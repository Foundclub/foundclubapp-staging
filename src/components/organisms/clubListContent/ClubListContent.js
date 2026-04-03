import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useClub from '@/domains/club/useClub';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import EmptyState from '@/components/atoms/emptyState/EmptyState';
import SearchMapFab from '@/components/atoms/searchMapFab/SearchMapFab';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import ClubSearchResultCard from '@/components/molecules/clubSearchResultCard/ClubSearchResultCard';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';

import { RouteNames } from '@/navigation/routeNames';

import { useGetClubs } from '@/services/club/clubQueries';
import { useSearchClubs, useSearchClubsMap } from '@/services/search/searchQueries';
import { getMatchReasonLabel, mapSearchPayload } from '@/services/search/searchService';

import SearchComponent from '../searchComponent/searchComponent';

function ClubsListSeparator() {
  return <View style={{ height: 12 }} />;
}

const hasFiniteViewportBounds = (viewport) => (
  Number.isFinite(Number(viewport?.north))
  && Number.isFinite(Number(viewport?.south))
  && Number.isFinite(Number(viewport?.east))
  && Number.isFinite(Number(viewport?.west))
);

const buildViewportListQuery = (viewport, filters = {}) => {
  if (!viewport || !hasFiniteViewportBounds(viewport)) {
    return null;
  }

  const q = typeof filters?.name === 'string' ? filters.name.trim() : '';

  return {
    activity: filters?.activity,
    centerLat: viewport.lat,
    centerLon: viewport.lng,
    east: viewport.east,
    includeMultisport: true,
    north: viewport.north,
    pageSize: 30,
    q: q.length >= 2 ? q : undefined,
    south: viewport.south,
    view: 'list',
    west: viewport.west,
    zoom: viewport.zoom,
  };
};

/**
 * Club list element to inject on home page or a dedicate one
 * @param {{ enableMapMode?: boolean }} [props]
 * @returns {import('react').ReactElement} ClubListContent component
 */
