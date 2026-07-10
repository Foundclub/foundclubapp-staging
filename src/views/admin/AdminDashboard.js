// @ts-nocheck
/* eslint-disable max-len, no-nested-ternary, react/function-component-definition, react/jsx-one-expression-per-line, perfectionist/sort-jsx-props */
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCreateManualSubscription,
  useGenerateTestTournament,
  useGetAdminStats,
  useGetDetectionVerificationQueue,
  useGetLeagueDisputes,
  useGetNonPartnerCoachAffiliations,
  useGetPendingClubClaims,
  useGetPendingClubOnboardingRequests,
  useGetSubscriptionOps,
  useMigrateLegacySubscriptions,
  useSaveManualEntitlement,
  useSyncSubscriptionTeamEntitlements,
  useUpdateDetectionVerification,
  useUpdateNonPartnerCoachAffiliation,
  useUpdateNonPartnerCoachGovernance,
} from '@/services/admin/adminQueries';
import { getPendingFeaturedRequests } from '@/services/event/eventService';
import { useGetInAppPopupCampaigns } from '@/services/inAppPopupCampaign/inAppPopupCampaignQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

const formatDateTime = (value) => {
  if (!value) return 'Date inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return date.toLocaleString('fr-FR');
};

const formatPersonName = (person) => {
  const firstname = String(person?.firstname || '').trim();
  const lastname = String(person?.lastname || '').trim();
  const fullname = `${firstname} ${lastname}`.trim();
  return fullname || 'Utilisateur inconnu';
};

const sanitizePhoneNumber = (value) => String(value || '')
  .replace(/[^\d+]/g, '')
  .trim();

const formatPlanCode = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Plan inconnu';
  return normalized.replace(/^fc_/i, '').replace(/_/g, ' ').toUpperCase();
};

const buildManualSubscriptionForm = (defaults = {}) => ({
  billingPeriod: 'manual',
  payerUserDocumentId: '',
  planCode: 'fc_team_1_monthly',
  provider: 'manual',
  providerProductId: '',
  providerTransactionId: '',
  reason: 'support-manual-grant',
  status: 'active',
  ...defaults,
});

const buildManualEntitlementForm = (defaults = {}) => ({
  capability: '*',
  clubDocumentId: '',
  documentId: '',
  endsAt: '',
  reason: 'support-entitlement-grant',
  scopeType: 'TEAM',
  startsAt: '',
  status: 'active',
  subscriptionDocumentId: '',
  teamDocumentId: '',
  ...defaults,
});

const REVIEWABLE_STATUSES = [
  { key: 'pending', label: 'En attente' },
  { key: 'verified', label: 'Verifiee' },
  { key: 'rejected', label: 'Rejetee' },
];

/**
 * Admin Dashboard screen component
 * @returns {import('react').ReactElement} Admin Dashboard screen component
 */
