import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  InteractionManager,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useClub from '@/domains/club/useClub';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import EmptyState from '@/components/atoms/emptyState/EmptyState';
import Loader from '@/components/atoms/loader/Loader';
import SearchMapFab from '@/components/atoms/searchMapFab/SearchMapFab';
import ClubCard from '@/components/molecules/clubCard/ClubCard';
import SearchResultsLoadingState from '@/components/molecules/searchResultsLoadingState/SearchResultsLoadingState';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';

import { navigateToStackScreenOrScreen } from '@/navigation/navigationAvailability';
import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { useGetClubs, useGetMultisportClubs } from '@/services/club/clubQueries';
import { keepPreviousPageData } from '@/services/queryOptions';
import { useSearchClubs, useSearchClubsMap } from '@/services/search/searchQueries';
import { getMatchReasonLabel, mapSearchPayload } from '@/services/search/searchService';

import { markSearchPerf } from '@/utils/performance/searchPerformance';

import ClubFiltersSheet from '../filtersSheet/ClubFiltersSheet';
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

const mergeClubCollections = (...collections) => {
  const byKey = new Map();

  collections.flat().forEach((item) => {
    const type = Reflect.get(item || {}, '_type') === 'multisport' ? 'multisport' : 'club';
    const id = String(item?.documentId || item?.id || '').trim();
    if (!id) return;
    const key = `${type}:${id}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        ...item,
        _type: type,
      });
    }
  });

  return Array.from(byKey.values());
};

/**
 * La poignee de defilement de la liste, telle que flash-list l expose. Le type
 * vient de la bibliotheque : on ne le re-declare pas.
 * ⚠️ Il annonce `scrollToOffset` comme toujours present, mais le rendu web n a
 * pas la meme implementation : la garde `typeof` reste obligatoire a l execution.
 * @typedef {import('@shopify/flash-list').FlashListRef<any>} PoigneeDefilementListe
 */

/**
 * Club list element to inject on home page or a dedicated one.
 * @param {{ enableMapMode?: boolean; refreshSignal?: number; screenActive?: boolean }} [props]
 * @returns {import('react').ReactElement}
 */
function ClubListContent({
  enableMapMode = false,
  refreshSignal = 0,
  screenActive = true,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [{ clubFilters, searchMapSessions }, appDispatch] = useAppContext();
  const { getClubFiltersNumber } = useClub();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { floatingActionBottomOffset, sceneBottomInset } = useBottomDockLayout();

  const [isMultisportDeferredEnabled, setIsMultisportDeferredEnabled] = useState(false);
  const [filtersSheetVisible, setFiltersSheetVisible] = useState(false);
  const primaryQuerySignatureRef = useRef('');
  const firstResultsSignatureRef = useRef('');
  const secondaryQuerySignatureRef = useRef('');
  const listeRef = useRef(
    /** @type {PoigneeDefilementListe | null} */ (null),
  );

  const viewportSession = searchMapSessions?.clubs || {};
  const viewportExecutedQuery = viewportSession?.executedQuery
    || viewportSession?.executedClubMapQuery
    || null;
  const viewportRegion = viewportSession?.searchedViewport
    || viewportSession?.executedViewport
    || null;
  const isViewportListMode = viewportExecutedQuery?.view === 'list'
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
    isFetched,
    isFetching,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetClubs({
    ...(clubFilters || {}),
    includeMultisport: false,
    pageSize: 30,
  }, {
    enabled: screenActive && !isViewportListMode && !isSmartSearchEnabled,
    placeholderData: keepPreviousPageData,
  });

  const {
    data: multisportClubPages,
    refetch: refetchMultisport,
  } = useGetMultisportClubs({
    geohash: clubFilters?.geohash,
    name: activeSearchText || undefined,
    pageSize: 10,
  }, {
    enabled: screenActive
      && !isViewportListMode
      && !isSmartSearchEnabled
      && isMultisportDeferredEnabled,
    placeholderData: undefined,
  });

  const {
    data: smartClubPages,
    error: smartError,
    fetchNextPage: fetchSmartNextPage,
    hasNextPage: hasSmartNextPage,
    isFetched: isSmartFetched,
    isFetching: isSmartFetching,
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
    enabled: screenActive && !isViewportListMode && isSmartSearchEnabled,
    placeholderData: keepPreviousPageData,
  });

  const {
    data: viewportClubPages,
    error: viewportError,
    fetchNextPage: fetchViewportNextPage,
    hasNextPage: hasViewportNextPage,
    isFetched: isViewportFetched,
    isFetching: isViewportFetching,
    isFetchingNextPage: isFetchingViewportNextPage,
    isLoading: isViewportLoading,
    refetch: refetchViewport,
  } = useSearchClubsMap(viewportListParams || {}, {
    enabled: screenActive && isViewportListMode && Boolean(viewportListParams),
    placeholderData: keepPreviousPageData,
  });

  const clubs = useMemo(() => clubPages?.pages
    ?.reduce((/** @type {Club[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    || [], [clubPages]);
  const multisportClubs = useMemo(() => multisportClubPages?.pages
    ?.reduce((/** @type {Club[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    || [], [multisportClubPages]);
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

  const defaultDisplayedClubs = useMemo(
    () => mergeClubCollections(multisportClubs, clubs),
    [clubs, multisportClubs],
  );

  let displayedClubs = defaultDisplayedClubs;
  if (isViewportListMode) {
    displayedClubs = viewportClubs;
  } else if (isSmartSearchEnabled) {
    displayedClubs = smartClubs;
  }

  let activeError = error;
  let activeHasFetched = isFetched;
  if (isViewportListMode) {
    activeError = viewportError;
    activeHasFetched = isViewportFetched;
  } else if (isSmartSearchEnabled) {
    activeError = smartError;
    activeHasFetched = isSmartFetched;
  }

  let activeIsLoading = isLoading;
  let activeIsFetching = isFetching;
  if (isViewportListMode) {
    activeIsLoading = isViewportLoading;
    activeIsFetching = isViewportFetching;
  } else if (isSmartSearchEnabled) {
    activeIsLoading = isSmartLoading;
    activeIsFetching = isSmartFetching;
  }

  let activeIsFetchingNext = isFetchingNextPage;
  if (isViewportListMode) {
    activeIsFetchingNext = isFetchingViewportNextPage;
  } else if (isSmartSearchEnabled) {
    activeIsFetchingNext = isFetchingSmartNextPage;
  }
  const hasResolvedActiveQuery = activeHasFetched || Boolean(activeError);
  const isActiveQueryBusy = Boolean(activeIsLoading || activeIsFetching);
  const showLoadingPlaceholder = !hasResolvedActiveQuery
    || (isActiveQueryBusy && displayedClubs.length === 0);
  const showInlineLoadingHint = hasResolvedActiveQuery
    && isActiveQueryBusy
    && displayedClubs.length > 0
    && !activeIsFetchingNext;

  const shouldShowMapToggle = enableMapMode && (displayedClubs.length > 0 || isViewportListMode);
  const listBottomPadding = shouldShowMapToggle
    ? Math.max(sceneBottomInset, floatingActionBottomOffset + 84)
    : sceneBottomInset;
  const viewportMeta = viewportClubPages?.pages?.[0]?.meta || null;
  const viewportTotalInBounds = Number(viewportMeta?.totalInBounds);
  const viewportDisplayCount = Number.isFinite(viewportTotalInBounds) && viewportTotalInBounds > 0
    ? viewportTotalInBounds
    : displayedClubs.length;
  const isViewportTruncated = Boolean(viewportMeta?.truncated);
  const requiresViewportZoom = Boolean(viewportMeta?.requiresZoom);
  let activeMode = 'default-list';
  if (isViewportListMode) {
    activeMode = 'viewport-list';
  } else if (isSmartSearchEnabled) {
    activeMode = 'smart-search';
  }
  let viewportHelperText = 'La liste suit la zone actuellement choisie sur la carte.';
  if (isViewportTruncated) {
    viewportHelperText = 'Zoome sur la carte pour charger tout le catalogue local.';
  }
  if (requiresViewportZoom) {
    viewportHelperText = 'Zoome pour affiner la recherche.';
  }

  useEffect(() => {
    if (!screenActive || isViewportListMode || isSmartSearchEnabled) {
      setIsMultisportDeferredEnabled(false);
      return undefined;
    }

    let cancelled = false;
    setIsMultisportDeferredEnabled(false);
    const task = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        setIsMultisportDeferredEnabled(true);
      }
    });

    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [
    activeSearchText,
    clubFilters?.activity,
    clubFilters?.geohash,
    isSmartSearchEnabled,
    isViewportListMode,
    screenActive,
  ]);

  const refreshHandler = useCallback(() => {
    if (isViewportListMode) {
      return refetchViewport();
    }

    if (isSmartSearchEnabled) {
      return refetchSmart();
    }

    const refreshTasks = [refetch()];
    if (isMultisportDeferredEnabled) {
      refreshTasks.push(refetchMultisport());
    }

    return Promise.allSettled(refreshTasks);
  }, [
    isMultisportDeferredEnabled,
    isSmartSearchEnabled,
    isViewportListMode,
    refetch,
    refetchMultisport,
    refetchSmart,
    refetchViewport,
  ]);

  useEffect(() => {
    if (!screenActive || !refreshSignal) return;
    refreshHandler();
  }, [refreshHandler, refreshSignal, screenActive]);

  // HAUT (26/08) - quand la recherche change, la liste doit repartir du 1er
  // resultat. Sans ca elle garde la position de la recherche PRECEDENTE, et les
  // meilleurs resultats restent hors ecran, au-dessus (constat d Adel : « ce que
  // je vois en premier c est le 6e meilleur resultat »).
  // On ne touche NI a `data`, NI a une `key` : flash-list relache son verrou de
  // pagination des que l identite de `data` change (une liste vide a deja
  // deroule 3 pages entieres a cause de ca). C est un simple appel imperatif.
  // La garde `typeof` est obligatoire : la reference peut manquer au premier
  // rendu et le web n a pas la meme implementation - motif deja en service dans
  // VenueProposalModal.js:255 et Conversation.js:4480.
  const remonterEnHautDeLaListe = useCallback(() => {
    const liste = listeRef.current;
    if (!liste || typeof liste.scrollToOffset !== 'function') return;
    // `animated: false` : un saut instantane. Une remontee animee ferait defiler
    // l ancienne liste sous les yeux avant d afficher la nouvelle.
    liste.scrollToOffset({ animated: false, offset: 0 });
  }, []);

  useEffect(() => {
    if (!screenActive) return;

    const signature = JSON.stringify({
      mode: activeMode,
      q: activeSearchText,
      viewport: isViewportListMode ? viewportListParams : null,
    });

    if (primaryQuerySignatureRef.current === signature) return;
    primaryQuerySignatureRef.current = signature;
    markSearchPerf('search_primary_query_started', {
      fromCache: displayedClubs.length > 0,
      mode: activeMode,
      networkCount: 1,
      type: 'clubs',
    });
    // Branche sur la SIGNATURE de requete, pas sur l arrivee des donnees :
    // remonter a chaque page recue ramenerait l utilisateur en haut pendant
    // qu il fait defiler. Au montage, la liste est deja en haut : sans effet.
    remonterEnHautDeLaListe();
  }, [activeMode, activeSearchText, displayedClubs.length, isViewportListMode, remonterEnHautDeLaListe, screenActive, viewportListParams]);

  useEffect(() => {
    if (!screenActive || activeIsLoading) return;

    const signature = JSON.stringify({
      count: displayedClubs.length,
      mode: activeMode,
      requiresViewportZoom,
    });

    if (firstResultsSignatureRef.current === signature) return;
    firstResultsSignatureRef.current = signature;
    markSearchPerf('search_primary_query_completed', {
      fromCache: displayedClubs.length > 0 && !activeIsFetchingNext,
      mode: activeMode,
      networkCount: 1,
      resultCount: displayedClubs.length,
      type: 'clubs',
    });
    markSearchPerf('search_first_results_rendered', {
      fromCache: displayedClubs.length > 0 && !activeIsFetchingNext,
      mode: activeMode,
      networkCount: 1,
      resultCount: displayedClubs.length,
      type: 'clubs',
    });
  }, [activeIsFetchingNext, activeIsLoading, activeMode, displayedClubs.length, requiresViewportZoom, screenActive]);

  useEffect(() => {
    if (!screenActive || isViewportListMode || isSmartSearchEnabled || !isMultisportDeferredEnabled) {
      return;
    }

    const signature = `${activeSearchText}:${multisportClubs.length}`;
    if (secondaryQuerySignatureRef.current === signature) return;
    secondaryQuerySignatureRef.current = signature;

    markSearchPerf('search_secondary_query_started', {
      fromCache: multisportClubs.length > 0,
      mode: 'default-list',
      networkCount: 1,
      type: 'clubs',
    });
    markSearchPerf('search_secondary_query_completed', {
      fromCache: multisportClubs.length > 0,
      mode: 'default-list',
      networkCount: 1,
      resultCount: multisportClubs.length,
      type: 'clubs',
    });
  }, [
    activeSearchText,
    isMultisportDeferredEnabled,
    isSmartSearchEnabled,
    isViewportListMode,
    multisportClubs.length,
    screenActive,
  ]);

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
    fetchSmartNextPage,
    fetchViewportNextPage,
    hasNextPage,
    hasSmartNextPage,
    hasViewportNextPage,
    isFetchingNextPage,
    isFetchingSmartNextPage,
    isFetchingViewportNextPage,
    isSmartSearchEnabled,
    isViewportListMode,
  ]);

  const handleClubSelection = useCallback((/** @type {string | undefined} */ documentId) => {
    if (documentId) {
      navigateToStackScreenOrScreen(navigation, {
        params: { clubId: documentId },
        screen: RouteNames.Club,
        stack: RouteNames.ClubStack,
      });
    }
  }, [navigation]);

  // D69 — le bouton ouvre desormais la FEUILLE du pack (capture 05) au lieu de
  // pousser l'ecran plein `ClubFilters`. L'ecran reste enregistre : le
  // navigateur public et l'ecran de carte y mènent encore, donc sa route ne
  // bouge pas.
  const handleOpenFilters = useCallback(() => {
    setFiltersSheetVisible(true);
  }, []);

  const handleSearchField = useCallback((name) => {
    appDispatch({
      payload: {
        ...(clubFilters || {}),
        name,
      },
      type: 'SET_CLUB_FILTERS',
    });
  }, [appDispatch, clubFilters]);

  const handleCreateClub = useCallback(() => {
    // Tunnel de création de club self-service (le serveur autorise coach/dirigeant
    // et refuse proprement les autres rôles). Remplace l'ancien formulaire de demande.
    navigation.navigate(RouteNames.ClubStack, {
      params: { entry: 'search' },
      screen: RouteNames.ClubWizardName,
    });
  }, [navigation]);

  const handleMultisportSelection = useCallback((documentId) => {
    if (documentId) {
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
          executedQuery: null,
          executedViewport: null,
          lastResultMeta: null,
          searchedViewport: null,
          visibleViewport: null,
        },
      },
      type: 'SET_SEARCH_MAP_SESSION_STATE',
    });
  }, [appDispatch]);

  const renderItem = useCallback(({ item }) => {
    const isMultisport = Reflect.get(item || {}, '_type') === 'multisport';
    const searchMeta = Reflect.get(item || {}, '__search');
    const primaryReasonLabel = getMatchReasonLabel(searchMeta?.matchReasons?.[0]);

    return (
      <ClubCard
        item={item}
        onPress={() => (isMultisport
          ? handleMultisportSelection(item.documentId)
          : handleClubSelection(item.documentId))}
        reasonLabel={primaryReasonLabel ? `Tri pertinence: ${primaryReasonLabel}` : ''}
      />
    );
  }, [handleClubSelection, handleMultisportSelection]);

  const renderEmptyList = useCallback(() => {
    if (showLoadingPlaceholder) {
      return (
        <SearchResultsLoadingState
          description="Nous chargeons les clubs correspondant à ta recherche."
          title="Chargement des clubs"
        />
      );
    }

    if (requiresViewportZoom) {
      return (
        <EmptyState
          description="La zone visible est trop large pour charger une liste fiable. Zoome puis relance la vue liste."
          title="Zoome pour affiner la recherche"
        />
      );
    }

    return (
      <EmptyState
        actionLabel={t('clubList.actions.createClub')}
        onAction={handleCreateClub}
        title={t('clubList.noData')}
      />
    );
  }, [handleCreateClub, requiresViewportZoom, showLoadingPlaceholder, t]);

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
      {showInlineLoadingHint ? (
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
          <Loader color={Colors.primary500} size="small" />
          <Text style={[Fonts.p4, Fonts.neutral200]}>
            Actualisation des clubs...
          </Text>
        </View>
      ) : null}

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
            <Text style={[Fonts.p4, Fonts.neutral200]}>{viewportHelperText}</Text>
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
        isLoading={false}
        wrapperStyle={[Alignments.fill]}
      >
        <FlashList
          contentContainerStyle={[
            { paddingBottom: listBottomPadding },
            displayedClubs.length === 0 ? Alignments.fill : null,
          ]}
          data={displayedClubs}
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
          ref={listeRef}
          refreshing={isActiveQueryBusy && !activeIsFetchingNext}
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

      {/* D69 — la feuille du pack. Le bouton et sa pastille, eux, n'ont pas
          bouge : ils marchaient deja. */}
      <ClubFiltersSheet
        filters={clubFilters}
        isVisible={filtersSheetVisible}
        onApply={(filtresChoisis) => {
          appDispatch({ payload: filtresChoisis, type: 'SET_CLUB_FILTERS' });
        }}
        onClose={() => setFiltersSheetVisible(false)}
      />
    </View>
  );
}

export default ClubListContent;
