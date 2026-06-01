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
  useGenerateTestTournament,
  useGetAdminStats,
  useGetDetectionVerificationQueue,
  useGetLeagueDisputes,
  useGetNonPartnerCoachAffiliations,
  useGetPendingClubClaims,
  useGetPendingClubOnboardingRequests,
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
  const generateTestTournamentMutation = useGenerateTestTournament();
  const updateDetectionVerificationMutation = useUpdateDetectionVerification();
  const updateNonPartnerCoachGovernanceMutation = useUpdateNonPartnerCoachGovernance();
  const updateNonPartnerCoachAffiliationMutation = useUpdateNonPartnerCoachAffiliation();

  const [reviewItem, setReviewItem] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewStatus, setReviewStatus] = useState('pending');

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
    }, [
      refetchClaims,
      refetchClubOnboarding,
      refetchDetectionQueue,
      refetchFeatured,
      refetchGovernanceAffiliations,
      refetchLeagueDisputes,
      refetchPopupCampaigns,
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

  const getPartnerStatusMeta = useCallback((isCustomer) => (
    isCustomer === true
      ? {
        backgroundColor: `${Colors.success500}18`,
        borderColor: `${Colors.success500}44`,
        label: 'Verifie',
        textColor: Colors.success500,
      }
      : {
        backgroundColor: `${Colors.neutral300}18`,
        borderColor: `${Colors.neutral300}44`,
        label: 'Non certifiee',
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
    const partnerStatusMeta = getPartnerStatusMeta(item?.club?.isCustomer === true);

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
    const partnerStatusMeta = getPartnerStatusMeta(item?.club?.isCustomer === true);

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