function AdminDashboard() {
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const createManualSubscriptionMutation = useCreateManualSubscription();
  const generateTestTournamentMutation = useGenerateTestTournament();
  const migrateLegacySubscriptionsMutation = useMigrateLegacySubscriptions();
  const saveManualEntitlementMutation = useSaveManualEntitlement();
  const syncSubscriptionTeamEntitlementsMutation = useSyncSubscriptionTeamEntitlements();
  const updateDetectionVerificationMutation = useUpdateDetectionVerification();
  const updateNonPartnerCoachGovernanceMutation = useUpdateNonPartnerCoachGovernance();
  const updateNonPartnerCoachAffiliationMutation = useUpdateNonPartnerCoachAffiliation();

  const [reviewItem, setReviewItem] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewStatus, setReviewStatus] = useState('pending');
  const [isLegacyMigrationModalVisible, setIsLegacyMigrationModalVisible] = useState(false);
  const [isManualEntitlementModalVisible, setIsManualEntitlementModalVisible] = useState(false);
  const [isManualSubscriptionModalVisible, setIsManualSubscriptionModalVisible] = useState(false);
  const [legacyMigrationClubDocumentId, setLegacyMigrationClubDocumentId] = useState('');
  const [manualEntitlementForm, setManualEntitlementForm] = useState(() => buildManualEntitlementForm());
  const [manualSubscriptionForm, setManualSubscriptionForm] = useState(() => buildManualSubscriptionForm());

  const {
    data: featuredRequestsData,
    error: featuredRequestsError,
    isLoading: isFeaturedRequestsLoading,
    refetch: refetchFeatured,
  } = useQuery({
    queryFn: () => getPendingFeaturedRequests({ status: 'PENDING' }),
    queryKey: ['admin-featured-requests-count'],
  });

  const {
    data: stats,
    error: statsError,
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = useGetAdminStats();

  const detectionQueueParams = useMemo(() => ({
    page: 1,
    pageSize: 12,
    status: 'pending',
  }), []);

  const {
    data: detectionQueueData,
    error: detectionQueueError,
    isLoading: isDetectionQueueLoading,
    refetch: refetchDetectionQueue,
  } = useGetDetectionVerificationQueue(detectionQueueParams);

  const governanceAffiliationParams = useMemo(() => ({
    page: 1,
    pageSize: 12,
  }), []);

  const {
    data: governanceAffiliationsData,
    error: governanceAffiliationsError,
    isLoading: isGovernanceAffiliationsLoading,
    refetch: refetchGovernanceAffiliations,
  } = useGetNonPartnerCoachAffiliations(governanceAffiliationParams);

  const {
    data: subscriptionOpsData,
    error: subscriptionOpsError,
    isLoading: isSubscriptionOpsLoading,
    refetch: refetchSubscriptionOps,
  } = useGetSubscriptionOps();

  const {
    data: claimsData,
    error: claimsError,
    isLoading: isClaimsLoading,
    refetch: refetchClaims,
  } = useGetPendingClubClaims();

  const {
    data: clubOnboardingData,
    error: clubOnboardingError,
    isLoading: isClubOnboardingLoading,
    refetch: refetchClubOnboarding,
  } = useGetPendingClubOnboardingRequests({
    pagination: {
      page: 1,
      pageSize: 1,
    },
  });

  const disputeCountParams = useMemo(() => ({
    pagination: { page: 1, pageSize: 1 },
  }), []);

  const {
    data: leagueDisputesData,
    error: leagueDisputesError,
    isLoading: isLeagueDisputesLoading,
    refetch: refetchLeagueDisputes,
  } = useGetLeagueDisputes(disputeCountParams);

  const {
    data: popupCampaignsData,
    error: popupCampaignsError,
    isLoading: isPopupCampaignsLoading,
    refetch: refetchPopupCampaigns,
  } = useGetInAppPopupCampaigns({
    page: 1,
    pageSize: 1,
  });

  const secondaryDashboardErrors = [
    featuredRequestsError,
    claimsError,
    clubOnboardingError,
    detectionQueueError,
    governanceAffiliationsError,
    leagueDisputesError,
    popupCampaignsError,
    subscriptionOpsError,
  ].filter(Boolean);

  const partialDashboardDescription = secondaryDashboardErrors.length > 0
    ? 'Certaines tuiles admin sont temporairement indisponibles.'
    : '';

  useFocusEffect(
    useCallback(() => {
      refetchFeatured();
      refetchStats();
      refetchDetectionQueue();
      refetchGovernanceAffiliations();
      refetchClaims();
      refetchClubOnboarding();
      refetchLeagueDisputes();
      refetchPopupCampaigns();
      refetchSubscriptionOps();
    }, [
      refetchClaims,
      refetchClubOnboarding,
      refetchDetectionQueue,
      refetchFeatured,
      refetchGovernanceAffiliations,
      refetchLeagueDisputes,
      refetchPopupCampaigns,
      refetchSubscriptionOps,
      refetchStats,
    ]),
  );

  const featuredCount = Array.isArray(featuredRequestsData?.data)
    ? featuredRequestsData.data.length
    : 0;

  const business = stats?.business || {};
  const ops = stats?.ops || {};
  const publishingGovernance = stats?.publishingGovernance || {};
  const recentFirstTeamEvents = Array.isArray(stats?.recentFirstTeamEvents)
    ? stats.recentFirstTeamEvents
    : [];
  const subscriptionOpsCounts = subscriptionOpsData?.counts || {};
  const subscriptionOpsPreviews = subscriptionOpsData?.previews || {};
  const subscriptionPreviewItems = Array.isArray(subscriptionOpsPreviews?.subscriptions)
    ? subscriptionOpsPreviews.subscriptions
    : [];
  const entitlementPreviewItems = Array.isArray(subscriptionOpsPreviews?.entitlements)
    ? subscriptionOpsPreviews.entitlements
    : [];
  const quotaPreviewItems = Array.isArray(subscriptionOpsPreviews?.quotas)
    ? subscriptionOpsPreviews.quotas
    : [];
  const billingEventPreviewItems = Array.isArray(subscriptionOpsPreviews?.billingEvents)
    ? subscriptionOpsPreviews.billingEvents
    : [];
  const claimRequestPreviewItems = Array.isArray(subscriptionOpsPreviews?.claimRequests)
    ? subscriptionOpsPreviews.claimRequests
    : [];
  const legacyCandidatePreviewItems = Array.isArray(subscriptionOpsPreviews?.legacyCandidates)
    ? subscriptionOpsPreviews.legacyCandidates
    : [];
  const subscriptionCatalog = Array.isArray(subscriptionOpsPreviews?.catalog)
    ? subscriptionOpsPreviews.catalog
    : [];
  const governanceAffiliations = Array.isArray(governanceAffiliationsData?.data)
    ? governanceAffiliationsData.data
    : [];
  const detectionVerificationQueue = Array.isArray(detectionQueueData?.data)
    ? detectionQueueData.data
    : (Array.isArray(stats?.detectionVerificationQueuePreview?.data)
      ? stats.detectionVerificationQueuePreview.data
      : []);

  const detectionQueueTotal = detectionQueueData?.meta?.pagination?.total
    || ops?.detectionsPendingVerification
    || detectionVerificationQueue.length
    || 0;

  const eventsTodayCount = stats?.eventsToday || 0;
  const generatedRevenue = stats?.revenue || 0;
  const reportsCount = stats?.reportsCount || 0;
  const claimsCount = claimsData?.meta?.pagination?.total || 0;
  const clubOnboardingCount = clubOnboardingData?.meta?.pagination?.total || 0;
  const leagueDisputesCount = leagueDisputesData?.meta?.pagination?.total || 0;
  const popupCampaignCount = popupCampaignsData?.meta?.total || 0;

  const dashboardError = statsError;
  const isBootstrapping = (
    isFeaturedRequestsLoading
    || isStatsLoading
    || isDetectionQueueLoading
    || isGovernanceAffiliationsLoading
    || isClaimsLoading
    || isClubOnboardingLoading
    || isLeagueDisputesLoading
    || isPopupCampaignsLoading
    || isSubscriptionOpsLoading
  );

  const openEventDetails = useCallback((eventDocumentId) => {
    if (!eventDocumentId) return;
    navigation.navigate(RouteNames.EventStack, {
      params: {
        eventId: eventDocumentId,
      },
      screen: RouteNames.EventDetails,
    });
  }, [navigation]);

  const openGeneratedTournament = openEventDetails;

  const handleGenerateTestTournament = useCallback(() => {
    if (generateTestTournamentMutation.isPending) return;

    Alert.alert(
      'Generer un tournoi fictif ?',
      'Cela cree un tournoi autonome [TEST] avec 8 equipes, des joueurs fictifs, des poules et des matchs brouillons. En production, cette action est bloquee sauf flag explicite.',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => {
            generateTestTournamentMutation.mutate(
              {
                generateCompetition: true,
                membersPerTeam: 5,
                teamCount: 8,
              },
              {
                onError: (error) => {
                  Alert.alert(
                    'Generation impossible',
                    getErrorMessage(error, 'generic') || 'Impossible de generer le tournoi fictif.',
                  );
                },
                onSuccess: (response) => {
                  const result = response?.data || response;
                  const event = result?.event || {};
                  const eventDocumentId = event?.documentId;
                  const warnings = Array.isArray(result?.warnings) && result.warnings.length > 0
                    ? `\n\nAttention: ${result.warnings.join(' | ')}`
                    : '';

                  Alert.alert(
                    'Tournoi fictif cree',
                    `${event?.name || 'Le tournoi de test'} est pret avec ${result?.generated?.teams || 0} equipes.${warnings}`,
                    [
                      { text: 'OK' },
                      eventDocumentId
                        ? { onPress: () => openGeneratedTournament(eventDocumentId), text: 'Ouvrir' }
                        : null,
                    ].filter(Boolean),
                  );
                },
              },
            );
          },
          text: 'Generer',
        },
      ],
    );
  }, [generateTestTournamentMutation, openGeneratedTournament]);

  const openReviewModal = useCallback((item, forcedStatus = null) => {
    const nextStatus = forcedStatus || item?.verification?.status || 'pending';
    setReviewItem(item);
    setReviewStatus(nextStatus);
    setReviewNotes(String(item?.verification?.notes || ''));
  }, []);

  const closeReviewModal = useCallback(() => {
    setReviewItem(null);
    setReviewNotes('');
    setReviewStatus('pending');
  }, []);

  const handleCallOrganizer = useCallback(async (phoneNumber) => {
    const sanitizedPhone = sanitizePhoneNumber(phoneNumber);
    if (!sanitizedPhone) {
      Alert.alert('Numero manquant', 'Aucun numero de telephone exploitable sur cette detection.');
      return;
    }

    const targetUrl = `tel:${sanitizedPhone}`;
    try {
      const supported = await Linking.canOpenURL(targetUrl);
      if (!supported) {
        Alert.alert('Appel indisponible', sanitizedPhone);
        return;
      }
      await Linking.openURL(targetUrl);
    } catch (_error) {
      Alert.alert('Appel indisponible', sanitizedPhone);
    }
  }, []);

  const handleSubmitReview = useCallback(() => {
    if (!reviewItem?.documentId || updateDetectionVerificationMutation.isPending) return;

    updateDetectionVerificationMutation.mutate(
      {
        documentId: reviewItem.documentId,
        notes: reviewNotes,
        status: reviewStatus,
      },
      {
        onError: (error) => {
          Alert.alert(
            'Verification impossible',
            getErrorMessage(error, 'generic') || 'Impossible de mettre a jour cette verification.',
          );
        },
        onSuccess: () => {
          closeReviewModal();
        },
      },
    );
  }, [
    closeReviewModal,
    reviewItem?.documentId,
    reviewNotes,
    reviewStatus,
    updateDetectionVerificationMutation,
  ]);

  const handleToggleGlobalGovernance = useCallback(() => {
    if (updateNonPartnerCoachGovernanceMutation.isPending) return;

    updateNonPartnerCoachGovernanceMutation.mutate(
      {
        globalEnabled: publishingGovernance?.globalEnabled !== true,
      },
      {
        onError: (error) => {
          Alert.alert(
            'Mise a jour impossible',
            getErrorMessage(error, 'generic') || 'Impossible de mettre a jour la publication des coachs non certifies.',
          );
        },
      },
    );
  }, [publishingGovernance?.globalEnabled, updateNonPartnerCoachGovernanceMutation]);

  const handleToggleCoachOverride = useCallback((item) => {
    if (!item?.user?.documentId || !item?.club?.documentId || updateNonPartnerCoachAffiliationMutation.isPending) {
      return;
    }

    updateNonPartnerCoachAffiliationMutation.mutate(
      {
        allowed: item?.override?.publicationOverride !== 'allowed',
        clubDocumentId: item.club.documentId,
        notes: item?.override?.internalReviewNotes || '',
        userDocumentId: item.user.documentId,
      },
      {
        onError: (error) => {
          Alert.alert(
            'Autorisation impossible',
            getErrorMessage(error, 'generic') || 'Impossible de mettre a jour cette autorisation coach.',
          );
        },
      },
    );
  }, [updateNonPartnerCoachAffiliationMutation]);

  const openLegacyMigrationModal = useCallback((clubDocumentId = '') => {
    setLegacyMigrationClubDocumentId(String(clubDocumentId || '').trim());
    setIsLegacyMigrationModalVisible(true);
  }, []);

  const closeLegacyMigrationModal = useCallback(() => {
    setIsLegacyMigrationModalVisible(false);
    setLegacyMigrationClubDocumentId('');
  }, []);

  const openManualSubscriptionModal = useCallback(() => {
    setManualSubscriptionForm(buildManualSubscriptionForm());
    setIsManualSubscriptionModalVisible(true);
  }, []);

  const closeManualSubscriptionModal = useCallback(() => {
    setIsManualSubscriptionModalVisible(false);
    setManualSubscriptionForm(buildManualSubscriptionForm());
  }, []);

  const openManualEntitlementModal = useCallback((item = null, subscriptionDocumentId = '') => {
    if (item?.documentId) {
      setManualEntitlementForm(buildManualEntitlementForm({
        capability: item?.capability || '*',
        clubDocumentId: item?.scopeClub?.documentId || '',
        documentId: item?.documentId || '',
        endsAt: item?.endsAt || '',
        reason: 'support-entitlement-correction',
        scopeType: item?.scopeType || 'TEAM',
        startsAt: item?.startsAt || '',
        status: item?.status || 'active',
        subscriptionDocumentId: item?.subscription?.documentId || '',
        teamDocumentId: item?.scopeTeam?.documentId || '',
      }));
    } else {
      setManualEntitlementForm(buildManualEntitlementForm({
        subscriptionDocumentId,
      }));
    }
    setIsManualEntitlementModalVisible(true);
  }, []);

  const closeManualEntitlementModal = useCallback(() => {
    setIsManualEntitlementModalVisible(false);
    setManualEntitlementForm(buildManualEntitlementForm());
  }, []);

  const handleRunLegacyMigration = useCallback((apply = false) => {
    if (migrateLegacySubscriptionsMutation.isPending) return;

    migrateLegacySubscriptionsMutation.mutate(
      {
        apply,
        clubDocumentId: String(legacyMigrationClubDocumentId || '').trim() || undefined,
      },
      {
        onError: (error) => {
          Alert.alert(
            apply ? 'Migration impossible' : 'Preview impossible',
            getErrorMessage(error, 'generic') || 'Impossible d executer la migration legacy.',
          );
        },
        onSuccess: (response) => {
          const migratedCount = Number(response?.meta?.migratedCount || 0);
          const label = apply ? 'Migration executee' : 'Preview terminee';
          const scopeLabel = legacyMigrationClubDocumentId
            ? `Club cible: ${legacyMigrationClubDocumentId}\n`
            : '';
          Alert.alert(
            label,
            `${scopeLabel}${migratedCount} club${migratedCount > 1 ? 's' : ''} analyse${migratedCount > 1 ? 's' : ''}.`,
          );
          closeLegacyMigrationModal();
        },
      },
    );
  }, [closeLegacyMigrationModal, legacyMigrationClubDocumentId, migrateLegacySubscriptionsMutation]);

  const handleSubmitManualSubscription = useCallback(() => {
    if (createManualSubscriptionMutation.isPending) return;

    createManualSubscriptionMutation.mutate(
      {
        billingPeriod: String(manualSubscriptionForm?.billingPeriod || '').trim(),
        payerUserDocumentId: String(manualSubscriptionForm?.payerUserDocumentId || '').trim(),
        planCode: String(manualSubscriptionForm?.planCode || '').trim(),
        provider: String(manualSubscriptionForm?.provider || '').trim(),
        providerProductId: String(manualSubscriptionForm?.providerProductId || '').trim(),
        providerTransactionId: String(manualSubscriptionForm?.providerTransactionId || '').trim(),
        reason: String(manualSubscriptionForm?.reason || '').trim(),
        status: String(manualSubscriptionForm?.status || '').trim(),
      },
      {
        onError: (error) => {
          Alert.alert(
            'Creation impossible',
            getErrorMessage(error, 'generic') || 'Impossible de creer cette subscription manuelle.',
          );
        },
        onSuccess: () => {
          Alert.alert('Subscription creee', 'La subscription manuelle a ete enregistree et auditee.');
          closeManualSubscriptionModal();
        },
      },
    );
  }, [closeManualSubscriptionModal, createManualSubscriptionMutation, manualSubscriptionForm]);

  const handleSubmitManualEntitlement = useCallback(() => {
    if (saveManualEntitlementMutation.isPending) return;

    const payload = {
      capability: String(manualEntitlementForm?.capability || '').trim(),
      clubDocumentId: String(manualEntitlementForm?.clubDocumentId || '').trim(),
      endsAt: String(manualEntitlementForm?.endsAt || '').trim(),
      reason: String(manualEntitlementForm?.reason || '').trim(),
      scopeType: String(manualEntitlementForm?.scopeType || '').trim(),
      startsAt: String(manualEntitlementForm?.startsAt || '').trim(),
      status: String(manualEntitlementForm?.status || '').trim(),
      subscriptionDocumentId: String(manualEntitlementForm?.subscriptionDocumentId || '').trim(),
      teamDocumentId: String(manualEntitlementForm?.teamDocumentId || '').trim(),
    };

    saveManualEntitlementMutation.mutate(
      {
        documentId: String(manualEntitlementForm?.documentId || '').trim() || undefined,
        payload,
      },
      {
        onError: (error) => {
          Alert.alert(
            'Enregistrement impossible',
            getErrorMessage(error, 'generic') || 'Impossible de sauvegarder cet entitlement.',
          );
        },
        onSuccess: () => {
          Alert.alert(
            manualEntitlementForm?.documentId ? 'Entitlement corrige' : 'Entitlement cree',
            'La mutation manuelle a bien ete auditee.',
          );
          closeManualEntitlementModal();
        },
      },
    );
  }, [closeManualEntitlementModal, manualEntitlementForm, saveManualEntitlementMutation]);

  const handleSyncTeamEntitlements = useCallback((item) => {
    const documentId = String(item?.documentId || '').trim();
    if (!documentId || syncSubscriptionTeamEntitlementsMutation.isPending) return;

    Alert.alert(
      'Resynchroniser les droits Team ?',
      `Cela va recalculer les entitlements TEAM de la subscription ${formatPlanCode(item?.planCode)}.`,
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => {
            syncSubscriptionTeamEntitlementsMutation.mutate(
              {
                documentId,
                reason: 'backoffice-team-entitlement-sync',
              },
              {
                onError: (error) => {
                  Alert.alert(
                    'Resync impossible',
                    getErrorMessage(error, 'generic') || 'Impossible de resynchroniser cette subscription.',
                  );
                },
                onSuccess: (response) => {
                  const syncedCount = Number(response?.meta?.syncedSlotCount || 0);
                  Alert.alert(
                    'Resync terminee',
                    `${syncedCount} slot${syncedCount > 1 ? 's' : ''} resynchronise${syncedCount > 1 ? 's' : ''}.`,
                  );
                },
              },
            );
          },
          text: 'Resynchroniser',
        },
      ],
    );
  }, [syncSubscriptionTeamEntitlementsMutation]);

  const openClaimPreviewDetail = useCallback((item) => {
    if (!item?.documentId) return;
    navigation.navigate(RouteNames.AdminClaimDetail, {
      requestId: item.documentId,
      requestType: 'claim',
    });
  }, [navigation]);

  const getPartnerStatusMeta = useCallback((clubVerified) => (
    clubVerified === true
      ? {
        backgroundColor: `${Colors.success500}18`,
        borderColor: `${Colors.success500}44`,
        label: 'Verifie',
        textColor: Colors.success500,
      }
      : {
        backgroundColor: `${Colors.neutral300}18`,
        borderColor: `${Colors.neutral300}44`,
        label: 'Non certifiée',
        textColor: Colors.neutral100,
      }
  ), [Colors.neutral100, Colors.neutral300, Colors.success500]);

  if (isBootstrapping) {
    return (
      <AdminStateView
        description="Nous synchronisons les indicateurs d'administration."
        isLoading
        title="Chargement du dashboard admin"
      />
    );
  }

  if (dashboardError) {
    return (
      <AdminStateView
        actionLabel="Reessayer"
        description={dashboardError?.message || 'Impossible de charger les indicateurs admin.'}
        onAction={() => {
          refetchFeatured();
          refetchStats();
          refetchDetectionQueue();
          refetchGovernanceAffiliations();
          refetchClaims();
          refetchClubOnboarding();
          refetchLeagueDisputes();
          refetchPopupCampaigns();
          refetchSubscriptionOps();
        }}
        title="Chargement impossible"
      />
    );
  }

  // eslint-disable-next-line react/no-unstable-nested-components
  const DashboardCard = ({
    color = Colors.primary500,
    meta,
    onPress,
    title,
    value,
  }) => (
    <TouchableOpacity
      accessibilityHint={onPress ? `Ouvrir ${title}` : undefined}
      accessibilityLabel={`${title}: ${value}`}
      accessibilityRole={onPress ? 'button' : 'summary'}
      activeOpacity={0.82}
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.dashboardCard,
        {
          backgroundColor: Colors.primary700,
          borderColor: `${color}55`,
          shadowColor: color,
        },
      ]}
    >
      <View style={[styles.cardHalo, { backgroundColor: `${color}18` }]} />
      <View style={[styles.cardAccent, { backgroundColor: color }]} />
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.cardChip,
            { backgroundColor: `${color}16`, borderColor: `${color}88` },
          ]}
        >
          <Text style={[Fonts.label, styles.cardChipText, { color }]}>{meta || 'Admin'}</Text>
        </View>
      </View>
      <View>
        <Text numberOfLines={1} style={[Fonts.h2Bold, styles.cardValue, { color }]}>
          {value}
        </Text>
        <Text numberOfLines={2} style={[Fonts.p2, Fonts.neutral00, styles.cardTitle]}>
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderDetectionQueueItem = (item) => {
    const verificationStatus = String(item?.verification?.status || 'pending');
    const organizerName = formatPersonName(item?.organizer);
    const phoneNumber = item?.organizer?.phoneNumber || '';
    const phoneLabel = sanitizePhoneNumber(phoneNumber);
    const partnerStatusMeta = getPartnerStatusMeta(item?.club?.clubVerified === true);

    return (
      <View
        key={`detection-${item?.documentId || item?.name || item?.createdAt || 'row'}`}
        style={[
          styles.detailCard,
          {
            backgroundColor: Colors.primary700,
            borderColor: `${Colors.primary500}33`,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {item?.name || 'Detection'}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              {item?.team?.name || 'Equipe inconnue'}
              {item?.club?.name ? ` - ${item.club.name}` : ''}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              {formatDateTime(item?.date || item?.createdAt)}
            </Text>
            <View
              style={[
                styles.statusPill,
                Spaces.marginTop[8],
                {
                  alignSelf: 'flex-start',
                  backgroundColor: partnerStatusMeta.backgroundColor,
                  borderColor: partnerStatusMeta.borderColor,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, { color: partnerStatusMeta.textColor }]}>
                {partnerStatusMeta.label}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: verificationStatus === 'verified'
                  ? `${Colors.success500}18`
                  : verificationStatus === 'rejected'
                    ? `${Colors.error500}18`
                    : `${Colors.warning500}18`,
                borderColor: verificationStatus === 'verified'
                  ? `${Colors.success500}55`
                  : verificationStatus === 'rejected'
                    ? `${Colors.error500}55`
                    : `${Colors.warning500}55`,
              },
            ]}
          >
            <Text
              style={[
                Fonts.p4Bold,
                {
                  color: verificationStatus === 'verified'
                    ? Colors.success500
                    : verificationStatus === 'rejected'
                      ? Colors.error500
                      : Colors.warning500,
                },
              ]}
            >
              {verificationStatus === 'verified'
                ? 'Verifiee'
                : verificationStatus === 'rejected'
                  ? 'Rejetee'
                  : 'En attente'}
            </Text>
          </View>
        </View>

        <View style={Spaces.marginTop[12]}>
          <Text style={[Fonts.p4Bold, { color: Colors.primary200 }]}>
            Coach
          </Text>
          <Text style={[Fonts.p4, Fonts.neutral00, Spaces.marginTop[4]]}>
            {organizerName}
          </Text>
          <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
            {phoneLabel || 'Telephone non renseigne'}
          </Text>
        </View>

        {item?.verification?.notes ? (
          <View style={[styles.notesBlock, { backgroundColor: `${Colors.neutral00}08`, borderColor: `${Colors.neutral00}10` }]}>
            <Text style={[Fonts.p4Bold, { color: Colors.primary200 }]}>Notes</Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              {item.verification.notes}
            </Text>
          </View>
        ) : null}

        <View style={styles.inlineActionsRow}>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => openEventDetails(item?.documentId)}
            style={[styles.inlineActionButton, { backgroundColor: `${Colors.primary500}18`, borderColor: `${Colors.primary500}44` }]}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Ouvrir</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => handleCallOrganizer(phoneNumber)}
            style={[styles.inlineActionButton, { backgroundColor: `${Colors.neutral00}08`, borderColor: `${Colors.neutral00}18` }]}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>Appeler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => openReviewModal(item)}
            style={[styles.inlineActionButton, { backgroundColor: `${Colors.success500}14`, borderColor: `${Colors.success500}33` }]}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.success500 }]}>Traiter</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFirstTeamEventItem = (item) => {
    const partnerStatusMeta = getPartnerStatusMeta(item?.club?.clubVerified === true);

    return (
      <TouchableOpacity
        key={`first-team-event-${item?.documentId || item?.name || item?.createdAt || 'row'}`}
        activeOpacity={0.86}
        onPress={() => openEventDetails(item?.documentId)}
        style={[
          styles.detailCard,
          {
            backgroundColor: Colors.primary700,
            borderColor: `${Colors.primary200}33`,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {item?.name || 'Evenement'}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              {item?.team?.name || 'Equipe inconnue'}
              {item?.club?.name ? ` - ${item.club.name}` : ''}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              Cree le {formatDateTime(item?.createdAt)}
            </Text>
            <View
              style={[
                styles.statusPill,
                Spaces.marginTop[8],
                {
                  alignSelf: 'flex-start',
                  backgroundColor: partnerStatusMeta.backgroundColor,
                  borderColor: partnerStatusMeta.borderColor,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, { color: partnerStatusMeta.textColor }]}>
                {partnerStatusMeta.label}
              </Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${Colors.primary200}18`, borderColor: `${Colors.primary200}44` }]}>
            <Text style={[Fonts.p4Bold, { color: Colors.primary200 }]}>1er event</Text>
          </View>
        </View>
        <Text style={[Fonts.p4, Fonts.primary100, Spaces.marginTop[12]]}>
          Organisateur: {formatPersonName(item?.organizer)}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderGovernanceAffiliationItem = (item) => {
    const phoneLabel = sanitizePhoneNumber(item?.user?.phoneNumber);
    const coachName = formatPersonName(item?.user);
    const canPublish = item?.access?.canPublish === true;
    const hasIndividualOverride = item?.override?.publicationOverride === 'allowed';
    const eventsCreatedCount = Number(item?.metrics?.eventsCreatedCount || 0);
    const recruitmentAdsCreatedCount = Number(item?.metrics?.recruitmentAdsCreatedCount || 0);
    const statusMeta = canPublish
      ? {
        backgroundColor: `${Colors.success500}18`,
        borderColor: `${Colors.success500}44`,
        label: item?.access?.reason === 'global_enabled'
          ? 'Publication ouverte (global)'
          : 'Publication autorisee',
        textColor: Colors.success500,
      }
      : {
        backgroundColor: `${Colors.warning500}18`,
        borderColor: `${Colors.warning500}44`,
        label: 'Publication bloquee',
        textColor: Colors.warning500,
      };

    return (
      <View
        key={`governed-coach-${item?.user?.documentId || 'user'}-${item?.club?.documentId || 'club'}`}
        style={[
          styles.detailCard,
          {
            backgroundColor: Colors.primary700,
            borderColor: `${Colors.neutral00}14`,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {coachName}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              {item?.club?.name || 'Club non renseigne'}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              {phoneLabel || 'Telephone non renseigne'}
            </Text>
          </View>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: statusMeta.backgroundColor,
                borderColor: statusMeta.borderColor,
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, { color: statusMeta.textColor }]}>
              {statusMeta.label}
            </Text>
          </View>
        </View>

        <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8], Spaces.marginTop[12]]}>
          <View style={[styles.statusPill, { backgroundColor: `${Colors.primary500}14`, borderColor: `${Colors.primary500}33` }]}>
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
              {eventsCreatedCount}
              {' '}
              event
              {eventsCreatedCount > 1 ? 's' : ''}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${Colors.primary200}14`, borderColor: `${Colors.primary200}33` }]}>
            <Text style={[Fonts.p4Bold, { color: Colors.primary200 }]}>
              {recruitmentAdsCreatedCount}
              {' '}
              annonce
              {recruitmentAdsCreatedCount > 1 ? 's' : ''}
            </Text>
          </View>
          {item?.affiliation?.autoAffiliated ? (
            <View style={[styles.statusPill, { backgroundColor: `${Colors.neutral00}08`, borderColor: `${Colors.neutral00}16` }]}>
              <Text style={[Fonts.p4Bold, Fonts.neutral00]}>Auto-affilie</Text>
            </View>
          ) : null}
        </View>

        {item?.override?.internalReviewNotes ? (
          <View style={[styles.notesBlock, { backgroundColor: `${Colors.neutral00}08`, borderColor: `${Colors.neutral00}10` }]}>
            <Text style={[Fonts.p4Bold, { color: Colors.primary200 }]}>Note interne</Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              {item.override.internalReviewNotes}
            </Text>
          </View>
        ) : null}

        <View style={styles.inlineActionsRow}>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => handleCallOrganizer(item?.user?.phoneNumber)}
            style={[styles.inlineActionButton, { backgroundColor: `${Colors.neutral00}08`, borderColor: `${Colors.neutral00}18` }]}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>Appeler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.86}
            disabled={updateNonPartnerCoachAffiliationMutation.isPending}
            onPress={() => handleToggleCoachOverride(item)}
            style={[
              styles.inlineActionButton,
              {
                backgroundColor: canPublish ? `${Colors.warning500}16` : `${Colors.success500}16`,
                borderColor: canPublish ? `${Colors.warning500}33` : `${Colors.success500}33`,
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, { color: hasIndividualOverride ? Colors.warning500 : Colors.success500 }]}>
              {hasIndividualOverride ? 'Retirer l exception' : 'Autoriser'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSubscriptionPreviewItem = (item) => {
    const status = String(item?.status || 'pending').trim().toLowerCase();
    const statusMeta = status === 'active'
      ? { backgroundColor: `${Colors.success500}18`, borderColor: `${Colors.success500}44`, textColor: Colors.success500 }
      : status === 'grace_period'
        ? { backgroundColor: `${Colors.warning500}18`, borderColor: `${Colors.warning500}44`, textColor: Colors.warning500 }
        : { backgroundColor: `${Colors.neutral00}08`, borderColor: `${Colors.neutral00}16`, textColor: Colors.neutral00 };

    return (
      <View
        key={`subscription-preview-${item?.documentId || item?.planCode || 'row'}`}
        style={[
          styles.detailCard,
          {
            backgroundColor: Colors.primary700,
            borderColor: `${Colors.primary500}22`,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {formatPlanCode(item?.planCode)}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              {item?.provider || 'provider inconnu'}
              {item?.billingPeriod ? ` - ${item.billingPeriod}` : ''}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              {item?.payerUser
                ? `Payeur: ${formatPersonName(item.payerUser)}`
                : 'Payeur non renseigne'}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              {item?.providerTransactionId || item?.documentId || 'Sans transaction'}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusMeta.backgroundColor, borderColor: statusMeta.borderColor }]}>
            <Text style={[Fonts.p4Bold, { color: statusMeta.textColor }]}>
              {status || 'pending'}
            </Text>
          </View>
        </View>

        <View style={styles.inlineActionsRow}>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => openManualEntitlementModal(null, item?.documentId || '')}
            style={[styles.inlineActionButton, { backgroundColor: `${Colors.primary500}18`, borderColor: `${Colors.primary500}44` }]}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Entitlement</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => handleSyncTeamEntitlements(item)}
            style={[styles.inlineActionButton, { backgroundColor: `${Colors.success500}14`, borderColor: `${Colors.success500}33` }]}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.success500 }]}>Resync Team</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEntitlementPreviewItem = (item) => {
    const status = String(item?.status || 'inactive').trim().toLowerCase();
    const statusMeta = status === 'active'
      ? { backgroundColor: `${Colors.success500}18`, borderColor: `${Colors.success500}44`, textColor: Colors.success500 }
      : { backgroundColor: `${Colors.warning500}18`, borderColor: `${Colors.warning500}44`, textColor: Colors.warning500 };
    const scopeLabel = item?.scopeType === 'CLUB'
      ? (item?.scopeClub?.name || item?.scopeClub?.documentId || 'Club')
      : (item?.scopeTeam?.name || item?.scopeTeam?.documentId || 'Equipe');

    return (
      <View
        key={`entitlement-preview-${item?.documentId || scopeLabel}`}
        style={[
          styles.detailCard,
          {
            backgroundColor: Colors.primary700,
            borderColor: `${Colors.primary200}22`,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {item?.capability || '*'}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              {item?.scopeType || 'Scope inconnu'}
              {' - '}
              {scopeLabel}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              Subscription: {formatPlanCode(item?.subscription?.planCode)}
            </Text>
            {item?.sourceTeamSlot?.documentId ? (
              <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
                Slot source: #{item?.sourceTeamSlot?.slotNumber || 0}
              </Text>
            ) : null}
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusMeta.backgroundColor, borderColor: statusMeta.borderColor }]}>
            <Text style={[Fonts.p4Bold, { color: statusMeta.textColor }]}>
              {status}
            </Text>
          </View>
        </View>

        <View style={styles.inlineActionsRow}>
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => openManualEntitlementModal(item)}
            style={[styles.inlineActionButton, { backgroundColor: `${Colors.primary200}16`, borderColor: `${Colors.primary200}33` }]}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.primary200 }]}>Corriger</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderQuotaPreviewItem = (item) => (
    <View
      key={`quota-preview-${item?.documentId || item?.quotaType || 'row'}`}
      style={[
        styles.detailCard,
        {
          backgroundColor: Colors.primary700,
          borderColor: `${Colors.neutral00}14`,
        },
      ]}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {item?.quotaType || 'Quota'}
      </Text>
      <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
        {item?.user ? formatPersonName(item.user) : 'Utilisateur inconnu'}
        {item?.team?.name ? ` - ${item.team.name}` : ''}
      </Text>
      <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8], Spaces.marginTop[12]]}>
        <View style={[styles.statusPill, { backgroundColor: `${Colors.primary500}14`, borderColor: `${Colors.primary500}33` }]}>
          <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
            {Number(item?.used || 0)} / {Number(item?.limit || 0)}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${Colors.warning500}14`, borderColor: `${Colors.warning500}33` }]}>
          <Text style={[Fonts.p4Bold, { color: Colors.warning500 }]}>
            reste {Number(item?.remaining || 0)}
          </Text>
        </View>
      </View>
      {item?.lastUsedAt ? (
        <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[12]]}>
          Dernier usage: {formatDateTime(item.lastUsedAt)}
        </Text>
      ) : null}
    </View>
  );

  const renderBillingEventPreviewItem = (item) => {
    const status = String(item?.processingStatus || 'pending').trim().toLowerCase();
    const isFailed = status === 'failed';
    return (
      <View
        key={`billing-preview-${item?.documentId || item?.providerEventId || 'row'}`}
        style={[
          styles.detailCard,
          {
            backgroundColor: Colors.primary700,
            borderColor: isFailed ? `${Colors.error500}33` : `${Colors.neutral00}14`,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {item?.eventType || 'billing-event'}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              {item?.provider || 'provider inconnu'}
              {item?.providerEventId ? ` - ${item.providerEventId}` : ''}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              Recu le {formatDateTime(item?.receivedAt)}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: isFailed ? `${Colors.error500}18` : `${Colors.success500}18`, borderColor: isFailed ? `${Colors.error500}44` : `${Colors.success500}44` }]}>
            <Text style={[Fonts.p4Bold, { color: isFailed ? Colors.error500 : Colors.success500 }]}>
              {status}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderClaimRequestPreviewItem = (item) => {
    const status = String(item?.verificationStatus || item?.state || 'pending').trim().toLowerCase();
    const isApproved = status === 'approved' || status === 'verified' || status === 'processed';
    const isRejected = status === 'rejected' || status === 'refused';
    return (
      <TouchableOpacity
        key={`claim-preview-${item?.documentId || item?.club?.documentId || 'row'}`}
        activeOpacity={0.86}
        onPress={() => openClaimPreviewDetail(item)}
        style={[
          styles.detailCard,
          {
            backgroundColor: Colors.primary700,
            borderColor: `${Colors.warning500}22`,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {item?.club?.name || 'Club inconnu'}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              {item?.user ? formatPersonName(item.user) : 'Utilisateur inconnu'}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
              {item?.proofType || 'Preuve non renseignee'}
            </Text>
          </View>
          <View style={[styles.statusPill, {
            backgroundColor: isApproved
              ? `${Colors.success500}18`
              : isRejected
                ? `${Colors.error500}18`
                : `${Colors.warning500}18`,
            borderColor: isApproved
              ? `${Colors.success500}44`
              : isRejected
                ? `${Colors.error500}44`
                : `${Colors.warning500}44`,
          }]}
          >
            <Text style={[Fonts.p4Bold, {
              color: isApproved
                ? Colors.success500
                : isRejected
                  ? Colors.error500
                  : Colors.warning500,
            }]}
            >
              {status}
            </Text>
          </View>
        </View>
        {item?.rejectionReason ? (
          <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[12]]}>
            Motif: {item.rejectionReason}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderLegacyCandidateItem = (item) => (
    <View
      key={`legacy-candidate-${item?.documentId || item?.name || 'row'}`}
      style={[
        styles.detailCard,
        {
          backgroundColor: Colors.primary700,
          borderColor: `${Colors.primary500}22`,
        },
      ]}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {item?.name || 'Club legacy'}
      </Text>
      <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[4]]}>
        {item?.documentId || 'Sans documentId'}
      </Text>
      <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8], Spaces.marginTop[12]]}>
        <View style={[styles.statusPill, { backgroundColor: `${Colors.success500}14`, borderColor: `${Colors.success500}33` }]}>
          <Text style={[Fonts.p4Bold, { color: Colors.success500 }]}>
            {item?.clubPartner ? 'Partenaire' : 'A migrer'}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${Colors.primary200}14`, borderColor: `${Colors.primary200}33` }]}>
          <Text style={[Fonts.p4Bold, { color: Colors.primary200 }]}>
            Legacy {Number(item?.subscriptionValue || 0)} EUR
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${Colors.primary500}14`, borderColor: `${Colors.primary500}33` }]}>
          <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
            Legacy {Number(item?.maxTeamNumber || 0)} equipe{Number(item?.maxTeamNumber || 0) > 1 ? 's' : ''}
          </Text>
        </View>
      </View>
      <View style={styles.inlineActionsRow}>
        <TouchableOpacity
          activeOpacity={0.86}
          onPress={() => openLegacyMigrationModal(item?.documentId || '')}
          style={[styles.inlineActionButton, { backgroundColor: `${Colors.warning500}16`, borderColor: `${Colors.warning500}33` }]}
        >
          <Text style={[Fonts.p4Bold, { color: Colors.warning500 }]}>Dry-run cible</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.fill,
      ]}
    >
      <View style={[Spaces.marginBottom[24], Spaces.paddingHorizontal[24]]}>
        <Text style={[Fonts.label, styles.headerEyebrow, { color: Colors.primary500 }]}>
          Superadmin
        </Text>
        <Text style={[Fonts.h1, Fonts.neutral00]}>Dashboard Admin</Text>
        <Text style={[Fonts.p2, Fonts.neutral300, styles.headerDescription]}>
          Pilote les demandes, les alertes, les detections et les evenements sensibles depuis un seul espace.
        </Text>
        {partialDashboardDescription ? (
          <Text style={[Fonts.p2, Fonts.neutral300, Spaces.marginTop[8]]}>
            {partialDashboardDescription}
          </Text>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={[Spaces.paddingHorizontal[24], Spaces.paddingBottom[32]]}>
        <View
          style={[
            styles.flagBanner,
            {
              backgroundColor: publishingGovernance.globalEnabled
                ? `${Colors.success500}18`
                : `${Colors.warning500}18`,
              borderColor: publishingGovernance.globalEnabled
                ? `${Colors.success500}44`
                : `${Colors.warning500}44`,
            },
          ]}
        >
          <View style={styles.flagBannerContent}>
            <Text style={[Fonts.label, styles.cardChipText, { color: publishingGovernance.globalEnabled ? Colors.success500 : Colors.warning500 }]}>
              Gouvernance
            </Text>
            <Text style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginTop[6]]}>
              Publication coachs non certifies
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[8]]}>
              {publishingGovernance.globalEnabled
                ? 'Les coachs rattaches a un club non certifie peuvent publier leurs evenements et annonces.'
                : 'Les coachs de clubs non certifies restent bloques tant qu aucune exception superadmin n est accordee.'}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.86}
            disabled={updateNonPartnerCoachGovernanceMutation.isPending}
            onPress={handleToggleGlobalGovernance}
            style={[
              styles.flagStatePill,
              {
                backgroundColor: publishingGovernance.globalEnabled ? Colors.success500 : Colors.warning500,
                opacity: updateNonPartnerCoachGovernanceMutation.isPending ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.neutral900 }]}>
              {updateNonPartnerCoachGovernanceMutation.isPending
                ? '...'
                : (publishingGovernance.globalEnabled ? 'ON' : 'OFF')}
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.testToolsCard,
            {
              backgroundColor: Colors.primary700,
              borderColor: `${Colors.primary500}55`,
            },
          ]}
        >
          <View style={styles.testToolsContent}>
            <Text style={[Fonts.label, styles.cardChipText, { color: Colors.primary500 }]}>
              Outils de test
            </Text>
            <Text style={[Fonts.h3Bold, Fonts.neutral00, styles.testToolsTitle]}>
              Tournoi fictif complet
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200, styles.testToolsDescription]}>
              Cree un tournoi sandbox avec equipes, effectifs fictifs, poules et matchs pour valider le flux de bout en bout.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.84}
            disabled={generateTestTournamentMutation.isPending}
            onPress={handleGenerateTestTournament}
            style={[
              styles.testToolsButton,
              {
                backgroundColor: generateTestTournamentMutation.isPending
                  ? `${Colors.primary500}66`
                  : Colors.primary500,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral900]}>
              {generateTestTournamentMutation.isPending ? 'Generation...' : 'Generer'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginBottom[12]]}>
          Pilotage general
        </Text>
        <View style={styles.dashboardGrid}>
          <DashboardCard
            color={Colors.success500}
            meta="Finance"
            onPress={() => navigation.navigate(RouteNames.AdminRevenue)}
            title="CA genere"
            value={`${generatedRevenue} EUR`}
          />
          <DashboardCard
            color={Colors.primary500}
            meta="Live"
            onPress={() => navigation.navigate(RouteNames.AdminEvents)}
            title="Evenements du jour"
            value={eventsTodayCount}
          />
          <DashboardCard
            color={Colors.error500}
            meta="Alerte"
            onPress={() => navigation.navigate(RouteNames.AdminReports)}
            title="Signalements"
            value={reportsCount}
          />
          <DashboardCard
            color={Colors.primary200}
            meta="A traiter"
            onPress={() => navigation.navigate(RouteNames.FeaturedRequestsList)}
            title="Demandes a la une"
            value={featuredCount}
          />
          <DashboardCard
            color={Colors.warning500}
            meta="Clubs"
            onPress={() => navigation.navigate(RouteNames.AdminClaimList)}
            title="Revendications"
            value={claimsCount}
          />
          <DashboardCard
            color={Colors.primary500}
            meta="Onboarding"
            onPress={() => navigation.navigate(RouteNames.AdminClubOnboardingList)}
            title="Clubs a onboarder"
            value={clubOnboardingCount}
          />
          <DashboardCard
            color={Colors.primary200}
            meta="Pop-up"
            onPress={() => navigation.navigate(RouteNames.AdminPopupCampaignList)}
            title="Campagnes pop-up"
            value={popupCampaignCount}
          />
          <DashboardCard
            color={Colors.error500}
            meta="League"
            onPress={() => navigation.navigate(RouteNames.AdminLeagueDisputes)}
            title="Litiges League"
            value={leagueDisputesCount}
          />
          <DashboardCard
            color={Colors.primary500}
            meta="Push"
            onPress={() => navigation.navigate(RouteNames.AdminNotificationsHealth)}
            title="Notifications"
            value="Push"
          />
          <DashboardCard
            color={Colors.primary200}
            meta="Gestion"
            onPress={() => navigation.navigate(RouteNames.AdminUserList)}
            title="Utilisateurs"
            value="Users"
          />
          <DashboardCard
            color={Colors.primary500}
            meta="Gestion"
            onPress={() => navigation.navigate(RouteNames.AdminClubList)}
            title="Clubs"
            value="Clubs"
          />
          <DashboardCard
            color={Colors.primary500}
            meta="Contenus"
            onPress={() => navigation.navigate(RouteNames.SuperAdminContentExplorer)}
            title="Explorer CM"
            value="CM"
          />
        </View>

        <Text style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginBottom[12], Spaces.marginTop[8]]}>
          KPIs detection et acquisition
        </Text>
        <View style={styles.dashboardGrid}>
          <DashboardCard
            color={Colors.primary500}
            meta="Business"
            title="Utilisateurs avec club"
            value={business?.usersWithClub || 0}
          />
          <DashboardCard
            color={Colors.warning500}
            meta="Business"
            title="Utilisateurs sans club"
            value={business?.usersWithoutClub || 0}
          />
          <DashboardCard
            color={Colors.primary200}
            meta="Business"
            title="Equipes creees"
            value={business?.teamsCreated || 0}
          />
          <DashboardCard
            color={Colors.success500}
            meta="Business"
            title="Clubs partenaires"
            value={business?.partnerClubs || 0}
          />
          <DashboardCard
            color={Colors.primary500}
            meta="Detections"
            title="Publiees sur 30 jours"
            value={ops?.detectionsPublishedLast30Days || 0}
          />
          <DashboardCard
            color={Colors.warning500}
            meta="Detections"
            title="A verifier"
            value={ops?.detectionsPendingVerification || 0}
          />
          <DashboardCard
            color={Colors.primary200}
            meta="Signals"
            title="Equipes avec 1er event"
            value={ops?.teamsWithFirstEventCount || 0}
          />
          <DashboardCard
            color={Colors.neutral100}
            meta="Gouvernance"
            title="Coachs non certifies"
            value={publishingGovernance?.nonPartnerCoaches || 0}
          />
          <DashboardCard
            color={Colors.neutral100}
            meta="Gouvernance"
            title="Clubs non certifies actifs"
            value={publishingGovernance?.nonPartnerClubsWithAffiliatedCoaches || 0}
          />
          <DashboardCard
            color={Colors.success500}
            meta="Gouvernance"
            title="Exceptions individuelles"
            value={publishingGovernance?.individuallyAllowedCoaches || 0}
          />
          <DashboardCard
            color={Colors.primary200}
            meta="Gouvernance"
            title="Coachs auto-affilies"
            value={publishingGovernance?.autoAffiliatedCoaches || 0}
          />
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: Colors.primary700,
              borderColor: `${Colors.primary500}33`,
            },
          ]}
        >
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Subscription Ops</Text>
              <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[6]]}>
                Pilote la migration legacy, les subscriptions manuelles, les entitlements et les signaux billing depuis le meme back-office.
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={refetchSubscriptionOps}
              style={[styles.refreshButton, { borderColor: `${Colors.primary500}44` }]}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Rafraichir</Text>
            </TouchableOpacity>
          </View>

          <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8], Spaces.marginTop[16]]}>
            <View style={[styles.statusPill, { backgroundColor: `${Colors.primary500}14`, borderColor: `${Colors.primary500}33` }]}>
              <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                {Number(subscriptionOpsCounts?.subscriptions || 0)} subscriptions
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: `${Colors.success500}14`, borderColor: `${Colors.success500}33` }]}>
              <Text style={[Fonts.p4Bold, { color: Colors.success500 }]}>
                {Number(subscriptionOpsCounts?.entitlements || 0)} entitlements
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: `${Colors.warning500}14`, borderColor: `${Colors.warning500}33` }]}>
              <Text style={[Fonts.p4Bold, { color: Colors.warning500 }]}>
                {Number(subscriptionOpsCounts?.legacyCandidateClubs || 0)} legacy
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: `${Colors.error500}14`, borderColor: `${Colors.error500}33` }]}>
              <Text style={[Fonts.p4Bold, { color: Colors.error500 }]}>
                {Number(subscriptionOpsCounts?.failedBillingEvents || 0)} billing KO
              </Text>
            </View>
          </View>

          <View style={styles.inlineActionsRow}>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => openLegacyMigrationModal('')}
              style={[styles.inlineActionButton, { backgroundColor: `${Colors.warning500}16`, borderColor: `${Colors.warning500}33` }]}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.warning500 }]}>Migration legacy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={openManualSubscriptionModal}
              style={[styles.inlineActionButton, { backgroundColor: `${Colors.primary500}18`, borderColor: `${Colors.primary500}44` }]}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Subscription manuelle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => openManualEntitlementModal()}
              style={[styles.inlineActionButton, { backgroundColor: `${Colors.primary200}16`, borderColor: `${Colors.primary200}33` }]}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.primary200 }]}>Entitlement manuel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => navigation.navigate(RouteNames.AdminClaimList)}
              style={[styles.inlineActionButton, { backgroundColor: `${Colors.neutral00}08`, borderColor: `${Colors.neutral00}16` }]}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>Claims</Text>
            </TouchableOpacity>
          </View>

          <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginTop[20], Spaces.marginBottom[12]]}>
            Subscriptions recentes
          </Text>
          {subscriptionPreviewItems.length > 0 ? (
            subscriptionPreviewItems.map(renderSubscriptionPreviewItem)
          ) : (
            <View style={[styles.emptySectionState, { backgroundColor: `${Colors.neutral00}06`, borderColor: `${Colors.neutral00}12` }]}>
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Aucune subscription a afficher</Text>
            </View>
          )}

          <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginTop[12], Spaces.marginBottom[12]]}>
            Entitlements recents
          </Text>
          {entitlementPreviewItems.length > 0 ? (
            entitlementPreviewItems.map(renderEntitlementPreviewItem)
          ) : (
            <View style={[styles.emptySectionState, { backgroundColor: `${Colors.neutral00}06`, borderColor: `${Colors.neutral00}12` }]}>
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Aucun entitlement a afficher</Text>
            </View>
          )}

          <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginTop[12], Spaces.marginBottom[12]]}>
            Clubs legacy candidats
          </Text>
          {legacyCandidatePreviewItems.length > 0 ? (
            legacyCandidatePreviewItems.map(renderLegacyCandidateItem)
          ) : (
            <View style={[styles.emptySectionState, { backgroundColor: `${Colors.neutral00}06`, borderColor: `${Colors.neutral00}12` }]}>
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Aucun candidat legacy</Text>
            </View>
          )}

          <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginTop[12], Spaces.marginBottom[12]]}>
            Claims a revoir
          </Text>
          {claimRequestPreviewItems.length > 0 ? (
            claimRequestPreviewItems.map(renderClaimRequestPreviewItem)
          ) : (
            <View style={[styles.emptySectionState, { backgroundColor: `${Colors.neutral00}06`, borderColor: `${Colors.neutral00}12` }]}>
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Aucun claim en preview</Text>
            </View>
          )}

          <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginTop[12], Spaces.marginBottom[12]]}>
            Quotas free
          </Text>
          {quotaPreviewItems.length > 0 ? (
            quotaPreviewItems.map(renderQuotaPreviewItem)
          ) : (
            <View style={[styles.emptySectionState, { backgroundColor: `${Colors.neutral00}06`, borderColor: `${Colors.neutral00}12` }]}>
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Aucun quota en preview</Text>
            </View>
          )}

          <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginTop[12], Spaces.marginBottom[12]]}>
            Billing events
          </Text>
          {billingEventPreviewItems.length > 0 ? (
            billingEventPreviewItems.map(renderBillingEventPreviewItem)
          ) : (
            <View style={[styles.emptySectionState, { backgroundColor: `${Colors.neutral00}06`, borderColor: `${Colors.neutral00}12` }]}>
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Aucun billing event en preview</Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: Colors.primary700,
              borderColor: `${Colors.neutral00}18`,
            },
          ]}
        >
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Coachs non certifies</Text>
              <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[6]]}>
                {publishingGovernance?.nonPartnerCoaches || 0}
                {' '}
                coach
                {(publishingGovernance?.nonPartnerCoaches || 0) > 1 ? 's' : ''}
                {' '}
                rattaches a un club non partenaire. Autorise individuellement ceux qui peuvent publier.
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={refetchGovernanceAffiliations}
              style={[styles.refreshButton, { borderColor: `${Colors.neutral00}18` }]}
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral00]}>Rafraichir</Text>
            </TouchableOpacity>
          </View>

          <View style={Spaces.marginTop[16]}>
            {governanceAffiliations.length > 0 ? (
              governanceAffiliations.map(renderGovernanceAffiliationItem)
            ) : (
              <View style={[styles.emptySectionState, { backgroundColor: `${Colors.neutral00}06`, borderColor: `${Colors.neutral00}12` }]}>
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Aucun coach non certifie</Text>
                <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[6]]}>
                  Les nouvelles affiliations auto-assignees apparaitront ici.
                </Text>
              </View>
            )}
          </View>
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: Colors.primary700,
              borderColor: `${Colors.primary500}44`,
            },
          ]}
        >
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>File de verification detection</Text>
              <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[6]]}>
                {detectionQueueTotal}
                {' '}
                detection
                {detectionQueueTotal > 1 ? 's' : ''}
                {' '}
                dans la file. Tu peux ouvrir la fiche, appeler le coach et noter la verification.
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={refetchDetectionQueue}
              style={[styles.refreshButton, { borderColor: `${Colors.primary500}44` }]}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Rafraichir</Text>
            </TouchableOpacity>
          </View>

          <View style={Spaces.marginTop[16]}>
            {detectionVerificationQueue.length > 0 ? (
              detectionVerificationQueue.map(renderDetectionQueueItem)
            ) : (
              <View style={[styles.emptySectionState, { backgroundColor: `${Colors.neutral00}06`, borderColor: `${Colors.neutral00}12` }]}>
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Aucune detection en attente</Text>
                <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[6]]}>
                  La file est vide pour le moment.
                </Text>
              </View>
            )}
          </View>
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: Colors.primary700,
              borderColor: `${Colors.primary200}44`,
            },
          ]}
        >
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Premiers evenements d equipe</Text>
              <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[6]]}>
                Surveille les equipes qui viennent de creer leur premier evenement pour detecter les structures a relancer.
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: `${Colors.primary200}18`, borderColor: `${Colors.primary200}44` }]}>
              <Text style={[Fonts.p4Bold, { color: Colors.primary200 }]}>
                {ops?.teamsWithFirstEventCount || 0}
              </Text>
            </View>
          </View>

          <View style={Spaces.marginTop[16]}>
            {recentFirstTeamEvents.length > 0 ? (
              recentFirstTeamEvents.map(renderFirstTeamEventItem)
            ) : (
              <View style={[styles.emptySectionState, { backgroundColor: `${Colors.neutral00}06`, borderColor: `${Colors.neutral00}12` }]}>
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Aucun premier evenement recent</Text>
                <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[6]]}>
                  Les nouveaux signaux d activation d equipe apparaitront ici.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={closeReviewModal}
        transparent
        visible={Boolean(reviewItem)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: Colors.neutral900, borderColor: `${Colors.primary500}44` }]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Traiter la verification</Text>
            <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[8]]}>
              {reviewItem?.name || 'Detection'}
            </Text>
            <Text style={[Fonts.p4, Fonts.primary100, Spaces.marginTop[4]]}>
              {reviewItem?.team?.name || 'Equipe inconnue'}
              {reviewItem?.club?.name ? ` - ${reviewItem.club.name}` : ''}
            </Text>

            <View style={[styles.statusSelectorRow, Spaces.marginTop[16]]}>
              {REVIEWABLE_STATUSES.map((statusOption) => {
                const isActive = reviewStatus === statusOption.key;
                return (
                  <TouchableOpacity
                    key={statusOption.key}
                    activeOpacity={0.86}
                    onPress={() => setReviewStatus(statusOption.key)}
                    style={[
                      styles.statusOptionButton,
                      {
                        backgroundColor: isActive ? `${Colors.primary500}20` : `${Colors.neutral00}06`,
                        borderColor: isActive ? `${Colors.primary500}66` : `${Colors.neutral00}16`,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p4Bold, { color: isActive ? Colors.primary500 : Colors.neutral00 }]}>
                      {statusOption.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[Fonts.p4Bold, { color: Colors.primary200 }, Spaces.marginTop[16], Spaces.marginBottom[8]]}>
              Notes internes
            </Text>
            <TextInput
              multiline
              onChangeText={setReviewNotes}
              placeholder="Appel effectue, identite verifiee, contact club, etc."
              placeholderTextColor={Colors.neutral400}
              style={[
                styles.notesInput,
                {
                  borderColor: `${Colors.neutral00}18`,
                  color: Colors.neutral00,
                },
              ]}
              textAlignVertical="top"
              value={reviewNotes}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={closeReviewModal}
                style={[styles.modalActionButton, { backgroundColor: `${Colors.neutral00}06`, borderColor: `${Colors.neutral00}16` }]}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.86}
                disabled={updateDetectionVerificationMutation.isPending}
                onPress={handleSubmitReview}
                style={[
                  styles.modalActionButton,
                  {
                    backgroundColor: updateDetectionVerificationMutation.isPending
                      ? `${Colors.primary500}66`
                      : Colors.primary500,
                    borderColor: Colors.primary500,
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.neutral900 }]}>
                  {updateDetectionVerificationMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeLegacyMigrationModal}
        transparent
        visible={isLegacyMigrationModalVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: Colors.neutral900, borderColor: `${Colors.warning500}44` }]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Migration legacy</Text>
            <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[8]]}>
              Lance un dry-run global ou cible un club precis avant l apply reel.
            </Text>
            <Text style={[Fonts.p4Bold, { color: Colors.warning500 }, Spaces.marginTop[16], Spaces.marginBottom[8]]}>
              Club documentId optionnel
            </Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setLegacyMigrationClubDocumentId}
              placeholder="club-document-id"
              placeholderTextColor={Colors.neutral400}
              style={[
                styles.formInput,
                {
                  borderColor: `${Colors.neutral00}18`,
                  color: Colors.neutral00,
                },
              ]}
              value={legacyMigrationClubDocumentId}
            />
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                activeOpacity={0.86}
                disabled={migrateLegacySubscriptionsMutation.isPending}
                onPress={() => handleRunLegacyMigration(false)}
                style={[styles.modalActionButton, { backgroundColor: `${Colors.warning500}16`, borderColor: `${Colors.warning500}33` }]}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.warning500 }]}>
                  {migrateLegacySubscriptionsMutation.isPending ? '...' : 'Dry-run'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.86}
                disabled={migrateLegacySubscriptionsMutation.isPending}
                onPress={() => handleRunLegacyMigration(true)}
                style={[styles.modalActionButton, { backgroundColor: Colors.warning500, borderColor: Colors.warning500 }]}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.neutral900 }]}>
                  {migrateLegacySubscriptionsMutation.isPending ? '...' : 'Apply'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={closeLegacyMigrationModal}
              style={[styles.linkButton, Spaces.marginTop[12]]}
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral300]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeManualSubscriptionModal}
        transparent
        visible={isManualSubscriptionModalVisible}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalCard, { backgroundColor: Colors.neutral900, borderColor: `${Colors.primary500}44` }]}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Subscription manuelle</Text>
              <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[8]]}>
                Cree une subscription auditee pour support, migration ciblee ou intervention superadmin.
              </Text>

              <Text style={[Fonts.p4Bold, { color: Colors.primary200 }, Spaces.marginTop[16], Spaces.marginBottom[8]]}>
                Plan
              </Text>
              <View style={styles.statusSelectorRow}>
                {subscriptionCatalog.map((entry) => {
                  const isActive = manualSubscriptionForm.planCode === entry.planCode;
                  return (
                    <TouchableOpacity
                      key={entry.planCode}
                      activeOpacity={0.86}
                      onPress={() => setManualSubscriptionForm((current) => ({
                        ...current,
                        planCode: entry.planCode,
                        providerProductId: entry.providerProductId || current.providerProductId,
                      }))}
                      style={[
                        styles.statusOptionButton,
                        {
                          backgroundColor: isActive ? `${Colors.primary500}20` : `${Colors.neutral00}06`,
                          borderColor: isActive ? `${Colors.primary500}66` : `${Colors.neutral00}16`,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p4Bold, { color: isActive ? Colors.primary500 : Colors.neutral00 }]}>
                        {formatPlanCode(entry.planCode)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[Fonts.p4Bold, { color: Colors.primary200 }, Spaces.marginTop[16], Spaces.marginBottom[8]]}>
                Payeur user documentId
              </Text>
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => setManualSubscriptionForm((current) => ({ ...current, payerUserDocumentId: value }))}
                placeholder="user-document-id"
                placeholderTextColor={Colors.neutral400}
                style={[styles.formInput, { borderColor: `${Colors.neutral00}18`, color: Colors.neutral00 }]}
                value={manualSubscriptionForm.payerUserDocumentId}
              />

              <Text style={[Fonts.p4Bold, { color: Colors.primary200 }, Spaces.marginTop[16], Spaces.marginBottom[8]]}>
                Provider / statut / periode
              </Text>
              <View style={styles.statusSelectorRow}>
                {['manual', 'apple', 'google', 'web', 'legacy'].map((provider) => {
                  const isActive = manualSubscriptionForm.provider === provider;
                  return (
                    <TouchableOpacity
                      key={provider}
                      activeOpacity={0.86}
                      onPress={() => setManualSubscriptionForm((current) => ({ ...current, provider }))}
                      style={[styles.statusOptionButton, {
                        backgroundColor: isActive ? `${Colors.primary500}20` : `${Colors.neutral00}06`,
                        borderColor: isActive ? `${Colors.primary500}66` : `${Colors.neutral00}16`,
                      }]}
                    >
                      <Text style={[Fonts.p4Bold, { color: isActive ? Colors.primary500 : Colors.neutral00 }]}>{provider}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={[styles.statusSelectorRow, Spaces.marginTop[10]]}>
                {['active', 'pending', 'grace_period', 'expired'].map((status) => {
                  const isActive = manualSubscriptionForm.status === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      activeOpacity={0.86}
                      onPress={() => setManualSubscriptionForm((current) => ({ ...current, status }))}
                      style={[styles.statusOptionButton, {
                        backgroundColor: isActive ? `${Colors.success500}20` : `${Colors.neutral00}06`,
                        borderColor: isActive ? `${Colors.success500}66` : `${Colors.neutral00}16`,
                      }]}
                    >
                      <Text style={[Fonts.p4Bold, { color: isActive ? Colors.success500 : Colors.neutral00 }]}>{status}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={[styles.statusSelectorRow, Spaces.marginTop[10]]}>
                {['manual', 'monthly', 'yearly', 'legacy'].map((billingPeriod) => {
                  const isActive = manualSubscriptionForm.billingPeriod === billingPeriod;
                  return (
                    <TouchableOpacity
                      key={billingPeriod}
                      activeOpacity={0.86}
                      onPress={() => setManualSubscriptionForm((current) => ({ ...current, billingPeriod }))}
                      style={[styles.statusOptionButton, {
                        backgroundColor: isActive ? `${Colors.primary200}20` : `${Colors.neutral00}06`,
                        borderColor: isActive ? `${Colors.primary200}66` : `${Colors.neutral00}16`,
                      }]}
                    >
                      <Text style={[Fonts.p4Bold, { color: isActive ? Colors.primary200 : Colors.neutral00 }]}>{billingPeriod}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[Fonts.p4Bold, { color: Colors.primary200 }, Spaces.marginTop[16], Spaces.marginBottom[8]]}>
                Provider productId / transactionId / raison
              </Text>
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => setManualSubscriptionForm((current) => ({ ...current, providerProductId: value }))}
                placeholder="providerProductId"
                placeholderTextColor={Colors.neutral400}
                style={[styles.formInput, { borderColor: `${Colors.neutral00}18`, color: Colors.neutral00 }]}
                value={manualSubscriptionForm.providerProductId}
              />
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => setManualSubscriptionForm((current) => ({ ...current, providerTransactionId: value }))}
                placeholder="providerTransactionId (optionnel)"
                placeholderTextColor={Colors.neutral400}
                style={[styles.formInput, styles.formInputSpacing, { borderColor: `${Colors.neutral00}18`, color: Colors.neutral00 }]}
                value={manualSubscriptionForm.providerTransactionId}
              />
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => setManualSubscriptionForm((current) => ({ ...current, reason: value }))}
                placeholder="reason obligatoire"
                placeholderTextColor={Colors.neutral400}
                style={[styles.formInput, styles.formInputSpacing, { borderColor: `${Colors.neutral00}18`, color: Colors.neutral00 }]}
                value={manualSubscriptionForm.reason}
              />

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={closeManualSubscriptionModal}
                  style={[styles.modalActionButton, { backgroundColor: `${Colors.neutral00}06`, borderColor: `${Colors.neutral00}16` }]}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.86}
                  disabled={createManualSubscriptionMutation.isPending}
                  onPress={handleSubmitManualSubscription}
                  style={[styles.modalActionButton, { backgroundColor: Colors.primary500, borderColor: Colors.primary500 }]}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.neutral900 }]}>
                    {createManualSubscriptionMutation.isPending ? 'Creation...' : 'Creer'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeManualEntitlementModal}
        transparent
        visible={isManualEntitlementModalVisible}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={[styles.modalCard, { backgroundColor: Colors.neutral900, borderColor: `${Colors.primary200}44` }]}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                {manualEntitlementForm.documentId ? 'Corriger un entitlement' : 'Entitlement manuel'}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[8]]}>
                Scope, capability et subscription restent alignes avec la source de verite backend.
              </Text>

              <Text style={[Fonts.p4Bold, { color: Colors.primary200 }, Spaces.marginTop[16], Spaces.marginBottom[8]]}>
                Subscription documentId
              </Text>
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => setManualEntitlementForm((current) => ({ ...current, subscriptionDocumentId: value }))}
                placeholder="subscription-document-id"
                placeholderTextColor={Colors.neutral400}
                style={[styles.formInput, { borderColor: `${Colors.neutral00}18`, color: Colors.neutral00 }]}
                value={manualEntitlementForm.subscriptionDocumentId}
              />

              <Text style={[Fonts.p4Bold, { color: Colors.primary200 }, Spaces.marginTop[16], Spaces.marginBottom[8]]}>
                Scope / statut
              </Text>
              <View style={styles.statusSelectorRow}>
                {['TEAM', 'CLUB'].map((scopeType) => {
                  const isActive = manualEntitlementForm.scopeType === scopeType;
                  return (
                    <TouchableOpacity
                      key={scopeType}
                      activeOpacity={0.86}
                      onPress={() => setManualEntitlementForm((current) => ({ ...current, scopeType }))}
                      style={[styles.statusOptionButton, {
                        backgroundColor: isActive ? `${Colors.primary200}20` : `${Colors.neutral00}06`,
                        borderColor: isActive ? `${Colors.primary200}66` : `${Colors.neutral00}16`,
                      }]}
                    >
                      <Text style={[Fonts.p4Bold, { color: isActive ? Colors.primary200 : Colors.neutral00 }]}>{scopeType}</Text>
                    </TouchableOpacity>
                  );
                })}
                {['active', 'inactive', 'revoked'].map((status) => {
                  const isActive = manualEntitlementForm.status === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      activeOpacity={0.86}
                      onPress={() => setManualEntitlementForm((current) => ({ ...current, status }))}
                      style={[styles.statusOptionButton, {
                        backgroundColor: isActive ? `${Colors.success500}20` : `${Colors.neutral00}06`,
                        borderColor: isActive ? `${Colors.success500}66` : `${Colors.neutral00}16`,
                      }]}
                    >
                      <Text style={[Fonts.p4Bold, { color: isActive ? Colors.success500 : Colors.neutral00 }]}>{status}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[Fonts.p4Bold, { color: Colors.primary200 }, Spaces.marginTop[16], Spaces.marginBottom[8]]}>
                Capability
              </Text>
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => setManualEntitlementForm((current) => ({ ...current, capability: value }))}
                placeholder="* ou capability precise"
                placeholderTextColor={Colors.neutral400}
                style={[styles.formInput, { borderColor: `${Colors.neutral00}18`, color: Colors.neutral00 }]}
                value={manualEntitlementForm.capability}
              />

              {manualEntitlementForm.scopeType === 'TEAM' ? (
                <>
                  <Text style={[Fonts.p4Bold, { color: Colors.primary200 }, Spaces.marginTop[16], Spaces.marginBottom[8]]}>
                    Team documentId
                  </Text>
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={(value) => setManualEntitlementForm((current) => ({ ...current, teamDocumentId: value }))}
                    placeholder="team-document-id"
                    placeholderTextColor={Colors.neutral400}
                    style={[styles.formInput, { borderColor: `${Colors.neutral00}18`, color: Colors.neutral00 }]}
                    value={manualEntitlementForm.teamDocumentId}
                  />
                </>
              ) : (
                <>
                  <Text style={[Fonts.p4Bold, { color: Colors.primary200 }, Spaces.marginTop[16], Spaces.marginBottom[8]]}>
                    Club documentId
                  </Text>
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={(value) => setManualEntitlementForm((current) => ({ ...current, clubDocumentId: value }))}
                    placeholder="club-document-id"
                    placeholderTextColor={Colors.neutral400}
                    style={[styles.formInput, { borderColor: `${Colors.neutral00}18`, color: Colors.neutral00 }]}
                    value={manualEntitlementForm.clubDocumentId}
                  />
                </>
              )}

              <Text style={[Fonts.p4Bold, { color: Colors.primary200 }, Spaces.marginTop[16], Spaces.marginBottom[8]]}>
                StartsAt / EndsAt / raison
              </Text>
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => setManualEntitlementForm((current) => ({ ...current, startsAt: value }))}
                placeholder="startsAt ISO optionnel"
                placeholderTextColor={Colors.neutral400}
                style={[styles.formInput, { borderColor: `${Colors.neutral00}18`, color: Colors.neutral00 }]}
                value={manualEntitlementForm.startsAt}
              />
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => setManualEntitlementForm((current) => ({ ...current, endsAt: value }))}
                placeholder="endsAt ISO optionnel"
                placeholderTextColor={Colors.neutral400}
                style={[styles.formInput, styles.formInputSpacing, { borderColor: `${Colors.neutral00}18`, color: Colors.neutral00 }]}
                value={manualEntitlementForm.endsAt}
              />
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => setManualEntitlementForm((current) => ({ ...current, reason: value }))}
                placeholder="reason obligatoire"
                placeholderTextColor={Colors.neutral400}
                style={[styles.formInput, styles.formInputSpacing, { borderColor: `${Colors.neutral00}18`, color: Colors.neutral00 }]}
                value={manualEntitlementForm.reason}
              />

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={closeManualEntitlementModal}
                  style={[styles.modalActionButton, { backgroundColor: `${Colors.neutral00}06`, borderColor: `${Colors.neutral00}16` }]}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.86}
                  disabled={saveManualEntitlementMutation.isPending}
                  onPress={handleSubmitManualEntitlement}
                  style={[styles.modalActionButton, { backgroundColor: Colors.primary200, borderColor: Colors.primary200 }]}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.neutral900 }]}>
                    {saveManualEntitlementMutation.isPending
                      ? 'Enregistrement...'
                      : (manualEntitlementForm.documentId ? 'Corriger' : 'Creer')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cardAccent: {
    borderBottomRightRadius: 4,
    borderTopRightRadius: 4,
    bottom: 18,
    left: 0,
    position: 'absolute',
    top: 18,
    width: 4,
  },
  cardChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  cardChipText: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cardHalo: {
    borderRadius: 54,
    height: 108,
    position: 'absolute',
    right: -42,
    top: -42,
    width: 108,
  },
  cardHeader: {
    alignItems: 'flex-start',
    minHeight: 26,
  },
  cardTitle: {
    minHeight: 42,
  },
  cardValue: {
    marginBottom: 8,
    marginTop: 18,
  },
  dashboardCard: {
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'space-between',
    marginBottom: 16,
    minHeight: 128,
    overflow: 'hidden',
    padding: 18,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    width: '48%',
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  emptySectionState: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  flagBanner: {
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
    overflow: 'hidden',
    padding: 18,
  },
  flagBannerContent: {
    flex: 1,
  },
  flagStatePill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    justifyContent: 'center',
    minWidth: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  formInput: {
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  formInputSpacing: {
    marginTop: 10,
  },
  headerDescription: {
    marginTop: 8,
    maxWidth: 460,
  },
  headerEyebrow: {
    letterSpacing: 1.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  inlineActionButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inlineActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  modalActionButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  modalCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    width: '100%',
  },
  modalOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 11, 16, 0.82)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
  },
  notesBlock: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notesInput: {
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 124,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  refreshButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 20,
    padding: 18,
  },
  statusOptionButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  testToolsButton: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 20,
  },
  testToolsCard: {
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
    overflow: 'hidden',
    padding: 18,
  },
  testToolsContent: {
    flex: 1,
  },
  testToolsDescription: {
    lineHeight: 18,
  },
  testToolsTitle: {
    marginBottom: 8,
    marginTop: 6,
  },
});

export default AdminDashboard;
