import { useMutation } from '@tanstack/react-query';
import i18next from 'i18next';
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, FlatList, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { useAppContext } from '@/store/appContext';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ClubSelector from '@/components/molecules/clubSelector/ClubSelector';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { switchManagedClub } from '@/services/auth/authService';
import {
  deleteDraftLicenseCampaign,
  duplicateLicenseCampaign,
  sendBulkLicenseReminder,
  sendLicenseReminder,
  transitionLicenseCampaign,
  unwaiveLicenseAssignment,
  useCurrentLicenseCampaign,
  useLicenseAssignments,
  useLicenseCampaign,
  useLicenseCampaigns,
  useLicenseDashboard,
  useLicenseMutation,
  useLicensePaymentReviews,
} from '@/services/license/licenseQueries';
import { connectLicenseHelloAsso } from '@/services/license/licenseService';

import {
  canValidateAssignmentPayment,
  createHelloAssoDraft,
  describeHelloAssoReadiness,
  formatLicenseMoney,
  getHelloAssoSnapshot,
  isHelloAssoReadyForCampaign,
  LicenseEmptyState,
  licenseRadius,
  LicenseSelectionChip,
  licenseSpacing,
  LicenseStatusChip,
  paymentModeLabels,
} from './licenseDesignSystem';
import MyLicenses from './MyLicenses';

/**
 * Champ texte de la feuille HelloAsso — meme grammaire que les champs du tunnel
 * (bord 1 px, 52 pt), sans dependre du tunnel : le hub ne l'importe pas.
 * @param {object} root0
 * @param {string} root0.label
 * @param {(value: string) => void} root0.onChangeText
 * @param {string} root0.placeholder
 * @param {string} root0.value
 * @returns {import('react').ReactElement}
 */
function HelloAssoField({
  label, onChangeText, placeholder, value,
}) {
  const {
    Colors, Fonts, Spaces,
  } = useTheme();

  return (
    <View style={Spaces.gap[8]}>
      <Text style={[Fonts.p3, Fonts.neutral200]}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.neutral300}
        style={[Fonts.p2, Fonts.neutral00, {
          borderColor: withAlpha(Colors.primary500, 0.2),
          borderRadius: licenseRadius.card,
          borderWidth: 1,
          minHeight: 52,
          paddingHorizontal: licenseSpacing.cardPadding,
          paddingVertical: 12,
        }]}
        value={value}
      />
    </View>
  );
}

const money = (value = 0, currency = 'EUR') => new Intl.NumberFormat(localeDesFormats(), {
  currency,
  style: 'currency',
}).format((value || 0) / 100);
const statusLabel = {
  get manual_review() {
    return i18next.t('clubLicenses.status.manualReview', 'A valider');
  },
  get overdue() {
    return i18next.t('clubLicenses.status.overdue', 'En retard');
  },
  get paid() {
    return i18next.t('clubLicenses.status.paid', 'Payee');
  },
  get partial() {
    return i18next.t('clubLicenses.status.partial', 'Partiel');
  },
  get pending() {
    return i18next.t('clubLicenses.status.pending', 'En attente');
  },
  get waived() {
    return i18next.t('clubLicenses.status.waived', 'Exemptee');
  },
};
const campaignTypeLabel = {
  get equipment() {
    return i18next.t('clubLicenses.campaignTypes.equipment', 'Equipement');
  },
  get internship() {
    return i18next.t('clubLicenses.campaignTypes.internship', 'Stage');
  },
  get license() {
    return i18next.t('clubLicenses.campaignTypes.license', 'Licence');
  },
  get membership() {
    return i18next.t('clubLicenses.campaignTypes.membership', 'Adhesion');
  },
  get other() {
    return i18next.t('clubLicenses.campaignTypes.other', 'Autre');
  },
  get tournament() {
    return i18next.t('clubLicenses.campaignTypes.tournament', 'Tournoi');
  },
};
const roleDisplayLabel = {
  get coach() {
    return i18next.t('clubLicenses.roles.coach', 'Entraîneur·e');
  },
  get dirigeant() {
    return i18next.t('clubLicenses.roles.manager', 'Dirigeant');
  },
  get entraineur() {
    return i18next.t('clubLicenses.roles.coach', 'Entraîneur·e');
  },
  get joueur() {
    return i18next.t('clubLicenses.roles.player', 'Joueur');
  },
  get president() {
    return i18next.t('clubLicenses.roles.manager', 'Dirigeant');
  },
  get superadmin() {
    return i18next.t('clubLicenses.roles.superAdmin', 'Super admin');
  },
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
  {
    get label() {
      return i18next.t('clubLicenses.filters.all', 'Tous');
    },
    value: '',
  },
  {
    get label() {
      return i18next.t('clubLicenses.status.pending', 'En attente');
    },
    value: 'pending',
  },
  {
    get label() {
      return i18next.t('clubLicenses.status.partial', 'Partiel');
    },
    value: 'partial',
  },
  {
    get label() {
      return i18next.t('clubLicenses.status.overdue', 'En retard');
    },
    value: 'overdue',
  },
  {
    get label() {
      return i18next.t('clubLicenses.status.manualReview', 'A valider');
    },
    value: 'manual_review',
  },
  {
    get label() {
      return i18next.t('clubLicenses.status.paid', 'Payee');
    },
    value: 'paid',
  },
  {
    get label() {
      return i18next.t('clubLicenses.status.waived', 'Exemptee');
    },
    value: 'waived',
  },
];
// Vocabulaire du pack de design des cotisations : le dirigeant lit l'etat de
// sa campagne, pas celui d'un enregistrement. « Ouverte » dit qu'un membre peut
// payer maintenant ; « Active » ne disait rien de tel.
// Corrige a la RACINE, une seule fois : les 3 endroits qui affichent un statut
// de campagne (carte du hub, entete du detail, pastille de recapitulatif) lisent
// tous cette table.
const campaignStatusLabel = {
  get active() {
    return i18next.t('clubLicenses.campaignStatus.active', 'Ouverte');
  },
  get archived() {
    return i18next.t('clubLicenses.campaignStatus.archived', 'Archivée');
  },
  get closed() {
    return i18next.t('clubLicenses.campaignStatus.closed', 'Terminée');
  },
  get draft() {
    return i18next.t('clubLicenses.campaignStatus.draft', 'Brouillon');
  },
  get paused() {
    return i18next.t('clubLicenses.campaignStatus.paused', 'En pause');
  },
  get scheduled() {
    return i18next.t('clubLicenses.campaignStatus.scheduled', 'Programmée');
  },
};
const providerReadinessLabel = {
  get checkout_failed() {
    return i18next.t('clubLicenses.helloAssoReadiness.checkoutFailed', 'Test checkout en erreur');
  },
  get credentials_missing() {
    return i18next.t(
      'clubLicenses.helloAssoReadiness.credentialsMissing',
      'Configuration incomplète',
    );
  },
  get disabled() {
    return i18next.t('clubLicenses.helloAssoReadiness.disabled', 'Desactive');
  },
  get oauth_failed() {
    return i18next.t('clubLicenses.helloAssoReadiness.oauthFailed', 'OAuth en erreur');
  },
  get pending() {
    return i18next.t('clubLicenses.helloAssoReadiness.pending', 'A vérifier');
  },
  get ready() {
    return i18next.t('clubLicenses.helloAssoReadiness.ready', 'Pret');
  },
  get webhook_pending() {
    return i18next.t('clubLicenses.helloAssoReadiness.webhookPending', 'Webhook à confirmer');
  },
  get webhook_stale() {
    return i18next.t('clubLicenses.helloAssoReadiness.webhookStale', 'Webhook à vérifier');
  },
};
const paymentOwnerLabel = {
  get club() {
    return i18next.t('clubLicenses.paymentOwner.club', 'Club');
  },
  get platform() {
    return i18next.t('clubLicenses.paymentOwner.platform', 'Plateforme');
  },
  get section() {
    return i18next.t('clubLicenses.paymentOwner.section', 'Section');
  },
};
const documentStatusLabel = {
  get missing() {
    return i18next.t('clubLicenses.documentStatus.missing', 'Document manquant');
  },
  get none() {
    return i18next.t('clubLicenses.documentStatus.none', 'Aucun document');
  },
  get refused() {
    return i18next.t('clubLicenses.documentStatus.refused', 'Document refuse');
  },
  get submitted() {
    return i18next.t('clubLicenses.documentStatus.submitted', 'Document déposé');
  },
  get to_replace() {
    return i18next.t('clubLicenses.documentStatus.toReplace', 'Document à remplacer');
  },
  get validated() {
    return i18next.t('clubLicenses.documentStatus.validated', 'Document valide');
  },
};
const installmentFrequencyLabel = {
  get custom() {
    return i18next.t('clubLicenses.installmentFrequency.custom', 'Libre');
  },
  get monthly() {
    return i18next.t('clubLicenses.installmentFrequency.monthly', 'Mensuelle');
  },
  get quarterly() {
    return i18next.t('clubLicenses.installmentFrequency.quarterly', 'Trimestrielle');
  },
  get weekly() {
    return i18next.t('clubLicenses.installmentFrequency.weekly', 'Hebdo');
  },
};
const detailTabOptions = [
  {
    get label() {
      return i18next.t('clubLicenses.tabs.overview', 'Vue d ensemble');
    },
    value: 'overview',
  },
  {
    get label() {
      return i18next.t('clubLicenses.tabs.members', 'Membres');
    },
    value: 'members',
  },
  {
    get label() {
      return i18next.t('clubLicenses.tabs.payments', 'Paiements');
    },
    value: 'payments',
  },
  {
    get label() {
      return i18next.t('clubLicenses.tabs.documents', 'Documents');
    },
    value: 'documents',
  },
  {
    get label() {
      return i18next.t('clubLicenses.tabs.reminders', 'Relances');
    },
    value: 'reminders',
  },
];
const emptyMemberFilters = {
  category: '',
  documentStatus: '',
  level: '',
  role: '',
  section: '',
  teamId: '',
};
const memberQuickFilterLabels = {
  get expected() {
    return i18next.t('clubLicenses.quickFilters.expected', 'Attendu');
  },
  get overdue() {
    return i18next.t('clubLicenses.quickFilters.overdue', 'Retards');
  },
  get paid() {
    return i18next.t('clubLicenses.quickFilters.paid', 'Encaisse');
  },
  get remaining() {
    return i18next.t('clubLicenses.quickFilters.remaining', 'Reste');
  },
};
const normalizeMemberQuickFilter = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(memberQuickFilterLabels, normalized) ? normalized : '';
};
const matchesMemberQuickFilter = (item, quickFilter) => {
  const normalizedFilter = normalizeMemberQuickFilter(quickFilter);
  if (!normalizedFilter || normalizedFilter === 'expected') return true;
  if (normalizedFilter === 'paid') return String(item?.status || '') === 'paid';
  if (normalizedFilter === 'remaining') return Number(item?.amountRemainingCents || 0) > 0;
  if (normalizedFilter === 'overdue') return String(item?.status || '') === 'overdue';
  return true;
};
const reminderEligibleStatuses = ['manual_review', 'overdue', 'partial', 'pending'];
const lifecycleForCampaign = (campaign) => {
  const status = campaign?.status;
  if (status === 'draft') {
    return {
      action: 'launch',
      label: i18next.t(
        'clubLicenses.actions.open',
        'Ouvrir',
      ),
    };
  }
  if (status === 'scheduled') {
    return {
      action: 'pause',
      label: i18next.t(
        'clubLicenses.actions.pause',
        'Mettre en pause',
      ),
    };
  }
  if (status === 'active') {
    return {
      action: 'pause',
      label: i18next.t(
        'clubLicenses.actions.pause',
        'Mettre en pause',
      ),
    };
  }
  if (status === 'paused') {
    return {
      action: 'resume',
      label: i18next.t(
        'clubLicenses.actions.resume',
        'Reprendre',
      ),
    };
  }
  if (status === 'closed') {
    return {
      action: 'archive',
      label: i18next.t(
        'clubLicenses.actions.archive',
        'Archiver',
      ),
    };
  }
  if (status === 'archived') {
    return {
      action: 'reopen',
      label: i18next.t(
        'clubLicenses.actions.reopen',
        'Reouvrir',
      ),
    };
  }
  return null;
};
const formatDateLabel = (value) => {
  const normalized = String(value || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return i18next.t(
      'clubLicenses.values.notSpecified',
      'Non renseignée',
    );
  }
  return `${normalized.slice(8, 10)}/${normalized.slice(5, 7)}/${normalized.slice(0, 4)}`;
};
const nonEmptyText = (value) => String(value || '').trim();
const buildTargetSummary = (campaign) => {
  const config = campaign?.targetConfig || {};
  if (config.includeAllMembers) {
    return [i18next.t('clubLicenses.target.allMembers', 'Tous les membres du club')];
  }

  const labels = [];
  if (Array.isArray(config.roles) && config.roles.length) labels.push(...config.roles.map((item) => String(item?.name || item?.label || item || '')));
  if (Array.isArray(config.teamIds) && config.teamIds.length) {
    labels.push(i18next.t(
      'clubLicenses.target.teams',
      '{{teams}} équipe(s)',
      { teams: config.teamIds.length, ...SANS_ECHAPPEMENT },
    ));
  }
  if (Array.isArray(config.categoryIds) && config.categoryIds.length) {
    labels.push(i18next.t(
      'clubLicenses.target.categories',
      '{{categories}} catégorie(s)',
      { categories: config.categoryIds.length, ...SANS_ECHAPPEMENT },
    ));
  }
  if (Array.isArray(config.sectionIds) && config.sectionIds.length) {
    labels.push(i18next.t(
      'clubLicenses.target.sections',
      '{{sections}} section(s)',
      { sections: config.sectionIds.length, ...SANS_ECHAPPEMENT },
    ));
  }
  if (Array.isArray(config.levelIds) && config.levelIds.length) {
    labels.push(i18next.t(
      'clubLicenses.target.levels',
      '{{levels}} niveau(x)',
      { levels: config.levelIds.length, ...SANS_ECHAPPEMENT },
    ));
  }

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

  const scopeLabel = parts[0] || i18next.t('clubLicenses.pricing.ruleFallback', 'Règle tarifaire');
  const amountLabel = rule?.isWaiver ? i18next.t(
    'clubLicenses.pricing.waiver',
    'Exoneration',
  ) : money(rule?.amountCents || 0, currency);
  return `${scopeLabel} - ${amountLabel}`;
};
const summarizeDocumentRequest = (request) => {
  const parts = [nonEmptyText(request?.name) || i18next.t(
    'clubLicenses.documents.fallbackName',
    'Document',
  )];
  if (request?.required !== false) {
    parts.push(i18next.t(
      'clubLicenses.documents.required',
      'obligatoire',
    ));
  }
  if (nonEmptyText(request?.dueDate)) {
    parts.push(i18next.t(
      'clubLicenses.documents.dueBefore',
      'avant le {{date}}',
      { date: formatDateLabel(request.dueDate), ...SANS_ECHAPPEMENT },
    ));
  }
  return parts.join(' - ');
};
const summarizeReminderStatuses = (statuses = []) => {
  const labels = statuses.map((status) => statusLabel[status] || campaignStatusLabel[status] || status).filter(Boolean);
  return labels.length ? labels.join(', ') : i18next.t(
    'clubLicenses.reminders.noTargetStatus',
    'Aucun statut cible',
  );
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
const getAssignmentMemberName = (item) => [item?.user?.firstname, item?.user?.lastname]
  .filter(Boolean)
  .join(' ')
  || item?.user?.username
  || i18next.t('clubLicenses.member.fallbackName', 'Membre');
const getAssignmentMemberAvatarUrl = (item) => item?.user?.avatar?.url || item?.user?.avatarUrl || item?.avatar?.url || item?.avatarUrl || '';
const canAssignmentBeReminded = (item) => reminderEligibleStatuses.includes(String(item?.status || '')) && Number(item?.amountRemainingCents || 0) > 0;
// U06 — « À payer » ne veut dire quelque chose que sur une cotisation EXEMPTEE :
// c est l exact retour en arriere d « Exempter la cotisation ». Une cotisation en
// attente est deja a payer, et le serveur refuserait le geste.
const canAssignmentBeSetBackToDue = (item) => String(item?.status || '') === 'waived';
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

/**
 *
 * @param root0
 * @param root0.children
 * @param root0.description
 * @param root0.title
 */
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

/**
 *
 * @param root0
 * @param root0.label
 */
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

/**
 *
 * @param root0
 * @param root0.active
 * @param root0.label
 * @param root0.onPress
 * @param root0.valueLabel
 */
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
 * @param root0.active
 * @param root0.onPress
 */
function StatCard({
  active = false,
  label,
  onPress,
  tone,
  value,
}) {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const renderCard = ({ isActive = false }) => (
    <View style={[ApplicationStyle.card, {
      backgroundColor: Colors.primary700,
      borderColor: isActive ? (tone || Colors.primary500) : `${tone || Colors.primary500}88`,
      borderRadius: licenseRadius.card,
      borderWidth: isActive ? 2 : 1,
      flex: 1,
      minHeight: 88,
      paddingHorizontal: licenseSpacing.cardPadding,
      paddingVertical: licenseSpacing.cardPadding,
    }]}
    >
      <Text style={[Fonts.p3, Fonts.neutral200]}>{label}</Text>
      <Text numberOfLines={1} style={[Fonts.h3, Spaces.marginTop[8], { color: tone || Colors.primary500 }]}>{value}</Text>
    </View>
  );

  if (!onPress) {
    return renderCard({ isActive: active });
  }

  return (
    <TouchableOpacity
      accessibilityHint={t(
        'clubLicenses.statCard.hint',
        'Ouvre les membres pour le bloc {{label}}.',
        { label: label.toLowerCase(), ...SANS_ECHAPPEMENT },
      )}
      accessibilityRole="button"
      accessible
      activeOpacity={0.92}
      hitSlop={{
        bottom: 6,
        left: 6,
        right: 6,
        top: 6,
      }}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      {renderCard({ isActive: active })}
    </TouchableOpacity>
  );
}

/**
 * Bloc de synthese du hub : une seule carte a la place des 4 cartes de
 * statistiques de 4 couleurs. Elle repond a la seule question que le dirigeant
 * se pose en arrivant : « combien est rentre, combien manque, qui est en
 * retard ».
 *
 * Le rouge n'apparait QUE s'il y a un retard : ici, une couleur est une
 * information, jamais une decoration.
 * @param {object} props
 * @param {string} [props.currency] - Devise ISO de la campagne.
 * @param {number} [props.expectedCents] - Montant total attendu, en centimes.
 * @param {number} [props.overdueCount] - Nombre de dossiers en retard.
 * @param {number} [props.paidCents] - Montant deja encaisse, en centimes.
 * @param {number} [props.remainingCents] - Reste a encaisser, en centimes.
 * @returns {import('react').ReactElement}
 */
function CampaignSummary({
  currency = 'EUR',
  expectedCents = 0,
  overdueCount = 0,
  paidCents = 0,
  remainingCents = 0,
}) {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const attendu = Math.max(expectedCents || 0, 0);
  const encaisse = Math.max(paidCents || 0, 0);
  // Rien d'attendu = barre a zero, jamais a 100 % : une campagne vide n'est pas
  // une campagne soldee. Et la part est bornee, un trop-percu ne deborde pas.
  const partEncaissee = attendu > 0 ? Math.min(encaisse / attendu, 1) : 0;
  const pourcentage = Math.round(partEncaissee * 100);
  const retards = Math.max(overdueCount || 0, 0);
  const libelleRetards = retards === 0 ? t(
    'clubLicenses.summary.noOverdue',
    'Aucun retard',
  ) : t('clubLicenses.summary.overdueCount', {
    count: retards,
    defaultValue_one: '{{count}} retard',
    defaultValue_other: '{{count}} retards',
  });

  return (
    <View style={[ApplicationStyle.card, Spaces.gap[12], {
      backgroundColor: Colors.primary800,
      borderColor: withAlpha(Colors.primary500, 0.33),
      borderRadius: licenseRadius.card,
      borderWidth: 1,
      paddingHorizontal: licenseSpacing.cardPadding,
      paddingVertical: licenseSpacing.cardPadding,
    }]}
    >
      <Text style={Fonts.p2}>
        <Text style={[Fonts.h3, Fonts.neutral00]}>{money(encaisse, currency)}</Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t('clubLicenses.summary.collectedOf', ' encaissés sur ')}
          {money(attendu, currency)}
          {t('clubLicenses.summary.expected', ' attendus')}
        </Text>
      </Text>

      <View
        accessibilityLabel={t(
          'clubLicenses.summary.progressLabel',
          'Progression des encaissements',
        )}
        accessibilityRole="progressbar"
        accessibilityValue={{
          max: 100,
          min: 0,
          now: pourcentage,
          text: t(
            'clubLicenses.summary.progressValue',
            '{{percent}} % encaissés',
            { percent: pourcentage, ...SANS_ECHAPPEMENT },
          ),
        }}
        style={{
          backgroundColor: withAlpha(Colors.primary500, 0.18),
          borderRadius: licenseRadius.pill,
          height: 8,
          overflow: 'hidden',
        }}
      >
        <View style={{
          backgroundColor: Colors.primary500,
          borderRadius: licenseRadius.pill,
          height: 8,
          width: `${pourcentage}%`,
        }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap, justifyContent: 'space-between' }}>
        <Text style={[Fonts.p2Bold, { color: Colors.warning500 }]}>
          {t('clubLicenses.summary.remaining', 'Reste ')}
          {money(Math.max(remainingCents || 0, 0), currency)}
        </Text>
        <Text style={[Fonts.p2Bold, { color: retards === 0 ? Colors.success500 : Colors.error500 }]}>
          {libelleRetards}
        </Text>
      </View>
    </View>
  );
}

