import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetAdminStats, useGetLeagueDisputes, useGetPendingClubClaims } from '@/services/admin/adminQueries';
import { useGetEvents } from '@/services/event/eventQueries';
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
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const navigation = useNavigation();

  // 1. Featured Requests Count
  const {
    data: featuredRequestsData,
    refetch: refetchFeatured,
  } = useGetEvents({
    featuredRequestStatus: 'pending',
    pageSize: 1, // We only need the count
  });

  const {
    data: stats,
    refetch: refetchStats,
  } = useGetAdminStats();

  const featuredCount = featuredRequestsData?.pages?.[0]?.meta?.pagination?.total || 0;
  const eventsTodayCount = stats?.eventsToday || 0;
  const caGenerated = stats?.revenue || 0;
  const reportsCount = stats?.reportsCount || 0;

  const {
    data: claimsData,
    refetch: refetchClaims,
  } = useGetPendingClubClaims();

  const claimsCount = claimsData?.meta?.pagination?.total || 0;
  const disputeCountParams = useMemo(() => ({
    pagination: { page: 1, pageSize: 1 },
  }), []);

  const {
    data: leagueDisputesData,
    refetch: refetchLeagueDisputes,
  } = useGetLeagueDisputes(disputeCountParams);

  const leagueDisputesCount = leagueDisputesData?.meta?.pagination?.total || 0;

  useFocusEffect(
    useCallback(() => {
      refetchFeatured();
      refetchStats();
      refetchClaims();
      refetchLeagueDisputes();
    }, [refetchFeatured, refetchStats, refetchClaims, refetchLeagueDisputes]),
  );

  /**
   *
   * @param root0
   * @param root0.color
   * @param root0.onPress
   * @param root0.title
   * @param root0.value
   */
  // eslint-disable-next-line react/no-unstable-nested-components
  function DashboardCard({
    color = Colors.primary500, onPress, title, value,
  }) {
    return (
      <TouchableOpacity
        disabled={!onPress}
        onPress={onPress}
        style={[
          ApplicationStyle.backgroundColor.neutral800,
          ApplicationStyle.borderRadius16,
          Spaces.padding[24],
          { marginBottom: 16, width: '48%' },
        ]}
      >
        <Text style={[Fonts.h2, { color, marginBottom: 8 }]}>{value}</Text>
        <Text style={[Fonts.p2, Fonts.neutral00]}>{title}</Text>
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
      <View style={[Spaces.marginBottom[32], Spaces.paddingHorizontal[24]]}>
        <Text style={[Fonts.h1, Fonts.neutral00]}>Dashboard Admin</Text>
      </View>

      <ScrollView contentContainerStyle={[Spaces.paddingHorizontal[24]]}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>

          {/* CA Généré */}
          <DashboardCard
            color={Colors.success500}
            onPress={() => navigation.navigate(RouteNames.AdminRevenue)}
            title="CA Généré"
            value={`${caGenerated}€`}
          />

          {/* Événements du jour */}
          <DashboardCard
            color={Colors.primary500}
            onPress={() => navigation.navigate(RouteNames.AdminEvents)}
            title="Events du jour"
            value={eventsTodayCount}
          />

          {/* Signalements */}
          <DashboardCard
            color={Colors.error500}
            onPress={() => navigation.navigate(RouteNames.AdminReports)}
            title="Signalements"
            value={reportsCount}
          />

          {/* Demandes à la une */}
          <DashboardCard
            color={Colors.primary200}
            onPress={() => navigation.navigate(RouteNames.FeaturedRequestsList)}
            title="Demandes à la une"
            value={featuredCount}
          />

          {/* Revendications Cards */}
          <DashboardCard
            color={Colors.warning500 || '#f59e0b'} // Orange for pending
            onPress={() => navigation.navigate(RouteNames.AdminClaimList)}
            title="Revendications"
            value={claimsCount}
          />

          <DashboardCard
            color={Colors.error500}
            onPress={() => navigation.navigate(RouteNames.AdminLeagueDisputes)}
            title="Litiges League"
            value={leagueDisputesCount}
          />

          {/* Gestion Utilisateurs */}
          <DashboardCard
            color={Colors.neutral100}
            onPress={() => navigation.navigate(RouteNames.AdminUserList)}
            title="Utilisateurs"
            value="👤"
          />

          {/* Gestion Clubs */}
          <DashboardCard
            color={Colors.neutral100}
            onPress={() => navigation.navigate(RouteNames.AdminClubList)}
            title="Clubs"
            value="🏟️"
          />

          <DashboardCard
            color={Colors.primary500}
            onPress={() => navigation.navigate(RouteNames.SuperAdminContentExplorer)}
            title="Explorer CM"
            value="CM"
          />

        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default AdminDashboard;
