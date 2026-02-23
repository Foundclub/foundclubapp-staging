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

import { navigateToRequestsHub } from '@/domains/requests/requestNavigation';
import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import { useGetCMClubs, useGetCMHighlightRequests } from '@/services/multisportClub/multisportClubQueries';

/**
 * @typedef {object} ClubSectionItem
 * @property {string} [documentId]
 * @property {string} [name]
 * @property {string} [sport]
 * @property {string} [city]
 * @property {string} [logoUrl]
 * @property {{ teams?: number; members?: number }} [stats]
 */

/**
 * Club Section Card Component
 * @param {{
 *  club: ClubSectionItem;
 *  onPress: () => void;
 *  Colors: any;
 *  Fonts: any;
 * }} props
 */
function ClubSectionCard({
  club, Colors, Fonts, onPress,
}) {
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
          <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
            {club.name}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p2, Fonts.neutral300]}>
            {club.sport || 'Sport'}
            {' '}
            •
            {club.city || 'Ville'}
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
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any> }} props
 */
function MyClubsScreen({ navigation }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();

  // Get current user
  const { data: userData } = useGetMe();

  // Get the first multisport club the user manages
  const cmId = userData?.multisportClubs?.[0]?.documentId;
  const cmName = userData?.multisportClubs?.[0]?.name || 'Club Multisport';

  // Fetch clubs and highlight requests
  const {
    data: clubsData,
    isLoading: isLoadingClubs,
    isRefetching,
    refetch: refetchClubs,
  } = useGetCMClubs(cmId || '');

  const { data: requestsData } = useGetCMHighlightRequests(cmId || '');
  const typedRequestsData = /** @type {{ data?: any[] } | undefined} */ (requestsData);
  const typedClubsData = /** @type {{ data?: ClubSectionItem[] } | undefined} */ (clubsData);
  const pendingRequestsCount = typedRequestsData?.data?.length || 0;

  // Filter state
  const [sportFilter, setSportFilter] = useState(/** @type {string | null} */ (null));

  // Filtered clubs
  const clubs = useMemo(() => {
    const allClubs = typedClubsData?.data || [];
    if (!sportFilter) return allClubs;
    return allClubs.filter((/** @type {ClubSectionItem} */ club) => club.sport === sportFilter);
  }, [typedClubsData, sportFilter]);

  // Available sports for filter
  const sports = useMemo(() => {
    const allClubs = typedClubsData?.data || [];
    const sportSet = new Set(allClubs.map((/** @type {ClubSectionItem} */ c) => c.sport).filter(Boolean));
    return Array.from(sportSet);
  }, [typedClubsData]);

  // Navigation handlers
  const handleClubPress = useCallback((/** @type {ClubSectionItem} */ club) => {
    navigation.navigate(RouteNames.Club, {
      clubId: club.documentId,
    });
  }, [navigation]);

  const handleInboxPress = useCallback(() => {
    navigateToRequestsHub(navigation, {
      initialFilter: 'featured',
      source: 'cm_dashboard',
    });
  }, [navigation, cmId]);

  const handleAddSection = useCallback(() => {
    navigation.navigate(RouteNames.CreateSection, { cmId: cmId || '' });
  }, [navigation, cmId]);

  const handlePlanningPress = useCallback(() => {
    navigation.navigate(RouteNames.CMPlanning, { cmId: cmId || '' });
  }, [navigation, cmId]);

  // Render club card
  const renderClubCard = useCallback((/** @type {{ item: ClubSectionItem }} */ { item }) => (
    <ClubSectionCard
      club={item}
      Colors={Colors}
      Fonts={Fonts}
      onPress={() => handleClubPress(item)}
    />
  ), [handleClubPress, Colors, Fonts]);

  // Loading state
  if (isLoadingClubs && !clubsData) {
    return (
      <ScreenContainer bgImage="bg2">
        <View style={[Alignments.fill, Alignments.center]}>
          <ActivityIndicator color={Colors.primary500} size="large" />
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
            {clubs.length}
            {' '}
            section
            {clubs.length > 1 ? 's' : ''}
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
                key={String(sport)}
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
          contentContainerStyle={[Spaces.padding[16], Spaces.gap[12]]}
          data={clubs}
          keyExtractor={(item) => item.documentId || item.name || Math.random().toString()}
          ListEmptyComponent={(
            <View style={[Alignments.center, Spaces.paddingVertical[40]]}>
              <Text style={[Fonts.p1, Fonts.neutral400]}>
                Aucune section trouvée
              </Text>
            </View>
          )}
          refreshControl={(
            <RefreshControl
              onRefresh={refetchClubs}
              refreshing={isRefetching}
              tintColor={Colors.primary500}
            />
          )}
          renderItem={renderClubCard}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actionBtn: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionIcon: {
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
  },
  badge: {
    alignItems: 'center',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    marginLeft: 4,
    minWidth: 18,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  filterChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
  },
  header: {
    gap: 4,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  logo: {
    height: 48,
    width: 48,
  },
  logoContainer: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 48,
  },
  logoPlaceholder: {
    fontSize: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
});

export default MyClubsScreen;
