/**
 * MyClubsScreen - Main screen for Dirigeant Omnisport
 * Displays all club sections (CS) of a MultisportClub (CM)
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { RouteNames } from '@/navigation/routeNames';
import { useGetMe } from '@/services/auth/authQueries';
import { useGetCMClubs, useGetCMHighlightRequests } from '@/services/multisportClub/multisportClubQueries';

/**
 * Club Section Card Component
 */
function ClubSectionCard({ club, onPress, Colors, Fonts, Spaces }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
    >
      <View style={styles.cardContent}>
        {/* Logo */}
        <View style={[styles.logoContainer, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
          {club.logoUrl ? (
            <Image source={{ uri: club.logoUrl }} style={styles.logo} />
          ) : (
            <Text style={styles.logoPlaceholder}>🏟️</Text>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]} numberOfLines={1}>
            {club.name}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral300]} numberOfLines={1}>
            {club.sport || 'Sport'} • {club.city || 'Ville'}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={[Fonts.h3, { color: Colors.primary500 }]}>
              {club.stats?.teams || 0}
            </Text>
            <Text style={[Fonts.caption, Fonts.neutral400]}>Équipes</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[Fonts.h3, { color: Colors.success500 }]}>
              {club.stats?.members || 0}
            </Text>
            <Text style={[Fonts.caption, Fonts.neutral400]}>Membres</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * MyClubsScreen Component
 */
function MyClubsScreen({ navigation }) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces, Alignments, ApplicationStyle } = useTheme();

  // Get current user
  const { data: userData } = useGetMe();
  
  // Get the first multisport club the user manages
  const cmId = userData?.multisportClubs?.[0]?.documentId;
  const cmName = userData?.multisportClubs?.[0]?.name || 'Club Multisport';

  // Fetch clubs and highlight requests
  const { 
    data: clubsData, 
    isLoading: isLoadingClubs,
    refetch: refetchClubs,
    isRefetching,
  } = useGetCMClubs(cmId);

  const { data: requestsData } = useGetCMHighlightRequests(cmId);
  const pendingRequestsCount = requestsData?.data?.length || 0;

  // Filter state
  const [sportFilter, setSportFilter] = useState(null);

  // Filtered clubs
  const clubs = useMemo(() => {
    const allClubs = clubsData?.data || [];
    if (!sportFilter) return allClubs;
    return allClubs.filter((club) => club.sport === sportFilter);
  }, [clubsData, sportFilter]);

  // Available sports for filter
  const sports = useMemo(() => {
    const allClubs = clubsData?.data || [];
    const sportSet = new Set(allClubs.map((c) => c.sport).filter(Boolean));
    return Array.from(sportSet);
  }, [clubsData]);

  // Navigation handlers
  const handleClubPress = useCallback((club) => {
    navigation.navigate(RouteNames.Club, { 
      clubId: club.documentId,
    });
  }, [navigation]);

  const handleInboxPress = useCallback(() => {
    navigation.navigate(RouteNames.HighlightRequestsInbox, { cmId });
  }, [navigation, cmId]);

  const handleAddSection = useCallback(() => {
    navigation.navigate(RouteNames.CreateSection, { cmId });
  }, [navigation, cmId]);

  const handlePlanningPress = useCallback(() => {
    navigation.navigate(RouteNames.CMPlanning, { cmId });
  }, [navigation, cmId]);

  // Render club card
  const renderClubCard = useCallback(({ item }) => (
    <ClubSectionCard
      club={item}
      onPress={() => handleClubPress(item)}
      Colors={Colors}
      Fonts={Fonts}
      Spaces={Spaces}
    />
  ), [handleClubPress, Colors, Fonts, Spaces]);

  // Loading state
  if (isLoadingClubs && !clubsData) {
    return (
      <ScreenContainer bgImage="bg2">
        <View style={[Alignments.fill, Alignments.center]}>
          <ActivityIndicator size="large" color={Colors.primary500} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bgImage="bg2">
      <View style={[Alignments.fill]}>
        {/* Header */}
        <View style={[styles.header, Spaces.paddingHorizontal[16], Spaces.paddingVertical[16]]}>
          <Text style={[Fonts.h2, Fonts.neutral00]}>
            {cmName}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral300]}>
            {clubs.length} section{clubs.length > 1 ? 's' : ''}
          </Text>
        </View>

        {/* Actions */}
        <View style={[styles.actions, Spaces.paddingHorizontal[16], Spaces.gap[8]]}>
          <Pressable
            onPress={handleInboxPress}
            style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
          >
            <Text style={styles.actionIcon}>📥</Text>
            <Text style={[Fonts.p2, Fonts.neutral00]}>Inbox</Text>
            {pendingRequestsCount > 0 && (
              <View style={[styles.badge, { backgroundColor: Colors.primary500 }]}>
                <Text style={styles.badgeText}>{pendingRequestsCount}</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={handlePlanningPress}
            style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
          >
            <Text style={styles.actionIcon}>📅</Text>
            <Text style={[Fonts.p2, Fonts.neutral00]}>Planning</Text>
          </Pressable>

          <Pressable
            onPress={handleAddSection}
            style={[styles.actionBtn, { backgroundColor: Colors.primary500 }]}
          >
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={[Fonts.p2, Fonts.neutral00]}>Section</Text>
          </Pressable>
        </View>

        {/* Sport Filters */}
        {sports.length > 1 && (
          <View style={[styles.filters, Spaces.paddingHorizontal[16], Spaces.marginTop[12]]}>
            <Pressable
              onPress={() => setSportFilter(null)}
              style={[
                styles.filterChip,
                !sportFilter && { backgroundColor: Colors.primary500 },
              ]}
            >
              <Text style={[Fonts.caption, Fonts.neutral00]}>Tous</Text>
            </Pressable>
            {sports.map((sport) => (
              <Pressable
                key={sport}
                onPress={() => setSportFilter(sport)}
                style={[
                  styles.filterChip,
                  sportFilter === sport && { backgroundColor: Colors.primary500 },
                ]}
              >
                <Text style={[Fonts.caption, Fonts.neutral00]}>{sport}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Club List */}
        <FlatList
          data={clubs}
          renderItem={renderClubCard}
          keyExtractor={(item) => item.documentId}
          contentContainerStyle={[Spaces.padding[16], Spaces.gap[12]]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetchClubs}
              tintColor={Colors.primary500}
            />
          }
          ListEmptyComponent={
            <View style={[Alignments.center, Spaces.paddingVertical[40]]}>
              <Text style={[Fonts.p1, Fonts.neutral400]}>
                Aucune section trouvée
              </Text>
            </View>
          }
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
  },
  actions: {
    flexDirection: 'row',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  actionIcon: {
    fontSize: 16,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 48,
    height: 48,
  },
  logoPlaceholder: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
});

export default MyClubsScreen;
