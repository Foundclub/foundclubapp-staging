import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getAppliedFilterCount } from '@/domains/search/recruitmentFlow';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Loader from '@/components/atoms/loader/Loader';
import MercatoCard from '@/components/molecules/mercatoCard/MercatoCard';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';

import { RouteNames } from '@/navigation/routeNames';

import { useSearchProfiles } from '@/services/search/searchQueries';
import { mapSearchPayload } from '@/services/search/searchService';

/**
 * @param {{
 *  bottomPadding?: number;
 *  onUserPress?: (user: any) => void;
 *  refreshSignal?: number;
 *  screenActive?: boolean;
 * }} props
 * @returns {import('react').ReactElement}
 */
function RecruitmentProfilesList({
  bottomPadding = 140,
  onUserPress,
  refreshSignal = 0,
  screenActive = true,
}) {
  const navigation = useNavigation();
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const [{ mercatoFilters }, appDispatch] = useAppContext();
  const [searchValue, setSearchValue] = useState(String(mercatoFilters?.q || ''));
  const recruitmentSurface = `${Colors.primary900}F0`;
  const recruitmentSurfaceStrong = `${Colors.primary700}70`;
  const recruitmentSurfaceSoft = `${Colors.primary500}14`;
  const recruitmentBorder = `${Colors.primary500}45`;
  const recruitmentBorderSoft = `${Colors.primary500}26`;
  const recruitmentMutedText = `${Colors.neutral100}C4`;

  useEffect(() => {
    setSearchValue(String(mercatoFilters?.q || ''));
  }, [mercatoFilters?.q]);

  const filtersCount = useMemo(
    () => getAppliedFilterCount(mercatoFilters, ['alertDocumentId', 'isActive', 'label', 'q', 'type']),
    [mercatoFilters],
  );

  const profileSearchParams = useMemo(() => {
    const trimmedSearch = String(searchValue || '').trim();
    return {
      activity: mercatoFilters?.activityNames || mercatoFilters?.activity,
      category: mercatoFilters?.sectionIds || mercatoFilters?.category,
      geohash: mercatoFilters?.geohash,
      position: mercatoFilters?.positions || mercatoFilters?.position,
      ...(trimmedSearch.length >= 2 ? { q: trimmedSearch, sort: 'relevance' } : { sort: 'date' }),
    };
  }, [
    mercatoFilters?.activity,
    mercatoFilters?.activityNames,
    mercatoFilters?.category,
    mercatoFilters?.geohash,
    mercatoFilters?.position,
    mercatoFilters?.positions,
    mercatoFilters?.sectionIds,
    searchValue,
  ]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isRefetching,
    refetch,
  } = useSearchProfiles(profileSearchParams, {
    enabled: screenActive,
  });

  useEffect(() => {
    if (!screenActive || !refreshSignal) return;
    refetch();
  }, [refetch, refreshSignal, screenActive]);

  const users = useMemo(
    () => (data?.pages || []).flatMap((page) => mapSearchPayload(page)),
    [data?.pages],
  );
  const totalProfiles = data?.pages?.[0]?.meta?.pagination?.total || users.length;
  const trimmedSearch = String(searchValue || '').trim();
  const hasSearchTerm = trimmedSearch.length >= 2;
  const hasActiveFilters = filtersCount > 0;
  let profilesCountLabel = '1 profil';
  if (totalProfiles === 0) {
    profilesCountLabel = 'Aucun profil';
  } else if (totalProfiles > 1) {
    profilesCountLabel = `${String(totalProfiles)} profils`;
  }
  let headerDescription = 'Retrouve ici les joueurs et joueuses ouverts a un club pour construire ton recrutement.';
  if (hasSearchTerm) {
    headerDescription = `Recherche en cours pour "${trimmedSearch}". Les profils les plus pertinents remontent en premier.`;
  } else if (hasActiveFilters) {
    headerDescription = 'Les filtres ci-dessous ciblent uniquement les profils ouverts à ton recrutement.';
  }
  const summaryPills = [
    profilesCountLabel,
    hasSearchTerm ? 'Recherche active' : 'Feed complet',
    hasActiveFilters ? `${String(filtersCount)} filtre(s)` : 'Sans filtre',
  ];

  const handleClearFilters = () => {
    appDispatch({
      payload: {},
      type: 'SET_MERCATO_FILTERS',
    });
  };

  const handleCardPress = (user) => {
    if (onUserPress) {
      onUserPress(user);
      return;
    }

    navigation.navigate(RouteNames.ProfileStack, {
      params: { userId: user.documentId || user.id },
      screen: RouteNames.UserDetails,
    });
  };

  const renderHeader = () => (
    <View style={[Spaces.gap[12], Spaces.marginBottom[4]]}>
      <View style={{
        backgroundColor: recruitmentSurface,
        borderColor: recruitmentBorder,
        borderRadius: 18,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 16,
      }}
      >
        <View style={{
          alignItems: 'flex-start',
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[Fonts.h4, Fonts.neutral100]}>
              Profils ouverts au recrutement
            </Text>
            <Text style={[Fonts.p2, { color: recruitmentMutedText, marginTop: 6 }]}>
              {headerDescription}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate(RouteNames.SearchAlerts)}
            style={{
              backgroundColor: recruitmentSurfaceSoft,
              borderColor: recruitmentBorder,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
              Alertes profils
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap', marginTop: 14 }]}>
          {summaryPills.map((pill) => (
            <View
              key={pill}
              style={{
                backgroundColor: recruitmentSurfaceStrong,
                borderColor: recruitmentBorderSoft,
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.neutral100 }]}>
                {pill}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View>
        <Text style={[Fonts.p3, { color: recruitmentMutedText, marginBottom: 8 }]}>
          Recherche et filtres profils
        </Text>
        <SearchComponent
          filterNumber={filtersCount}
          handleSearchField={setSearchValue}
          openFilters={() => navigation.navigate(RouteNames.MercatoFilters)}
          placeholder="Rechercher un profil..."
          searchDefaultValue={searchValue}
        />
      </View>

      {hasActiveFilters ? (
        <TouchableOpacity
          onPress={handleClearFilters}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: recruitmentSurfaceSoft,
            borderColor: recruitmentBorderSoft,
            borderRadius: 999,
            borderWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
            Effacer les filtres profils
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderEmptyState = () => (
    <View
      style={[Spaces.padding[24], {
        alignItems: 'center',
        backgroundColor: recruitmentSurface,
        borderColor: recruitmentBorderSoft,
        borderRadius: 18,
        borderWidth: 1,
      }]}
    >
      <Text style={[Fonts.p1, Fonts.neutral100, { textAlign: 'center' }]}>
        Aucun profil visible pour cette recherche.
      </Text>
      <Text style={[Fonts.p2, { color: recruitmentMutedText, marginTop: 8, textAlign: 'center' }]}>
        {hasSearchTerm || hasActiveFilters
          ? 'Essaie d\'elargir les filtres ou de simplifier la recherche.'
          : 'Les profils ouverts a un club apparaîtront ici des qu\'ils seront disponibles.'}
      </Text>
      {hasSearchTerm || hasActiveFilters ? (
        <TouchableOpacity
          onPress={() => {
            setSearchValue('');
            handleClearFilters();
          }}
          style={{
            backgroundColor: recruitmentSurfaceSoft,
            borderColor: recruitmentBorder,
            borderRadius: 999,
            borderWidth: 1,
            marginTop: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
            Revenir au flux complet
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {isLoading ? (
        <Loader />
      ) : (
        <FlatList
          contentContainerStyle={[Spaces.gap[16], { flexGrow: 1, paddingBottom: bottomPadding }]}
          data={users}
          keyExtractor={(item) => String(item.documentId || item.id || Math.random())}
          ListEmptyComponent={renderEmptyState()}
          ListFooterComponent={isFetchingNextPage ? (
            <View style={[Spaces.paddingVertical[16], { alignItems: 'center' }]}>
              <ActivityIndicator color={Colors.primary500} />
            </View>
          ) : null}
          ListHeaderComponent={renderHeader()}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.35}
          refreshControl={(
            <RefreshControl
              onRefresh={refetch}
              refreshing={isRefetching && !isFetchingNextPage}
            />
          )}
          renderItem={({ item }) => (
            <MercatoCard onPress={handleCardPress} user={item} />
          )}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        />
      )}
    </View>
  );
}

export default RecruitmentProfilesList;
