import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';
import { RouteNames } from '@/navigation/routeNames';
import ScreenContainer from '@/components/templates/ScreenContainer';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';

import { useGetEvents } from '@/services/event/eventQueries';
import { useGetAdminStats } from '@/services/admin/adminQueries';
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
        isLoading: isFeaturedLoading,
        refetch: refetchFeatured,
    } = useGetEvents({
        featuredRequestStatus: 'pending',
        pageSize: 1, // We only need the count
    });

    const {
        data: stats,
        isLoading: isStatsLoading,
        refetch: refetchStats,
    } = useGetAdminStats();

    const featuredCount = featuredRequestsData?.pages?.[0]?.meta?.pagination?.total || 0;
    const eventsTodayCount = stats?.eventsToday || 0;
    const caGenerated = stats?.revenue || 0;
    const reportsCount = stats?.reportsCount || 0;

    useFocusEffect(
        useCallback(() => {
            refetchFeatured();
            refetchStats();
        }, [refetchFeatured, refetchStats])
    );

    const DashboardCard = ({ title, value, onPress, color = Colors.primary500 }) => (
        <TouchableOpacity
            onPress={onPress}
            disabled={!onPress}
            style={[
                ApplicationStyle.backgroundColor.neutral800,
                ApplicationStyle.borderRadius16,
                Spaces.padding[24],
                { width: '48%', marginBottom: 16 }
            ]}
        >
            <Text style={[Fonts.h2, { color, marginBottom: 8 }]}>{value}</Text>
            <Text style={[Fonts.p2, Fonts.neutral00]}>{title}</Text>
        </TouchableOpacity>
    );

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
                        title="CA Généré"
                        value={`${caGenerated}€`}
                        color={Colors.success500}
                        onPress={() => navigation.navigate(RouteNames.AdminRevenue)}
                    />

                    {/* Événements du jour */}
                    <DashboardCard
                        title="Events du jour"
                        value={eventsTodayCount}
                        color={Colors.primary500}
                        onPress={() => navigation.navigate(RouteNames.AdminEvents)}
                    />

                    {/* Signalements */}
                    <DashboardCard
                        title="Signalements"
                        value={reportsCount}
                        color={Colors.error500}
                        onPress={() => navigation.navigate(RouteNames.AdminReports)}
                    />

                    {/* Demandes à la une */}
                    <DashboardCard
                        title="Demandes à la une"
                        value={featuredCount}
                        color={Colors.primary200}
                        onPress={() => navigation.navigate(RouteNames.FeaturedRequestsList)}
                    />

                </View>
            </ScrollView>
        </ScreenContainer>
    );
}

export default AdminDashboard;
