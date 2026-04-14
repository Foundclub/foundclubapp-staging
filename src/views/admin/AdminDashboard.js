import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';
import AdminStateView from '@/views/admin/components/AdminStateView';

import { RouteNames } from '@/navigation/routeNames';

import {
  useGetAdminStats,
  useGetLeagueDisputes,
  useGetPendingClubClaims,
  useGetPendingClubOnboardingRequests,
} from '@/services/admin/adminQueries';
import { getPendingFeaturedRequests } from '@/services/event/eventService';
import { useGetInAppPopupCampaigns } from '@/services/inAppPopupCampaign/inAppPopupCampaignQueries';
// We might need a useGetClubs hook. I'll assume it exists or I can use a generic fetch.
// Checking imports in other files... useClub hook exists but it's for the user's club.
// I'll check if there is a query for all clubs.

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

  // 1. Featured Requests Count
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

  const featuredCount = Array.isArray(featuredRequestsData?.data)
    ? featuredRequestsData.data.length
    : 0;
  const eventsTodayCount = stats?.eventsToday || 0;
  const caGenerated = stats?.revenue || 0;
  const reportsCount = stats?.reportsCount || 0;

  const {
    data: claimsData,
    error: claimsError,
    isLoading: isClaimsLoading,
    refetch: refetchClaims,
  } = useGetPendingClubClaims();

  const claimsCount = claimsData?.meta?.pagination?.total || 0;
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
  const clubOnboardingCount = clubOnboardingData?.meta?.pagination?.total || 0;
  const disputeCountParams = useMemo(() => ({
    pagination: { page: 1, pageSize: 1 },
  }), []);

  const {
    data: leagueDisputesData,
    error: leagueDisputesError,
    isLoading: isLeagueDisputesLoading,
    refetch: refetchLeagueDisputes,
  } = useGetLeagueDisputes(disputeCountParams);

  const leagueDisputesCount = leagueDisputesData?.meta?.pagination?.total || 0;
  const {
    data: popupCampaignsData,
    error: popupCampaignsError,
    isLoading: isPopupCampaignsLoading,
    refetch: refetchPopupCampaigns,
  } = useGetInAppPopupCampaigns({
    page: 1,
    pageSize: 1,
  });
  const popupCampaignCount = popupCampaignsData?.meta?.total || 0;
  const secondaryDashboardErrors = [
    featuredRequestsError,
    claimsError,
    clubOnboardingError,
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
      refetchClaims();
      refetchClubOnboarding();
      refetchLeagueDisputes();
      refetchPopupCampaigns();
    }, [
      refetchClaims,
      refetchClubOnboarding,
      refetchFeatured,
      refetchLeagueDisputes,
      refetchPopupCampaigns,
      refetchStats,
    ]),
  );

  const dashboardError = statsError;
  const isBootstrapping = (
    isFeaturedRequestsLoading
    || isStatsLoading
    || isClaimsLoading
    || isClubOnboardingLoading
    || isLeagueDisputesLoading
    || isPopupCampaignsLoading
  );

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
        actionLabel="R\u00E9essayer"
        description={dashboardError?.message || 'Impossible de charger les indicateurs admin.'}
        onAction={() => {
          refetchFeatured();
          refetchStats();
          refetchClaims();
          refetchClubOnboarding();
          refetchLeagueDisputes();
          refetchPopupCampaigns();
        }}
        title="Chargement impossible"
      />
    );
  }

  /**
   * Render an admin dashboard shortcut card.
   * @param {object} root0 - Dashboard card props.
   * @param {string} [root0.color] - Accent color.
   * @param {string} [root0.meta] - Small contextual chip.
   * @param {() => void} [root0.onPress] - Navigation action.
   * @param {string} root0.title - Card title.
   * @param {string | number} root0.value - Main metric value.
   * @returns {import('react').ReactElement} Dashboard card.
   */
  // eslint-disable-next-line react/no-unstable-nested-components
  function DashboardCard({
    color = Colors.primary500, meta, onPress, title, value,
  }) {
    return (
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
  }

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
          Pilote les demandes, les alertes et les contenus sensibles depuis un seul espace.
        </Text>
        {partialDashboardDescription ? (
          <Text style={[Fonts.p2, Fonts.neutral300, Spaces.marginTop[8]]}>
            {partialDashboardDescription}
          </Text>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={[Spaces.paddingHorizontal[24], Spaces.paddingBottom[32]]}>
        <View style={styles.dashboardGrid}>

          {/* CA Généré */}
          <DashboardCard
            color={Colors.success500}
            meta="Finance"
            onPress={() => navigation.navigate(RouteNames.AdminRevenue)}
            title="CA généré"
            value={`${caGenerated} €`}
          />

          {/* Événements du jour */}
          <DashboardCard
            color={Colors.primary500}
            meta="Live"
            onPress={() => navigation.navigate(RouteNames.AdminEvents)}
            title="Événements du jour"
            value={eventsTodayCount}
          />

          {/* Signalements */}
          <DashboardCard
            color={Colors.error500}
            meta="Alerte"
            onPress={() => navigation.navigate(RouteNames.AdminReports)}
            title="Signalements"
            value={reportsCount}
          />

          {/* Demandes à la une */}
          <DashboardCard
            color={Colors.primary200}
            meta="À traiter"
            onPress={() => navigation.navigate(RouteNames.FeaturedRequestsList)}
            title="Demandes à la une"
            value={featuredCount}
          />

          {/* Revendications Cards */}
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
            title="Clubs à onboarder"
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

          {/* Gestion Utilisateurs */}
          <DashboardCard
            color={Colors.primary200}
            meta="Gestion"
            onPress={() => navigation.navigate(RouteNames.AdminUserList)}
            title="Utilisateurs"
            value="👤"
          />

          {/* Gestion Clubs */}
          <DashboardCard
            color={Colors.primary500}
            meta="Gestion"
            onPress={() => navigation.navigate(RouteNames.AdminClubList)}
            title="Clubs"
            value="🏟️"
          />

          <DashboardCard
            color={Colors.primary500}
            meta="Contenus"
            onPress={() => navigation.navigate(RouteNames.SuperAdminContentExplorer)}
            title="Explorer CM"
            value="CM"
          />

        </View>
      </ScrollView>
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
  headerDescription: {
    marginTop: 8,
    maxWidth: 330,
  },
  headerEyebrow: {
    letterSpacing: 1.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
});

export default AdminDashboard;
