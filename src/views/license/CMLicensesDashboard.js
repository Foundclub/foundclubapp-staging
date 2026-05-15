// @ts-nocheck
/* eslint-disable import/order, no-nested-ternary, object-curly-newline, perfectionist/sort-imports, perfectionist/sort-modules, perfectionist/sort-named-imports */
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  approveExternalLicensePayment,
  bulkCreateCMLicenseCampaigns,
  bulkGenerateCMLicenseAssignments,
  rejectExternalLicensePayment,
  useCMLicenseDashboard,
  useCMLicensePaymentReviews,
  useLicenseMutation,
} from '@/services/license/licenseQueries';

import {
  LicenseEmptyState,
  LicenseStatusChip,
  licenseRadius,
  licenseSpacing,
} from './licenseDesignSystem';

const money = (value = 0) => new Intl.NumberFormat('fr-FR', { currency: 'EUR', style: 'currency' }).format((value || 0) / 100);
const currentSeason = () => `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
const euroToCents = (value) => Math.round(Number(String(value || '0').replace(',', '.')) * 100);

const statusOptions = [
  { label: 'Toutes', value: '' },
  { label: 'Actives', value: 'active' },
  { label: 'Brouillons', value: 'draft' },
  { label: 'Cloturees', value: 'closed' },
];

const defaultPaymentModes = {
  bank_transfer: true,
  card_physical: false,
  cash: true,
  check: true,
  external_link: false,
  helloasso: false,
};

const firstReviewPayment = (assignment) => (
  assignment?.payments || []
).find((payment) => payment?.status === 'manual_review') || null;

function StatCard({ label, tone, value }) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  return (
    <View style={[ApplicationStyle.card, Spaces.gap[6], {
      backgroundColor: Colors.primary700,
      borderColor: `${tone || Colors.primary500}88`,
      borderRadius: licenseRadius.card,
      flexBasis: '48%',
      flexGrow: 1,
      minHeight: 92,
      paddingHorizontal: licenseSpacing.cardPadding,
      paddingVertical: licenseSpacing.cardPadding,
    }]}
    >
      <Text style={[Fonts.p3, Fonts.neutral200]}>{label}</Text>
      <Text numberOfLines={1} style={[Fonts.h3, { color: tone || Colors.primary500 }]}>{value}</Text>
    </View>
  );
}

function SectionLicenseCard({
  onOpen,
  onOpenPayments,
  onOpenSettings,
  section,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const campaign = section?.campaign;
  const totals = section?.totals || {};
  const hasCampaign = Boolean(campaign);
  const tone = !hasCampaign
    ? Colors.neutral300
    : section?.manualReviewCount > 0
      ? Colors.warning500
      : section?.overdueCount > 0
        ? Colors.error500
        : Colors.success500;

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View style={[ApplicationStyle.card, Spaces.gap[12], {
        backgroundColor: Colors.primary700,
        borderColor: `${tone}88`,
        borderRadius: licenseRadius.hero,
        paddingHorizontal: licenseSpacing.heroPadding,
        paddingVertical: licenseSpacing.heroPadding,
      }]}
      >
        <View style={[Alignments.row, Alignments.alignStart, Alignments.justifySpaceBetween]}>
          <View style={[Spaces.gap[4], { flex: 1, paddingRight: 12 }]}>
            <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>{section?.clubName || 'Section'}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {campaign?.seasonLabel || 'Aucune campagne'}
              {campaign?.paymentOwner === 'multisport' ? ' - encaissement central' : ''}
            </Text>
            {campaign?.paymentModes?.helloasso ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                HelloAsso:
                {' '}
                {campaign?.paymentProviderSnapshot?.helloasso?.readiness || 'a verifier'}
              </Text>
            ) : null}
          </View>
          <LicenseStatusChip status={campaign?.status || 'not_configured'} tone={tone} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: licenseSpacing.actionGap }}>
          <StatCard label="Licencies" tone={Colors.primary500} value={String(totals.total || 0)} />
          <StatCard label="Reste" tone={Colors.warning500} value={money(totals.remainingCents)} />
        </View>

        <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
          <Button onPress={onOpenSettings} style={{ flex: 1 }} title={hasCampaign ? 'Reglages' : 'Configurer'} variant="Secondary" />
          <Button onPress={onOpenPayments} style={{ flex: 1 }} title={`A valider (${section?.manualReviewCount || 0})`} variant="Secondary" />
        </View>
      </View>
    </Pressable>
  );
}

function ReviewCard({
  assignment,
  onApprove,
  onOpen,
  onReject,
}) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const payment = firstReviewPayment(assignment);
  const memberName = [assignment?.user?.firstname, assignment?.user?.lastname].filter(Boolean).join(' ') || assignment?.user?.username || 'Membre';

  return (
    <View style={[ApplicationStyle.card, Spaces.gap[12], {
      backgroundColor: Colors.primary700,
      borderColor: `${Colors.warning500}88`,
      borderRadius: licenseRadius.card,
      paddingHorizontal: licenseSpacing.cardPadding,
      paddingVertical: licenseSpacing.cardPadding,
    }]}
    >
      <View style={Spaces.gap[4]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{memberName}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {assignment?.club?.name || assignment?.campaign?.club?.name || 'Section'}
          {' - '}
          {assignment?.team?.name || 'Sans equipe'}
        </Text>
        <Text style={[Fonts.p2Bold, { color: Colors.warning500 }]}>
          {money(payment?.amountCents || assignment?.amountRemainingCents)}
          {' '}
          a valider
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
        <Button onPress={onOpen} style={{ flex: 1 }} title="Detail" variant="Secondary" />
        <Button onPress={onReject} style={{ flex: 1 }} title="Rejeter" variant="Secondary" />
        <Button onPress={onApprove} style={{ flex: 1 }} title="Valider" />
      </View>
    </View>
  );
}

function CMLicensesDashboard({ navigation, route }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const cmId = route?.params?.cmId;
  const [seasonLabel, setSeasonLabel] = useState(currentSeason());
  const [defaultAmount, setDefaultAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const queryParams = useMemo(() => ({
    seasonLabel: seasonLabel.trim(),
    status: statusFilter,
  }), [seasonLabel, statusFilter]);
  const dashboardQuery = useCMLicenseDashboard(cmId, queryParams, { enabled: Boolean(cmId) });
  const reviewsQuery = useCMLicensePaymentReviews(cmId, { pageSize: 20, q: search }, { enabled: Boolean(cmId) });
  const bulkCreateMutation = useLicenseMutation((payload) => bulkCreateCMLicenseCampaigns(cmId, payload), cmId);
  const bulkGenerateMutation = useLicenseMutation((payload) => bulkGenerateCMLicenseAssignments(cmId, payload), cmId);
  const approveMutation = useLicenseMutation((paymentId) => approveExternalLicensePayment(paymentId), cmId);
  const rejectMutation = useLicenseMutation((paymentId) => rejectExternalLicensePayment(paymentId, { reason: 'Rejete depuis le cockpit multisport' }), cmId);

  const dashboard = dashboardQuery.data || {};
  const totals = dashboard.totals || {};
  const rawSections = dashboard.sections;
  const sections = useMemo(() => rawSections || [], [rawSections]);
  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((section) => String(section?.clubName || '').toLowerCase().includes(q));
  }, [search, sections]);
  const rawReviews = reviewsQuery.data?.data;
  const reviews = useMemo(() => rawReviews || [], [rawReviews]);
  const missingSectionIds = sections
    .filter((section) => !section?.campaign)
    .map((section) => section?.clubId)
    .filter(Boolean);
  const campaignIds = sections
    .map((section) => section?.campaign?.documentId || section?.campaign?.id)
    .filter(Boolean);

  const handleBulkCreate = useCallback(() => {
    if (!missingSectionIds.length) {
      Alert.alert('Campagnes deja pretes', 'Toutes les sections visibles ont deja une campagne pour cette saison.');
      return;
    }
    const amountCents = euroToCents(defaultAmount);
    if (amountCents <= 0) {
      Alert.alert('Montant requis', 'Indique un montant par defaut avant de creer les campagnes manquantes.');
      return;
    }
    Alert.alert(
      'Creer les campagnes manquantes',
      `${missingSectionIds.length} section(s) recevront une campagne ${seasonLabel}.`,
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => bulkCreateMutation.mutate({
            defaultAmountCents: amountCents,
            dueDate: dueDate.trim() || null,
            paymentModes: defaultPaymentModes,
            paymentOwner: 'section',
            seasonLabel: seasonLabel.trim(),
            sectionIds: missingSectionIds,
            status: 'active',
          }, {
            onSuccess: (result) => Alert.alert(
              'Campagnes creees',
              `${result?.summary?.created || 0} creee(s), ${result?.summary?.skipped || 0} ignoree(s), ${result?.summary?.errors || 0} erreur(s).`,
            ),
          }),
          text: 'Creer',
        },
      ],
    );
  }, [bulkCreateMutation, defaultAmount, dueDate, missingSectionIds, seasonLabel]);

  const handleBulkGenerate = useCallback(() => {
    if (!campaignIds.length) {
      Alert.alert('Aucune campagne', 'Cree au moins une campagne avant de relancer une synchronisation de secours.');
      return;
    }
    Alert.alert(
      'Resynchroniser les campagnes',
      'Operation de maintenance: les cotisations manquantes seront rattachees sans dupliquer les dossiers deja existants.',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => bulkGenerateMutation.mutate({ campaignIds, mode: 'missing_only' }, {
            onSuccess: (result) => Alert.alert(
              'Synchronisation terminee',
              `${result?.summary?.created || 0} creee(s), ${result?.summary?.skipped || 0} deja existante(s).`,
            ),
          }),
          text: 'Resynchroniser',
        },
      ],
    );
  }, [bulkGenerateMutation, campaignIds]);

  const openSectionLicenses = useCallback((section) => {
    if (!section?.clubId) return;
    navigation.navigate(RouteNames.ClubStack, {
      params: { clubId: section.clubId },
      screen: RouteNames.ClubLicenses,
    });
  }, [navigation]);

  const openSectionSettings = useCallback((section) => {
    if (!section?.clubId) return;
    navigation.navigate(RouteNames.ClubStack, {
      params: {
        campaignId: section?.campaign?.documentId || section?.campaign?.id,
        clubId: section.clubId,
      },
      screen: RouteNames.ClubLicenseCampaignSettings,
    });
  }, [navigation]);

  const openSectionPayments = useCallback((section) => {
    if (!section?.clubId) return;
    navigation.navigate(RouteNames.ClubStack, {
      params: {
        campaignId: section?.campaign?.documentId || section?.campaign?.id,
        clubId: section.clubId,
      },
      screen: RouteNames.ClubLicensePayments,
    });
  }, [navigation]);

  const openAssignment = useCallback((assignment) => {
    navigation.navigate(RouteNames.ClubStack, {
      params: {
        assignmentId: assignment?.documentId || assignment?.id,
        campaignId: assignment?.campaign?.documentId || assignment?.campaign?.id,
      },
      screen: RouteNames.ClubLicenseMemberDetail,
    });
  }, [navigation]);

  return (
    <ScreenContainer bottomInsetMode="tab-scene" withHeaderPadding>
      <ScrollView contentContainerStyle={[Spaces.gap[licenseSpacing.sectionGap], { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        <View style={Spaces.gap[licenseSpacing.titleGap]}>
          <Text style={[Fonts.h2, Fonts.neutral00]}>Cotisations multisport</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Pilote les campagnes de toutes les sections, les restes a payer et les validations en attente.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: licenseSpacing.actionGap }}>
          <StatCard label="Attendu" tone={Colors.primary500} value={money(totals.expectedCents)} />
          <StatCard label="Encaisse" tone={Colors.success500} value={money(totals.paidCents)} />
          <StatCard label="Reste" tone={Colors.warning500} value={money(totals.remainingCents)} />
          <StatCard label="A valider" tone={Colors.warning500} value={String(totals.manualReviewCount || 0)} />
        </View>

        <View style={Spaces.gap[12]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Filtres et creation globale</Text>
          <TextInput
            onChangeText={setSeasonLabel}
            placeholder="Saison"
            placeholderTextColor={Colors.neutral400}
            style={{ borderBottomColor: Colors.neutral200, borderBottomWidth: 1, color: Colors.neutral00, paddingVertical: 12 }}
            value={seasonLabel}
          />
          <TextInput
            onChangeText={setSearch}
            placeholder="Rechercher une section ou un paiement"
            placeholderTextColor={Colors.neutral400}
            style={{ borderBottomColor: Colors.neutral200, borderBottomWidth: 1, color: Colors.neutral00, paddingVertical: 12 }}
            value={search}
          />
          <View style={[Alignments.row, Alignments.wrap, { gap: licenseSpacing.actionGap }]}>
            {statusOptions.map((option) => (
              <Button
                key={option.value || 'all'}
                onPress={() => setStatusFilter(option.value)}
                title={option.label}
                variant={statusFilter === option.value ? 'Primary' : 'Secondary'}
              />
            ))}
          </View>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setDefaultAmount}
            placeholder="Montant par defaut pour les campagnes manquantes"
            placeholderTextColor={Colors.neutral400}
            style={{ borderBottomColor: Colors.neutral200, borderBottomWidth: 1, color: Colors.neutral00, paddingVertical: 12 }}
            value={defaultAmount}
          />
          <TextInput
            onChangeText={setDueDate}
            placeholder="Date limite optionnelle YYYY-MM-DD"
            placeholderTextColor={Colors.neutral400}
            style={{ borderBottomColor: Colors.neutral200, borderBottomWidth: 1, color: Colors.neutral00, paddingVertical: 12 }}
            value={dueDate}
          />
          <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
            <Button isLoading={bulkCreateMutation.isPending} onPress={handleBulkCreate} style={{ flex: 1 }} title="Creer manquantes" variant="Secondary" />
            <Button isLoading={bulkGenerateMutation.isPending} onPress={handleBulkGenerate} style={{ flex: 1 }} title="Resynchroniser" />
          </View>
        </View>

        <View style={Spaces.gap[licenseSpacing.listGap]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Sections</Text>
          {dashboardQuery.isLoading ? (
            <Text style={[Fonts.p2, Fonts.neutral200]}>Chargement des sections...</Text>
          ) : null}
          {!dashboardQuery.isLoading && filteredSections.length === 0 ? (
            <LicenseEmptyState
              description="Aucune section ne correspond aux filtres choisis."
              title="Aucune section"
            />
          ) : null}
          {filteredSections.map((section) => (
            <SectionLicenseCard
              key={String(section.clubId)}
              onOpen={() => openSectionLicenses(section)}
              onOpenPayments={() => openSectionPayments(section)}
              onOpenSettings={() => openSectionSettings(section)}
              section={section}
            />
          ))}
        </View>

        <View style={Spaces.gap[licenseSpacing.listGap]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Paiements a valider</Text>
          {reviews.length === 0 ? (
            <LicenseEmptyState
              description="Les declarations manuelles ou externes en attente apparaitront ici."
              title="Aucun paiement en attente"
            />
          ) : null}
          {reviews.map((assignment) => {
            const payment = firstReviewPayment(assignment);
            return (
              <ReviewCard
                assignment={assignment}
                key={String(assignment?.documentId || assignment?.id)}
                onApprove={() => payment?.id && approveMutation.mutate(payment.id)}
                onOpen={() => openAssignment(assignment)}
                onReject={() => payment?.id && rejectMutation.mutate(payment.id)}
              />
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default CMLicensesDashboard;
