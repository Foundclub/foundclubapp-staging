import { useCallback, useMemo, useState } from 'react';
import {
  Alert, FlatList, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  generateLicenseAssignments,
  sendBulkLicenseReminder,
  useCurrentLicenseCampaign,
  useLicenseAssignments,
  useLicenseDashboard,
  useLicenseMutation,
} from '@/services/license/licenseQueries';

import {
  LicenseEmptyState,
  licenseRadius,
  licenseSpacing,
} from './licenseDesignSystem';

const money = (value = 0) => new Intl.NumberFormat('fr-FR', { currency: 'EUR', style: 'currency' }).format((value || 0) / 100);
const statusLabel = {
  manual_review: 'A valider', overdue: 'En retard', paid: 'Payee', partial: 'Partiel', pending: 'En attente', waived: 'Exemptee',
};
const statusTone = (Colors, status) => ({
  manual_review: Colors.warning500,
  overdue: Colors.error500,
  paid: Colors.success500,
  partial: Colors.primary200,
  pending: Colors.primary500,
  waived: Colors.neutral200,
}[status] || Colors.primary500);

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
 */
function AssignmentCard({ item, onPress }) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const tone = statusTone(Colors, item?.status);
  const name = [item?.user?.firstname, item?.user?.lastname].filter(Boolean).join(' ') || item?.user?.username || 'Membre';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View style={[ApplicationStyle.card, Spaces.marginBottom[12], {
        backgroundColor: Colors.primary700, borderColor: `${tone}88`, borderRadius: licenseRadius.hero, paddingHorizontal: licenseSpacing.cardPadding, paddingVertical: licenseSpacing.cardPadding,
      }]}
      >
        <View style={{
          alignItems: 'flex-start',
          flexDirection: 'row',
          gap: licenseSpacing.actionGap,
          justifyContent: 'space-between',
        }}
        >
          <View style={[Spaces.gap[4], { flex: 1 }]}>
            <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>{name}</Text>
            <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral200]}>{item?.team?.name || 'Sans equipe'}</Text>
          </View>
          <View style={[Spaces.gap[4], { alignItems: 'flex-end' }]}>
            <Text style={[Fonts.p2Bold, { color: tone }]}>{statusLabel[item?.status] || item?.status}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {money(item?.amountRemainingCents)}
              {' '}
              reste
            </Text>
          </View>
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
          Configure les regles de cotisation du club, puis genere les cotisations des membres.
          Le tableau de bord apparaitra ensuite avec les montants a encaisser.
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
          description="Cree automatiquement une cotisation pour chaque joueur ou entraineur du club."
          index="3"
          title="Creer les cotisations des membres"
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
  const clubId = route?.params?.clubId;
  const [search, setSearch] = useState('');
  const [setupFooterHeight, setSetupFooterHeight] = useState(0);
  const campaignQueryParams = useMemo(() => ({ clubId, includeDraft: true }), [clubId]);
  const campaignQuery = useCurrentLicenseCampaign(campaignQueryParams, { enabled: Boolean(clubId) });
  const campaign = campaignQuery.data;
  const campaignId = campaign?.documentId || campaign?.id;
  const dashboardQuery = useLicenseDashboard(campaignId, { enabled: Boolean(campaignId) });
  const assignmentsQuery = useLicenseAssignments(campaignId, { pageSize: 40, q: search }, { enabled: Boolean(campaignId) });
  const generateMutation = useLicenseMutation((payload) => generateLicenseAssignments(campaignId, payload), campaignId);
  const reminderMutation = useLicenseMutation((payload) => sendBulkLicenseReminder(campaignId, payload), campaignId);

  const totals = dashboardQuery.data?.totals || {};
  const scope = dashboardQuery.data?.scope;
  const canManageLicenses = scope !== 'coach';
  const assignments = assignmentsQuery.data?.data || [];
  const isLoading = campaignQuery.isLoading || (Boolean(campaignId) && dashboardQuery.isLoading);
  const hasGeneratedAssignments = Number(totals.total || 0) > 0;
  const shouldShowSetup = !campaign || !campaignId || (campaign && !dashboardQuery.isLoading && !hasGeneratedAssignments);

  const handleGenerate = useCallback(() => {
    if (!campaignId) {
      Alert.alert(
        'Parametrage requis',
        'Commence par definir la campagne de cotisation avant de creer les cotisations des membres.',
      );
      return;
    }

    if (!canManageLicenses) {
      Alert.alert('Action reservee', 'Seuls les dirigeants peuvent generer les cotisations.');
      return;
    }

    Alert.alert(
      'Creer les cotisations des membres',
      'Cette action cree une cotisation pour chaque membre du club trouve dans les equipes ou rattache au club. Les cotisations deja creees ne seront pas dupliquees.',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => generateMutation.mutate({ mode: 'missing_only' }, {
            onError: (error) => Alert.alert(
              'Creation impossible',
              typeof error === 'string'
                ? error
                : error?.message || 'La campagne est introuvable ou le serveur n est pas a jour.',
            ),
            onSuccess: (result) => Alert.alert(
              'Cotisations creees',
              `${result?.created || 0} cotisation(s) creee(s), ${result?.skipped || 0} deja existante(s).`,
            ),
          }),
          text: 'Creer',
        },
      ],
    );
  }, [campaignId, canManageLicenses, generateMutation]);

  const handleSetupContinue = useCallback(() => {
    if (campaignId) {
      handleGenerate();
      return;
    }

    navigation.navigate(RouteNames.ClubLicenseCampaignSettings, { clubId });
  }, [campaignId, clubId, handleGenerate, navigation]);

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

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={[Spaces.gap[12], { marginTop: 8 }]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>Chargement des cotisations</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>On verifie la campagne et les cotisations deja generees.</Text>
        </View>
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

    return (
      <>
        <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
          <StatCard label="Attendu" tone={Colors.primary500} value={money(totals.expectedCents)} />
          <StatCard label="Encaisse" tone={Colors.success500} value={money(totals.paidCents)} />
        </View>
        <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
          <StatCard label="Reste" tone={Colors.warning500} value={money(totals.remainingCents)} />
          <StatCard label="Retards" tone={Colors.error500} value={String(totals.overdueCount || 0)} />
        </View>
        {canManageLicenses ? (
          <>
            <View style={{ flexDirection: 'row', gap: licenseSpacing.actionGap }}>
              <Button onPress={() => navigation.navigate(RouteNames.ClubLicenseCampaignSettings, { campaignId, clubId })} style={{ flex: 1 }} title="Parametres" variant="Secondary" />
              <Button isLoading={generateMutation.isPending} onPress={handleGenerate} style={{ flex: 1 }} title="+ Nouveaux" variant="Secondary" />
            </View>
            <Button isLoading={reminderMutation.isPending} onPress={handleBulkReminder} title="Relancer les non-payeurs" />
            <Button onPress={() => navigation.navigate(RouteNames.ClubLicensePayments, { campaignId, clubId })} title={`Paiements a valider (${totals.manualReviewCount || 0})`} variant="Secondary" />
          </>
        ) : (
          <LicenseEmptyState
            description="Vue limitee aux equipes que vous entrainez. Les actions financieres restent reservees aux dirigeants."
            title="Vue entraineur"
          />
        )}
        <TextInput
          onChangeText={setSearch}
          placeholder="Rechercher un membre"
          placeholderTextColor={Colors.neutral400}
          style={{
            borderBottomColor: Colors.neutral200, borderBottomWidth: 1, color: Colors.neutral00, paddingVertical: 12,
          }}
          value={search}
        />
        <FlatList
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
          data={assignments}
          keyExtractor={(item) => String(item.documentId || item.id)}
          ListEmptyComponent={<Text style={[Fonts.p2, Fonts.neutral200]}>Aucune cotisation pour ces filtres.</Text>}
          renderItem={({ item }) => <AssignmentCard item={item} onPress={() => navigation.navigate(RouteNames.ClubLicenseMemberDetail, { assignmentId: item.documentId || item.id, campaignId })} />}
        />
      </>
    );
  };

  const isSetupMode = !isLoading && shouldShowSetup && canManageLicenses;
  const scrollBottomPadding = isSetupMode ? (setupFooterHeight || 96) + 28 : 96;

  return (
    <ScreenContainer bottomInsetMode={isSetupMode ? 'none' : 'tab-scene'} withHeaderPadding>
      <View style={[Alignments.fill, Alignments.relative]}>
        <ScrollView
          contentContainerStyle={[Spaces.gap[licenseSpacing.sectionGap], { paddingBottom: scrollBottomPadding }]}
          showsVerticalScrollIndicator={false}
          style={Alignments.fill}
        >
          <View>
            <Text style={[Fonts.h2, Fonts.neutral00]}>Cotisations</Text>
            <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[8]]}>Suivi des paiements, relances et echeanciers du club.</Text>
          </View>

          {renderContent()}
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
              isLoading={generateMutation.isPending}
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
