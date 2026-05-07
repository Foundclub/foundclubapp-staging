import {
  useCallback, useEffect, useLayoutEffect, useMemo, useState,
} from 'react';
import {
  Alert, FlatList, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  deleteDraftLicenseCampaign,
  duplicateLicenseCampaign,
  sendBulkLicenseReminder,
  sendLicenseReminder,
  transitionLicenseCampaign,
  useCurrentLicenseCampaign,
  useLicenseAssignments,
  useLicenseCampaign,
  useLicenseCampaigns,
  useLicenseDashboard,
  useLicenseMutation,
  useLicensePaymentReviews,
} from '@/services/license/licenseQueries';

import {
  LicenseEmptyState,
  licenseRadius,
  LicenseSectionHeader,
  licenseSpacing,
  paymentModeLabels,
} from './licenseDesignSystem';
import MyLicense from './MyLicense';

const money = (value = 0, currency = 'EUR') => new Intl.NumberFormat('fr-FR', { currency, style: 'currency' }).format((value || 0) / 100);
const statusLabel = {
  manual_review: 'A valider', overdue: 'En retard', paid: 'Payee', partial: 'Partiel', pending: 'En attente', waived: 'Exemptee',
};
const campaignTypeLabel = {
  equipment: 'Equipement',
  internship: 'Stage',
  license: 'Licence',
  membership: 'Adhesion',
  other: 'Autre',
  tournament: 'Tournoi',
};
const roleDisplayLabel = {
  coach: 'Entraineur',
  dirigeant: 'Dirigeant',
  entraineur: 'Entraineur',
  joueur: 'Joueur',
  president: 'Dirigeant',
  superadmin: 'Super admin',
};
const statusTone = (Colors, status) => ({
  manual_review: Colors.warning500,
  overdue: Colors.error500,
  paid: Colors.success500,
  partial: Colors.primary200,
  pending: Colors.primary500,
  waived: Colors.neutral200,
}[status] || Colors.primary500);
const statusFilters = [
  { label: 'Tous', value: '' },
  { label: 'En attente', value: 'pending' },
  { label: 'Partiel', value: 'partial' },
  { label: 'En retard', value: 'overdue' },
  { label: 'A valider', value: 'manual_review' },
  { label: 'Payee', value: 'paid' },
  { label: 'Exemptee', value: 'waived' },
];
const campaignStatusLabel = {
  active: 'Active',
  archived: 'Archivee',
  closed: 'Terminee',
  draft: 'Brouillon',
  paused: 'En pause',
  scheduled: 'Programme',
};
const paymentOwnerLabel = {
  club: 'Club',
  platform: 'Plateforme',
  section: 'Section',
};
const documentStatusLabel = {
  missing: 'Document manquant',
  none: 'Aucun document',
  refused: 'Document refuse',
  submitted: 'Document depose',
  to_replace: 'Document a remplacer',
  validated: 'Document valide',
};
const installmentFrequencyLabel = {
  custom: 'Libre',
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  weekly: 'Hebdo',
};
const detailTabOptions = [
  { label: 'Vue d ensemble', value: 'overview' },
  { label: 'Membres', value: 'members' },
  { label: 'Paiements', value: 'payments' },
  { label: 'Documents', value: 'documents' },
  { label: 'Relances', value: 'reminders' },
];
const reminderEligibleStatuses = ['manual_review', 'overdue', 'partial', 'pending'];
const lifecycleForCampaign = (campaign) => {
  const status = campaign?.status;
  if (status === 'draft') return { action: 'launch', label: 'Ouvrir' };
  if (status === 'scheduled') return { action: 'pause', label: 'Mettre en pause' };
  if (status === 'active') return { action: 'pause', label: 'Mettre en pause' };
  if (status === 'paused') return { action: 'resume', label: 'Reprendre' };
  if (status === 'closed') return { action: 'archive', label: 'Archiver' };
  if (status === 'archived') return { action: 'reopen', label: 'Reouvrir' };
  return null;
};
const formatDateLabel = (value) => {
  const normalized = String(value || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return 'Non renseignee';
  return `${normalized.slice(8, 10)}/${normalized.slice(5, 7)}/${normalized.slice(0, 4)}`;
};
const nonEmptyText = (value) => String(value || '').trim();
const buildTargetSummary = (campaign) => {
  const config = campaign?.targetConfig || {};
  if (config.includeAllMembers) {
    return ['Tous les membres du club'];
  }

  const labels = [];
  if (Array.isArray(config.roles) && config.roles.length) labels.push(...config.roles.map((item) => String(item?.name || item?.label || item || '')));
  if (Array.isArray(config.teamIds) && config.teamIds.length) labels.push(`${config.teamIds.length} equipe(s)`);
  if (Array.isArray(config.categoryIds) && config.categoryIds.length) labels.push(`${config.categoryIds.length} categorie(s)`);
  if (Array.isArray(config.sectionIds) && config.sectionIds.length) labels.push(`${config.sectionIds.length} section(s)`);
  if (Array.isArray(config.levelIds) && config.levelIds.length) labels.push(`${config.levelIds.length} niveau(x)`);

  return labels.filter(Boolean);
};
const summarizePricingRule = (rule, currency = 'EUR') => {
  const parts = [];
  const label = nonEmptyText(rule?.label);
  if (label) parts.push(label);
  if (nonEmptyText(rule?.roleName)) parts.push(rule.roleName);
  if (nonEmptyText(rule?.team?.name)) parts.push(rule.team.name);
  if (nonEmptyText(rule?.category?.name)) parts.push(rule.category.name);
  if (nonEmptyText(rule?.section?.name)) parts.push(rule.section.name);
  if (nonEmptyText(rule?.level?.name)) parts.push(rule.level.name);

  const scopeLabel = parts[0] || 'Regle tarifaire';
  const amountLabel = rule?.isWaiver ? 'Exoneration' : money(rule?.amountCents || 0, currency);
  return `${scopeLabel} - ${amountLabel}`;
};
const summarizeDocumentRequest = (request) => {
  const parts = [nonEmptyText(request?.name) || 'Document'];
  if (request?.required !== false) parts.push('obligatoire');
  if (nonEmptyText(request?.dueDate)) parts.push(`avant le ${formatDateLabel(request.dueDate)}`);
  return parts.join(' - ');
};
const summarizeReminderStatuses = (statuses = []) => {
  const labels = statuses.map((status) => statusLabel[status] || campaignStatusLabel[status] || status).filter(Boolean);
  return labels.length ? labels.join(', ') : 'Aucun statut cible';
};
const sumPaymentReviewCents = (assignment = {}) => (assignment?.payments || [])
  .filter((payment) => payment?.status === 'manual_review')
  .reduce((sum, payment) => sum + (Number(payment?.amountCents) || 0), 0);
const sortByRemainingDescending = (left, right) => Number(right?.amountRemainingCents || 0) - Number(left?.amountRemainingCents || 0);
const sortByReminderPriority = (left, right) => {
  const leftStatusIndex = reminderEligibleStatuses.indexOf(left?.status);
  const rightStatusIndex = reminderEligibleStatuses.indexOf(right?.status);
  if (leftStatusIndex !== rightStatusIndex) {
    return leftStatusIndex - rightStatusIndex;
  }

  return sortByRemainingDescending(left, right);
};
const getAssignmentMemberName = (item) => [item?.user?.firstname, item?.user?.lastname].filter(Boolean).join(' ') || item?.user?.username || 'Membre';
const getAssignmentMemberAvatarUrl = (item) => item?.user?.avatar?.url || item?.user?.avatarUrl || item?.avatar?.url || item?.avatarUrl || '';
const canAssignmentBeReminded = (item) => reminderEligibleStatuses.includes(String(item?.status || '')) && Number(item?.amountRemainingCents || 0) > 0;
const normalizeFilterValue = (value) => String(value || '').trim();
const getAssignmentTeamId = (item) => normalizeFilterValue(item?.team?.documentId || item?.team?.id);
const getAssignmentRoleKey = (item) => normalizeFilterValue(item?.roleName || item?.user?.role?.name || item?.user?.role?.type).toLowerCase();
const getAssignmentCategoryValue = (item) => normalizeFilterValue(item?.team?.category?.documentId || item?.team?.category?.id || item?.categoryLabel || item?.team?.category?.name);
const getAssignmentSectionValue = (item) => normalizeFilterValue(item?.team?.section?.documentId || item?.team?.section?.id || item?.team?.section?.name);
const getAssignmentLevelValue = (item) => normalizeFilterValue(item?.team?.level?.documentId || item?.team?.level?.id || item?.team?.level?.name);

const collectFilterOptions = (items, mapItem) => {
  const seen = new Map();
  (items || []).forEach((item) => {
    const mapped = mapItem(item);
    const value = normalizeFilterValue(mapped?.value);
    const label = normalizeFilterValue(mapped?.label);
    if (!value || !label || seen.has(value)) return;
    seen.set(value, { label, value });
  });
  return [...seen.values()].sort((left, right) => left.label.localeCompare(right.label, 'fr', { sensitivity: 'base' }));
};

function CampaignDetailSection({
  children,
  description,
  title,
}) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  return (
    <View style={[ApplicationStyle.card, Spaces.gap[12], {
      backgroundColor: Colors.primary800,
      borderColor: `${Colors.primary500}44`,
      borderRadius: licenseRadius.card,
      paddingHorizontal: licenseSpacing.cardPadding,
      paddingVertical: licenseSpacing.cardPadding,
    }]}
    >
      <View style={Spaces.gap[4]}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{title}</Text>
        {description ? <Text style={[Fonts.p2, Fonts.neutral200]}>{description}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function DetailPill({ label }) {
  const { Colors, Fonts } = useTheme();
  return (
    <View style={{
      backgroundColor: Colors.primary800,
      borderColor: `${Colors.primary500}44`,
      borderRadius: licenseRadius.pill,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    }}
    >
      <Text style={[Fonts.p3Bold, Fonts.neutral200]}>{label}</Text>
    </View>
  );
}

function FilterTrigger({
  active,
  label,
  onPress,
  valueLabel,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        opacity: pressed ? 0.92 : 1,
      }]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8], {
        backgroundColor: active ? 'rgba(1, 179, 244, 0.16)' : Colors.primary700,
        borderColor: active ? Colors.primary500 : 'rgba(1, 179, 244, 0.28)',
        borderRadius: licenseRadius.pill,
        borderWidth: 1,
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }]}
      >
        <View style={{ flexShrink: 1 }}>
          <Text style={[Fonts.p4Bold, active ? Fonts.primary500 : Fonts.neutral200]}>{label}</Text>
        </View>
        {valueLabel ? (
          <Text numberOfLines={1} style={[Fonts.p4Bold, Fonts.neutral00, { flexShrink: 1, maxWidth: 132 }]}>
            {valueLabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.tone
 * @param root0.value
 */
function StatCard({ label, tone, value }) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  return (
    <View style={[ApplicationStyle.card, {
      backgroundColor: Colors.primary700, borderColor: `${tone || Colors.primary500}88`, borderRadius: licenseRadius.card, flex: 1, minHeight: 88, paddingHorizontal: licenseSpacing.cardPadding, paddingVertical: licenseSpacing.cardPadding,
    }]}
    >
      <Text style={[Fonts.p3, Fonts.neutral200]}>{label}</Text>
      <Text numberOfLines={1} style={[Fonts.h3, Spaces.marginTop[8], { color: tone || Colors.primary500 }]}>{value}</Text>
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.item
 * @param root0.onPress
 * @param {boolean} [root0.canRemind]
 * @param {boolean} [root0.isReminding]
 * @param {() => void} [root0.onRemind]
 */
function AssignmentCard({
  canRemind,
  isReminding,
  item,
  onPress,
  onRemind,
}) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const tone = statusTone(Colors, item?.status);
  const name = getAssignmentMemberName(item);
  const avatarUrl = getAssignmentMemberAvatarUrl(item);
  return (
    <View style={[ApplicationStyle.card, Spaces.marginBottom[12], {
      backgroundColor: Colors.primary700,
      borderColor: `${tone}88`,
      borderRadius: licenseRadius.hero,
      paddingHorizontal: licenseSpacing.cardPadding,
      paddingVertical: licenseSpacing.cardPadding,
    }]}
    >
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
        <View style={{
          alignItems: 'flex-start',
          flexDirection: 'row',
          gap: licenseSpacing.actionGap,
          justifyContent: 'space-between',
        }}
        >
          <View style={{ paddingTop: 2 }}>
            <ProfileAvatar enablePreview={false} imageUrl={avatarUrl} size={48} />
          </View>
          <View style={[Spaces.gap[4], { flex: 1 }]}>
            <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>{name}</Text>
            <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral200]}>{item?.team?.name || 'Sans equipe'}</Text>
          </View>
          <View style={[Spaces.gap[4], { alignItems: 'flex-end', maxWidth: 120 }]}>
            <Text numberOfLines={1} style={[Fonts.p2Bold, { color: tone }]}>{statusLabel[item?.status] || item?.status}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200, { textAlign: 'right' }]}>
              {money(item?.amountRemainingCents, item?.currency || 'EUR')}
              {' '}
              reste
            </Text>
          </View>
        </View>
      </Pressable>
      {canRemind && onRemind ? (
        <View style={[Spaces.marginTop[12], { alignItems: 'flex-end' }]}>
          <Button
            isLoading={isReminding}
            onPress={onRemind}
            size="sm"
            title="Relancer"
            variant="Secondary"
          />
        </View>
      ) : null}
    </View>
  );
}