function ClubListContent({ enableMapMode = false }) {
  // hooks
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [{ clubFilters, searchMapSessions }, appDispatch] = useAppContext();
  const { getClubFiltersNumber } = useClub();
  const viewportSession = searchMapSessions?.clubs || {};
  const viewportRegion = viewportSession?.executedViewport || null;
  const isViewportListMode = viewportSession?.executedClubMapQuery?.view === 'list'
    && hasFiniteViewportBounds(viewportRegion);
  const viewportListParams = useMemo(
    () => (isViewportListMode ? buildViewportListQuery(viewportRegion, clubFilters || {}) : null),
    [clubFilters, isViewportListMode, viewportRegion],
  );
  const activeSearchText = useMemo(
    () => (typeof clubFilters?.name === 'string' ? clubFilters.name.trim() : ''),
    [clubFilters?.name],
  );
  const isSmartSearchEnabled = !isViewportListMode && activeSearchText.length >= 2;
  const {
    data: clubPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetClubs(Object.assign(clubFilters || {}, {
    pageSize: 30,
  }), {
    enabled: !isViewportListMode && !isSmartSearchEnabled,
  });
  const {
    data: smartClubPages,
    error: smartError,
    fetchNextPage: fetchSmartNextPage,
    hasNextPage: hasSmartNextPage,
    isFetchingNextPage: isFetchingSmartNextPage,
    isLoading: isSmartLoading,
    refetch: refetchSmart,
  } = useSearchClubs({
    activity: clubFilters?.activity,
    lat: clubFilters?.lat,
    lon: clubFilters?.lon,
    pageSize: 30,
    q: activeSearchText,
    radius: clubFilters?.radius,
  }, {
    enabled: !isViewportListMode && isSmartSearchEnabled,
  });
  const {
    data: viewportClubPages,
    error: viewportError,
    fetchNextPage: fetchViewportNextPage,
    hasNextPage: hasViewportNextPage,
    isFetchingNextPage: isFetchingViewportNextPage,
    isLoading: isViewportLoading,
    refetch: refetchViewport,
  } = useSearchClubsMap(viewportListParams || {}, {
    enabled: isViewportListMode && Boolean(viewportListParams),
  });
  const navigation = useNavigation();
  const { t } = useTranslation();

  // variables
  const clubs = useMemo(() => clubPages?.pages
    ?.reduce((/** @type {Club[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    || [], [clubPages]);
  const smartClubs = useMemo(() => smartClubPages?.pages
    ?.reduce((/** @type {Club[]} */ acc, page) => {
      const items = mapSearchPayload(page);
      return acc.concat(items);
    }, [])
    || [], [smartClubPages]);
  const viewportClubs = useMemo(() => viewportClubPages?.pages
    ?.reduce((/** @type {Club[]} */ acc, page) => {
      const items = mapSearchPayload(page);
      return acc.concat(items);
    }, [])
    || [], [viewportClubPages]);
  let displayedClubs = clubs;
  if (isViewportListMode) {
    displayedClubs = viewportClubs;
  } else if (isSmartSearchEnabled) {
    displayedClubs = smartClubs;
  }

  let activeError = error;
  if (isViewportListMode) {
    activeError = viewportError;
  } else if (isSmartSearchEnabled) {
    activeError = smartError;
  }

  let activeIsLoading = isLoading;
  if (isViewportListMode) {
    activeIsLoading = isViewportLoading;
  } else if (isSmartSearchEnabled) {
    activeIsLoading = isSmartLoading;
  }

  let activeIsFetchingNext = isFetchingNextPage;
  if (isViewportListMode) {
    activeIsFetchingNext = isFetchingViewportNextPage;
  } else if (isSmartSearchEnabled) {
    activeIsFetchingNext = isFetchingSmartNextPage;
  }
  let refreshHandler = refetch;
  if (isViewportListMode) {
    refreshHandler = refetchViewport;
  } else if (isSmartSearchEnabled) {
    refreshHandler = refetchSmart;
  }
  const shouldShowMapToggle = enableMapMode && displayedClubs.length > 0;
  const viewportMeta = viewportClubPages?.pages?.[0]?.meta || null;
  const viewportTotalInBounds = Number(viewportMeta?.totalInBounds);
  const viewportDisplayCount = Number.isFinite(viewportTotalInBounds) && viewportTotalInBounds > 0
    ? viewportTotalInBounds
    : displayedClubs.length;
  const isViewportTruncated = Boolean(viewportMeta?.truncated);

  // handlers
  const handleEndReached = useCallback(() => {
    if (isViewportListMode) {
      if (hasViewportNextPage && !isFetchingViewportNextPage) {
        fetchViewportNextPage();
      }
      return;
    }
    if (isSmartSearchEnabled) {
      if (hasSmartNextPage && !isFetchingSmartNextPage) {
        fetchSmartNextPage();
      }
      return;
    }
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [
    fetchNextPage,
    fetchViewportNextPage,
    fetchSmartNextPage,
    hasNextPage,
    hasViewportNextPage,
    hasSmartNextPage,
    isFetchingNextPage,
    isFetchingViewportNextPage,
    isFetchingSmartNextPage,
    isViewportListMode,
    isSmartSearchEnabled,
  ]);

  const handleClubSelection = useCallback((/** @type {string | undefined} */ documentId) => {
    if (documentId) {
      // @ts-expect-error because of react navigation type definitions
      navigation.navigate(RouteNames.ClubStack, {
        params: { clubId: documentId },
        screen: RouteNames.Club,
      });
    }
  }, [navigation]);

  const handleOpenFilters = useCallback(() => {
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.ClubStack, {
      screen: RouteNames.ClubFilters,
    });
  }, [navigation]);

  /**
   * Handles the search field input
   * @param {string} name
   */
  const handleSearchField = (name) => {
    appDispatch({
      payload: Object.assign(clubFilters || {}, { name }),
      type: 'SET_CLUB_FILTERS',
    });
  };

  const handleCreateClub = () => {
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.ClubStack, {
      screen: RouteNames.CreateClub,
    });
  };
  // renderers
  /**
   * Handle multisport club selection - navigates to MultisportClubDetails
   * @param {string | undefined} documentId
   */
  const handleMultisportSelection = useCallback((documentId) => {
    if (documentId) {
      // @ts-expect-error because of react navigation type definitions
      navigation.navigate(RouteNames.MultisportClubDetails, {
        cmId: documentId,
      });
    }
  }, [navigation]);

  const handleExitViewportMode = useCallback(() => {
    appDispatch({
      payload: {
        scope: 'clubs',
        state: {
          executedClubMapQuery: null,
          executedViewport: null,
          lastResultMeta: null,
        },
      },
      type: 'SET_SEARCH_MAP_SESSION_STATE',
    });
  }, [appDispatch]);

  /**
   * Render the club item
   * @param {object} param
   * @param {Club} param.item
   * @returns {import('react').ReactElement}
   */
  const renderItem = ({ item }) => {
    const isMultisport = Reflect.get(item || {}, '_type') === 'multisport';
    const searchMeta = Reflect.get(item || {}, '__search');
    const primaryReasonLabel = getMatchReasonLabel(searchMeta?.matchReasons?.[0]);
    const footer = !isMultisport && item.sponsor?.length > 0 ? (
      <View style={[Alignments.row, Spaces.gap[12], Spaces.marginTop[8], { flexWrap: 'wrap' }]}>
        {item.sponsor.slice(0, 5).map((sponsor, idx) => (
          <SponsorLogoTile
            borderRadius={20}
            height={40}
            imageUrl={sponsor.logo?.url}
            key={sponsor.id || idx}
            link={sponsor.link}
            title={sponsor.title || sponsor.name || 'Sponsor'}
            titleStyle={[
              Fonts.p4Bold,
              Fonts.neutral00,
              { fontSize: 10, textAlign: 'center' },
            ]}
            width={40}
          />
        ))}
      </View>
    ) : null;

    return (
      <ClubSearchResultCard
        footer={footer}
        item={item}
        onPress={() => (isMultisport
          ? handleMultisportSelection(item.documentId)
          : handleClubSelection(item.documentId))}
        reasonLabel={primaryReasonLabel ? `Tri pertinence: ${primaryReasonLabel}` : ''}
      />
    );
  };

  const renderEmptyList = () => (
    <EmptyState
      actionLabel={t('clubList.actions.createClub')}
      onAction={handleCreateClub}
      title={t('clubList.noData')}
    />
  );

  return (
    <View style={[Alignments.fill, Spaces.gap[16]]}>
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
        <View style={{ flex: 1 }}>
          <SearchComponent
            filterNumber={getClubFiltersNumber(clubFilters)}
            handleSearchField={handleSearchField}
            inputDensity="default"
            inputStyle={{ lineHeight: 20, paddingVertical: 2 }}
            openFilters={handleOpenFilters}
            placeholder={t('clubList.search.placeholder', 'Nom du club')}
            searchDefaultValue={clubFilters?.name}
          />
        </View>
      </View>
      {isViewportListMode ? (
        <View
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            ApplicationStyle.shadow200,
            {
              backgroundColor: 'rgba(6, 24, 34, 0.9)',
              borderColor: `${Colors.primary500}26`,
              borderRadius: 18,
              borderWidth: 1,
              paddingHorizontal: 14,
              paddingVertical: 12,
            },
          ]}
        >
          <View style={[Spaces.gap[4], { flex: 1, paddingRight: 12 }]}>
            <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
              {`${viewportDisplayCount}${isViewportTruncated ? '+' : ''} clubs dans la zone visible`}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral200]}>
              {isViewportTruncated
                ? 'Zoomez sur la carte pour charger tout le catalogue local.'
                : 'La liste suit la zone actuellement choisie sur la carte.'}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleExitViewportMode}
            style={[
              ApplicationStyle.borderRadius16,
              {
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.12)',
                borderWidth: 1,
                justifyContent: 'center',
                minHeight: 40,
                paddingHorizontal: 12,
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
              Quitter
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <WithDataWrapper
        error={activeError?.message}
        isLoading={activeIsLoading && !activeIsFetchingNext}
        wrapperStyle={[Alignments.fill]}
      >
        <FlashList
          contentContainerStyle={[
            Spaces.paddingBottom[96],
            displayedClubs.length === 0 ? Alignments.fill : null,
          ]}
          data={displayedClubs}
          estimatedItemSize={112}
          ItemSeparatorComponent={ClubsListSeparator}
          keyExtractor={(item, index) => item?.documentId || `unknown-${item?.name || ''}-${index}`}
          ListEmptyComponent={renderEmptyList}
          ListHeaderComponent={isSmartSearchEnabled ? (
            <Text style={[Fonts.p3, Fonts.primary500, Spaces.marginBottom[12]]}>
              Trie par pertinence
            </Text>
          ) : null}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          onRefresh={refreshHandler}
          refreshing={activeIsLoading && !activeIsFetchingNext}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      </WithDataWrapper>
      {shouldShowMapToggle ? (
        <SearchMapFab
          mode="list"
          onPress={() => navigation.navigate(RouteNames.SearchMapScreen, { scope: 'clubs' })}
          scope="clubs"
        />
      ) : null}
    </View>
  );
}

export default ClubListContent;