/**
 * La carte d'un membre dans la liste des cotisations d'une campagne.
 * @param {object} root0 - Les proprietes de la carte.
 * @param {any} root0.item - L'affectation servie par le serveur.
 * @param {() => void} root0.onPress - Ouvre la fiche du membre.
 * @param {boolean} [root0.canRemind] - Une relance a-t-elle un sens ?
 * @param {boolean} [root0.canSetBackToDue] - U06 : cotisation EXEMPTEE uniquement.
 * @param {boolean} [root0.canValidatePayment] - Y06 : encaisser a-t-il un sens, et le droit ?
 * @param {boolean} [root0.isReminding] - Relance en cours pour CE membre.
 * @param {boolean} [root0.isSettingBackToDue] - Retour a payer en cours pour CE membre.
 * @param {() => void} [root0.onRemind] - Envoie la relance individuelle.
 * @param {() => void} [root0.onSetBackToDue] - Retire l'exemption.
 * @param {() => void} [root0.onValidatePayment] - Y06 : ouvre la fenetre d'encaissement.
 * @returns {import('react').ReactElement} La carte.
 */
function AssignmentCard({
  canRemind,
  canSetBackToDue,
  canValidatePayment,
  isReminding,
  isSettingBackToDue,
  item,
  onPress,
  onRemind,
  onSetBackToDue,
  onValidatePayment,
}) {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const tone = statusTone(Colors, item?.status);
  const name = getAssignmentMemberName(item);
  const avatarUrl = getAssignmentMemberAvatarUrl(item);
  // La rangee du bas n existe que si elle porte au moins un geste : une bande
  // vide sous chaque carte serait du bruit sur une liste de 100 membres.
  const aDesActions = (canRemind && onRemind)
    || (canValidatePayment && onValidatePayment)
    || (canSetBackToDue && onSetBackToDue);
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
            <ProfileAvatar enablePreview={false} imageUrl={avatarUrl} name={name} size={48} />
          </View>
          <View style={[Spaces.gap[4], { flex: 1 }]}>
            {/* MARQUEE — le nom du licencie se lit en entier */}
            <MarqueeText
              style={[Fonts.p1Bold, Fonts.neutral00]}
              text={name}
            />
            {/* MARQUEE — l equipe du licencie se lit en entier */}
            <MarqueeText
              style={[Fonts.p3, Fonts.neutral200]}
              text={item?.team?.name || t('clubLicenses.assignment.noTeam', 'Sans équipe')}
            />
          </View>
          <View style={[Spaces.gap[4], { alignItems: 'flex-end', maxWidth: 120 }]}>
            <Text numberOfLines={1} style={[Fonts.p2Bold, { color: tone }]}>{statusLabel[item?.status] || item?.status}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200, { textAlign: 'right' }]}>
              {money(item?.amountRemainingCents, item?.currency || 'EUR')}
              {' '}
              {t('clubLicenses.assignment.remaining', 'reste')}
            </Text>
          </View>
        </View>
      </Pressable>
      {aDesActions ? (
        <View style={[Spaces.marginTop[12], {
          alignItems: 'center',
          flexDirection: 'row',
          gap: licenseSpacing.actionGap,
          justifyContent: 'flex-end',
        }]}
        >
          {canRemind && onRemind ? (
            <Button
              isLoading={isReminding}
              onPress={onRemind}
              size="sm"
              title={t('clubLicenses.actions.remind', 'Relancer')}
              variant="Secondary"
            />
          ) : null}
          {/* Y06 — « A payé », le geste qu Adel a cherche TROIS fois. Le lot W02
              l avait pose sur la fiche d un membre ; sa capture du 19/08 montre
              la LISTE. Il est donc ici, juste a cote de « Relancer ».
              💰 Le droit vient de `canValidateAssignmentPayment` — la MEME regle
              que la fiche, jamais une seconde.
              🧨 Et il ne cotoie JAMAIS « À payer » (une lettre d ecart, le geste
              contraire) : l un ne sort que sur une cotisation EXEMPTEE, l autre
              que sur une cotisation ou il reste quelque chose a encaisser. */}
          {canValidatePayment && onValidatePayment ? (
            <Button
              onPress={onValidatePayment}
              size="sm"
              title={t('clubLicenses.assignment.markPaid', 'A payé')}
            />
          ) : null}
          {/* U06 — « À payer », juste a cote de « Relancer », exactement la ou
              Adel le cherchait. Il n apparait que sur une cotisation EXEMPTEE :
              ailleurs il serait inerte. */}
          {canSetBackToDue && onSetBackToDue ? (
            <Button
              isLoading={isSettingBackToDue}
              onPress={onSetBackToDue}
              size="sm"
              title={t('clubLicenses.assignment.setBackToDue', 'À payer')}
              variant="Secondary"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.helper
 * @param root0.item
 * @param root0.label
 * @param root0.onPress
 */
function AssignmentSignalCard({
  helper,
  item,
  label,
  onPress,
}) {
  const { t } = useTranslation();
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
            <ProfileAvatar enablePreview={false} imageUrl={avatarUrl} name={name} size={40} />
          </View>
          <View style={[Spaces.gap[4], { flex: 1 }]}>
            {/* MARQUEE — le nom du licencie se lit en entier */}
            <MarqueeText
              style={[Fonts.p1Bold, Fonts.neutral00]}
              text={name}
            />
            {/* MARQUEE — l equipe du licencie se lit en entier */}
            <MarqueeText
              style={[Fonts.p3, Fonts.neutral200]}
              text={item?.team?.name || t('clubLicenses.assignment.noTeam', 'Sans équipe')}
            />
          </View>
          <Text style={[Fonts.p3Bold, { color: tone }]}>{label}</Text>
        </View>
        {helper ? <Text style={[Fonts.p2, Fonts.neutral200]}>{helper}</Text> : null}
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
          {t('clubLicenses.signalCard.openMember', 'Ouvrir la fiche membre')}
        </Text>
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
 * @param root0.isSelected
 */
/**
 * Une ligne « libelle a gauche, valeur a droite » de la carte de campagne.
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value
 * @param {string} props.valueColor
 * @param props.isSelected
 * @param props.item
 * @param props.libelleGesteEnCours
 * @param props.onOpenActions
 * @param props.onPress
 * @returns {import('react').ReactElement}
 */
function CampaignCard({
  isSelected = false,
  item,
  libelleGesteEnCours = '',
  onOpenActions,
  onPress,
}) {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const totals = item?.totals || {};
  const helloAssoReadiness = item?.paymentProviderSnapshot?.helloasso?.readiness;
  const normalizedStatus = String(item?.status || '').toLowerCase();
  const isInactiveCampaign = ['archived', 'closed', 'paused'].includes(normalizedStatus);
  const statusColor = isInactiveCampaign ? Colors.neutral300 : Colors.primary500;
  const secondaryTextColor = isInactiveCampaign ? Colors.neutral300 : Colors.neutral200;
  const currency = item?.currency || 'EUR';
  const nombreDocuments = (item?.documentRequests || []).length;
  const nombreRetards = totals.overdueCount || 0;
  let backgroundColor = Colors.primary800;
  if (isInactiveCampaign) backgroundColor = Colors.primary900;
  else if (isSelected) backgroundColor = Colors.primary700;

  let borderColor = withAlpha(Colors.primary500, 0.33);
  if (isSelected) borderColor = isInactiveCampaign ? withAlpha(Colors.neutral300, 0.6) : Colors.primary500;
  else if (isInactiveCampaign) borderColor = withAlpha(Colors.neutral400, 0.33);

  return (
    <View style={[ApplicationStyle.card, Spaces.gap[12], {
      backgroundColor,
      borderColor,
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
          {/*
            Plus de `numberOfLines` : un nom de campagne coupe en plein milieu
            est la premiere chose que le dirigeant ne reconnait pas. Il passe a
            la ligne, la carte grandit.
          */}
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {item?.name || t(
              'clubLicenses.campaignCard.nameFallback',
              'Campagne',
            )}
          </Text>
          <Text style={[Fonts.p3, { color: secondaryTextColor }]}>
            {item?.seasonLabel || '-'}
            {item?.defaultAmountCents ? t(
              'clubLicenses.campaignCard.perMember',
              ' · {{amount}} par membre',
              { amount: money(item.defaultAmountCents, currency), ...SANS_ECHAPPEMENT },
            ) : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {isSelected ? (
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
              {t('clubLicenses.campaignCard.current', 'Suivi actuel')}
            </Text>
          ) : null}
          <View style={{
            backgroundColor: isInactiveCampaign
              ? withAlpha(Colors.neutral00, 0.08)
              : withAlpha(Colors.primary500, 0.14),
            borderColor: isInactiveCampaign
              ? withAlpha(Colors.neutral00, 0.12)
              : withAlpha(Colors.primary500, 0.4),
            borderRadius: licenseRadius.pill,
            borderWidth: 1,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
          >
            <Text style={[Fonts.p4Bold, { color: statusColor }]}>
              {campaignStatusLabel[item?.status] || item?.status}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ backgroundColor: withAlpha(Colors.neutral00, 0.08), height: 1 }} />

      <View style={Spaces.gap[8]}>
        <CampaignCardRow
          label={t('clubLicenses.campaignCard.collected', 'Encaissé')}
          value={t(
            'clubLicenses.campaignCard.collectedValue',
            '{{paid}} sur {{expected}}',
            {
              expected: money(totals.expectedCents || 0, currency),
              paid: money(totals.paidCents || 0, currency),
              ...SANS_ECHAPPEMENT,
            },
          )}
          valueColor={Colors.neutral00}
        />
        <CampaignCardRow
          label={t('clubLicenses.tabs.members', 'Membres')}
          value={t(
            'clubLicenses.campaignCard.membersValue',
            '{{total}} · {{overdue}} en retard',
            { overdue: nombreRetards, total: totals.total || 0, ...SANS_ECHAPPEMENT },
          )}
          // Le rouge ne sert qu'au retard : sans retard, la ligne reste neutre.
          valueColor={nombreRetards > 0 ? Colors.error500 : Colors.neutral00}
        />
        <CampaignCardRow
          label={t('clubLicenses.tabs.documents', 'Documents')}
          value={nombreDocuments === 0 ? t(
            'clubLicenses.campaignCard.noDocuments',
            'Aucun demandé',
          ) : t('clubLicenses.campaignCard.documentsCount', {
            count: nombreDocuments,
            defaultValue_one: '{{count}} demandé',
            defaultValue_other: '{{count}} demandés',
          })}
          valueColor={Colors.neutral00}
        />
        {item?.paymentModes?.helloasso ? (
          <CampaignCardRow
            label="HelloAsso"
            value={providerReadinessLabel[helloAssoReadiness] || helloAssoReadiness || t(
              'clubLicenses.campaignCard.toConfigure',
              'A configurer',
            )}
            valueColor={Colors.neutral00}
          />
        ) : null}
      </View>

      {/*
        T03 — LA LIGNE QUI MANQUAIT. Elle n apparait que sur la campagne dont le
        geste est en vol, et elle NOMME ce geste. `accessibilityLiveRegion` la
        fait annoncer a voix haute : l attente est la meme pour qui ne voit pas
        l ecran.
      */}
      {libelleGesteEnCours ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[Fonts.p3Bold, { color: Colors.primary500 }]}
          testID="license-campagne-geste-en-cours"
        >
          {libelleGesteEnCours}
        </Text>
      ) : null}

      <View style={{ alignItems: 'center', flexDirection: 'row', gap: licenseSpacing.actionGap }}>
        <View style={{ flex: 1 }}>
          <Button
            onPress={onPress}
            title={isSelected ? t(
              'clubLicenses.campaignCard.selected',
              'Campagne ouverte',
            ) : t(
              'clubLicenses.campaignCard.viewDetails',
              'Voir le détail',
            )}
          />
        </View>
        {/*
          Les actions secondaires passent sous ce bouton : c'est ce qui supprime
          les libelles tronques (« Mettre en pau... ») de l'ancienne rangee.
          La cible tactile fait 44 pt de cote, comme l'exige le pack de design.
        */}
        <Pressable
          accessibilityHint={t(
            'clubLicenses.campaignCard.moreActionsHint',
            'Dupliquer, mettre en pause ou modifier cette campagne.',
          )}
          accessibilityLabel={t(
            'clubLicenses.campaignCard.moreActionsLabel',
            'Autres actions pour la campagne {{name}}',
            {
              name: item?.name || t('clubLicenses.campaignCard.untitled', 'sans nom'),
              ...SANS_ECHAPPEMENT,
            },
          )}
          accessibilityRole="button"
          // ⛔ Un geste deja en vol ferme la porte du suivant : c est le meme
          // reflexe que le verrou du bouton final du tunnel (S06, 8c19cff).
          disabled={Boolean(libelleGesteEnCours)}
          onPress={onOpenActions}
          style={({ pressed }) => [{
            alignItems: 'center',
            borderColor: withAlpha(Colors.primary500, 0.4),
            borderRadius: licenseRadius.pill,
            borderWidth: 1,
            height: 44,
            justifyContent: 'center',
            opacity: pressed ? 0.8 : 1,
            width: 44,
          }, Platform.OS === 'web' ? { cursor: 'pointer' } : null]}
        >
          <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>…</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.value
 * @param root0.valueColor
 */
function CampaignCardRow({ label, value, valueColor }) {
  const { Fonts } = useTheme();
  return (
    <View style={{
      alignItems: 'baseline', flexDirection: 'row', gap: licenseSpacing.actionGap, justifyContent: 'space-between',
    }}
    >
      <Text style={[Fonts.p3, Fonts.neutral200]}>{label}</Text>
      <Text style={[Fonts.p3Bold, { color: valueColor, flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

/**
 *
 */
function LicenseSetupIntro() {
  const { t } = useTranslation();
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
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('clubLicenses.setup.title', 'Avant de suivre les paiements')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {t(
            'clubLicenses.setup.intro',
            'Configure les règles de cotisation du club, puis publie la campagne. Les '
              + 'membres éligibles seront synchronises automatiquement des qu elle devient '
              + 'active.',
          )}
        </Text>
      </View>

      <View style={Spaces.gap[licenseSpacing.listGap]}>
        <SetupStep
          description={t(
            'clubLicenses.setup.step1.description',
            'Choisis la saison, le montant par défaut et les règles de relance.',
          )}
          index="1"
          title={t('clubLicenses.setup.step1.title', 'Définir la campagne')}
        />
        <SetupStep
          description={t(
            'clubLicenses.setup.step2.description',
            'Active les paiements acceptes: espece, chèque, virement, HelloAsso intègre ou '
              + 'lien externe.',
          )}
          index="2"
          title={t('clubLicenses.setup.step2.title', 'Configurer les moyens de paiement')}
        />
        <SetupStep
          description={t(
            'clubLicenses.setup.step3.description',
            'La campagne s applique automatiquement aux membres qui correspondent aux criteres.',
          )}
          index="3"
          title={t('clubLicenses.setup.step3.title', 'Synchronisation auto des membres')}
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
 * PERF2 — un bloc factice de chargement : une `View` avec son propre fond.
 *
 * JAMAIS du texte ni une vraie carte : tant que `SkeletonLoader` n a pas
 * mesure son cadre, il rend ses enfants NUS — du contenu factice ferait un
 * eclair de faux contenu. Le rayon 16 est celui des cartes du pack.
 * @param {object} props
 * @param {number} props.height
 * @returns {import('react').ReactElement}
 */
function SkeletonBlock({ height }) {
  const { Colors } = useTheme();
  return (
    <View style={{ backgroundColor: Colors.primary700, borderRadius: 16, height }} />
  );
}

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function ClubLicenses({ navigation, route }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const currentRouteName = route?.name;
  const [{ auth }] = useAppContext();
  const {
    activeClubId,
    clubs,
    refetchUserData,
  } = useAuth();
  const routeClubId = route?.params?.clubId;
  const clubId = routeClubId || activeClubId || clubs?.[0]?.documentId || clubs?.[0]?.id || null;
  const routeCampaign = route?.params?.campaign;
  const routeCampaignId = route?.params?.campaignId;
  const routeInitialDetailTab = route?.params?.initialDetailTab;
  const routeInitialMemberQuickFilter = normalizeMemberQuickFilter(route?.params?.initialMemberQuickFilter);
  const routeInitialStatusFilter = normalizeFilterValue(route?.params?.initialStatusFilter);
  const routeAutoScrollToMembers = Boolean(route?.params?.autoScrollToMembers);
  const roleKey = getUserRoleKey(auth?.user?.role?.type || auth?.user?.role?.name);
  const showMemberLicense = !['coach', 'president', 'superAdmin'].includes(roleKey);
  const managerViewEnabled = Boolean(clubId) && !showMemberLicense;
  const switchClubMutation = useMutation({
    mutationFn: switchManagedClub,
    onError: (mutationError) => {
      const errorMessage = mutationError?.response?.data?.error?.message
        || mutationError?.response?.data?.error
        || mutationError?.message
        || t('clubLicenses.errors.switchClub', 'Impossible de changer de club pour le moment.');

      Alert.alert(t('clubLicenses.errors.title', 'Erreur'), errorMessage);
    },
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(routeCampaignId ? routeInitialStatusFilter : '');
  const [memberQuickFilter, setMemberQuickFilter] = useState(routeCampaignId ? routeInitialMemberQuickFilter : '');
  const [detailTab, setDetailTab] = useState(routeCampaignId ? (routeInitialDetailTab || 'members') : 'overview');
  const [setupFooterHeight, setSetupFooterHeight] = useState(0);
  const [pendingReminderAssignmentId, setPendingReminderAssignmentId] = useState(null);
  const [pendingUnwaiveAssignmentId, setPendingUnwaiveAssignmentId] = useState(null);
  const [memberFilterMenuKey, setMemberFilterMenuKey] = useState(null);
  // Campagne dont la feuille « … » est ouverte, ou `null`. C'est elle qui
  // remplace les boutons secondaires tronques de l'ancienne carte.
  const [campaignActionsFor, setCampaignActionsFor] = useState(null);
  // T03 — LE GESTE EN VOL, ET SUR QUELLE CAMPAGNE.
  //
  // Adel, recette du 2026-08-17 (point 8) : « quand on appuie sur REPRENDRE,
  // c est trop long avant de rouvrir la campagne, donc on a l impression que ca
  // n a pas marche pendant quelques secondes ».
  //
  // Le voyant EXISTAIT (`isLoading={transitionMutation.isPending}`, l. 2425 et
  // 2588) — mais sur des boutons qui vivent DANS la feuille « … », et
  // `fermerPuis` la referme avant de lancer le geste. On regardait donc un
  // bouton demonte. `isPending` seul ne suffit pas non plus : il est vrai pour
  // TOUTE campagne, et allumerait la mauvaise carte.
  // ⇒ on retient le couple { campagne, libelle }, et la carte concernee — elle
  //   seule — dit ce qu elle est en train de faire.
  const [gesteEnCours, setGesteEnCours] = useState(null);
  const [isHelloAssoSheetOpen, setIsHelloAssoSheetOpen] = useState(false);
  const [helloAssoConfig, setHelloAssoConfig] = useState(() => createHelloAssoDraft(null));
  const [helloAssoSnapshot, setHelloAssoSnapshot] = useState(null);
  const [memberFilters, setMemberFilters] = useState({ ...emptyMemberFilters });
  const [membersSectionOffset, setMembersSectionOffset] = useState(null);
  const [shouldAutoScrollMembers, setShouldAutoScrollMembers] = useState(routeAutoScrollToMembers);
  const dashboardListRef = useRef(null);
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
  // U06 — « À payer », le miroir d « Exempter la cotisation ». Le lot T03 l avait
  // pose sur la FICHE d un joueur ; Adel, lui, le cherchait la ou vit
  // « Relancer » : sur chaque carte de CETTE liste. Meme geste serveur, meme
  // garde-fou (uniquement sur une cotisation EXEMPTEE).
  const unwaiveMutation = useLicenseMutation(
    ({ assignmentId }) => unwaiveLicenseAssignment(assignmentId),
    campaignId,
  );
  const duplicateMutation = useLicenseMutation(({ id, payload }) => duplicateLicenseCampaign(id, payload), campaignId);
  const transitionMutation = useLicenseMutation(({ action, id }) => transitionLicenseCampaign(id, action), campaignId);
  const deleteMutation = useLicenseMutation((id) => deleteDraftLicenseCampaign(id), campaignId);

  // ── HelloAsso au niveau CLUB (D26, decision 4) ────────────────────────────
  // ⚠️ L'app n'a pas d'appel qui lise la connexion du club seule : le seul
  // cliche disponible est celui que le serveur recopie sur la campagne
  // (`paymentProviderSnapshot.helloasso`). On le lit donc depuis la campagne
  // courante — c'est la meme connexion, vue par la fenetre qui existe.
  const clubHelloAssoSnapshot = helloAssoSnapshot || getHelloAssoSnapshot(campaign);
  const helloAssoMutation = useLicenseMutation(() => connectLicenseHelloAsso({
    clientId: helloAssoConfig.clientId,
    clientSecret: helloAssoConfig.clientSecret,
    clubId,
    environment: helloAssoConfig.environment,
    organizationSlug: helloAssoConfig.organizationSlug,
  }), campaignId);
  const handleHelloAssoFieldChange = useCallback((key, value) => {
    setHelloAssoConfig((currentConfig) => ({ ...currentConfig, [key]: value }));
  }, []);
  const verifyClubHelloAssoConnection = useCallback(() => {
    helloAssoMutation.mutate(undefined, {
      onError: (error) => {
        Alert.alert(
          t('clubLicenses.helloAsso.checkFailedTitle', 'Vérification HelloAsso impossible'),
          error?.message || t(
            'clubLicenses.helloAsso.checkFailedMessage',
            'La vérification HelloAsso a échoué.',
          ),
        );
      },
      onSuccess: (result) => {
        setHelloAssoSnapshot(result?.snapshot || null);
        // On ne garde JAMAIS le secret en memoire apres l'envoi.
        setHelloAssoConfig((currentConfig) => ({
          ...currentConfig,
          clientId: '',
          clientSecret: '',
          environment: result?.snapshot?.environment || currentConfig.environment,
          organizationSlug: result?.snapshot?.organizationSlug || currentConfig.organizationSlug,
        }));
        Alert.alert(
          isHelloAssoReadyForCampaign(result?.snapshot) ? t(
            'clubLicenses.helloAsso.readyTitle',
            'HelloAsso prêt',
          ) : t(
            'clubLicenses.helloAsso.toCheckTitle',
            'HelloAsso à vérifier',
          ),
          describeHelloAssoReadiness(result?.snapshot),
        );
      },
    });
  }, [helloAssoMutation, t]);

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
    if (!matchesMemberQuickFilter(item, memberQuickFilter)) return false;
    if (statusFilter && String(item?.status || '') !== statusFilter) return false;
    if (memberFilters.teamId && getAssignmentTeamId(item) !== memberFilters.teamId) return false;
    if (memberFilters.role && getAssignmentRoleKey(item) !== memberFilters.role) return false;
    if (memberFilters.category && getAssignmentCategoryValue(item) !== memberFilters.category) return false;
    if (memberFilters.section && getAssignmentSectionValue(item) !== memberFilters.section) return false;
    if (memberFilters.level && getAssignmentLevelValue(item) !== memberFilters.level) return false;
    if (memberFilters.documentStatus && normalizeFilterValue(item?.documentStatus || 'none') !== memberFilters.documentStatus) return false;
    return true;
  }), [assignments, memberFilters, memberQuickFilter, statusFilter]);
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
  const enabledPaymentModes = useMemo(() => Object.entries(campaign?.paymentModes || {})
    .filter(([mode, enabled]) => Boolean(enabled) && mode !== 'stripe')
    .map(([mode]) => paymentModeLabels[mode] || mode), [campaign?.paymentModes]);
  const documentRequestSummaries = useMemo(() => (campaign?.documentRequests || []).map((item) => summarizeDocumentRequest(item)), [campaign?.documentRequests]);
  const pricingRuleSummaries = useMemo(() => (campaign?.pricingRules || []).map((item) => summarizePricingRule(item, campaign?.currency || 'EUR')), [campaign?.currency, campaign?.pricingRules]);
  const reminderAutomation = campaign?.reminderAutomation || {};
  const reminderTimingSummary = useMemo(() => {
    if (!campaign) return [];
    const summary = [];
    if (reminderAutomation.enabled === false) {
      summary.push(t('clubLicenses.reminderTiming.disabled', 'Relances auto désactivées'));
      return summary;
    }
    if (campaign?.dueDate) {
      summary.push(t(
        'clubLicenses.reminderTiming.mainDueDate',
        'Échéance principale: {{date}}',
        { date: formatDateLabel(campaign.dueDate), ...SANS_ECHAPPEMENT },
      ));
    }
    if (
      reminderAutomation.beforeDueDays !== undefined
      && reminderAutomation.beforeDueDays !== null
    ) {
      summary.push(t(
        'clubLicenses.reminderTiming.daysBefore',
        '{{days}} j avant échéance',
        { days: reminderAutomation.beforeDueDays, ...SANS_ECHAPPEMENT },
      ));
    }
    if (reminderAutomation.onDueDate) {
      summary.push(t(
        'clubLicenses.reminderTiming.onDueDate',
        'Le jour de l échéance',
      ));
    }
    if (reminderAutomation.afterDueDays !== undefined && reminderAutomation.afterDueDays !== null) {
      summary.push(t(
        'clubLicenses.reminderTiming.daysAfter',
        '{{days}} j après échéance',
        { days: reminderAutomation.afterDueDays, ...SANS_ECHAPPEMENT },
      ));
    }
    if (reminderAutomation.frequencyDays) {
      summary.push(t(
        'clubLicenses.reminderTiming.every',
        'Toutes les {{days}} j',
        { days: reminderAutomation.frequencyDays, ...SANS_ECHAPPEMENT },
      ));
    }
    if (reminderAutomation.maxCount) {
      summary.push(t(
        'clubLicenses.reminderTiming.maxCount',
        '{{max}} relance(s) max',
        { max: reminderAutomation.maxCount, ...SANS_ECHAPPEMENT },
      ));
    }
    return summary;
  }, [
    campaign,
    reminderAutomation.afterDueDays,
    reminderAutomation.beforeDueDays,
    reminderAutomation.enabled,
    reminderAutomation.frequencyDays,
    reminderAutomation.maxCount,
    reminderAutomation.onDueDate,
    t,
  ]);
  const installmentSummary = useMemo(() => {
    if (!campaign?.allowInstallments) {
      return t(
        'clubLicenses.installments.single',
        'Paiement en une fois',
      );
    }
    const count = Number(campaign?.installmentCount || campaign?.installmentSchedule?.length || 1);
    const frequency = installmentFrequencyLabel[campaign?.installmentFrequency]
      || campaign?.installmentFrequency
      || t('clubLicenses.installmentFrequency.custom', 'Libre');
    return t(
      'clubLicenses.installments.summary',
      '{{installments}} échéance(s) - {{frequency}}',
      { frequency, installments: count, ...SANS_ECHAPPEMENT },
    );
  }, [
    campaign?.allowInstallments,
    campaign?.installmentCount,
    campaign?.installmentFrequency,
    campaign?.installmentSchedule,
    t,
  ]);
  const campaignDescription = nonEmptyText(campaign?.description);
  const campaignInternalNote = nonEmptyText(campaign?.internalNote);
  const isFocusedMembersView = isFocusedCampaignView && detailTab === 'members';
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
    {
      key: 'teamId',
      label: t(
        'clubLicenses.memberFilters.team',
        'Equipe',
      ),
      options: memberTeamOptions,
    },
    {
      key: 'role',
      label: t(
        'clubLicenses.memberFilters.role',
        'Role',
      ),
      options: memberRoleOptions,
    },
    {
      key: 'category',
      label: t(
        'clubLicenses.memberFilters.category',
        'Categorie',
      ),
      options: memberCategoryOptions,
    },
    {
      key: 'section',
      label: t(
        'clubLicenses.memberFilters.section',
        'Section',
      ),
      options: memberSectionOptions,
    },
    {
      key: 'level',
      label: t(
        'clubLicenses.memberFilters.level',
        'Niveau',
      ),
      options: memberLevelOptions,
    },
    {
      key: 'documentStatus',
      label: t(
        'clubLicenses.tabs.documents',
        'Documents',
      ),
      options: memberDocumentOptions,
    },
  ]), [
    memberCategoryOptions,
    memberDocumentOptions,
    memberLevelOptions,
    memberRoleOptions,
    memberSectionOptions,
    memberTeamOptions,
    t,
  ]);
  const visibleMemberFilterDefinitions = useMemo(
    () => memberFilterDefinitions.filter((definition) => definition.options.length > 0 || memberFilters[definition.key]),
    [memberFilterDefinitions, memberFilters],
  );
  const activeMemberFilterCount = useMemo(
    () => Object.values(memberFilters).filter(Boolean).length,
    [memberFilters],
  );
  const activeMemberFilterPills = useMemo(
    () => [
      memberQuickFilter ? t(
        'clubLicenses.memberList.quickView',
        'Vue rapide: {{view}}',
        {
          view: memberQuickFilterLabels[memberQuickFilter] || memberQuickFilter,
          ...SANS_ECHAPPEMENT,
        },
      ) : null,
      statusFilter ? t(
        'clubLicenses.memberList.status',
        'Statut: {{status}}',
        {
          status: statusFilters.find((filter) => filter.value === statusFilter)?.label
            || statusFilter,
          ...SANS_ECHAPPEMENT,
        },
      ) : null,
      ...memberFilterDefinitions.map((definition) => {
        const selectedValue = memberFilters[definition.key];
        if (!selectedValue) return null;
        const selectedOption = definition.options.find((option) => option.value === selectedValue);
        return selectedOption ? `${definition.label}: ${selectedOption.label}` : null;
      }),
    ].filter(Boolean),
    [memberFilterDefinitions, memberFilters, memberQuickFilter, statusFilter, t],
  );
  const memberListSummary = useMemo(() => {
    if (assignmentsQuery.isLoading) return '';
    if (activeMemberFilterCount || statusFilter || memberQuickFilter) {
      return t(
        'clubLicenses.memberList.shownSummary',
        '{{shown}} membre(s) affiche(s){{preview}}.',
        {
          preview: assignmentsTotalCount > assignments.length
            ? t('clubLicenses.memberList.previewSuffix', ' - apercu sur {{loaded}}/{{total}}', {
              loaded: assignments.length,
              total: assignmentsTotalCount,
              ...SANS_ECHAPPEMENT,
            })
            : '',
          shown: visibleAssignments.length,
          ...SANS_ECHAPPEMENT,
        },
      );
    }
    if (assignmentsTotalCount > assignments.length) {
      return t(
        'clubLicenses.memberList.previewSummary',
        'Aperçu sur {{loaded}} membre(s) sur {{total}}. Affine avec la recherche ou les filtres.',
        { loaded: assignments.length, total: assignmentsTotalCount, ...SANS_ECHAPPEMENT },
      );
    }
    return t(
      'clubLicenses.memberList.inViewSummary',
      '{{members}} membre(s) dans cette vue.',
      { members: visibleAssignments.length, ...SANS_ECHAPPEMENT },
    );
  }, [
    activeMemberFilterCount,
    assignments.length,
    assignmentsQuery.isLoading,
    assignmentsTotalCount,
    memberQuickFilter,
    statusFilter,
    visibleAssignments.length,
    t,
  ]);

  const resetAdvancedMemberFilters = useCallback(() => {
    setMemberFilters({ ...emptyMemberFilters });
  }, []);

  const clearMemberFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('');
    setMemberQuickFilter('');
    resetAdvancedMemberFilters();
  }, [resetAdvancedMemberFilters]);

  const applyMemberQuickFilterView = useCallback((quickFilterKey) => {
    setDetailTab('members');
    setSearch('');
    setStatusFilter('');
    setMemberQuickFilter(normalizeMemberQuickFilter(quickFilterKey));
    setMemberFilterMenuKey(null);
    setShouldAutoScrollMembers(true);
    resetAdvancedMemberFilters();
  }, [resetAdvancedMemberFilters]);

  const handleOpenMemberStatView = useCallback((quickFilterKey) => {
    if (isFocusedCampaignView) {
      applyMemberQuickFilterView(quickFilterKey);
      return;
    }

    const targetCampaign = defaultCampaign;
    const targetCampaignId = targetCampaign?.documentId || targetCampaign?.id;
    if (!targetCampaignId) {
      Alert.alert(t('clubLicenses.alerts.noCampaign.title', 'Aucune campagne disponible'), t(
        'clubLicenses.alerts.noCampaign.message',
        'Crée ou ouvre une campagne pour consulter les membres relies à ces indicateurs.',
      ));
      return;
    }

    navigation.push(RouteNames.ClubLicenseCampaignDetail, {
      autoScrollToMembers: true,
      campaign: targetCampaign,
      campaignId: targetCampaignId,
      clubId,
      initialDetailTab: 'members',
      initialMemberQuickFilter: normalizeMemberQuickFilter(quickFilterKey),
    });
  }, [applyMemberQuickFilterView, clubId, defaultCampaign, isFocusedCampaignView, navigation, t]);

  useEffect(() => {
    setDetailTab(campaignId ? (routeInitialDetailTab || 'members') : 'overview');
    setSearch('');
    setStatusFilter(campaignId ? routeInitialStatusFilter : '');
    setMemberQuickFilter(campaignId ? routeInitialMemberQuickFilter : '');
    setMemberFilterMenuKey(null);
    setMemberFilters({ ...emptyMemberFilters });
    setShouldAutoScrollMembers(campaignId ? routeAutoScrollToMembers : false);
  }, [campaignId, routeAutoScrollToMembers, routeInitialDetailTab, routeInitialMemberQuickFilter, routeInitialStatusFilter]);

  useEffect(() => {
    if (!isFocusedCampaignView || detailTab !== 'members' || !shouldAutoScrollMembers) {
      return undefined;
    }
    if (!dashboardListRef.current) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      if (visibleAssignments.length > 0) {
        try {
          dashboardListRef.current?.scrollToIndex?.({
            animated: true,
            index: 0,
            viewOffset: 0,
            viewPosition: 0,
          });
          setShouldAutoScrollMembers(false);
          return;
        } catch (_error) {
          // Fallback below if the list has not measured the first item yet.
        }
      }

      if (membersSectionOffset != null) {
        dashboardListRef.current?.scrollToOffset?.({
          animated: true,
          offset: Math.max(membersSectionOffset - 12, 0),
        });
      }
      setShouldAutoScrollMembers(false);
    }, 80);

    return () => clearTimeout(timeoutId);
  }, [detailTab, isFocusedCampaignView, membersSectionOffset, shouldAutoScrollMembers, visibleAssignments.length]);

  useLayoutEffect(() => {
    if (currentRouteName !== RouteNames.ClubLicenseCampaignDetail) return;
    navigation.setOptions({
      headerTitle: campaign?.name || t(
        'clubLicenses.header.campaignFallbackTitle',
        'Campagne cotisation',
      ),
    });
  }, [campaign?.name, currentRouteName, navigation, t]);

  const handleOpenCampaignDashboard = useCallback((selectedCampaign) => {
    const selectedCampaignId = selectedCampaign?.documentId || selectedCampaign?.id;
    if (!selectedCampaignId) {
      return;
    }

    setSearch('');
    setStatusFilter('');
    setMemberQuickFilter('');
    resetAdvancedMemberFilters();
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
  }, [campaignId, clubId, isFocusedCampaignView, navigation, resetAdvancedMemberFilters]);

  const handleReturnToCampaignOverview = useCallback(() => {
    setSearch('');
    setStatusFilter('');
    setMemberQuickFilter('');
    resetAdvancedMemberFilters();
    if (currentRouteName === RouteNames.ClubLicenseCampaignDetail && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace(RouteNames.ClubLicenses, { clubId });
  }, [clubId, currentRouteName, navigation, resetAdvancedMemberFilters]);

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
    Alert.alert(t('clubLicenses.alerts.bulkReminder.title', 'Relancer les non-payeurs'), t(
      'clubLicenses.alerts.bulkReminder.message',
      'Envoyer une relance aux cotisations en attente, partielles ou en retard ?',
    ), [
      { style: 'cancel', text: t('clubLicenses.actions.cancel', 'Annuler') },
      {
        onPress: () => reminderMutation.mutate(
          { statuses: ['pending', 'partial', 'overdue'] },
          {
            onError: (error) => Alert.alert(
              t('clubLicenses.alerts.reminderFailedTitle', 'Relance impossible'),
              error?.message || t(
                'clubLicenses.alerts.bulkReminder.failedMessage',
                "Les relances n'ont pas pu être envoyées.",
              ),
            ),
            // S06 — meme famille que la pause et la suppression : la relance
            // INDIVIDUELLE annoncait deja son envoi (l. 1480 avant ce lot), la
            // relance groupee non. Elle le dit maintenant, en nommant QUI a
            // recu — c'est ce que le dirigeant a besoin de savoir avant de
            // recommencer.
            onSuccess: () => Alert.alert(
              t('clubLicenses.alerts.bulkReminder.sentTitle', 'Relances envoyées'),
              t(
                'clubLicenses.alerts.bulkReminder.sentMessage',
                'Les membres en attente, en paiement partiel ou en retard ont reçu une relance.',
              ),
            ),
          },
        ),
        text: t('clubLicenses.actions.remind', 'Relancer'),
      },
    ]);
  }, [reminderMutation, t]);

  const updateMemberFilter = useCallback((key, value) => {
    setMemberFilters((current) => ({
      ...current,
      [key]: normalizeFilterValue(value),
    }));
  }, []);

  const handleSingleReminder = useCallback((item) => {
    const assignmentId = item?.documentId || item?.id;
    if (!assignmentId) return;

    if (!canManageLicenses) {
      Alert.alert(t('clubLicenses.alerts.restricted.title', 'Action réservée'), t(
        'clubLicenses.alerts.restricted.remindMessage',
        'Seuls les dirigeants peuvent envoyer une relance individuelle.',
      ));
      return;
    }

    const memberName = getAssignmentMemberName(item);
    Alert.alert(
      t('clubLicenses.alerts.singleReminder.title', 'Relancer ce membre'),
      t(
        'clubLicenses.alerts.singleReminder.message',
        'Envoyer une relance individuelle a {{memberName}} ?',
        { memberName, ...SANS_ECHAPPEMENT },
      ),
      [
        { style: 'cancel', text: t('clubLicenses.actions.cancel', 'Annuler') },
        {
          onPress: () => {
            setPendingReminderAssignmentId(String(assignmentId));
            singleReminderMutation.mutate(
              { assignmentId },
              {
                onError: (error) => {
                  const message = typeof error === 'string'
                    ? error
                    : error?.message || t(
                      'clubLicenses.alerts.singleReminder.failedMessage',
                      'La relance n a pas pu être envoyée.',
                    );
                  Alert.alert(t(
                    'clubLicenses.alerts.reminderFailedTitle',
                    'Relance impossible',
                  ), message);
                },
                onSettled: () => setPendingReminderAssignmentId(null),
                onSuccess: () => Alert.alert(t(
                  'clubLicenses.alerts.singleReminder.sentTitle',
                  'Relance envoyée',
                ), t(
                  'clubLicenses.alerts.singleReminder.sentMessage',
                  '{{memberName}} a bien été relance.',
                  { memberName, ...SANS_ECHAPPEMENT },
                )),
              },
            );
          },
          text: t('clubLicenses.actions.remind', 'Relancer'),
        },
      ],
    );
  }, [canManageLicenses, singleReminderMutation, t]);

  // U06 — le retour en arriere d une exemption, depuis la LISTE. Meme confirmation
  // que sur la fiche : remettre une cotisation a payer engage de l argent pour
  // quelqu un, ça ne se fait pas sur un appui distrait.
  const handleSetBackToDue = useCallback((item) => {
    const assignmentId = item?.documentId || item?.id;
    if (!assignmentId) return;

    if (!canManageLicenses) {
      Alert.alert(
        t('clubLicenses.alerts.restricted.title', 'Action réservée'),
        t(
          'clubLicenses.alerts.restricted.setBackToDueMessage',
          'Seuls les dirigeants peuvent remettre une cotisation à payer.',
        ),
      );
      return;
    }

    const memberName = getAssignmentMemberName(item);
    Alert.alert(
      t('clubLicenses.alerts.setBackToDue.title', 'Remettre à payer'),
      t(
        'clubLicenses.alerts.setBackToDue.message',
        '{{memberName}} devra de nouveau régler cette cotisation. L exemption sera retirée.',
        { memberName, ...SANS_ECHAPPEMENT },
      ),
      [
        { style: 'cancel', text: t('clubLicenses.actions.cancel', 'Annuler') },
        {
          onPress: () => {
            setPendingUnwaiveAssignmentId(String(assignmentId));
            unwaiveMutation.mutate(
              { assignmentId },
              {
                onError: (error) => Alert.alert(
                  t('clubLicenses.alerts.setBackToDue.failedTitle', 'Geste impossible'),
                  error?.message || t(
                    'clubLicenses.alerts.setBackToDue.failedMessage',
                    'La cotisation n a pas pu être remise à payer.',
                  ),
                ),
                onSettled: () => setPendingUnwaiveAssignmentId(null),
                onSuccess: () => Alert.alert(
                  t('clubLicenses.alerts.setBackToDue.doneTitle', 'Cotisation à payer'),
                  t(
                    'clubLicenses.alerts.setBackToDue.doneMessage',
                    '{{memberName}} doit de nouveau régler sa cotisation.',
                    { memberName, ...SANS_ECHAPPEMENT },
                  ),
                ),
              },
            );
          },
          text: t('clubLicenses.assignment.setBackToDue', 'À payer'),
        },
      ],
    );
  }, [canManageLicenses, unwaiveMutation, t]);

  const handleDuplicateCampaign = useCallback((item) => {
    const nextSeason = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    const nom = item?.name || 'Campagne';
    const nomDeLaCopie = `${nom} - copie`;
    Alert.alert(t('clubLicenses.alerts.duplicate.title', 'Dupliquer la campagne'), t(
      'clubLicenses.alerts.duplicate.message',
      'Créer une copie en brouillon avec les mêmes réglages ?',
    ), [
      { style: 'cancel', text: t('clubLicenses.actions.cancel', 'Annuler') },
      {
        onPress: () => {
          const identifiantCampagne = item.documentId || item.id;
          // T03 — meme regle que le cycle de vie : dupliquer recopie les
          // documents et les regles une par une cote serveur, ca n est pas
          // instantane.
          setGesteEnCours({
            campagneId: identifiantCampagne,
            libelle: t(
              'clubLicenses.alerts.duplicate.pending',
              'Duplication en cours...',
            ),
          });
          duplicateMutation.mutate(
            {
              id: identifiantCampagne,
              payload: { name: nomDeLaCopie, seasonLabel: nextSeason },
            },
            {
              onError: (error) => {
                setGesteEnCours(null);
                Alert.alert(
                  t('clubLicenses.alerts.duplicate.failedTitle', 'Duplication impossible'),
                  error?.message || t(
                    'clubLicenses.alerts.duplicate.failedMessage',
                    "La copie n'a pas pu être créée.",
                  ),
                );
              },
              // S06 — ce que ca change vraiment : une copie EN BROUILLON, et
              // l'originale intacte. Les deux valent d'etre dits : c'est ce qui
              // evite de chercher la copie parmi les campagnes ouvertes.
              onSuccess: () => {
                setGesteEnCours(null);
                Alert.alert(
                  t('clubLicenses.alerts.duplicate.doneTitle', 'Copie créée'),
                  t(
                    'clubLicenses.alerts.duplicate.doneMessageStart',
                    "« {{copyName}} » t'attend en brouillon, à ouvrir quand tu veux. ",
                    { copyName: nomDeLaCopie, ...SANS_ECHAPPEMENT },
                  )
                  + t(
                    'clubLicenses.alerts.duplicate.doneMessageEnd',
                    "« {{name}} » n'a pas bougé.",
                    { name: nom, ...SANS_ECHAPPEMENT },
                  ),
                );
              },
            },
          );
        },
        text: t('clubLicenses.actions.duplicate', 'Dupliquer'),
      },
    ]);
  }, [duplicateMutation, t]);

  // `forcedAction` force l'etape du cycle de vie plutot que de la deduire du
  // statut. R01 s'en sert pour proposer « Archiver » quand une suppression est
  // refusee — sans le type explicite, il serait infere `null` et refuserait
  // toute chaine.
  const handleLifecycleCampaign = useCallback((
    /** @type {any} */ item,
    /** @type {string|null} */ forcedAction = null,
  ) => {
    const lifecycle = forcedAction ? { action: forcedAction, label: forcedAction } : lifecycleForCampaign(item);
    if (!lifecycle) return;
    // S06 — CHAQUE ETAPE PORTE MAINTENANT TROIS TEXTES, PAS UN.
    // `title`/`description`/`confirm` : ce qu'on demande AVANT.
    // `doneTitle`/`doneDescription` : ce qui a CHANGE, dit apres la reponse du
    // serveur — jamais « c'est fait », toujours l'effet reel sur les joueurs.
    // `failedTitle` : l'echec, sous le nom du geste tente, avec le message du
    // serveur en corps (c'est lui qui sait ce qui bloque).
    // T03 ajoute un QUATRIEME texte, `pendingLabel` : ce qui se passe PENDANT.
    // Il manquait, et c est lui qu Adel a cherche pendant « quelques secondes ».
    const copyByAction = {
      archive: {
        confirm: t('clubLicenses.actions.archive', 'Archiver'),
        description: t(
          'clubLicenses.lifecycle.archive.description',
          'La campagne restera consultable dans les archives.',
        ),
        doneDescription: t(
          'clubLicenses.lifecycle.archive.doneStart',
          "sort de la liste. Rien n'est perdu : elle reste consultable ",
        )
          + t('clubLicenses.lifecycle.archive.doneEnd', 'dans les archives.'),
        doneTitle: t('clubLicenses.lifecycle.archive.doneTitle', 'Campagne archivée'),
        failedTitle: t('clubLicenses.lifecycle.archive.failedTitle', 'Archivage impossible'),
        pendingLabel: t('clubLicenses.lifecycle.archive.pending', 'Archivage en cours...'),
        title: t('clubLicenses.lifecycle.archive.title', 'Archiver la campagne'),
      },
      close: {
        confirm: t('clubLicenses.actions.end', 'Clore'),
        description: t(
          'clubLicenses.lifecycle.close.description',
          'Les relances et les paiements resteront visibles, mais la campagne passe en fin '
            + 'de cycle.',
        ),
        doneDescription: t(
          'clubLicenses.lifecycle.close.doneStart',
          "passe en fin de cycle. Plus aucun membre n'y sera ajouté ; ",
        )
          + t(
            'clubLicenses.lifecycle.close.doneEnd',
            'les paiements déjà encaissés et les relances restent consultables.',
          ),
        doneTitle: t('clubLicenses.lifecycle.close.doneTitle', 'Campagne close'),
        failedTitle: t('clubLicenses.lifecycle.close.failedTitle', 'Clôture impossible'),
        pendingLabel: t('clubLicenses.lifecycle.close.pending', 'Clôture en cours...'),
        title: t('clubLicenses.lifecycle.close.title', 'Clore la campagne'),
      },
      launch: {
        confirm: t('clubLicenses.actions.open', 'Ouvrir'),
        description: t(
          'clubLicenses.lifecycle.launch.description',
          'La campagne devient active et synchronise automatiquement les membres concernés.',
        ),
        doneDescription: t(
          'clubLicenses.lifecycle.launch.doneStart',
          'est ouverte. Les joueurs peuvent payer, et les membres concernés ',
        )
          + t('clubLicenses.lifecycle.launch.doneEnd', 'y sont ajoutés automatiquement.'),
        doneTitle: t('clubLicenses.lifecycle.launch.doneTitle', 'Campagne ouverte'),
        failedTitle: t('clubLicenses.lifecycle.launch.failedTitle', 'Ouverture impossible'),
        // Ces trois-la nomment le TRAVAIL, pas le geste : `launch`, `resume` et
        // `reopen` declenchent cote serveur une synchronisation membre par
        // membre (license.ts:2562). C est la qu on attend le plus longtemps,
        // donc c est la qu il faut dire pourquoi.
        pendingLabel: t(
          'clubLicenses.lifecycle.launch.pending',
          'Ouverture en cours, les membres sont ajoutés...',
        ),
        title: t('clubLicenses.lifecycle.launch.title', 'Ouvrir la campagne'),
      },
      pause: {
        confirm: t('clubLicenses.actions.pause', 'Mettre en pause'),
        description: t(
          'clubLicenses.lifecycle.pause.description',
          'La campagne reste visible, mais bloque les ajouts auto, les relances et les '
            + 'paiements membres.',
        ),
        doneDescription: t(
          'clubLicenses.lifecycle.pause.doneStart',
          'est en pause : les joueurs ne peuvent plus payer, les relances ',
        )
          + t(
            'clubLicenses.lifecycle.pause.doneMiddle',
            "automatiques s'arrêtent et aucun membre n'y sera ajouté. ",
          )
          + t('clubLicenses.lifecycle.pause.doneEnd', 'Tu peux la reprendre quand tu veux.'),
        doneTitle: t('clubLicenses.lifecycle.pause.doneTitle', 'Campagne en pause'),
        failedTitle: t('clubLicenses.lifecycle.pause.failedTitle', 'Mise en pause impossible'),
        pendingLabel: t('clubLicenses.lifecycle.pause.pending', 'Mise en pause en cours...'),
        title: t('clubLicenses.lifecycle.pause.title', 'Mettre la campagne en pause'),
      },
      reopen: {
        confirm: t('clubLicenses.actions.reopen', 'Reouvrir'),
        description: t(
          'clubLicenses.lifecycle.reopen.description',
          'La campagne redevient active et resynchronise les membres concernés.',
        ),
        doneDescription: t(
          'clubLicenses.lifecycle.openAgainStart',
          'est de nouveau ouverte. Les joueurs peuvent payer, et les membres ',
        )
          + t(
            'clubLicenses.lifecycle.reopen.doneEnd',
            'concernés y sont rajoutés automatiquement.',
          ),
        doneTitle: t('clubLicenses.lifecycle.reopen.doneTitle', 'Campagne réouverte'),
        failedTitle: t('clubLicenses.lifecycle.reopen.failedTitle', 'Réouverture impossible'),
        pendingLabel: t(
          'clubLicenses.lifecycle.reopen.pending',
          'Réouverture en cours, les membres sont ajoutés...',
        ),
        title: t('clubLicenses.lifecycle.reopen.title', 'Reouvrir la campagne'),
      },
      resume: {
        confirm: t('clubLicenses.actions.resume', 'Reprendre'),
        description: t(
          'clubLicenses.lifecycle.resume.description',
          'La campagne redevient active et resynchronise automatiquement les membres éligibles.',
        ),
        doneDescription: t(
          'clubLicenses.lifecycle.openAgainStart',
          'est de nouveau ouverte. Les joueurs peuvent payer, et les membres ',
        )
          + t(
            'clubLicenses.lifecycle.resume.doneEnd',
            'éligibles y sont rajoutés automatiquement.',
          ),
        doneTitle: t('clubLicenses.lifecycle.resume.doneTitle', 'Campagne reprise'),
        failedTitle: t('clubLicenses.lifecycle.resume.failedTitle', 'Reprise impossible'),
        pendingLabel: t('clubLicenses.lifecycle.resume.pending', 'Reprise en cours...'),
        title: t('clubLicenses.lifecycle.resume.title', 'Reprendre la campagne'),
      },
    };
    const copy = copyByAction[lifecycle.action];
    const nom = item?.name || t('clubLicenses.lifecycle.nameFallback', 'Cette campagne');
    const identifiantCampagne = item.documentId || item.id;
    Alert.alert(copy.title, copy.description, [
      { style: 'cancel', text: t('clubLicenses.actions.cancel', 'Annuler') },
      {
        onPress: () => {
          // ⛔ Pose AVANT l envoi, effacee dans LES DEUX issues : une carte qui
          // resterait figee sur « en cours » serait pire que le silence.
          setGesteEnCours({ campagneId: identifiantCampagne, libelle: copy.pendingLabel });
          transitionMutation.mutate(
            { action: lifecycle.action, id: identifiantCampagne },
            {
              onError: (error) => {
                setGesteEnCours(null);
                Alert.alert(
                  copy.failedTitle,
                  error?.message || t(
                    'clubLicenses.lifecycle.serverRefused',
                    'Le serveur a refusé ce changement.',
                  ),
                );
              },
              onSuccess: () => {
                setGesteEnCours(null);
                Alert.alert(copy.doneTitle, t(
                  'clubLicenses.lifecycle.doneMessage',
                  '« {{name}} » {{description}}',
                  { description: copy.doneDescription, name: nom, ...SANS_ECHAPPEMENT },
                ));
              },
            },
          );
        },
        text: copy.confirm,
      },
    ]);
  }, [transitionMutation, t]);

  const handleDeleteDraft = useCallback((item) => {
    const nom = item?.name || t('clubLicenses.alerts.deleteDraft.nameFallback', 'Ce brouillon');
    Alert.alert(t('clubLicenses.alerts.deleteDraft.title', 'Supprimer le brouillon'), t(
      'clubLicenses.alerts.deleteDraft.message',
      'Supprimer definitivement cette campagne non lancée ?',
    ), [
      { style: 'cancel', text: t('clubLicenses.actions.cancel', 'Annuler') },
      {
        onPress: () => deleteMutation.mutate(item.documentId || item.id, {
          onError: (error) => Alert.alert(
            t('clubLicenses.alerts.deleteFailedTitle', 'Suppression impossible'),
            error?.message || t(
              'clubLicenses.alerts.deleteFailedMessage',
              'La suppression a échoué.',
            ),
          ),
          onSuccess: () => Alert.alert(
            t('clubLicenses.alerts.deleteDraft.doneTitle', 'Brouillon supprimé'),
            t(
              'clubLicenses.alerts.deleteDraft.doneStart',
              "« {{name}} » est supprimé. Un brouillon n'ayant jamais été ouvert, ",
              { name: nom, ...SANS_ECHAPPEMENT },
            )
            + t(
              'clubLicenses.alerts.deleteDraft.doneEnd',
              'aucune cotisation ne disparaît avec lui.',
            ),
          ),
        }),
        style: 'destructive',
        text: t('clubLicenses.actions.delete', 'Supprimer'),
      },
    ]);
  }, [deleteMutation, t]);

  // R01 (2026-08-13) — SUPPRIMER UNE CAMPAGNE, EN DISANT CE QU ON PERD.
  //
  // Adel en recette : « impossible de supprimer une campagne volontairement, il
  // n y a pas de bouton prevu ». Il n y en avait qu un, « Supprimer le brouillon »,
  // reserve aux campagnes non lancees — donc jamais celle qu on veut retirer.
  //
  // Deux chemins, et le premier est un REFUS :
  //   * la campagne a deja encaisse -> on ne supprime pas, on propose d ARCHIVER ;
  //   * sinon -> on demande confirmation en NOMMANT le nombre de cotisations qui
  //     partent avec elle.
  // Les chiffres viennent de `item.totals`, que la liste porte deja (le serveur
  // les calcule dans listCampaigns) : aucun appel de plus pour poser la question.
  // Le serveur reste l arbitre — s il refuse, on reaffiche SON message, qui nomme
  // lui aussi ce qui bloque.
  // `item` est la campagne de la liste, avec ses `totals`.
  const handleDeleteCampaign = useCallback((/** @type {any} */ item) => {
    // `compteurs` et non `totals` : le nom court est deja pris par la synthese
    // du hub (l. 1097), et le masquer rendrait les deux illisibles.
    const compteurs = item?.totals || {};
    const nom = item?.name || t('clubLicenses.lifecycle.nameFallback', 'Cette campagne');
    const nombreCotisations = Number(compteurs.total) || 0;
    const nombreMembresAyantPaye = (Number(compteurs.paidCount) || 0)
      + (Number(compteurs.partialCount) || 0);
    const montantEncaisseCents = Number(compteurs.paidCents) || 0;
    const identifiant = item?.documentId || item?.id;

    if (montantEncaisseCents > 0 || nombreMembresAyantPaye > 0) {
      const lifecycle = lifecycleForCampaign(item);
      const peutArchiverMaintenant = lifecycle?.action === 'archive';
      const sortie = peutArchiverMaintenant
        ? t(
          'clubLicenses.alerts.deleteCampaign.canArchive',
          "Tu peux l'archiver : elle sort de la liste, et rien n'est perdu.",
        )
        : t(
          'clubLicenses.alerts.deleteCampaign.closeFirst',
          "Clos-la d'abord, puis archive-la : elle sortira de la liste sans rien perdre.",
        );
      Alert.alert(
        t('clubLicenses.alerts.deleteFailedTitle', 'Suppression impossible'),
        t(
          'clubLicenses.alerts.deleteCampaign.refusedStart',
          '« {{name}} » a déjà encaissé {{amount}} ',
          { amount: formatLicenseMoney(montantEncaisseCents), name: nom, ...SANS_ECHAPPEMENT },
        )
        + t('clubLicenses.alerts.deleteCampaign.refusedMembers', {
          count: nombreMembresAyantPaye,
          defaultValue_one: 'auprès de {{count}} membre. ',
          defaultValue_other: 'auprès de {{count}} membres. ',
        })
        + t(
          'clubLicenses.alerts.deleteCampaign.refusedEnd',
          "On ne supprime pas une campagne qui porte de l'argent.\n\n{{nextStep}}",
          { nextStep: sortie, ...SANS_ECHAPPEMENT },
        ),
        [
          { style: 'cancel', text: t('clubLicenses.actions.cancel', 'Annuler') },
          ...(lifecycle ? [{
            onPress: () => handleLifecycleCampaign(item, lifecycle.action),
            text: peutArchiverMaintenant ? t(
              'clubLicenses.actions.archive',
              'Archiver',
            ) : lifecycle.label,
          }] : []),
        ],
      );
      return;
    }

    const cotisationsPerdues = nombreCotisations > 0
      ? t('clubLicenses.alerts.deleteCampaign.lostFees', {
        count: nombreCotisations,
        defaultValue_one: ', avec ses {{count}} cotisation.',
        defaultValue_other: ', avec ses {{count}} cotisations.',
      })
      : '.';
    Alert.alert(
      t('clubLicenses.alerts.deleteCampaign.title', 'Supprimer cette campagne ?'),
      t(
        'clubLicenses.alerts.deleteCampaign.messageStart',
        '« {{name}} » sera définitivement supprimée{{lostFees}}',
        { lostFees: cotisationsPerdues, name: nom, ...SANS_ECHAPPEMENT },
      )
      + t(
        'clubLicenses.alerts.deleteCampaign.messageNoPayment',
        "\n\nAucun paiement n'a été encaissé : rien d'autre ne sera perdu. ",
      )
      + t(
        'clubLicenses.alerts.deleteCampaign.messageIrreversible',
        'Cette action est irréversible.',
      ),
      [
        { style: 'cancel', text: t('clubLicenses.actions.cancel', 'Annuler') },
        {
          onPress: () => deleteMutation.mutate(identifiant, {
            onError: (error) => Alert.alert(
              t('clubLicenses.alerts.deleteFailedTitle', 'Suppression impossible'),
              error?.message || t(
                'clubLicenses.alerts.deleteFailedMessage',
                'La suppression a échoué.',
              ),
            ),
            // S06 — LE MESSAGE QUI MANQUAIT (point 12 de la recette). Il
            // REUTILISE le chiffre que la confirmation vient d'afficher : c'est
            // le meme `item.totals.total`, aucun appel de plus, et l'utilisateur
            // retrouve donc exactement le nombre qu'il a accepte de perdre.
            onSuccess: () => Alert.alert(
              t('clubLicenses.alerts.deleteCampaign.doneTitle', 'Campagne supprimée'),
              nombreCotisations > 0
                ? t(
                  'clubLicenses.alerts.deleteCampaign.doneWithFeesStart',
                  '« {{name}} » est supprimée, avec ses {{fees}} ',
                  { fees: nombreCotisations, name: nom, ...SANS_ECHAPPEMENT },
                )
                  + t('clubLicenses.alerts.deleteCampaign.doneWithFeesEnd', {
                    count: nombreCotisations,
                    defaultValue_one: 'cotisation.',
                    defaultValue_other: 'cotisations.',
                  })
                : t(
                  'clubLicenses.alerts.deleteCampaign.doneNoFees',
                  '« {{name}} » est supprimée. Elle ne portait aucune cotisation.',
                  { name: nom, ...SANS_ECHAPPEMENT },
                ),
            ),
          }),
          style: 'destructive',
          text: t('clubLicenses.actions.delete', 'Supprimer'),
        },
      ],
    );
  }, [deleteMutation, handleLifecycleCampaign, t]);

  const retryData = useCallback(() => {
    campaignQuery.refetch();
    campaignsQuery.refetch();
    if (campaignId) {
      dashboardQuery.refetch();
      assignmentsQuery.refetch();
      paymentReviewsQuery.refetch();
    }
  }, [assignmentsQuery, campaignId, campaignQuery, campaignsQuery, dashboardQuery, paymentReviewsQuery]);

  // Y06 — `extraParams` sert au geste « A payé » de la carte : la liste emmene
  // sur la fiche AVEC la fenetre d encaissement deja ouverte. ⛔ On ne recopie
  // pas ce formulaire ici : il n existe qu un seul endroit ou l argent s encaisse.
  const openAssignmentDetail = useCallback((item, extraParams) => {
    navigation.navigate(RouteNames.ClubLicenseMemberDetail, {
      assignmentId: item?.documentId || item?.id,
      campaignId,
      canManageLicenses,
      scope,
      ...extraParams,
    });
  }, [campaignId, canManageLicenses, navigation, scope]);

  // Y06 — LE CHEMIN VERS LA DELEGATION, PAS UNE COPIE DU REGLAGE.
  //
  // 🗣️ Adel, 19/08 : « ou ça, je peux ajouter cette option ? ». Le reglage
  // existe (lot W02) et il vit dans « Modifier mon equipe »
  // (`TeamEdit.js`, `authorizedPaymentValidators`). Adel, lui, le cherchait la
  // ou vit l argent : dans les cotisations.
  //
  // ⛔ ON N Y RECOPIE PAS LE FORMULAIRE. Deux endroits pour poser le meme droit,
  // ce sont deux verites qui divergent — et ici c est la caisse du club.
  const openTeamPaymentDelegation = useCallback((team) => {
    const teamId = normalizeFilterValue(team?.value);
    if (!teamId) return;
    navigation.navigate(RouteNames.TeamStack, {
      params: { clubId, teamId },
      screen: RouteNames.TeamEdit,
    });
  }, [clubId, navigation]);

  const handleSelectClub = useCallback(async (club) => {
    const selectedClubId = String(club?.documentId || club?.id || '').trim();
    const currentClubId = String(clubId || '').trim();
    if (!selectedClubId || selectedClubId === currentClubId) {
      return;
    }

    try {
      await switchClubMutation.mutateAsync({ clubId: selectedClubId });
      await refetchUserData?.();
      navigation.replace(RouteNames.ClubLicenses, { clubId: selectedClubId });
    } catch (_error) {
      // Handled by the mutation onError alert.
    }
  }, [clubId, navigation, refetchUserData, switchClubMutation]);

  if (showMemberLicense) {
    // ⛔ Pas de `route` : la LISTE n a aucun parametre. C est le DETAIL
    // (`MyLicenseDetail`) qui lit un `assignmentId`.
    return <MyLicenses navigation={navigation} />;
  }

  // Sur le hub, l'ecran ne rend plus de titre : le navigateur en pose deja un
  // (`ClubStack.js:172`, « Cotisations », avec sa fleche de retour dont la
  // cible tactile fait deja 44 pt via `hitSlop.min44From32`). Le dirigeant
  // lisait donc « Cotisations » DEUX FOIS, l'un sous l'autre — meme famille que
  // les deux fleches de retour empilees du lot D2.
  // La vue « detail d'une campagne » garde son entete : elle est hors lot, et
  // son entete de navigation porte le nom de la campagne, pas « Cotisations ».
  const renderTopHeader = () => (
    <View>
      {managerViewEnabled && clubs?.length > 1 ? (
        <ClubSelector
          activeClubId={clubId}
          clubs={clubs}
          isLoading={switchClubMutation.isPending}
          onSelectClub={handleSelectClub}
          title={t('clubLicenses.header.chooseClub', 'Choisir un club')}
        />
      ) : null}
      {isFocusedCampaignView ? (
        <>
          <Text style={[Fonts.h2, Fonts.neutral00]}>
            {t('clubLicenses.header.title', 'Cotisations')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[8]]}>
            {t(
              'clubLicenses.header.detailSubtitle',
              'Detail complet de la campagne {{name}}.',
              {
                name: campaign?.name || t('clubLicenses.header.selectedFallback', 'selectionnee'),
                ...SANS_ECHAPPEMENT,
              },
            )}
          </Text>
        </>
      ) : null}
    </View>
  );

  const renderDashboardHeader = () => (
    <View style={Spaces.gap[licenseSpacing.sectionGap]}>
      {/*
        Le hub repond en un bloc : encaisse / attendu, la barre, le reste et les
        retards. Les 4 cartes de statistiques restent sur la vue « detail d'une
        campagne », ou elles servent de filtre sur la liste des membres — c'est
        leur seul role reel, et cette vue est hors lot.
      */}
      {isFocusedCampaignView ? (
        <>
          <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
            <StatCard
              active={memberQuickFilter === 'expected'}
              label={t('clubLicenses.quickFilters.expected', 'Attendu')}
              onPress={() => handleOpenMemberStatView('expected')}
              tone={Colors.primary500}
              value={money(totals.expectedCents, campaign?.currency || 'EUR')}
            />
            <StatCard
              active={memberQuickFilter === 'paid'}
              label={t('clubLicenses.quickFilters.paid', 'Encaisse')}
              onPress={() => handleOpenMemberStatView('paid')}
              tone={Colors.success500}
              value={money(totals.paidCents, campaign?.currency || 'EUR')}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
            <StatCard
              active={memberQuickFilter === 'remaining'}
              label={t('clubLicenses.quickFilters.remaining', 'Reste')}
              onPress={() => handleOpenMemberStatView('remaining')}
              tone={Colors.warning500}
              value={money(totals.remainingCents, campaign?.currency || 'EUR')}
            />
            <StatCard
              active={memberQuickFilter === 'overdue'}
              label={t('clubLicenses.quickFilters.overdue', 'Retards')}
              onPress={() => handleOpenMemberStatView('overdue')}
              tone={Colors.error500}
              value={String(totals.overdueCount || 0)}
            />
          </View>
        </>
      ) : (
        <CampaignSummary
          currency={campaign?.currency || 'EUR'}
          expectedCents={totals.expectedCents}
          overdueCount={totals.overdueCount}
          paidCents={totals.paidCents}
          remainingCents={totals.remainingCents}
        />
      )}
      {(() => {
        // La carte « Vue d ensemble des campagnes » a ete retiree : elle
        // n'affichait aucun chiffre et ne portait aucune action.
        if (!isFocusedCampaignView) {
          return null;
        }

        if (isFocusedMembersView) {
          return null;
        }

        return (
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
              <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                {t('clubLicenses.dashboard.tracking', 'Suivi de campagne')}
              </Text>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                {campaign?.name || t(
                  'clubLicenses.campaignCard.nameFallback',
                  'Campagne',
                )}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {campaign?.seasonLabel || '-'}
                {' '}
                -
                {' '}
                {campaignStatusLabel[campaign?.status] || campaign?.status}
              </Text>
            </View>
            <Button
              onPress={handleReturnToCampaignOverview}
              title={t(
                'clubLicenses.dashboard.viewAll',
                'Voir toutes les campagnes',
              )}
              variant="Secondary"
            />
          </View>
        );
      })()}
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
                description={t(
                  'clubLicenses.overview.info.description',
                  'Retrouve ici l identité, la période et le positionnement de la campagne '
                    + 'sélectionnée.',
                )}
                title={t('clubLicenses.overview.info.title', 'Informations de campagne')}
              >
                <View style={Spaces.gap[12]}>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    {campaignDescription || t(
                      'clubLicenses.overview.noDescription',
                      'Aucune description visible pour les membres.',
                    )}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <DetailPill label={`Type: ${
                      campaignTypeLabel[campaign?.type]
                      || campaign?.type
                      || t('clubLicenses.campaignTypes.license', 'Licence')
                    }`}
                    />
                    <DetailPill label={t(
                      'clubLicenses.overview.season',
                      'Saison: {{season}}',
                      {
                        season: campaign?.seasonLabel
                          || t('clubLicenses.values.notSpecified', 'Non renseignée'),
                        ...SANS_ECHAPPEMENT,
                      },
                    )}
                    />
                    <DetailPill label={t(
                      'clubLicenses.overview.period',
                      'Du {{start}} au {{end}}',
                      {
                        end: formatDateLabel(campaign?.endDate),
                        start: formatDateLabel(campaign?.startDate),
                        ...SANS_ECHAPPEMENT,
                      },
                    )}
                    />
                    <DetailPill label={t(
                      'clubLicenses.overview.status',
                      'Statut: {{status}}',
                      {
                        status: campaignStatusLabel[campaign?.status]
                          || campaign?.status
                          || t('clubLicenses.overview.unknownStatus', 'Inconnu'),
                        ...SANS_ECHAPPEMENT,
                      },
                    )}
                    />
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
                      <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                        {t('clubLicenses.overview.internalNote', 'Note interne')}
                      </Text>
                      <Text style={[Fonts.p2, Fonts.neutral200]}>{campaignInternalNote}</Text>
                    </View>
                  ) : null}
                </View>
              </CampaignDetailSection>

              <CampaignDetailSection
                description={t(
                  'clubLicenses.overview.pricing.description',
                  'Montant de référence, ciblage des membres et règles tarifaires associées.',
                )}
                title={t('clubLicenses.overview.pricing.title', 'Tarification et public')}
              >
                <View style={Spaces.gap[12]}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <DetailPill label={t(
                      'clubLicenses.overview.defaultAmount',
                      'Montant par défaut: {{amount}}',
                      {
                        amount: money(
                          campaign?.defaultAmountCents || 0,
                          campaign?.currency || 'EUR',
                        ),
                        ...SANS_ECHAPPEMENT,
                      },
                    )}
                    />
                    <DetailPill label={t(
                      'clubLicenses.overview.currency',
                      'Devise: {{currency}}',
                      { currency: campaign?.currency || 'EUR', ...SANS_ECHAPPEMENT },
                    )}
                    />
                    {campaign?.dueDate ? (
                      <DetailPill label={t(
                        'clubLicenses.overview.dueDate',
                        'Échéance: {{date}}',
                        { date: formatDateLabel(campaign.dueDate), ...SANS_ECHAPPEMENT },
                      )}
                      />
                    ) : null}
                  </View>
                  <View style={Spaces.gap[8]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                      {t('clubLicenses.overview.audience', 'Public concerne')}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {(targetSummary.length ? targetSummary : [t(
                        'clubLicenses.overview.noFilter',
                        'Aucun filtre défini',
                      )]).map((item) => (
                        <DetailPill key={item} label={item} />
                      ))}
                    </View>
                  </View>
                  <View style={Spaces.gap[8]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                      {t('clubLicenses.overview.pricingRules', 'Règles tarifaires')}
                    </Text>
                    {pricingRuleSummaries.length ? pricingRuleSummaries.slice(0, 4).map((item) => (
                      <Text key={item} style={[Fonts.p2, Fonts.neutral200]}>{`\u2022 ${item}`}</Text>
                    )) : (
                      <Text style={[Fonts.p2, Fonts.neutral200]}>
                        {t(
                          'clubLicenses.overview.noPricingRule',
                          'Aucune règle tarifaire speciale.',
                        )}
                      </Text>
                    )}
                    {pricingRuleSummaries.length > 4 ? (
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {t(
                          'clubLicenses.overview.moreRules',
                          '+ {{more}} autre(s) règle(s)',
                          { more: pricingRuleSummaries.length - 4, ...SANS_ECHAPPEMENT },
                        )}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </CampaignDetailSection>

              <CampaignDetailSection
                description={t(
                  'clubLicenses.overview.payments.description',
                  'Moyens de paiement autorises, gestion du paiement en ligne et '
                    + 'organisation des échéances.',
                )}
                title={t('clubLicenses.overview.payments.title', 'Paiements et échéancier')}
              >
                <View style={Spaces.gap[12]}>
                  <View style={Spaces.gap[8]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                      {t('clubLicenses.overview.paymentMethods', 'Moyens de paiement')}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {(enabledPaymentModes.length ? enabledPaymentModes : [t(
                        'clubLicenses.overview.noMethod',
                        'Aucun moyen active',
                      )]).map((item) => (
                        <DetailPill key={item} label={item} />
                      ))}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <DetailPill label={installmentSummary} />
                    <DetailPill label={t(
                      'clubLicenses.overview.onlinePayment',
                      'Paiement en ligne {{requirement}}',
                      {
                        requirement: campaign?.onlinePaymentRequired
                          ? t('clubLicenses.documents.required', 'obligatoire')
                          : t('clubLicenses.overview.optional', 'optionnel'),
                        ...SANS_ECHAPPEMENT,
                      },
                    )}
                    />
                    <DetailPill label={t(
                      'clubLicenses.overview.collection',
                      'Encaissement: {{owner}}',
                      {
                        owner: paymentOwnerLabel[campaign?.paymentOwner]
                          || campaign?.paymentOwner
                          || 'Section',
                        ...SANS_ECHAPPEMENT,
                      },
                    )}
                    />
                  </View>
                  {nonEmptyText(campaign?.externalPaymentUrl) ? (
                    <Text numberOfLines={2} style={[Fonts.p2, Fonts.neutral200]}>
                      {t(
                        'clubLicenses.overview.paymentLink',
                        'Lien de paiement: {{url}}',
                        { url: campaign.externalPaymentUrl, ...SANS_ECHAPPEMENT },
                      )}
                    </Text>
                  ) : null}
                </View>
              </CampaignDetailSection>

              <View style={Spaces.gap[licenseSpacing.actionGap]}>
                <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                  <Button
                    onPress={() => navigation.navigate(RouteNames.ClubLicenseCampaignSettings, { campaignId, clubId })}
                    style={{ flex: 1 }}
                    title={t('clubLicenses.actions.settings', 'Parametres')}
                    variant="Secondary"
                  />
                  <Button
                    onPress={() => navigation.navigate(RouteNames.ClubLicensePayments, {
                      campaignId, canManageLicenses, clubId, scope,
                    })}
                    style={{ flex: 1 }}
                    title={t(
                      'clubLicenses.overview.pendingPayments',
                      'Paiements à valider ({{pending}})',
                      { pending: totals.manualReviewCount || 0, ...SANS_ECHAPPEMENT },
                    )}
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
                    title={t('clubLicenses.lifecycle.close.title', 'Clore la campagne')}
                    variant="Secondary"
                  />
                ) : null}
              </View>
            </>
          ) : null}

          {detailTab === 'members' ? (
            <View
              onLayout={(event) => {
                const nextOffset = Math.round(event?.nativeEvent?.layout?.y || 0);
                setMembersSectionOffset((currentOffset) => (
                  currentOffset === nextOffset ? currentOffset : nextOffset
                ));
              }}
              style={Spaces.gap[12]}
            >
              <View style={Spaces.gap[licenseSpacing.actionGap]}>
                <View style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: 12,
                  justifyContent: 'space-between',
                }}
                >
                  <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                    {t('clubLicenses.tabs.members', 'Membres')}
                  </Text>
                  {activeMemberFilterPills.length ? (
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
                      <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                        {t('clubLicenses.members.reset', 'Réinitialiser')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <TextInput
                  onChangeText={setSearch}
                  placeholder={t('clubLicenses.members.searchPlaceholder', 'Rechercher un membre')}
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
                    label={activeMemberFilterCount ? t(
                      'clubLicenses.members.filtersCount',
                      'Filtres ({{active}})',
                      { active: activeMemberFilterCount, ...SANS_ECHAPPEMENT },
                    ) : t(
                      'clubLicenses.members.filters',
                      'Filtres',
                    )}
                    onPress={() => setMemberFilterMenuKey('filters')}
                  />
                  {statusFilters.map((filter) => (
                    <LicenseSelectionChip
                      key={filter.value || 'all'}
                      label={filter.label}
                      onPress={() => {
                        setMemberQuickFilter('');
                        setStatusFilter(filter.value);
                      }}
                      selected={statusFilter === filter.value}
                    />
                  ))}
                </ScrollView>
                {activeMemberFilterPills.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {activeMemberFilterPills.map((pill) => (
                      <DetailPill key={pill} label={pill} />
                    ))}
                  </View>
                ) : null}
                {assignmentsQuery.isLoading ? (
                  // PERF2 — la FORME des lignes de membres, pas une phrase.
                  <View testID="club-licenses-members-skeleton">
                    <WithDataWrapper isLoading wrapperStyle={[Spaces.gap[12]]}>
                      <SkeletonBlock height={64} />
                      <SkeletonBlock height={64} />
                      <SkeletonBlock height={64} />
                    </WithDataWrapper>
                  </View>
                ) : null}
                {!assignmentsQuery.isLoading && memberListSummary && (search.trim() || activeMemberFilterPills.length) ? (
                  <Text style={[Fonts.p3, Fonts.neutral200]}>{memberListSummary}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {detailTab === 'payments' ? (
            <>
              <CampaignDetailSection
                description={t(
                  'clubLicenses.payments.description',
                  'Pilote les encaissements et les dossiers à valider pour cette campagne.',
                )}
                title={t('clubLicenses.payments.title', 'Pilotage des paiements')}
              >
                <View style={Spaces.gap[12]}>
                  <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                    <StatCard
                      label={t(
                        'clubLicenses.status.manualReview',
                        'A valider',
                      )}
                      tone={Colors.warning500}
                      value={String(totals.manualReviewCount || 0)}
                    />
                    <StatCard
                      label={t(
                        'clubLicenses.payments.paidStat',
                        'Payees',
                      )}
                      tone={Colors.success500}
                      value={money(totals.paidCents || 0, campaign?.currency || 'EUR')}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                    <Button
                      onPress={() => navigation.navigate(RouteNames.ClubLicensePayments, {
                        campaignId, canManageLicenses, clubId, scope,
                      })}
                      style={{ flex: 1 }}
                      title={t('clubLicenses.payments.openValidations', 'Ouvrir les validations')}
                    />
                    <Button
                      onPress={() => navigation.navigate(RouteNames.ClubLicenseCampaignSettings, { campaignId, clubId })}
                      style={{ flex: 1 }}
                      title={t('clubLicenses.payments.settings', 'Régler les paiements')}
                      variant="Secondary"
                    />
                  </View>
                  {/*
                    Y06 — LE RENVOI VERS LA DELEGATION.
                    ⚠️ UNE CAMPAGNE COUVRE PLUSIEURS EQUIPES : elle appartient a un
                    CLUB (schema `license-campaign`, relation `club`), pas a une
                    equipe. La delegation, elle, se donne equipe par equipe. Un
                    renvoi vers UNE seule equipe serait donc faux : on nomme
                    toutes celles que les cotisations chargées font apparaitre.
                    🔒 Ce bloc ne s affiche que dans la vue dirigeant : seul le
                    dirigeant du club peut poser cette delegation (admin,
                    `canDelegatePaymentValidation`).
                  */}
                  <View style={Spaces.gap[8]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                      {t('clubLicenses.payments.whoTitle', 'Qui peut valider les paiements ?')}
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {t(
                        'clubLicenses.payments.whoBody',
                        'Toi, toujours. Tu peux aussi confier l encaissement a un '
                          + 'entraîneur, équipe par équipe : le réglage vit dans la fiche de l '
                          + 'équipe, section « Encaissement des cotisations ».',
                      )}
                    </Text>
                    {memberTeamOptions.length ? memberTeamOptions.map((team) => (
                      <Button
                        key={team.value}
                        onPress={() => openTeamPaymentDelegation(team)}
                        title={t(
                          'clubLicenses.payments.settleForTeam',
                          'Régler pour {{team}}',
                          { team: team.label, ...SANS_ECHAPPEMENT },
                        )}
                        variant="Secondary"
                      />
                    )) : (
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {t(
                          'clubLicenses.payments.noTeam',
                          'Aucune équipe n apparaît encore dans cette campagne.',
                        )}
                      </Text>
                    )}
                    {assignmentsTotalCount > assignments.length ? (
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {t(
                          'clubLicenses.payments.loadedStart',
                          'Seuls les {{loaded}} premiers membres sont ',
                          { loaded: assignments.length, ...SANS_ECHAPPEMENT },
                        )
                        + t(
                          'clubLicenses.payments.loadedEnd',
                          'chargés : d autres équipes peuvent exister.',
                        )}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description={t(
                  'clubLicenses.payments.reviews.description',
                  'Déclarations externes qui attendent une validation dirigeant.',
                )}
                title={t('clubLicenses.payments.reviews.title', 'Paiements à valider maintenant')}
              >
                <View style={Spaces.gap[12]}>
                  {paymentReviewsQuery.isLoading ? (
                    // PERF2 — la FORME des cartes a valider, pas une phrase.
                    <View testID="club-licenses-reviews-skeleton">
                      <WithDataWrapper isLoading wrapperStyle={[Spaces.gap[12]]}>
                        <SkeletonBlock height={76} />
                        <SkeletonBlock height={76} />
                      </WithDataWrapper>
                    </View>
                  ) : null}
                  {!paymentReviewsQuery.isLoading && paymentReviewAssignments.length ? paymentReviewAssignments.slice(0, 5).map((item) => (
                    <AssignmentSignalCard
                      helper={t(
                        'clubLicenses.payments.declarations',
                        '{{declarations}} déclaration(s) - {{amount}}',
                        {
                          amount: money(
                            sumPaymentReviewCents(item),
                            item?.currency || campaign?.currency || 'EUR',
                          ),
                          declarations: (item?.payments || [])
                            .filter((payment) => payment?.status === 'manual_review')
                            .length,
                          ...SANS_ECHAPPEMENT,
                        },
                      )}
                      item={item}
                      key={item?.documentId || item?.id}
                      label={t('clubLicenses.status.manualReview', 'A valider')}
                      onPress={() => openAssignmentDetail(item)}
                    />
                  )) : null}
                  {!paymentReviewsQuery.isLoading && !paymentReviewAssignments.length ? (
                    <Text style={[Fonts.p2, Fonts.neutral200]}>
                      {t(
                        'clubLicenses.payments.noReviews',
                        'Aucune déclaration de paiement n attend ici pour le moment.',
                      )}
                    </Text>
                  ) : null}
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description={t(
                  'clubLicenses.payments.overdue.description',
                  'Membres avec reste à payer déjà en retard.',
                )}
                title={t('clubLicenses.payments.overdue.title', 'Impayes prioritaires')}
              >
                <View style={Spaces.gap[12]}>
                  {overdueAssignments.length ? overdueAssignments.map((item) => (
                    <AssignmentSignalCard
                      helper={t(
                        'clubLicenses.payments.remainingWithReminder',
                        '{{amount}} restant{{reminder}}',
                        {
                          amount: money(
                            item?.amountRemainingCents || 0,
                            item?.currency || campaign?.currency || 'EUR',
                          ),
                          reminder: item?.lastReminderAt
                            ? t('clubLicenses.payments.remindedOn', ' - relance le {{date}}', {
                              date: formatDateLabel(item.lastReminderAt),
                              ...SANS_ECHAPPEMENT,
                            })
                            : '',
                          ...SANS_ECHAPPEMENT,
                        },
                      )}
                      item={item}
                      key={item?.documentId || item?.id}
                      label={t('clubLicenses.status.overdue', 'En retard')}
                      onPress={() => openAssignmentDetail(item)}
                    />
                  )) : (
                    <Text style={[Fonts.p2, Fonts.neutral200]}>
                      {t(
                        'clubLicenses.payments.noOverdue',
                        'Aucun impaye en retard dans cet aperçu.',
                      )}
                    </Text>
                  )}
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description={t(
                  'clubLicenses.payments.channels.description',
                  'Résumé des moyens actifs sur cette campagne.',
                )}
                title={t('clubLicenses.payments.channels.title', 'Canaux actifs')}
              >
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(enabledPaymentModes.length ? enabledPaymentModes : [t(
                    'clubLicenses.overview.noMethod',
                    'Aucun moyen active',
                  )]).map((item) => (
                    <DetailPill key={item} label={item} />
                  ))}
                  {campaign?.paymentModes?.helloasso ? (
                    <DetailPill
                      label={`HelloAsso ${
                        providerReadinessLabel[
                          campaign?.paymentProviderSnapshot?.helloasso?.readiness
                        ]
                        || campaign?.paymentProviderSnapshot?.helloasso?.readiness
                        || t('clubLicenses.campaignCard.toConfigure', 'A configurer')
                      }`}
                    />
                  ) : null}
                </View>
              </CampaignDetailSection>
            </>
          ) : null}

          {detailTab === 'documents' ? (
            <>
              <CampaignDetailSection
                description={t(
                  'clubLicenses.documentsTab.requested.description',
                  'Pièces exigees par la campagne et état global des dossiers membres.',
                )}
                title={t('clubLicenses.documentsTab.requested.title', 'Documents demandes')}
              >
                <View style={Spaces.gap[12]}>
                  {documentRequestSummaries.length ? documentRequestSummaries.map((item) => (
                    <Text key={item} style={[Fonts.p2, Fonts.neutral200]}>{`\u2022 ${item}`}</Text>
                  )) : (
                    <Text style={[Fonts.p2, Fonts.neutral200]}>
                      {t('clubLicenses.documentsTab.noRequested', 'Aucun document demande.')}
                    </Text>
                  )}
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description={t(
                  'clubLicenses.documentsTab.status.description',
                  'Vue d ensemble des statuts documentaires des membres sur cette campagne.',
                )}
                title={t('clubLicenses.documentsTab.status.title', 'État des dossiers')}
              >
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <DetailPill label={t(
                    'clubLicenses.documentsTab.missingCount',
                    'Manquants: {{missing}}',
                    { missing: documentStatusSummary.missing || 0, ...SANS_ECHAPPEMENT },
                  )}
                  />
                  <DetailPill label={t(
                    'clubLicenses.documentsTab.submittedCount',
                    'Deposes: {{submitted}}',
                    { submitted: documentStatusSummary.submitted || 0, ...SANS_ECHAPPEMENT },
                  )}
                  />
                  <DetailPill label={t(
                    'clubLicenses.documentsTab.validatedCount',
                    'Valides: {{validated}}',
                    { validated: documentStatusSummary.validated || 0, ...SANS_ECHAPPEMENT },
                  )}
                  />
                  <DetailPill label={t(
                    'clubLicenses.documentsTab.toReplaceCount',
                    'A remplacer: {{toReplace}}',
                    { toReplace: documentStatusSummary.to_replace || 0, ...SANS_ECHAPPEMENT },
                  )}
                  />
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description={t(
                  'clubLicenses.documentsTab.review.description',
                  'Membres dont les documents ont besoin d une action humaine.',
                )}
                title={t('clubLicenses.documentsTab.review.title', 'Dossiers à vérifier')}
              >
                <View style={Spaces.gap[12]}>
                  {documentReviewAssignments.length ? documentReviewAssignments.map((item) => (
                    <AssignmentSignalCard
                      helper={documentStatusLabel[item?.documentStatus] || t(
                        'clubLicenses.documentsTab.toCheck',
                        'Document à vérifier',
                      )}
                      item={item}
                      key={item?.documentId || item?.id}
                      label={documentStatusLabel[item?.documentStatus] || t(
                        'clubLicenses.documents.fallbackName',
                        'Document',
                      )}
                      onPress={() => openAssignmentDetail(item)}
                    />
                  )) : (
                    <Text style={[Fonts.p2, Fonts.neutral200]}>
                      {t(
                        'clubLicenses.documentsTab.noReview',
                        'Aucun document n attend de vérification dans cet aperçu.',
                      )}
                    </Text>
                  )}
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description={t(
                  'clubLicenses.documentsTab.missing.description',
                  'Dossiers encore incomplets à traiter en priorité.',
                )}
                title={t('clubLicenses.documentsTab.missing.title', 'Documents manquants')}
              >
                <View style={Spaces.gap[12]}>
                  {missingDocumentAssignments.length ? missingDocumentAssignments.map((item) => (
                    <AssignmentSignalCard
                      helper={t(
                        'clubLicenses.documentsTab.remaining',
                        '{{amount}} restant',
                        {
                          amount: money(
                            item?.amountRemainingCents || 0,
                            item?.currency || campaign?.currency || 'EUR',
                          ),
                          ...SANS_ECHAPPEMENT,
                        },
                      )}
                      item={item}
                      key={item?.documentId || item?.id}
                      label={t('clubLicenses.documentsTab.missingLabel', 'Manquant')}
                      onPress={() => openAssignmentDetail(item)}
                    />
                  )) : (
                    <Text style={[Fonts.p2, Fonts.neutral200]}>
                      {t(
                        'clubLicenses.documentsTab.noMissing',
                        'Aucun document manquant dans cet aperçu.',
                      )}
                    </Text>
                  )}
                  {assignmentsTotalCount > assignments.length ? (
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {t(
                        'clubLicenses.memberList.previewShort',
                        'Aperçu sur {{loaded}} membre(s) sur {{total}}.',
                        {
                          loaded: assignments.length,
                          total: assignmentsTotalCount,
                          ...SANS_ECHAPPEMENT,
                        },
                      )}
                    </Text>
                  ) : null}
                </View>
              </CampaignDetailSection>
            </>
          ) : null}

          {detailTab === 'reminders' ? (
            <>
              <CampaignDetailSection
                description={t(
                  'clubLicenses.remindersTab.settings.description',
                  'Automatisation, statuts cibles et historique agrégé des relances.',
                )}
                title={t('clubLicenses.remindersTab.settings.title', 'Configuration des relances')}
              >
                <View style={Spaces.gap[12]}>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>{summarizeReminderStatuses(reminderAutomation.targetStatuses || [])}</Text>
                  {reminderTimingSummary.length ? reminderTimingSummary.map((item) => (
                    <Text key={item} style={[Fonts.p2, Fonts.neutral200]}>{`\u2022 ${item}`}</Text>
                  )) : (
                    <Text style={[Fonts.p2, Fonts.neutral200]}>
                      {t(
                        'clubLicenses.remindersTab.noAutomation',
                        'Aucune relance automatique configuree.',
                      )}
                    </Text>
                  )}
                  {nonEmptyText(campaign?.reminderMessage) ? <Text style={[Fonts.p2, Fonts.neutral200]}>{campaign.reminderMessage}</Text> : null}
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description={t(
                  'clubLicenses.remindersTab.activity.description',
                  'Tu peux lancer une relance groupée ou suivre l intensité des rappels déjà '
                    + 'envoyés.',
                )}
                title={t('clubLicenses.remindersTab.activity.title', 'Activité de relance')}
              >
                <View style={Spaces.gap[12]}>
                  <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                    <StatCard
                      label={t(
                        'clubLicenses.remindersTab.membersReminded',
                        'Membres relances',
                      )}
                      tone={Colors.primary500}
                      value={String(reminderSummary.memberCount || 0)}
                    />
                    <StatCard
                      label={t(
                        'clubLicenses.alerts.bulkReminder.sentTitle',
                        'Relances envoyées',
                      )}
                      tone={Colors.warning500}
                      value={String(reminderSummary.totalCount || 0)}
                    />
                  </View>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    {t('clubLicenses.remindersTab.lastReminder', 'Derniere relance:')}
                    {' '}
                    {reminderSummary.lastReminderAt
                      ? formatDateLabel(reminderSummary.lastReminderAt)
                      : t('clubLicenses.remindersTab.none', 'Aucune')}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
                    <Button
                      isLoading={reminderMutation.isPending}
                      onPress={handleBulkReminder}
                      style={{ flex: 1 }}
                      title={t(
                        'clubLicenses.alerts.bulkReminder.title',
                        'Relancer les non-payeurs',
                      )}
                    />
                    <Button
                      onPress={() => navigation.navigate(RouteNames.ClubLicenseCampaignSettings, { campaignId, clubId })}
                      style={{ flex: 1 }}
                      title={t('clubLicenses.remindersTab.settingsButton', 'Régler les relances')}
                      variant="Secondary"
                    />
                  </View>
                </View>
              </CampaignDetailSection>
              <CampaignDetailSection
                description={t(
                  'clubLicenses.remindersTab.priority.description',
                  'Membres qui devraient être consideres en priorité pour une relance.',
                )}
                title={t('clubLicenses.remindersTab.priority.title', 'A relancer maintenant')}
              >
                <View style={Spaces.gap[12]}>
                  {remindableAssignments.length ? remindableAssignments.map((item) => (
                    <AssignmentSignalCard
                      helper={t(
                        'clubLicenses.remindersTab.priorityHelper',
                        '{{amount}} restant - {{status}}{{reminders}}',
                        {
                          amount: money(
                            item?.amountRemainingCents || 0,
                            item?.currency || campaign?.currency || 'EUR',
                          ),
                          reminders: Number(item?.reminderCount || 0) > 0
                            ? t(
                              'clubLicenses.remindersTab.reminderCount',
                              ' - {{reminders}} relance(s)',
                              { reminders: item.reminderCount, ...SANS_ECHAPPEMENT },
                            )
                            : '',
                          status: statusLabel[item?.status] || item?.status,
                          ...SANS_ECHAPPEMENT,
                        },
                      )}
                      item={item}
                      key={item?.documentId || item?.id}
                      label={t('clubLicenses.remindersTab.priorityLabel', 'A relancer')}
                      onPress={() => openAssignmentDetail(item)}
                    />
                  )) : (
                    <Text style={[Fonts.p2, Fonts.neutral200]}>
                      {t(
                        'clubLicenses.remindersTab.noPriority',
                        'Aucun membre prioritaire à relancer dans cet aperçu.',
                      )}
                    </Text>
                  )}
                  {assignmentsTotalCount > assignments.length ? (
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {t(
                        'clubLicenses.memberList.previewShort',
                        'Aperçu sur {{loaded}} membre(s) sur {{total}}.',
                        {
                          loaded: assignments.length,
                          total: assignmentsTotalCount,
                          ...SANS_ECHAPPEMENT,
                        },
                      )}
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
          <Text style={[Fonts.p3Bold, Fonts.neutral200, { letterSpacing: 1, textTransform: 'uppercase' }]}>
            {isFocusedCampaignView ? t('clubLicenses.campaigns.others', 'Autres campagnes') : t(
              'clubLicenses.campaigns.count',
              'Campagnes · {{campaigns}}',
              { campaigns: campaigns.length, ...SANS_ECHAPPEMENT },
            )}
          </Text>
          {(isFocusedCampaignView
            ? campaigns.filter((item) => (item?.documentId || item?.id) !== campaignId)
            : campaigns
          ).slice(0, 5).map((item) => (
            <CampaignCard
              isSelected={campaignId === (item.documentId || item.id)}
              item={item}
              key={item.documentId || item.id}
              // Le libelle ne descend QUE sur la campagne concernee : une seule
              // carte parle a la fois.
              libelleGesteEnCours={gesteEnCours?.campagneId === (item.documentId || item.id)
                ? gesteEnCours.libelle
                : ''}
              onOpenActions={() => setCampaignActionsFor(item)}
              onPress={() => handleOpenCampaignDashboard(item)}
            />
          ))}
        </View>
      ) : null}
      {shouldShowCampaignManagementActions ? (
        <>
          {/*
            Sur le hub, « Nouvelle campagne » est la seule action de premier
            plan : c'est une tuile pointillee, qui se lit comme un emplacement
            vide a remplir. « Modifier l active » a rejoint la feuille « … » de
            chaque carte, la ou l'action porte enfin le nom de sa campagne.
          */}
          {isFocusedCampaignView ? (
            <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
              <Button
                onPress={() => navigation.navigate(RouteNames.ClubLicenseCampaignSettings, editorCampaignId ? { campaignId: editorCampaignId, clubId } : { clubId })}
                style={{ flex: 1 }}
                title={t('clubLicenses.actions.settings', 'Parametres')}
                variant="Secondary"
              />
              <Button
                onPress={() => navigation.navigate(RouteNames.ClubLicenseCampaignSettings, { clubId })}
                style={{ flex: 1 }}
                title={t('clubLicenses.campaigns.new', 'Nouvelle campagne')}
                variant="Secondary"
              />
            </View>
          ) : (
            <Pressable
              accessibilityHint={t(
                'clubLicenses.campaigns.newHint',
                'Ouvre le tunnel de creation d une campagne de cotisation.',
              )}
              accessibilityLabel={t('clubLicenses.campaigns.new', 'Nouvelle campagne')}
              accessibilityRole="button"
              onPress={() => navigation.navigate(RouteNames.ClubLicenseCampaignSettings, { clubId })}
              style={({ pressed }) => [{
                alignItems: 'center',
                borderColor: withAlpha(Colors.primary500, 0.4),
                borderRadius: licenseRadius.card,
                borderStyle: 'dashed',
                borderWidth: 1,
                justifyContent: 'center',
                minHeight: 64,
                opacity: pressed ? 0.8 : 1,
                paddingHorizontal: licenseSpacing.cardPadding,
                paddingVertical: licenseSpacing.cardPadding,
              }, Platform.OS === 'web' ? { cursor: 'pointer' } : null]}
            >
              <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>
                {t('clubLicenses.campaigns.newTile', '+ Nouvelle campagne')}
              </Text>
            </Pressable>
          )}
          {/*
            D26 : la connexion HelloAsso est un reglage de CLUB — la charge
            envoyee au serveur porte un `clubId`, jamais un `campaignId`. Elle
            sort donc du tunnel de campagne, ou elle etait redemandee a chaque
            creation, et vient ici : une fois pour toutes.
          */}
          <Pressable
            accessibilityHint={t(
              'clubLicenses.helloAsso.settingsHint',
              'Connecte le compte HelloAsso du club, une fois pour toutes.',
            )}
            accessibilityLabel={t(
              'clubLicenses.helloAsso.settingsTitle',
              'Réglages du club — HelloAsso',
            )}
            accessibilityRole="button"
            onPress={() => setIsHelloAssoSheetOpen(true)}
            style={{
              alignItems: 'center',
              borderColor: withAlpha(Colors.primary500, 0.2),
              borderRadius: licenseRadius.card,
              borderWidth: 1,
              flexDirection: 'row',
              justifyContent: 'space-between',
              minHeight: 56,
              paddingHorizontal: licenseSpacing.cardPadding,
              paddingVertical: 12,
            }}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1, paddingRight: 12 }]}>
              {t('clubLicenses.helloAsso.settingsTitle', 'Réglages du club — HelloAsso')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {isHelloAssoReadyForCampaign(clubHelloAssoSnapshot) ? t(
                'clubLicenses.helloAsso.connected',
                'Connecté ✓',
              ) : t(
                'clubLicenses.helloAsso.toConnect',
                'À connecter',
              )}
            </Text>
          </Pressable>
          {/*
            T03 — la campagne OUVERTE n est pas dans la liste (elle en est
            filtree, l. 2348), sa carte ne peut donc pas parler pour elle. Le
            bouton ci-dessous portait deja un tourniquet ; il lui manquait le
            NOM du geste, exactement comme aux cartes.
          */}
          {gesteEnCours?.campagneId === campaignId ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[Fonts.p3Bold, { color: Colors.primary500 }]}
              testID="license-campagne-geste-en-cours"
            >
              {gesteEnCours.libelle}
            </Text>
          ) : null}
          {campaign ? (
            <Button
              isLoading={transitionMutation.isPending}
              onPress={() => handleLifecycleCampaign(campaign)}
              title={lifecycleForCampaign(campaign)?.label ? t(
                'clubLicenses.campaignActions.manageWith',
                '{{action}} la campagne',
                { action: lifecycleForCampaign(campaign)?.label, ...SANS_ECHAPPEMENT },
              ) : t(
                'clubLicenses.campaignActions.manage',
                'Gérer la campagne',
              )}
              variant="Secondary"
            />
          ) : null}
          {campaign?.status === 'draft' ? (
            <Button
              isLoading={deleteMutation.isPending}
              onPress={() => handleDeleteDraft(campaign)}
              title={t(
                'clubLicenses.alerts.deleteDraft.title',
                'Supprimer le brouillon',
              )}
              variant="Secondary"
            />
          ) : null}
        </>
      ) : null}
    </View>
  );

  const renderStaticContent = () => {
    if (isLoading) {
      // PERF2 — les deux vagues de requetes n affichent plus deux phrases
      // nues : la FORME du tableau de bord qui arrive (un en-tete, des cartes).
      return (
        <View style={{ marginTop: 8 }} testID="club-licenses-skeleton">
          <WithDataWrapper isLoading wrapperStyle={[Spaces.gap[12]]}>
            <SkeletonBlock height={120} />
            <SkeletonBlock height={84} />
            <SkeletonBlock height={84} />
          </WithDataWrapper>
        </View>
      );
    }

    if (hasError) {
      return (
        <LicenseEmptyState
          action={(
            <Button
              onPress={retryData}
              title={t(
                'clubLicenses.emptyStates.retry',
                'Réessayer',
              )}
              variant="Secondary"
            />
)}
          description={t(
            'clubLicenses.emptyStates.errorDescription',
            'Impossible de charger la campagne ou les cotisations pour le moment.',
          )}
          title={t('clubLicenses.emptyStates.errorTitle', 'Cotisations indisponibles')}
        />
      );
    }

    if (shouldShowSetup) {
      if (!canManageLicenses) {
        return (
          <LicenseEmptyState
            description={t(
              'clubLicenses.emptyStates.noCampaignDescription',
              'Un dirigeant doit d abord créer et activer une campagne de cotisation.',
            )}
            title={t('clubLicenses.emptyStates.noCampaignTitle', 'Aucune campagne active')}
          />
        );
      }
      return <LicenseSetupIntro />;
    }

    if (!canManageLicenses) {
      return (
        <LicenseEmptyState
          description={t(
            'clubLicenses.emptyStates.coachDescription',
            'Vue limitée aux équipes que tu entraines. Les actions financieres restent '
              + 'réservées aux dirigeants.',
          )}
          title={t('clubLicenses.emptyStates.coachTitle', 'Vue entraîneur')}
        />
      );
    }

    return null;
  };

  const renderAssignmentItem = ({ item }) => (
    <AssignmentCard
      canRemind={canManageLicenses && canAssignmentBeReminded(item)}
      canSetBackToDue={canManageLicenses && canAssignmentBeSetBackToDue(item)}
      // Y06 — DEUX conditions, et elles disent deux choses differentes :
      //   · le DROIT — la regle partagee avec la fiche (`canValidateAssignmentPayment`) ;
      //   · le SENS — `canAssignmentBeReminded` mesure deja « il reste quelque
      //     chose a encaisser » (statut utile ET reste a payer > 0). Une
      //     cotisation soldee ou exemptee n a rien a encaisser : pas de bouton.
      canValidatePayment={canValidateAssignmentPayment(item, canManageLicenses)
        && canAssignmentBeReminded(item)}
      isReminding={singleReminderMutation.isPending && pendingReminderAssignmentId === String(item?.documentId || item?.id)}
      isSettingBackToDue={unwaiveMutation.isPending
        && pendingUnwaiveAssignmentId === String(item?.documentId || item?.id)}
      item={item}
      onPress={() => openAssignmentDetail(item)}
      onRemind={() => handleSingleReminder(item)}
      onSetBackToDue={() => handleSetBackToDue(item)}
      onValidatePayment={() => openAssignmentDetail(item, { openPaymentModal: true })}
    />
  );
  /**
   * Feuille des actions secondaires d'une campagne, ouverte par le bouton « … »
   * de sa carte. Chaque action y porte le nom de SA campagne : l'ancienne
   * rangee de boutons ne le disait pas, et « Modifier l active » designait une
   * campagne que le dirigeant devait deviner.
   * @returns {import('react').ReactElement | null}
   */
  const renderHelloAssoSettingsSheet = () => {
    if (!isHelloAssoSheetOpen) return null;

    const fermer = () => setIsHelloAssoSheetOpen(false);

    return (
      <BottomModal close={fermer} isVisible snapPoints={['86%']}>
        <View style={Spaces.gap[16]}>
          <View style={Spaces.gap[4]}>
            <Text style={[Fonts.h4Black, Fonts.neutral00]}>
              {t('clubLicenses.helloAsso.settingsTitle', 'Réglages du club — HelloAsso')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'clubLicenses.helloAssoSheet.intro',
                'À renseigner une seule fois pour le club. Toutes les campagnes s y '
                  + 'connectent ensuite d un simple interrupteur.',
              )}
            </Text>
          </View>
          <LicenseStatusChip status={clubHelloAssoSnapshot?.readiness || 'not_configured'} />
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {describeHelloAssoReadiness(clubHelloAssoSnapshot)}
          </Text>
          <HelloAssoField
            label={t('clubLicenses.helloAssoSheet.slugLabel', 'Slug organisation')}
            onChangeText={(value) => handleHelloAssoFieldChange('organizationSlug', value)}
            placeholder={t('clubLicenses.helloAssoSheet.slugPlaceholder', 'mon-club')}
            value={helloAssoConfig.organizationSlug}
          />
          <HelloAssoField
            label={t('clubLicenses.helloAssoSheet.environmentLabel', 'Environnement')}
            onChangeText={(value) => handleHelloAssoFieldChange('environment', value)}
            placeholder={t(
              'clubLicenses.helloAssoSheet.environmentPlaceholder',
              'production ou sandbox',
            )}
            value={helloAssoConfig.environment}
          />
          <HelloAssoField
            label="Client id"
            onChangeText={(value) => handleHelloAssoFieldChange('clientId', value)}
            placeholder={clubHelloAssoSnapshot?.clientIdConfigured
              ? t(
                'clubLicenses.helloAssoSheet.clientIdKeep',
                'Laisser vide pour conserver l identifiant actuel',
              )
              : t('clubLicenses.helloAssoSheet.clientIdEnter', 'Renseigne le client id')}
            value={helloAssoConfig.clientId}
          />
          <HelloAssoField
            label="Client secret"
            onChangeText={(value) => handleHelloAssoFieldChange('clientSecret', value)}
            placeholder={clubHelloAssoSnapshot?.clientSecretConfigured
              ? t(
                'clubLicenses.helloAssoSheet.clientSecretKeep',
                'Laisser vide pour conserver le secret actuel',
              )
              : t('clubLicenses.helloAssoSheet.clientSecretEnter', 'Renseigne le client secret')}
            value={helloAssoConfig.clientSecret}
          />
          <Button
            isLoading={helloAssoMutation.isPending}
            onPress={verifyClubHelloAssoConnection}
            title={t('clubLicenses.helloAssoSheet.verify', 'Vérifier la connexion')}
          />
          <Button
            onPress={fermer}
            title={t(
              'clubLicenses.actions.close',
              'Fermer',
            )}
            variant="Secondary"
          />
        </View>
      </BottomModal>
    );
  };

  const renderCampaignActionsSheet = () => {
    if (!campaignActionsFor) return null;

    const lifecycle = lifecycleForCampaign(campaignActionsFor);
    const fermer = () => setCampaignActionsFor(null);
    /**
     * @param {() => void} action
     * @returns {() => void}
     */
    const fermerPuis = (action) => () => {
      fermer();
      action();
    };

    // 50 % et non 40 % : la feuille porte un bouton de plus depuis R01.
    return (
      <BottomModal close={fermer} isVisible snapPoints={['50%']}>
        <View style={Spaces.gap[12]}>
          <View style={Spaces.gap[4]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {campaignActionsFor?.name || t(
                'clubLicenses.campaignCard.nameFallback',
                'Campagne',
              )}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {campaignActionsFor?.seasonLabel || '-'}
              {' · '}
              {campaignStatusLabel[campaignActionsFor?.status] || campaignActionsFor?.status}
            </Text>
          </View>
          <Button
            onPress={fermerPuis(() => handleDuplicateCampaign(campaignActionsFor))}
            title={t('clubLicenses.actions.duplicate', 'Dupliquer')}
            variant="Secondary"
          />
          {lifecycle ? (
            <Button
              isLoading={transitionMutation.isPending}
              onPress={fermerPuis(() => handleLifecycleCampaign(campaignActionsFor))}
              title={lifecycle.label}
              variant="Secondary"
            />
          ) : null}
          <Button
            onPress={fermerPuis(() => navigation.navigate(RouteNames.ClubLicenseCampaignSettings, {
              campaignId: campaignActionsFor?.documentId || campaignActionsFor?.id,
              clubId,
            }))}
            title={t('clubLicenses.actions.edit', 'Modifier')}
            variant="Secondary"
          />
          {/*
            R01 — le geste explicite qui manquait. En dernier, et separe des
            autres : c'est le seul de cette feuille qui detruit quelque chose.
          */}
          <Button
            isLoading={deleteMutation.isPending}
            onPress={fermerPuis(() => handleDeleteCampaign(campaignActionsFor))}
            title={t('clubLicenses.actions.delete', 'Supprimer')}
            variant="Secondary"
          />
        </View>
      </BottomModal>
    );
  };

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
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {t('clubLicenses.filterModal.title', 'Filtrer les membres')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t(
                'clubLicenses.filterModal.description',
                'Affiche seulement les cotisations qui t interessent, par équipe, rôle, '
                  + 'catégorie, niveau ou état documentaire.',
              )}
            </Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={Spaces.gap[16]}>
              {visibleMemberFilterDefinitions.map((definition) => {
                const selectedValue = memberFilters[definition.key];
                return (
                  <View key={definition.key} style={Spaces.gap[8]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{definition.label}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <LicenseSelectionChip
                        label={t('clubLicenses.filters.all', 'Tous')}
                        onPress={() => updateMemberFilter(definition.key, '')}
                        selected={!selectedValue}
                        variant="soft"
                      />
                      {definition.options.map((option) => (
                        <LicenseSelectionChip
                          key={option.value}
                          label={option.label}
                          onPress={() => updateMemberFilter(
                            definition.key,
                            selectedValue === option.value ? '' : option.value,
                          )}
                          selected={selectedValue === option.value}
                          variant="soft"
                        />
                      ))}
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
              title={t('clubLicenses.filterModal.reset', 'Reinitialiser')}
              variant="Secondary"
            />
            <Button
              onPress={() => setMemberFilterMenuKey(null)}
              style={{ flex: 1 }}
              title={t('clubLicenses.filterModal.apply', 'Appliquer')}
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
          ListEmptyComponent={isFocusedCampaignView && detailTab === 'members' ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t(
                'clubLicenses.list.empty',
                'Aucune cotisation pour ces filtres ou cette recherche.',
              )}
            </Text>
          ) : null}
          ListHeaderComponent={(
            <View style={Spaces.gap[licenseSpacing.sectionGap]}>
              {renderTopHeader()}
              {renderDashboardHeader()}
            </View>
          )}
          ref={dashboardListRef}
          renderItem={renderAssignmentItem}
          showsVerticalScrollIndicator={false}
        />
        {renderMemberFilterModal()}
        {renderCampaignActionsSheet()}
        {renderHelloAssoSettingsSheet()}
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
              accessibilityHint={t(
                'clubLicenses.setupFooter.hint',
                'Continue le paramétrage des cotisations du club.',
              )}
              accessibilityLabel={t('clubLicenses.setupFooter.label', 'Continuer le paramétrage')}
              onPress={handleSetupContinue}
              title={t('clubLicenses.setupFooter.continue', 'Continuer')}
            />
          </View>
        ) : null}
      </View>
      {renderCampaignActionsSheet()}
      {renderHelloAssoSettingsSheet()}
    </ScreenContainer>
  );
}

export default ClubLicenses;