function AssignmentSignalCard({
  helper,
  item,
  label,
  onPress,
}) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const tone = statusTone(Colors, item?.status);
  const name = getAssignmentMemberName(item);
  const avatarUrl = getAssignmentMemberAvatarUrl(item);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      <View style={[ApplicationStyle.card, Spaces.gap[8], {
        backgroundColor: Colors.primary700,
        borderColor: `${tone}66`,
        borderRadius: licenseRadius.card,
        borderWidth: 1,
        paddingHorizontal: licenseSpacing.cardPadding,
        paddingVertical: licenseSpacing.cardPadding,
      }]}
      >
        <View style={{
          alignItems: 'flex-start',
          flexDirection: 'row',
          gap: licenseSpacing.actionGap,
          justifyContent: 'space-between',
        }}
        >
          <View style={{ paddingTop: 2 }}>
            <ProfileAvatar enablePreview={false} imageUrl={avatarUrl} size={40} />
          </View>
          <View style={[Spaces.gap[4], { flex: 1 }]}>
            <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>{name}</Text>
            <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral200]}>{item?.team?.name || 'Sans equipe'}</Text>
          </View>
          <Text style={[Fonts.p3Bold, { color: tone }]}>{label}</Text>
        </View>
        {helper ? <Text style={[Fonts.p2, Fonts.neutral200]}>{helper}</Text> : null}
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>Ouvrir la fiche membre</Text>
      </View>
    </Pressable>
  );
}

/**
 *
 * @param root0
 * @param root0.item
 * @param root0.onDuplicate
 * @param root0.onLifecycle
 * @param root0.onPress
 */
