import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';

import { useGetSubscriptionOps } from '@/services/admin/adminQueries';

const formatDateTime = (value) => {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

const formatPerson = (person = {}) => (
  [person?.firstname, person?.lastname].filter(Boolean).join(' ')
  || person?.documentId
  || 'Utilisateur inconnu'
);

/**
 * Admin Revenue screen component
 * @returns {import('react').ReactElement} Admin Revenue screen component
 */
function AdminRevenue() {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const {
    data: subscriptionOpsData,
    error,
    isLoading,
    refetch,
  } = useGetSubscriptionOps();

  const counts = subscriptionOpsData?.counts || {};
  const previews = subscriptionOpsData?.previews || {};
  const subscriptions = Array.isArray(previews?.subscriptions) ? previews.subscriptions : [];
  const claims = Array.isArray(previews?.claimRequests) ? previews.claimRequests : [];
  const billingEvents = Array.isArray(previews?.billingEvents) ? previews.billingEvents : [];
  const legacyCandidates = Array.isArray(previews?.legacyCandidates) ? previews.legacyCandidates : [];

  const statCards = [
    { accent: Colors.primary500, label: 'Subscriptions', value: Number(counts?.subscriptions || 0) },
    { accent: Colors.success500, label: 'Entitlements', value: Number(counts?.entitlements || 0) },
    { accent: Colors.warning500, label: 'Claims a revoir', value: Number(counts?.pendingClaimReviews || 0) },
    { accent: Colors.error500, label: 'Billing KO', value: Number(counts?.failedBillingEvents || 0) },
    { accent: Colors.primary200, label: 'Quotas', value: Number(counts?.quotas || 0) },
    { accent: Colors.neutral100, label: 'Legacy a migrer', value: Number(counts?.legacyCandidateClubs || 0) },
  ];

  const failedBillingEvents = billingEvents
    .filter((item) => item?.processingStatus === 'failed')
    .slice(0, 4);

  if (isLoading && !subscriptionOpsData) {
    return (
      <AdminStateView
        description="Nous chargeons le pilotage abonnements depuis le backend."
        isLoading
        title="Chargement des abonnements"
      />
    );
  }

  if (error && !subscriptionOpsData) {
    return (
      <AdminStateView
        actionLabel="Rafraichir"
        description="Impossible de charger les operations abonnements."
        onAction={refetch}
        title="Chargement impossible"
      />
    );
  }

  const renderSection = (title, items, renderItem, emptyLabel) => (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius16,
        Spaces.padding[16],
        styles.sectionCard,
        { borderColor: `${Colors.primary500}22` },
      ]}
    >
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{title}</Text>
      <View style={[Spaces.gap[12], Spaces.marginTop[12]]}>
        {items.length ? items.map(renderItem) : (
          <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>{emptyLabel}</Text>
        )}
      </View>
    </View>
  );

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="tab-scene">
      <ScrollView
        contentContainerStyle={[
          Spaces.padding[24],
          Spaces.paddingBottom[36],
          Spaces.gap[16],
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={[Fonts.h1, Fonts.neutral00]}>Pilotage abonnements</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300 }, Spaces.marginTop[8]]}>
            Cette vue suit maintenant les subscriptions, entitlements, claims et incidents billing cote serveur. Les anciens champs club ne servent plus de reference metier ici.
          </Text>
        </View>

        <View style={[Alignments.row, styles.statsGrid]}>
          {statCards.map((card) => (
            <View
              key={card.label}
              style={[
                ApplicationStyle.backgroundColor.primary700,
                ApplicationStyle.borderRadius16,
                Spaces.padding[16],
                styles.statCard,
                { borderColor: `${card.accent}44`, borderWidth: 1 },
              ]}
            >
              <Text style={[Fonts.h2Bold, { color: card.accent }]}>{card.value}</Text>
              <Text style={[Fonts.p2, { color: Colors.neutral200 }, Spaces.marginTop[6]]}>{card.label}</Text>
            </View>
          ))}
        </View>

        {renderSection(
          'Subscriptions recentes',
          subscriptions.slice(0, 5),
          (item) => (
            <View key={String(item?.documentId || item?.providerTransactionId || item?.planCode)} style={[styles.rowCard, { borderBottomColor: `${Colors.primary500}22` }]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {item?.planCode || item?.providerProductId || 'Plan inconnu'}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
                {item?.status || 'Statut inconnu'}
                {item?.billingPeriod ? ` • ${item.billingPeriod}` : ''}
                {item?.provider ? ` • ${item.provider}` : ''}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
                {formatPerson(item?.payerUser)}
              </Text>
              <Text style={[Fonts.p4, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
                {formatDateTime(item?.currentPeriodStart)}
                {' -> '}
                {formatDateTime(item?.currentPeriodEnd)}
              </Text>
            </View>
          ),
          'Aucune subscription disponible.',
        )}

        {renderSection(
          'Claims a revoir',
          claims.slice(0, 5),
          (item) => (
            <View key={String(item?.documentId || item?.createdAt || item?.proofUrl)} style={[styles.rowCard, { borderBottomColor: `${Colors.warning500}22` }]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {item?.club?.name || 'Club inconnu'}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
                {formatPerson(item?.user)}
                {item?.claimedRole ? ` • ${item.claimedRole}` : ''}
              </Text>
              <Text style={[Fonts.p4Bold, { color: Colors.warning500 }, Spaces.marginTop[4]]}>
                {item?.verificationStatus || item?.state || 'pending'}
              </Text>
            </View>
          ),
          'Aucun claim en attente.',
        )}

        {renderSection(
          'Incidents billing',
          failedBillingEvents,
          (item) => (
            <View key={String(item?.documentId || item?.providerEventId || item?.payloadHash)} style={[styles.rowCard, { borderBottomColor: `${Colors.error500}22` }]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {item?.eventType || 'Event inconnu'}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
                {item?.provider || 'provider inconnu'}
                {item?.providerEventId ? ` • ${item.providerEventId}` : ''}
              </Text>
              <Text style={[Fonts.p4Bold, { color: Colors.error500 }, Spaces.marginTop[4]]}>
                {item?.processingStatus || 'failed'}
              </Text>
            </View>
          ),
          'Aucun incident billing en erreur.',
        )}

        {renderSection(
          'Legacy a migrer',
          legacyCandidates.slice(0, 5),
          (item) => (
            <View key={String(item?.documentId || item?.name)} style={[styles.rowCard, { borderBottomColor: `${Colors.primary200}22` }]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {item?.name || 'Club legacy'}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }, Spaces.marginTop[4]]}>
                {item?.clubPartner ? 'Deja partenaire' : 'Migration requise'}
              </Text>
              <Text style={[Fonts.p4, { color: Colors.primary200 }, Spaces.marginTop[4]]}>
                Legacy abonnement:
                {' '}
                {Number(item?.subscriptionValue || 0)}
                {' '}
                EUR
              </Text>
              <Text style={[Fonts.p4, { color: Colors.primary200 }, Spaces.marginTop[4]]}>
                Legacy max equipes:
                {' '}
                {Number(item?.maxTeamNumber || 0)}
              </Text>
            </View>
          ),
          'Aucun club legacy dans l apercu.',
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowCard: {
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  sectionCard: {
    borderWidth: 1,
  },
  statCard: {
    marginBottom: 12,
    minHeight: 108,
    width: '48%',
  },
  statsGrid: {
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});

export default AdminRevenue;