function CampaignCard({
  isSelected = false,
  item,
  onDuplicate,
  onLifecycle,
  onPress,
}) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const totals = item?.totals || {};
  const lifecycle = lifecycleForCampaign(item);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View style={[ApplicationStyle.card, Spaces.gap[8], {
        backgroundColor: isSelected ? Colors.primary700 : Colors.primary800,
        borderColor: isSelected ? Colors.primary500 : `${Colors.primary500}55`,
        borderRadius: licenseRadius.card,
        borderWidth: isSelected ? 1.5 : 1,
        paddingHorizontal: licenseSpacing.cardPadding,
        paddingVertical: licenseSpacing.cardPadding,
      }]}
      >
        <View style={{
          alignItems: 'flex-start', flexDirection: 'row', gap: licenseSpacing.actionGap, justifyContent: 'space-between',
        }}
        >
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>{item?.name || 'Campagne'}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {item?.seasonLabel || '-'}
              {' '}
              -
              {' '}
              {campaignStatusLabel[item?.status] || item?.status}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {isSelected ? <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Suivi actuel</Text> : null}
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{money(totals.remainingCents || 0, item?.currency || 'EUR')}</Text>
          </View>
        </View>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {totals.total || 0}
          {' membres - '}
          {money(totals.expectedCents || 0, item?.currency || 'EUR')}
          {' attendus'}
        </Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {(item?.documentRequests || []).length}
          {' document(s) demande(s)'}
        </Text>
        <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
          <Button onPress={onDuplicate} style={{ flex: 1 }} title="Dupliquer" variant="Secondary" />
          {lifecycle ? <Button onPress={onLifecycle} style={{ flex: 1 }} title={lifecycle.label} variant="Secondary" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 *
 */
function LicenseSetupIntro() {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  return (
    <View style={Spaces.gap[24]}>
      <View style={[ApplicationStyle.card, Spaces.gap[12], {
        backgroundColor: Colors.primary700,
        borderColor: `${Colors.primary500}77`,
        borderRadius: licenseRadius.panel,
        paddingHorizontal: licenseSpacing.heroPadding,
        paddingVertical: licenseSpacing.heroPadding,
      }]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Avant de suivre les paiements</Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          Configure les regles de cotisation du club, puis publie la campagne.
          Les membres eligibles seront synchronises automatiquement des qu elle devient active.
        </Text>
      </View>

      <View style={Spaces.gap[licenseSpacing.listGap]}>
        <SetupStep
          description="Choisis la saison, le montant par defaut et les regles de relance."
          index="1"
          title="Definir la campagne"
        />
        <SetupStep
          description="Active les paiements acceptes: espece, cheque, virement, HelloAsso ou lien externe."
          index="2"
          title="Configurer les moyens de paiement"
        />
        <SetupStep
          description="La campagne s applique automatiquement aux membres qui correspondent aux criteres."
          index="3"
          title="Synchronisation auto des membres"
        />
      </View>
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.description
 * @param root0.index
 * @param root0.title
 */
function SetupStep({ description, index, title }) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  return (
    <View style={[ApplicationStyle.card, {
      backgroundColor: Colors.primary800,
      borderColor: `${Colors.primary500}55`,
      borderRadius: licenseRadius.card,
      paddingHorizontal: licenseSpacing.cardPadding,
      paddingVertical: licenseSpacing.cardPadding,
    }]}
    >
      <View style={{ alignItems: 'flex-start', flexDirection: 'row', gap: licenseSpacing.actionGap }}>
        <View style={{
          alignItems: 'center',
          backgroundColor: Colors.primary500,
          borderRadius: licenseRadius.card,
          height: 32,
          justifyContent: 'center',
          width: 32,
        }}
        >
          <Text style={[Fonts.p3Bold, Fonts.neutral900]}>{index}</Text>
        </View>
        <View style={[Spaces.gap[8], { flex: 1 }]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{title}</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>{description}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function ClubLicenses({ navigation, route }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const currentRouteName = route?.name;
  const [{ auth }] = useAppContext();
  const clubId = route?.params?.clubId;
  const routeCampaign = route?.params?.campaign;
  const routeCampaignId = route?.params?.campaignId;
  const roleKey = getUserRoleKey(auth?.user?.role?.type || auth?.user?.role?.name);
  const showMemberLicense = !['coach', 'president', 'superAdmin'].includes(roleKey);
  const managerViewEnabled = Boolean(clubId) && !showMemberLicense;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detailTab, setDetailTab] = useState('overview');
  const [setupFooterHeight, setSetupFooterHeight] = useState(0);
  const [pendingReminderAssignmentId, setPendingReminderAssignmentId] = useState(null);
  const [memberFilterMenuKey, setMemberFilterMenuKey] = useState(null);
  const [memberFilters, setMemberFilters] = useState({
    category: '',
    documentStatus: '',
    level: '',
    role: '',
    section: '',
    teamId: '',
  });
  const campaignQueryParams = useMemo(() => ({ clubId }), [clubId]);
  const campaignsQueryParams = useMemo(() => ({ clubId }), [clubId]);
  const campaignQuery = useCurrentLicenseCampaign(campaignQueryParams, { enabled: managerViewEnabled });
  const selectedCampaignQuery = useLicenseCampaign(routeCampaignId, { enabled: managerViewEnabled && Boolean(routeCampaignId) });
  const campaignsQuery = useLicenseCampaigns(campaignsQueryParams, { enabled: managerViewEnabled });
  const campaigns = useMemo(() => campaignsQuery.data?.data || [], [campaignsQuery.data]);
  const fallbackCampaign = useMemo(() => (
    campaigns.find((item) => item?.status === 'active')
    || campaigns.find((item) => item?.status === 'paused')
    || campaigns.find((item) => item?.status === 'scheduled')
    || campaigns.find((item) => item?.status === 'draft')
    || campaigns[0]
    || null
  ), [campaigns]);
  const defaultCampaign = campaignQuery.data || fallbackCampaign || null;
  const campaign = useMemo(() => {
    if (!routeCampaignId) {
      return null;
    }

    return selectedCampaignQuery.data
      || routeCampaign
      || campaigns.find((item) => String(item?.documentId || item?.id) === String(routeCampaignId))
      || null;
  }, [campaigns, routeCampaign, routeCampaignId, selectedCampaignQuery.data]);
  const campaignId = campaign?.documentId || campaign?.id || null;
  const editorCampaignId = campaignId || defaultCampaign?.documentId || defaultCampaign?.id || null;
  const isFocusedCampaignView = Boolean(campaignId);
  const dashboardQuery = useLicenseDashboard(campaignId, { enabled: managerViewEnabled && Boolean(campaignId) });
  const isMembersTab = isFocusedCampaignView && detailTab === 'members';
  const assignmentQueryParams = useMemo(() => ({
    pageSize: 100,
    q: isMembersTab ? search : undefined,
  }), [isMembersTab, search]);
  const assignmentsQuery = useLicenseAssignments(campaignId, assignmentQueryParams, { enabled: managerViewEnabled && Boolean(campaignId) });
  const paymentReviewsQuery = useLicensePaymentReviews(campaignId, { pageSize: 20 }, { enabled: managerViewEnabled && Boolean(campaignId) && isFocusedCampaignView && detailTab === 'payments' });
  const reminderMutation = useLicenseMutation((payload) => sendBulkLicenseReminder(campaignId, payload), campaignId);
  const singleReminderMutation = useLicenseMutation(({ assignmentId, ...payload }) => sendLicenseReminder(assignmentId, payload), campaignId);
  const duplicateMutation = useLicenseMutation(({ id, payload }) => duplicateLicenseCampaign(id, payload), campaignId);
  const transitionMutation = useLicenseMutation(({ action, id }) => transitionLicenseCampaign(id, action), campaignId);
  const deleteMutation = useLicenseMutation((id) => deleteDraftLicenseCampaign(id), campaignId);

  const overviewTotals = useMemo(() => campaigns.reduce((accumulator, item) => {
    const itemTotals = item?.totals || {};
    return {
      expectedCents: accumulator.expectedCents + (itemTotals.expectedCents || 0),
      manualReviewCount: accumulator.manualReviewCount + (itemTotals.manualReviewCount || 0),
      overdueCount: accumulator.overdueCount + (itemTotals.overdueCount || 0),
      paidCents: accumulator.paidCents + (itemTotals.paidCents || 0),
      remainingCents: accumulator.remainingCents + (itemTotals.remainingCents || 0),
    };
  }, {
    expectedCents: 0,
    manualReviewCount: 0,
    overdueCount: 0,
    paidCents: 0,
    remainingCents: 0,
  }), [campaigns]);
  const totals = isFocusedCampaignView ? (dashboardQuery.data?.totals || {}) : overviewTotals;
  const scope = dashboardQuery.data?.scope;
  const canManageLicenses = roleKey !== 'coach' && scope !== 'coach';
  const assignments = useMemo(
    () => (isFocusedCampaignView ? (assignmentsQuery.data?.data || []) : []),
    [assignmentsQuery.data?.data, isFocusedCampaignView],
  );
  const memberTeamOptions = useMemo(() => collectFilterOptions(assignments, (item) => ({
    label: normalizeFilterValue(item?.team?.name),
    value: getAssignmentTeamId(item),
  })), [assignments]);
  const memberRoleOptions = useMemo(() => collectFilterOptions(assignments, (item) => {
    const memberRoleKey = getAssignmentRoleKey(item);
    return {
      label: roleDisplayLabel[memberRoleKey] || memberRoleKey,
      value: memberRoleKey,
    };
  }), [assignments]);
  const memberCategoryOptions = useMemo(() => collectFilterOptions(assignments, (item) => ({
    label: normalizeFilterValue(item?.team?.category?.name || item?.categoryLabel),
    value: getAssignmentCategoryValue(item),
  })), [assignments]);
  const memberSectionOptions = useMemo(() => collectFilterOptions(assignments, (item) => ({
    label: normalizeFilterValue(item?.team?.section?.name),
    value: getAssignmentSectionValue(item),
  })), [assignments]);
  const memberLevelOptions = useMemo(() => collectFilterOptions(assignments, (item) => ({
    label: normalizeFilterValue(item?.team?.level?.name),
    value: getAssignmentLevelValue(item),
  })), [assignments]);
  const memberDocumentOptions = useMemo(() => collectFilterOptions(assignments, (item) => {
    const status = normalizeFilterValue(item?.documentStatus || 'none');
    return {
      label: documentStatusLabel[status] || status,
      value: status,
    };
  }), [assignments]);
  const assignmentsTotalCount = assignmentsQuery.data?.meta?.pagination?.total || assignments.length;
  const visibleAssignments = useMemo(() => assignments.filter((item) => {
    if (statusFilter && String(item?.status || '') !== statusFilter) return false;
    if (memberFilters.teamId && getAssignmentTeamId(item) !== memberFilters.teamId) return false;
    if (memberFilters.role && getAssignmentRoleKey(item) !== memberFilters.role) return false;
    if (memberFilters.category && getAssignmentCategoryValue(item) !== memberFilters.category) return false;
    if (memberFilters.section && getAssignmentSectionValue(item) !== memberFilters.section) return false;
    if (memberFilters.level && getAssignmentLevelValue(item) !== memberFilters.level) return false;
    if (memberFilters.documentStatus && normalizeFilterValue(item?.documentStatus || 'none') !== memberFilters.documentStatus) return false;
    return true;
  }), [assignments, memberFilters, statusFilter]);
  const paymentReviewAssignments = useMemo(
    () => paymentReviewsQuery.data?.data || [],
    [paymentReviewsQuery.data?.data],
  );
  const overdueAssignments = useMemo(
    () => [...assignments]
      .filter((item) => item?.status === 'overdue')
      .sort(sortByRemainingDescending)
      .slice(0, 5),
    [assignments],
  );
  const documentReviewAssignments = useMemo(
    () => [...assignments]
      .filter((item) => ['refused', 'submitted', 'to_replace'].includes(String(item?.documentStatus || '')))
      .sort((left, right) => String(left?.documentStatus || '').localeCompare(String(right?.documentStatus || '')))
      .slice(0, 5),
    [assignments],
  );
  const missingDocumentAssignments = useMemo(
    () => [...assignments]
      .filter((item) => item?.documentStatus === 'missing')
      .sort(sortByRemainingDescending)
      .slice(0, 5),
    [assignments],
  );
  const remindableAssignments = useMemo(
    () => [...assignments]
      .filter((item) => reminderEligibleStatuses.includes(String(item?.status || '')) && Number(item?.amountRemainingCents || 0) > 0)
      .sort(sortByReminderPriority)
      .slice(0, 5),
    [assignments],
  );
  const targetSummary = useMemo(() => buildTargetSummary(campaign), [campaign]);
  const syncScopeLabel = useMemo(() => {
    if (campaign?.targetConfig?.includeAllMembers) return 'Tout le club';
    if (!targetSummary.length) return 'Ciblage personnalise';
    if (targetSummary.length === 1) return targetSummary[0];
    return `${targetSummary[0]} +${targetSummary.length - 1}`;
  }, [campaign?.targetConfig?.includeAllMembers, targetSummary]);
  const lastSyncLabel = useMemo(() => {
    const sourceDate = campaign?.updatedAt || campaign?.launchedAt || campaign?.createdAt;
    return sourceDate ? formatDateLabel(sourceDate) : 'Non disponible';
  }, [campaign?.createdAt, campaign?.launchedAt, campaign?.updatedAt]);
  const enabledPaymentModes = useMemo(() => Object.entries(campaign?.paymentModes || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([mode]) => paymentModeLabels[mode] || mode), [campaign?.paymentModes]);
  const documentRequestSummaries = useMemo(() => (campaign?.documentRequests || []).map((item) => summarizeDocumentRequest(item)), [campaign?.documentRequests]);
  const pricingRuleSummaries = useMemo(() => (campaign?.pricingRules || []).map((item) => summarizePricingRule(item, campaign?.currency || 'EUR')), [campaign?.currency, campaign?.pricingRules]);
  const reminderAutomation = campaign?.reminderAutomation || {};
  const reminderTimingSummary = useMemo(() => {
    if (!campaign) return [];
    const summary = [];
    if (reminderAutomation.enabled === false) {
      summary.push('Relances auto desactivees');
      return summary;
    }
    if (campaign?.dueDate) summary.push(`Echeance principale: ${formatDateLabel(campaign.dueDate)}`);
    if (reminderAutomation.beforeDueDays !== undefined && reminderAutomation.beforeDueDays !== null) summary.push(`${reminderAutomation.beforeDueDays} j avant echeance`);
    if (reminderAutomation.onDueDate) summary.push('Le jour de l echeance');
    if (reminderAutomation.afterDueDays !== undefined && reminderAutomation.afterDueDays !== null) summary.push(`${reminderAutomation.afterDueDays} j apres echeance`);
    if (reminderAutomation.frequencyDays) summary.push(`Toutes les ${reminderAutomation.frequencyDays} j`);
    if (reminderAutomation.maxCount) summary.push(`${reminderAutomation.maxCount} relance(s) max`);
    return summary;
  }, [campaign, reminderAutomation.afterDueDays, reminderAutomation.beforeDueDays, reminderAutomation.enabled, reminderAutomation.frequencyDays, reminderAutomation.maxCount, reminderAutomation.onDueDate]);
  const installmentSummary = useMemo(() => {
    if (!campaign?.allowInstallments) return 'Paiement en une fois';
    const count = Number(campaign?.installmentCount || campaign?.installmentSchedule?.length || 1);
    const frequency = installmentFrequencyLabel[campaign?.installmentFrequency] || campaign?.installmentFrequency || 'Libre';
    return `${count} echeance(s) - ${frequency}`;
  }, [campaign?.allowInstallments, campaign?.installmentCount, campaign?.installmentFrequency, campaign?.installmentSchedule]);
  const campaignDescription = nonEmptyText(campaign?.description);
  const campaignInternalNote = nonEmptyText(campaign?.internalNote);
  const shouldShowCampaignSwitcher = !isFocusedCampaignView || detailTab === 'overview';
  const shouldShowCampaignManagementActions = !isFocusedCampaignView || detailTab === 'overview';
  const documentStatusSummary = useMemo(() => assignments.reduce((accumulator, item) => {
    const key = String(item?.documentStatus || 'none');
    return {
      ...accumulator,
      [key]: (accumulator[key] || 0) + 1,
    };
  }, {}), [assignments]);
  const reminderSummary = useMemo(() => assignments.reduce((accumulator, item) => {
    const nextCount = accumulator.totalCount + Number(item?.reminderCount || 0);
    const nextMembers = accumulator.memberCount + (Number(item?.reminderCount || 0) > 0 ? 1 : 0);
    const nextLastReminderAt = [accumulator.lastReminderAt, item?.lastReminderAt]
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || '';
    return {
      lastReminderAt: nextLastReminderAt,
      memberCount: nextMembers,
      totalCount: nextCount,
    };
  }, {
    lastReminderAt: '',
    memberCount: 0,
    totalCount: 0,
  }), [assignments]);
  const isLoading = campaignQuery.isLoading
    || campaignsQuery.isLoading
    || (Boolean(routeCampaignId) && selectedCampaignQuery.isLoading)
    || (Boolean(campaignId) && dashboardQuery.isLoading);
  const hasError = campaignQuery.isError
    || campaignsQuery.isError
    || (Boolean(routeCampaignId) && selectedCampaignQuery.isError)
    || dashboardQuery.isError
    || assignmentsQuery.isError;
  const shouldShowSetup = !defaultCampaign && campaigns.length === 0;
  const memberFilterDefinitions = useMemo(() => ([
    { key: 'teamId', label: 'Equipe', options: memberTeamOptions },
    { key: 'role', label: 'Role', options: memberRoleOptions },
    { key: 'category', label: 'Categorie', options: memberCategoryOptions },
    { key: 'section', label: 'Section', options: memberSectionOptions },
    { key: 'level', label: 'Niveau', options: memberLevelOptions },
    { key: 'documentStatus', label: 'Documents', options: memberDocumentOptions },
  ]), [memberCategoryOptions, memberDocumentOptions, memberLevelOptions, memberRoleOptions, memberSectionOptions, memberTeamOptions]);
  const visibleMemberFilterDefinitions = useMemo(
    () => memberFilterDefinitions.filter((definition) => definition.options.length > 0 || memberFilters[definition.key]),
    [memberFilterDefinitions, memberFilters],
  );
  const activeMemberFilterCount = useMemo(
    () => Object.values(memberFilters).filter(Boolean).length,
    [memberFilters],
  );
  const activeMemberFilterPills = useMemo(
    () => memberFilterDefinitions
      .map((definition) => {
        const selectedValue = memberFilters[definition.key];
        if (!selectedValue) return null;
        const selectedOption = definition.options.find((option) => option.value === selectedValue);
        return selectedOption ? `${definition.label}: ${selectedOption.label}` : null;
      })
      .filter(Boolean),
    [memberFilterDefinitions, memberFilters],
  );
  const memberListSummary = useMemo(() => {
    if (assignmentsQuery.isLoading) return '';
    if (activeMemberFilterCount || statusFilter) {
      return `${visibleAssignments.length} membre(s) affiche(s)${assignmentsTotalCount > assignments.length ? ` - apercu sur ${assignments.length}/${assignmentsTotalCount}` : ''}.`;
    }
    if (assignmentsTotalCount > assignments.length) {
      return `Apercu sur ${assignments.length} membre(s) sur ${assignmentsTotalCount}. Affine avec la recherche ou les filtres.`;
    }
    return `${visibleAssignments.length} membre(s) dans cette vue.`;
  }, [
    activeMemberFilterCount,
    assignments.length,
    assignmentsQuery.isLoading,
    assignmentsTotalCount,
    statusFilter,
    visibleAssignments.length,
  ]);

  useEffect(() => {
    setDetailTab('overview');
    setSearch('');
    setStatusFilter('');
    setMemberFilterMenuKey(null);
    setMemberFilters({
      category: '',
      documentStatus: '',
      level: '',
      role: '',
      section: '',
      teamId: '',
    });
  }, [campaignId]);

  useLayoutEffect(() => {
    if (currentRouteName !== RouteNames.ClubLicenseCampaignDetail) return;
    navigation.setOptions({
      headerTitle: campaign?.name || 'Campagne cotisation',
    });
  }, [campaign?.name, currentRouteName, navigation]);

  const handleOpenCampaignDashboard = useCallback((selectedCampaign) => {
    const selectedCampaignId = selectedCampaign?.documentId || selectedCampaign?.id;
    if (!selectedCampaignId) {
      return;
    }

    setSearch('');
    setStatusFilter('');
    const params = {
      campaign: selectedCampaign,
      campaignId: selectedCampaignId,
      clubId,
    };

    if (isFocusedCampaignView) {
      if (String(selectedCampaignId) === String(campaignId)) return;
      navigation.replace(RouteNames.ClubLicenseCampaignDetail, params);
      return;
    }

    navigation.push(RouteNames.ClubLicenseCampaignDetail, params);
  }, [campaignId, clubId, isFocusedCampaignView, navigation]);

  const handleReturnToCampaignOverview = useCallback(() => {
    setSearch('');
    setStatusFilter('');
    if (currentRouteName === RouteNames.ClubLicenseCampaignDetail && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace(RouteNames.ClubLicenses, { clubId });
  }, [clubId, currentRouteName, navigation]);

  const handleSetupContinue = useCallback(() => {
    navigation.navigate(RouteNames.ClubLicenseCampaignSettings, { clubId });
  }, [clubId, navigation]);

  const handleSetupFooterLayout = useCallback((event) => {
    const nextHeight = Math.ceil(event?.nativeEvent?.layout?.height || 0);
    setSetupFooterHeight((previousHeight) => (
      previousHeight === nextHeight ? previousHeight : nextHeight
    ));
  }, []);

  const handleBulkReminder = useCallback(() => {
    Alert.alert('Relancer les non-payeurs', 'Envoyer une relance aux cotisations en attente, partielles ou en retard ?', [
      { style: 'cancel', text: 'Annuler' },
      { onPress: () => reminderMutation.mutate({ statuses: ['pending', 'partial', 'overdue'] }), text: 'Relancer' },
    ]);
  }, [reminderMutation]);

  const updateMemberFilter = useCallback((key, value) => {
    setMemberFilters((current) => ({
      ...current,
      [key]: normalizeFilterValue(value),
    }));
  }, []);

  const clearMemberFilters = useCallback(() => {
    setMemberFilters({
      category: '',
      documentStatus: '',
      level: '',
      role: '',
      section: '',
      teamId: '',
    });
  }, []);

  const handleSingleReminder = useCallback((item) => {
    const assignmentId = item?.documentId || item?.id;
    if (!assignmentId) return;

    if (!canManageLicenses) {
      Alert.alert('Action reservee', 'Seuls les dirigeants peuvent envoyer une relance individuelle.');
      return;
    }

    const memberName = getAssignmentMemberName(item);
    Alert.alert(
      'Relancer ce membre',
      `Envoyer une relance individuelle a ${memberName} ?`,
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => {
            setPendingReminderAssignmentId(String(assignmentId));
            singleReminderMutation.mutate(
              { assignmentId },
              {
                onError: (error) => {
                  const message = typeof error === 'string'
                    ? error
                    : error?.message || 'La relance n a pas pu etre envoyee.';
                  Alert.alert('Relance impossible', message);
                },
                onSettled: () => setPendingReminderAssignmentId(null),
                onSuccess: () => Alert.alert('Relance envoyee', `${memberName} a bien ete relance.`),
              },
            );
          },
          text: 'Relancer',
        },
      ],
    );
  }, [canManageLicenses, singleReminderMutation]);

  const handleDuplicateCampaign = useCallback((item) => {
    const nextSeason = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    Alert.alert('Dupliquer la campagne', 'Creer une copie en brouillon avec les memes reglages ?', [
      { style: 'cancel', text: 'Annuler' },
      {
        onPress: () => duplicateMutation.mutate({
          id: item.documentId || item.id,
          payload: { name: `${item.name || 'Campagne'} - copie`, seasonLabel: nextSeason },
        }),
        text: 'Dupliquer',
      },
    ]);
  }, [duplicateMutation]);

  const handleLifecycleCampaign = useCallback((item, forcedAction = null) => {
    const lifecycle = forcedAction ? { action: forcedAction, label: forcedAction } : lifecycleForCampaign(item);
    if (!lifecycle) return;
    const copyByAction = {
      archive: {
        confirm: 'Archiver',
        description: 'La campagne restera consultable dans les archives.',
        title: 'Archiver la campagne',
      },
      close: {
        confirm: 'Clore',
        description: 'Les relances et les paiements resteront visibles, mais la campagne passe en fin de cycle.',
        title: 'Clore la campagne',
      },
      launch: {
        confirm: 'Ouvrir',
        description: 'La campagne devient active et synchronise automatiquement les membres concernes.',
        title: 'Ouvrir la campagne',
      },
      pause: {
        confirm: 'Mettre en pause',
        description: 'La campagne reste visible, mais bloque les ajouts auto, les relances et les paiements membres.',
        title: 'Mettre la campagne en pause',
      },
      reopen: {
        confirm: 'Reouvrir',
        description: 'La campagne redevient active et resynchronise les membres concernes.',
        title: 'Reouvrir la campagne',
      },
      resume: {
        confirm: 'Reprendre',
        description: 'La campagne redevient active et resynchronise automatiquement les membres eligibles.',
        title: 'Reprendre la campagne',
      },
    };
    const copy = copyByAction[lifecycle.action];
    Alert.alert(copy.title, copy.description, [
      { style: 'cancel', text: 'Annuler' },
      {
        onPress: () => transitionMutation.mutate({ action: lifecycle.action, id: item.documentId || item.id }),
        text: copy.confirm,
      },
    ]);
  }, [transitionMutation]);

  const handleDeleteDraft = useCallback((item) => {
    Alert.alert('Supprimer le brouillon', 'Supprimer definitivement cette campagne non lancee ?', [
      { style: 'cancel', text: 'Annuler' },
      { onPress: () => deleteMutation.mutate(item.documentId || item.id), style: 'destructive', text: 'Supprimer' },
    ]);
  }, [deleteMutation]);

  const retryData = useCallback(() => {
    campaignQuery.refetch();
    campaignsQuery.refetch();
    if (campaignId) {
      dashboardQuery.refetch();
      assignmentsQuery.refetch();
      paymentReviewsQuery.refetch();
    }
  }, [assignmentsQuery, campaignId, campaignQuery, campaignsQuery, dashboardQuery, paymentReviewsQuery]);

  const openAssignmentDetail = useCallback((item) => {
    navigation.navigate(RouteNames.ClubLicenseMemberDetail, {
      assignmentId: item?.documentId || item?.id,
      campaignId,
      canManageLicenses,
      scope,
    });
  }, [campaignId, canManageLicenses, navigation, scope]);

  if (showMemberLicense) {
    return <MyLicense navigation={navigation} route={route} />;
  }

  const renderTopHeader = () => (
    <View>
      <Text style={[Fonts.h2, Fonts.neutral00]}>Cotisations</Text>
      <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[8]]}>
        {isFocusedCampaignView
          ? `Detail complet de la campagne ${campaign?.name || 'selectionnee'}.`
          : 'Suivi des paiements, relances et echeanciers du club.'}
      </Text>
    </View>
  );

  const renderDashboardHeader = () => (
    <View style={Spaces.gap[licenseSpacing.sectionGap]}>
      <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
        <StatCard label="Attendu" tone={Colors.primary500} value={money(totals.expectedCents, campaign?.currency || 'EUR')} />
        <StatCard label="Encaisse" tone={Colors.success500} value={money(totals.paidCents, campaign?.currency || 'EUR')} />
      </View>
      <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
        <StatCard label="Reste" tone={Colors.warning500} value={money(totals.remainingCents, campaign?.currency || 'EUR')} />
        <StatCard label="Retards" tone={Colors.error500} value={String(totals.overdueCount || 0)} />
      </View>
      {isFocusedCampaignView ? (
        <View style={[Spaces.gap[12], {
          backgroundColor: Colors.primary800,
          borderColor: `${Colors.primary500}55`,
          borderRadius: licenseRadius.card,
          borderWidth: 1,
          paddingHorizontal: licenseSpacing.cardPadding,
          paddingVertical: licenseSpacing.cardPadding,
        }]}
        >
          <View style={Spaces.gap[4]}>
            <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>Suivi de campagne</Text>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{campaign?.name || 'Campagne'}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {campaign?.seasonLabel || '-'}
              {' '}
              -
              {' '}
              {campaignStatusLabel[campaign?.status] || campaign?.status}
            </Text>
          </View>
          <Button onPress={handleReturnToCampaignOverview} title="Voir toutes les campagnes" variant="Secondary" />
        </View>
      ) : (
        <View style={[Spaces.gap[8], {
          backgroundColor: Colors.primary800,
          borderColor: `${Colors.primary500}44`,
          borderRadius: licenseRadius.card,
          borderWidth: 1,
          paddingHorizontal: licenseSpacing.cardPadding,
          paddingVertical: licenseSpacing.cardPadding,
        }]}
        >
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Vue d ensemble des campagnes</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Ouvre une campagne pour suivre ses membres, ses relances et ses paiements en detail.
          </Text>
        </View>
      )}
      {isFocusedCampaignView ? (
        <View style={{ marginTop: -4 }}>
          <SegmentedControl
            onChange={setDetailTab}
            options={detailTabOptions}
            value={detailTab}
          />
        </View>
      ) : null}
      {isFocusedCampaignView && campaign ? (
        <View style={Spaces.gap[licenseSpacing.listGap]}>
          {detailTab === 'overview' ? (
            <>
              <CampaignDetailSection
                description="Retrouve ici l identite, la periode et le positionnement de la campagne selectionnee."
                title="Informations de campagne"
              >
                <View style={Spaces.gap[12]}>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>{campaignDescription || 'Aucune description visible pour les membres.'}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <DetailPill label={`Type: ${campaignTypeLabel[campaign?.type] || campaign?.type || 'Licence'}`} />
                    <DetailPill label={`Saison: ${campaign?.seasonLabel || 'Non renseignee'}`} />
                    <DetailPill label={`Du ${formatDateLabel(campaign?.startDate)} au ${formatDateLabel(campaign?.endDate)}`} />
                    <DetailPill label={`Statut: ${campaignStatusLabel[campaign?.status] || campaign?.status || 'Inconnu'}`} />
                  </View>
                  {campaignInternalNote ? (
                    <View style={[Spaces.gap[4], {
                      backgroundColor: `${Colors.neutral900}55`,
                      borderColor: `${Colors.primary500}33`,
                      borderRadius: licenseRadius.card,
                      borderWidth: 1,
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                    }]}
                    >
                      <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Note interne</Text>
                      <Text style={[Fonts.p2, Fonts.neutral200]}>{campaignInternalNote}</Text>
                    </View>
                  ) : null}
                </View>
              </CampaignDetailSection>

              <CampaignDetailSection
                description="Montant de reference, ciblage des membres et regles tarifaires associees."
                title="Tarification et public"
              >
                <View style={Spaces.gap[12]}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <DetailPill label={`Montant par defaut: ${money(campaign?.defaultAmountCents || 0, campaign?.currency || 'EUR')}`} />
                    <DetailPill label={`Devise: ${campaign?.currency || 'EUR'}`} />
                    {campaign?.dueDate ? <DetailPill label={`Echeance: ${formatDateLabel(campaign.dueDate)}`} /> : null}
                  </View>
                  <View style={Spaces.gap[8]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Public concerne</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {(targetSummary.length ? targetSummary : ['Aucun filtre defini']).map((item) => (
                        <DetailPill key={item} label={item} />
                      ))}
                    </View>
                  </View>
                  <View style={Spaces.gap[8]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Regles tarifaires</Text>
                    {pricingRuleSummaries.length ? pricingRuleSummaries.slice(0, 4).map((item) => (
                      <Text key={item} style={[Fonts.p2, Fonts.neutral200]}>{`\u2022 ${item}`}</Text>
                    )) : <Text style={[Fonts.p2, Fonts.neutral200]}>Aucune regle tarifaire speciale.</Text>}
                    {pricingRuleSummaries.length > 4 ? <Text style={[Fonts.p3, Fonts.neutral200]}>{`+ ${pricingRuleSummaries.length - 4} autre(s) regle(s)`}</Text> : null}
                  </View>
                </View>
              </CampaignDetailSection>

              <CampaignDetailSection
                description="Moyens de paiement autorises, gestion du paiement en ligne et organisation des echeances."
                title="Paiements et echeancier"
              >
                <View style={Spaces.gap[12]}>
                  <View style={Spaces.gap[8]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Moyens de paiement</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {(enabledPaymentModes.length ? enabledPaymentModes : ['Aucun moyen active']).map((item) => (
                        <DetailPill key={item} label={item} />
                      ))}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <DetailPill label={installmentSummary} />
                    <DetailPill label={`Paiement en ligne ${campaign?.onlinePaymentRequired ? 'obligatoire' : 'optionnel'}`} />
                    <DetailPill label={`Encaissement: ${paymentOwnerLabel[campaign?.paymentOwner] || campaign?.paymentOwner || 'Section'}`} />
                  </View>
                  {nonEmptyText(campaign?.externalPaymentUrl) ? (
                    <Text numberOfLines={2} style={[Fonts.p2, Fonts.neutral200]}>{`Lien de paiement: ${campaign.externalPaymentUrl}`}</Text>
                  ) : null}
                </View>
              </CampaignDetailSection>

              <View style={Spaces.gap[licenseSpacing.actionGap]}>
                <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                  <Button
                    onPress={() => navigation.navigate(RouteNames.ClubLicenseCampaignSettings, { campaignId, clubId })}
                    style={{ flex: 1 }}
                    title="Parametres"
                    variant="Secondary"
                  />
                  <Button
                    onPress={() => navigation.navigate(RouteNames.ClubLicensePayments, {
                      campaignId, canManageLicenses, clubId, scope,
                    })}
                    style={{ flex: 1 }}
                    title={`Paiements a valider (${totals.manualReviewCount || 0})`}
                    variant="Secondary"
                  />
                </View>
                {lifecycleForCampaign(campaign) ? (
                  <Button
                    onPress={() => handleLifecycleCampaign(campaign)}
                    title={lifecycleForCampaign(campaign)?.label}
                    variant="Secondary"
                  />
                ) : null}
                {['active', 'paused'].includes(campaign?.status) ? (
                  <Button
                    onPress={() => handleLifecycleCampaign(campaign, 'close')}
                    title="Clore la campagne"
                    variant="Secondary"
                  />
                ) : null}
              </View>
            </>
          ) : null}

          {detailTab === 'members' ? (
            <View style={Spaces.gap[licenseSpacing.fieldGap]}>
              <View style={[Spaces.gap[licenseSpacing.actionGap], { flexDirection: 'row' }]}>
                <Button
                  onPress={() => navigation.navigate(RouteNames.ClubLicenseCampaignSettings, { campaignId, clubId })}
                  style={{ flex: 1 }}
                  textStyle={{ textAlign: 'center' }}
                  title="Parametres"
                  variant="Secondary"
                />
                {lifecycleForCampaign(campaign) ? (
                  <Button
                    onPress={() => handleLifecycleCampaign(campaign)}
                    style={{ flex: 1 }}
                    textStyle={{ textAlign: 'center' }}
                    title={lifecycleForCampaign(campaign)?.label}
                    variant="Secondary"
                  />
                ) : null}
              </View>

              <LicenseSectionHeader
                description="Recherche, filtre et pilote directement les cotisations synchronisees avec cette campagne."
                title="Membres"
              />

              <View style={Spaces.gap[licenseSpacing.actionGap]}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <DetailPill label={`Cible: ${syncScopeLabel}`} />
                  <DetailPill label={`Cotisations actives: ${assignmentsTotalCount}`} />
                  <DetailPill label={`Derniere sync: ${lastSyncLabel}`} />
                </View>
                <TextInput
                  onChangeText={setSearch}
                  placeholder="Rechercher un membre"
                  placeholderTextColor={Colors.neutral400}
                  style={{
                    borderBottomColor: Colors.neutral200, borderBottomWidth: 1, color: Colors.neutral00, paddingVertical: 12,
                  }}
                  value={search}
                />
                <ScrollView
                  contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  <FilterTrigger
                    active={Boolean(activeMemberFilterCount)}
                    label={activeMemberFilterCount ? `Filtres (${activeMemberFilterCount})` : 'Filtres'}
                    onPress={() => setMemberFilterMenuKey('filters')}
                  />
                  {statusFilters.map((filter) => {
                    const selected = statusFilter === filter.value;
                    return (
                      <Pressable
                        key={filter.value || 'all'}
                        onPress={() => setStatusFilter(filter.value)}
                        style={{
                          backgroundColor: selected ? Colors.primary500 : Colors.primary800,
                          borderColor: selected ? Colors.primary500 : `${Colors.primary500}55`,
                          borderRadius: licenseRadius.pill,
                          borderWidth: 1,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={[Fonts.p3Bold, selected ? Fonts.neutral900 : Fonts.neutral200]}>{filter.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {visibleMemberFilterDefinitions.length && activeMemberFilterPills.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {activeMemberFilterPills.map((pill) => (
                      <DetailPill key={pill} label={pill} />
                    ))}
                    <Pressable
                      onPress={clearMemberFilters}
                      style={{
                        backgroundColor: Colors.primary800,
                        borderColor: `${Colors.primary500}44`,
                        borderRadius: licenseRadius.pill,
                        borderWidth: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={[Fonts.p3Bold, Fonts.primary500]}>Reinitialiser</Text>
                    </Pressable>
                  </View>
                ) : null}
                {assignmentsQuery.isLoading ? (
                  <Text style={[Fonts.p2, Fonts.neutral200]}>Chargement des membres...</Text>
                ) : null}
                {!assignmentsQuery.isLoading && memberListSummary ? <Text style={[Fonts.p3, Fonts.neutral200]}>{memberListSummary}</Text> : null}
              </View>
            </View>
          ) : null}

          {detailTab === 'payments' ? (
            <>
              <CampaignDetailSection
                description="Pilote les encaissements et les dossiers a valider pour cette campagne."
                title="Pilotage des paiements"
              >
                <View style={Spaces.gap[12]}>
                  <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                    <StatCard label="A valider" tone={Colors.warning500} value={String(totals.manualReviewCount || 0)} />
                    <StatCard label="Payees" tone={Colors.success500} value={money(totals.paidCents || 0, campaign?.currency || 'EUR')} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                    <Button
                      onPress={() => navigation.navigate(RouteNames.ClubLicensePayments, {
                        campaignId, canManageLicenses, clubId, scope,
                      })}
                      style={{ flex: 1 }}
                      title="Ouvrir les validations"
                    />
                    <Button
                      onPress={() => navigation.navigate(RouteNames.ClubLicenseCampaignSettings, { campaignId, clubId })}
                      style={{ flex: 1 }}
                      title="Regler les paiements"
                      variant="Secondary"
                    />
                  </View>
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description="Declarations externes qui attendent une validation dirigeant."
                title="Paiements a valider maintenant"
              >
                <View style={Spaces.gap[12]}>
                  {paymentReviewsQuery.isLoading ? <Text style={[Fonts.p2, Fonts.neutral200]}>Chargement des validations...</Text> : null}
                  {!paymentReviewsQuery.isLoading && paymentReviewAssignments.length ? paymentReviewAssignments.slice(0, 5).map((item) => (
                    <AssignmentSignalCard
                      helper={`${(item?.payments || []).filter((payment) => payment?.status === 'manual_review').length} declaration(s) - ${money(sumPaymentReviewCents(item), item?.currency || campaign?.currency || 'EUR')}`}
                      item={item}
                      key={item?.documentId || item?.id}
                      label="A valider"
                      onPress={() => openAssignmentDetail(item)}
                    />
                  )) : null}
                  {!paymentReviewsQuery.isLoading && !paymentReviewAssignments.length ? (
                    <Text style={[Fonts.p2, Fonts.neutral200]}>Aucune declaration de paiement n attend ici pour le moment.</Text>
                  ) : null}
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description="Membres avec reste a payer deja en retard."
                title="Impayes prioritaires"
              >
                <View style={Spaces.gap[12]}>
                  {overdueAssignments.length ? overdueAssignments.map((item) => (
                    <AssignmentSignalCard
                      helper={`${money(item?.amountRemainingCents || 0, item?.currency || campaign?.currency || 'EUR')} restant${item?.lastReminderAt ? ` - relance le ${formatDateLabel(item.lastReminderAt)}` : ''}`}
                      item={item}
                      key={item?.documentId || item?.id}
                      label="En retard"
                      onPress={() => openAssignmentDetail(item)}
                    />
                  )) : <Text style={[Fonts.p2, Fonts.neutral200]}>Aucun impaye en retard dans cet apercu.</Text>}
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description="Resume des moyens actifs sur cette campagne."
                title="Canaux actifs"
              >
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(enabledPaymentModes.length ? enabledPaymentModes : ['Aucun moyen active']).map((item) => (
                    <DetailPill key={item} label={item} />
                  ))}
                </View>
              </CampaignDetailSection>
            </>
          ) : null}

          {detailTab === 'documents' ? (
            <>
              <CampaignDetailSection
                description="Pieces exigees par la campagne et etat global des dossiers membres."
                title="Documents demandes"
              >
                <View style={Spaces.gap[12]}>
                  {documentRequestSummaries.length ? documentRequestSummaries.map((item) => (
                    <Text key={item} style={[Fonts.p2, Fonts.neutral200]}>{`\u2022 ${item}`}</Text>
                  )) : <Text style={[Fonts.p2, Fonts.neutral200]}>Aucun document demande.</Text>}
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description="Vue d ensemble des statuts documentaires des membres sur cette campagne."
                title="Etat des dossiers"
              >
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <DetailPill label={`Manquants: ${documentStatusSummary.missing || 0}`} />
                  <DetailPill label={`Deposes: ${documentStatusSummary.submitted || 0}`} />
                  <DetailPill label={`Valides: ${documentStatusSummary.validated || 0}`} />
                  <DetailPill label={`A remplacer: ${documentStatusSummary.to_replace || 0}`} />
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description="Membres dont les documents ont besoin d une action humaine."
                title="Dossiers a verifier"
              >
                <View style={Spaces.gap[12]}>
                  {documentReviewAssignments.length ? documentReviewAssignments.map((item) => (
                    <AssignmentSignalCard
                      helper={documentStatusLabel[item?.documentStatus] || 'Document a verifier'}
                      item={item}
                      key={item?.documentId || item?.id}
                      label={documentStatusLabel[item?.documentStatus] || 'Document'}
                      onPress={() => openAssignmentDetail(item)}
                    />
                  )) : <Text style={[Fonts.p2, Fonts.neutral200]}>Aucun document n attend de verification dans cet apercu.</Text>}
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description="Dossiers encore incomplets a traiter en priorite."
                title="Documents manquants"
              >
                <View style={Spaces.gap[12]}>
                  {missingDocumentAssignments.length ? missingDocumentAssignments.map((item) => (
                    <AssignmentSignalCard
                      helper={`${money(item?.amountRemainingCents || 0, item?.currency || campaign?.currency || 'EUR')} restant`}
                      item={item}
                      key={item?.documentId || item?.id}
                      label="Manquant"
                      onPress={() => openAssignmentDetail(item)}
                    />
                  )) : <Text style={[Fonts.p2, Fonts.neutral200]}>Aucun document manquant dans cet apercu.</Text>}
                  {assignmentsTotalCount > assignments.length ? (
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {`Apercu sur ${assignments.length} membre(s) sur ${assignmentsTotalCount}.`}
                    </Text>
                  ) : null}
                </View>
              </CampaignDetailSection>
            </>
          ) : null}

          {detailTab === 'reminders' ? (
            <>
              <CampaignDetailSection
                description="Automatisation, statuts cibles et historique agrégé des relances."
                title="Configuration des relances"
              >
                <View style={Spaces.gap[12]}>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>{summarizeReminderStatuses(reminderAutomation.targetStatuses || [])}</Text>
                  {reminderTimingSummary.length ? reminderTimingSummary.map((item) => (
                    <Text key={item} style={[Fonts.p2, Fonts.neutral200]}>{`\u2022 ${item}`}</Text>
                  )) : <Text style={[Fonts.p2, Fonts.neutral200]}>Aucune relance automatique configuree.</Text>}
                  {nonEmptyText(campaign?.reminderMessage) ? <Text style={[Fonts.p2, Fonts.neutral200]}>{campaign.reminderMessage}</Text> : null}
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description="Tu peux lancer une relance groupée ou suivre l intensité des rappels deja envoyes."
                title="Activite de relance"
              >
                <View style={Spaces.gap[12]}>
                  <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                    <StatCard label="Membres relances" tone={Colors.primary500} value={String(reminderSummary.memberCount || 0)} />
                    <StatCard label="Relances envoyees" tone={Colors.warning500} value={String(reminderSummary.totalCount || 0)} />
                  </View>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    Derniere relance:
                    {' '}
                    {reminderSummary.lastReminderAt ? formatDateLabel(reminderSummary.lastReminderAt) : 'Aucune'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                    <Button isLoading={reminderMutation.isPending} onPress={handleBulkReminder} style={{ flex: 1 }} title="Relancer les non-payeurs" />
                    <Button
                      onPress={() => navigation.navigate(RouteNames.ClubLicenseCampaignSettings, { campaignId, clubId })}
                      style={{ flex: 1 }}
                      title="Regler les relances"
                      variant="Secondary"
                    />
                  </View>
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description="Membres qui devraient etre consideres en priorite pour une relance."
                title="A relancer maintenant"
              >
                <View style={Spaces.gap[12]}>
                  {remindableAssignments.length ? remindableAssignments.map((item) => (
                    <AssignmentSignalCard
                      helper={`${money(item?.amountRemainingCents || 0, item?.currency || campaign?.currency || 'EUR')} restant - ${statusLabel[item?.status] || item?.status}${Number(item?.reminderCount || 0) > 0 ? ` - ${item.reminderCount} relance(s)` : ''}`}
                      item={item}
                      key={item?.documentId || item?.id}
                      label="A relancer"
                      onPress={() => openAssignmentDetail(item)}
                    />
                  )) : <Text style={[Fonts.p2, Fonts.neutral200]}>Aucun membre prioritaire a relancer dans cet apercu.</Text>}
                  {assignmentsTotalCount > assignments.length ? (
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {`Apercu sur ${assignments.length} membre(s) sur ${assignmentsTotalCount}.`}
                    </Text>
                  ) : null}
                </View>
              </CampaignDetailSection>
            </>
          ) : null}
        </View>
      ) : null}
      {campaigns.length && shouldShowCampaignSwitcher ? (
        <View style={Spaces.gap[licenseSpacing.listGap]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{isFocusedCampaignView ? 'Autres campagnes' : 'Campagnes'}</Text>
          {(isFocusedCampaignView
            ? campaigns.filter((item) => (item?.documentId || item?.id) !== campaignId)
            : campaigns
          ).slice(0, 5).map((item) => (
            <CampaignCard
              isSelected={campaignId === (item.documentId || item.id)}
              item={item}
              key={item.documentId || item.id}
              onDuplicate={() => handleDuplicateCampaign(item)}
              onLifecycle={() => handleLifecycleCampaign(item)}
              onPress={() => handleOpenCampaignDashboard(item)}
            />
          ))}
        </View>
      ) : null}
      {shouldShowCampaignManagementActions ? (
        <>
          <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
            <Button
              onPress={() => navigation.navigate(RouteNames.ClubLicenseCampaignSettings, editorCampaignId ? { campaignId: editorCampaignId, clubId } : { clubId })}
              style={{ flex: 1 }}
              title={isFocusedCampaignView ? 'Parametres' : 'Modifier l active'}
              variant="Secondary"
            />
            <Button
              onPress={() => navigation.navigate(RouteNames.ClubLicenseCampaignSettings, { clubId })}
              style={{ flex: 1 }}
              title="Nouvelle campagne"
              variant="Secondary"
            />
          </View>
          {campaign ? (
            <Button
              isLoading={transitionMutation.isPending}
              onPress={() => handleLifecycleCampaign(campaign)}
              title={lifecycleForCampaign(campaign)?.label ? `${lifecycleForCampaign(campaign)?.label} la campagne` : 'Gerer la campagne'}
              variant="Secondary"
            />
          ) : null}
          {campaign?.status === 'draft' ? <Button isLoading={deleteMutation.isPending} onPress={() => handleDeleteDraft(campaign)} title="Supprimer le brouillon" variant="Secondary" /> : null}
        </>
      ) : null}
    </View>
  );

  const renderStaticContent = () => {
    if (isLoading) {
      return (
        <View style={[Spaces.gap[12], { marginTop: 8 }]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Chargement des cotisations</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>On verifie la campagne et les cotisations deja generees.</Text>
        </View>
      );
    }

    if (hasError) {
      return (
        <LicenseEmptyState
          action={<Button onPress={retryData} title="Reessayer" variant="Secondary" />}
          description="Impossible de charger la campagne ou les cotisations pour le moment."
          title="Cotisations indisponibles"
        />
      );
    }

    if (shouldShowSetup) {
      if (!canManageLicenses) {
        return (
          <LicenseEmptyState
            description="Un dirigeant doit d abord creer et activer une campagne de cotisation."
            title="Aucune campagne active"
          />
        );
      }
      return <LicenseSetupIntro />;
    }

    if (!canManageLicenses) {
      return (
        <LicenseEmptyState
          description="Vue limitee aux equipes que vous entrainez. Les actions financieres restent reservees aux dirigeants."
          title="Vue entraineur"
        />
      );
    }

    return null;
  };

  const renderAssignmentItem = ({ item }) => (
    <AssignmentCard
      canRemind={canManageLicenses && canAssignmentBeReminded(item)}
      isReminding={singleReminderMutation.isPending && pendingReminderAssignmentId === String(item?.documentId || item?.id)}
      item={item}
      onPress={() => openAssignmentDetail(item)}
      onRemind={() => handleSingleReminder(item)}
    />
  );
  const renderMemberFilterModal = () => {
    if (memberFilterMenuKey !== 'filters') return null;

    return (
      <BottomModal
        close={() => setMemberFilterMenuKey(null)}
        hideCloseButton={false}
        isVisible={memberFilterMenuKey === 'filters'}
        snapPoints={['86%']}
      >
        <View style={Spaces.gap[12]}>
          <View style={Spaces.gap[4]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Filtrer les membres</Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>Affiche seulement les cotisations qui t interessent, par equipe, role, categorie, niveau ou etat documentaire.</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={Spaces.gap[16]}>
              {visibleMemberFilterDefinitions.map((definition) => {
                const selectedValue = memberFilters[definition.key];
                return (
                  <View key={definition.key} style={Spaces.gap[8]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{definition.label}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Pressable
                        onPress={() => updateMemberFilter(definition.key, '')}
                        style={{
                          backgroundColor: !selectedValue ? 'rgba(1, 179, 244, 0.14)' : Colors.primary700,
                          borderColor: !selectedValue ? Colors.primary500 : 'rgba(1, 179, 244, 0.24)',
                          borderRadius: licenseRadius.pill,
                          borderWidth: 1,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                        }}
                      >
                        <Text style={[Fonts.p3Bold, !selectedValue ? Fonts.primary500 : Fonts.neutral00]}>Tous</Text>
                      </Pressable>
                      {definition.options.map((option) => {
                        const selected = selectedValue === option.value;
                        return (
                          <Pressable
                            key={option.value}
                            onPress={() => updateMemberFilter(definition.key, selected ? '' : option.value)}
                            style={{
                              backgroundColor: selected ? 'rgba(1, 179, 244, 0.14)' : Colors.primary700,
                              borderColor: selected ? Colors.primary500 : 'rgba(1, 179, 244, 0.24)',
                              borderRadius: licenseRadius.pill,
                              borderWidth: 1,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                            }}
                          >
                            <Text style={[Fonts.p3Bold, selected ? Fonts.primary500 : Fonts.neutral00]}>{option.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
            <Button
              onPress={() => {
                clearMemberFilters();
                setMemberFilterMenuKey(null);
              }}
              style={{ flex: 1 }}
              title="Reinitialiser"
              variant="Secondary"
            />
            <Button
              onPress={() => setMemberFilterMenuKey(null)}
              style={{ flex: 1 }}
              title="Appliquer"
            />
          </View>
        </View>
      </BottomModal>
    );
  };

  const staticContent = renderStaticContent();
  const isSetupMode = !hasError && !isLoading && shouldShowSetup && canManageLicenses;
  const isDashboardListMode = !isLoading && !hasError && !shouldShowSetup && canManageLicenses;
  const scrollBottomPadding = isSetupMode ? (setupFooterHeight || 96) + 28 : Math.max(insets.bottom + 8, 16);

  if (isDashboardListMode) {
    return (
      <ScreenContainer bottomInsetMode="none" withHeaderPadding>
        <FlatList
          contentContainerStyle={{
            gap: licenseSpacing.sectionGap,
            paddingBottom: Math.max(insets.bottom + 8, 12),
          }}
          data={isFocusedCampaignView && detailTab === 'members' ? visibleAssignments : []}
          keyExtractor={(item) => String(item.documentId || item.id)}
          ListEmptyComponent={isFocusedCampaignView && detailTab === 'members' ? <Text style={[Fonts.p2, Fonts.neutral200]}>Aucune cotisation pour ces filtres ou cette recherche.</Text> : null}
          ListHeaderComponent={(
            <View style={Spaces.gap[licenseSpacing.sectionGap]}>
              {renderTopHeader()}
              {renderDashboardHeader()}
            </View>
          )}
          renderItem={renderAssignmentItem}
          showsVerticalScrollIndicator={false}
        />
        {renderMemberFilterModal()}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bottomInsetMode="none" withHeaderPadding>
      <View style={[Alignments.fill, Alignments.relative]}>
        <ScrollView
          contentContainerStyle={[Spaces.gap[licenseSpacing.sectionGap], { paddingBottom: scrollBottomPadding }]}
          showsVerticalScrollIndicator={false}
          style={Alignments.fill}
        >
          {renderTopHeader()}
          {staticContent}
        </ScrollView>

        {isSetupMode ? (
          <View
            onLayout={handleSetupFooterLayout}
            style={[
              Spaces.paddingTop[12],
              {
                backgroundColor: `${Colors.neutral900}E8`,
                borderTopColor: `${Colors.primary500}33`,
                borderTopWidth: 1,
                bottom: 0,
                left: -24,
                paddingBottom: Math.max(insets.bottom, 16),
                paddingHorizontal: 24,
                position: 'absolute',
                right: -24,
                zIndex: 20,
              },
            ]}
          >
            <Button
              accessibilityHint="Continue le parametrage des cotisations du club."
              accessibilityLabel="Continuer le parametrage"
              onPress={handleSetupContinue}
              title="Continuer"
            />
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

export default ClubLicenses;
