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
  Platform,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import useClub from '@/domains/club/useClub';
import { useAppContext } from '@/store/appContext';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
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

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetClubsDuTerritoire } from '@/services/annuaire/annuaireQueries';
import { cheminFicheAnnuaire, slugAnnuaire } from '@/services/annuaire/slugAnnuaire';
import { useGetClubs, useGetMultisportClubs } from '@/services/club/clubQueries';
import { keepPreviousPageData } from '@/services/queryOptions';
import { useSearchClubs, useSearchClubsMap } from '@/services/search/searchQueries';
import { getMatchReasonLabel, mapSearchPayload } from '@/services/search/searchService';

import { markSearchPerf } from '@/utils/performance/searchPerformance';

import ClubFiltersSheet from '../filtersSheet/ClubFiltersSheet';
import PastillesFiltresClub from '../filtersSheet/PastillesFiltresClub';
import SearchComponent from '../searchComponent/searchComponent';

/**
 * La clé d'une carte de club dans la liste.
 * @param {any} item Le club.
 * @param {number} index Sa place.
 * @returns {string} La clé.
 */
const cleDeCarte = (item, index) => item?.documentId || `unknown-${item?.name || ''}-${index}`;

function ClubsListSeparator() {
  return <View style={{ height: 12 }} />;
}

// ANNUAIRE-E1 — au-delà, l'annuaire du site range ses cartes sur deux colonnes (planche
// « ordinateur » de la maquette).
const LARGEUR_DEUX_COLONNES = 1024;
// ANNUAIRE-E1 — l'identifiant des cartes posées à plat, lu par le suivi de ce qui est à l'écran.
const PREFIXE_CARTE = 'carte-club-';

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
 * RECHERCHE-UNIQUE (phase 3) — une ligne de l'annuaire, sous la forme que lit ClubCard.
 * @param {any} club Un club tel que `/public-directory/landing` le rend.
 * @returns {any} Le club pour la carte.
 */
const versCarteDeClub = (club) => ({
  _type: 'club',
  activites: Array.isArray(club?.sports) ? club.sports : [],
  addressDetails: club?.addressLabel || club?.city || '',
  documentId: club?.documentId,
  logoUrl: club?.logoUrl || null,
  name: club?.name,
});

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
 * @param {{
 *  actionDeCarte?: (club: any) => import('react').ReactNode;
 *  annuaire?: boolean;
 *  childDocumentId?: string;
 *  enableMapMode?: boolean;
 *  paramsDeFiche?: Record<string, unknown>;
 *  refreshSignal?: number;
 *  screenActive?: boolean;
 * }} [props]
 *   `annuaire` (ANNUAIRE-E1, posé par l'annuaire du site seulement) : la liste défile AVEC la page
 *   (cartes à plat, « Voir plus » au lieu du défilement sans fin) et chaque carte est un vrai lien
 *   vers sa fiche publique. Absent, rien ne change — le téléphone garde sa liste.
 *   `childDocumentId` (PAR-L4, recette PAR-009) : l'enfant venu de SA fiche (« Chercher un club
 *   pour Anissa ») ; la carte l'emmene jusqu'a la fiche club, qui coche cet enfant dans
 *   « Demander une place ». Son identifiant seul : le prenom se relit la-bas, dans MA liste.
 *   `actionDeCarte` / `paramsDeFiche` (R17-INVITER, 19/10, posés par la seule Ville dans
 *   « Ajouter un club ») : l'action rendue sous la carte de chaque club (« Ce club fait partie
 *   de ma collectivité »), les paramètres ajoutés à l'ouverture de sa fiche (la Ville), et pas
 *   de « Créer un club » quand la liste est vide. Absents, rien ne change.
 * @returns {import('react').ReactElement}
 */
function ClubListContent({
  actionDeCarte = undefined,
  annuaire = false,
  childDocumentId = undefined,
  enableMapMode = false,
  paramsDeFiche = undefined,
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
  const { width: largeurEcran } = useWindowDimensions();
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
  // RECHERCHE-UNIQUE (phase 3, decision d'Adel du 25/09 « Q2 = B ») — un département ou une région
  // choisi dans le champ Lieu : la liste lit l'ANNUAIRE, page par page, pour compter comme le titre
  // de sa page (mesure du 25/09 : 404 clubs de football dans les Bouches-du-Rhône selon l'annuaire,
  // 250 selon la table des clubs, 0 en région). Le nom tapé y est cherché aussi (`q`).
  // La requête des sports est déjà partie : la feuille de filtres, montée en permanence, la lance.
  const { data: activites } = useGetActivities();
  const territoire = clubFilters?.city?.territoire && clubFilters?.city?.slug
    ? { echelle: clubFilters.city.territoire, slug: clubFilters.city.slug }
    : null;
  const isTerritoryMode = !isViewportListMode && Boolean(territoire);
  // '' = tous les sports ; null = le sport n'est pas encore connu (on attend, sinon la liste
  // partirait une première fois sur TOUS les sports du département).
  const sportDuTerritoire = useMemo(() => {
    if (!clubFilters?.activity) return '';
    const activite = (activites || []).find(
      (/** @type {any} */ item) => item?.documentId === clubFilters.activity,
    );
    return activite?.name ? slugAnnuaire(activite.name) : null;
  }, [activites, clubFilters?.activity]);
  const isSmartSearchEnabled = !isViewportListMode
    && !isTerritoryMode
    && activeSearchText.length >= 2;

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
    enabled: screenActive && !isViewportListMode && !isSmartSearchEnabled && !isTerritoryMode,
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
      && !isTerritoryMode
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
    // RECHERCHE-UNIQUE (25/09) — le serveur repond sans compte depuis le 23/09
    // (`/search/clubs`, `/search/clubs/map`) : sans cette cle, un visiteur
    // anonyme (telephone ou annuaire du site) restait sur « Chargement » sans fin.
    allowAnonymous: true,
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
    allowAnonymous: true,
    enabled: screenActive && isViewportListMode && Boolean(viewportListParams),
    placeholderData: keepPreviousPageData,
  });

  const {
    data: territoirePages,
    error: territoireError,
    fetchNextPage: fetchTerritoireNextPage,
    hasNextPage: hasTerritoireNextPage,
    isFetched: isTerritoireFetched,
    isFetching: isTerritoireFetching,
    isFetchingNextPage: isFetchingTerritoireNextPage,
    isLoading: isTerritoireLoading,
    refetch: refetchTerritoire,
  } = useGetClubsDuTerritoire({
    department: territoire?.echelle === 'departement' ? territoire.slug : undefined,
    q: activeSearchText.length >= 2 ? activeSearchText : undefined,
    region: territoire?.echelle === 'region' ? territoire.slug : undefined,
    sport: sportDuTerritoire || undefined,
  }, {
    enabled: screenActive && isTerritoryMode && sportDuTerritoire !== null,
    placeholderData: keepPreviousPageData,
  });
  const territoireClubs = useMemo(
    () => (territoirePages?.pages || []).flatMap(
      (/** @type {any} */ page) => (page?.items || []).map(versCarteDeClub),
    ),
    [territoirePages],
  );

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
  } else if (isTerritoryMode) {
    displayedClubs = territoireClubs;
  } else if (isSmartSearchEnabled) {
    displayedClubs = smartClubs;
  }

  let activeError = error;
  let activeHasFetched = isFetched;
  if (isViewportListMode) {
    activeError = viewportError;
    activeHasFetched = isViewportFetched;
  } else if (isTerritoryMode) {
    activeError = territoireError;
    activeHasFetched = isTerritoireFetched;
  } else if (isSmartSearchEnabled) {
    activeError = smartError;
    activeHasFetched = isSmartFetched;
  }

  let activeIsLoading = isLoading;
  let activeIsFetching = isFetching;
  if (isViewportListMode) {
    activeIsLoading = isViewportLoading;
    activeIsFetching = isViewportFetching;
  } else if (isTerritoryMode) {
    activeIsLoading = isTerritoireLoading;
    activeIsFetching = isTerritoireFetching;
  } else if (isSmartSearchEnabled) {
    activeIsLoading = isSmartLoading;
    activeIsFetching = isSmartFetching;
  }

  let activeIsFetchingNext = isFetchingNextPage;
  let activeHasNextPage = hasNextPage;
  if (isViewportListMode) {
    activeIsFetchingNext = isFetchingViewportNextPage;
    activeHasNextPage = hasViewportNextPage;
  } else if (isTerritoryMode) {
    activeIsFetchingNext = isFetchingTerritoireNextPage;
    activeHasNextPage = hasTerritoireNextPage;
  } else if (isSmartSearchEnabled) {
    activeIsFetchingNext = isFetchingSmartNextPage;
    activeHasNextPage = hasSmartNextPage;
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
  } else if (isTerritoryMode) {
    activeMode = 'territory-list';
  } else if (isSmartSearchEnabled) {
    activeMode = 'smart-search';
  }
  let viewportHelperText = t(
    'clubListContent.viewport.followsMap',
    'La liste suit la zone actuellement choisie sur la carte.',
  );
  if (isViewportTruncated) {
    viewportHelperText = t(
      'clubListContent.viewport.zoomToLoadAll',
      'Zoome sur la carte pour charger tout le catalogue local.',
    );
  }
  if (requiresViewportZoom) {
    viewportHelperText = t(
      'clubListContent.viewport.zoomToRefine',
      'Zoome pour affiner la recherche.',
    );
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

    if (isTerritoryMode) {
      return refetchTerritoire();
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
    isTerritoryMode,
    isViewportListMode,
    refetch,
    refetchMultisport,
    refetchSmart,
    refetchTerritoire,
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

    if (isTerritoryMode) {
      if (hasTerritoireNextPage && !isFetchingTerritoireNextPage) {
        fetchTerritoireNextPage();
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
    fetchTerritoireNextPage,
    fetchViewportNextPage,
    hasNextPage,
    hasSmartNextPage,
    hasTerritoireNextPage,
    hasViewportNextPage,
    isFetchingNextPage,
    isFetchingSmartNextPage,
    isFetchingTerritoireNextPage,
    isFetchingViewportNextPage,
    isSmartSearchEnabled,
    isTerritoryMode,
    isViewportListMode,
  ]);

  const handleClubSelection = useCallback((/** @type {string | undefined} */ documentId) => {
    if (documentId) {
      navigateToStackScreenOrScreen(navigation, {
        params: {
          clubId: documentId,
          ...(childDocumentId ? { childDocumentId } : {}),
          ...(paramsDeFiche || {}),
        },
        screen: RouteNames.Club,
        stack: RouteNames.ClubStack,
      });
    }
  }, [childDocumentId, navigation, paramsDeFiche]);

  // D69 — le bouton ouvre desormais la FEUILLE du pack (capture 05) au lieu de
  // pousser l'ecran plein `ClubFilters`. L'ecran reste enregistre : le
  // navigateur public et l'ecran de carte y mènent encore, donc sa route ne
  // bouge pas.
  const handleOpenFilters = useCallback(() => {
    setFiltersSheetVisible(true);
  }, []);

  const appliquerFiltres = useCallback((/** @type {Record<string, any>} */ filtresChoisis) => {
    appDispatch({ payload: filtresChoisis, type: 'SET_CLUB_FILTERS' });
  }, [appDispatch]);

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

  // 🔋 CE QUI EST REELLEMENT A L'ECRAN (decision d'Adel du 2026-08-27 : le nom
  // defile EN BOUCLE, sans fin). Une boucle sans fin sur une carte que
  // personne ne regarde, c'est de la batterie brulee pour rien.
  //
  // La liste est virtualisee : elle garde montees quelques cartes AU-DELA du
  // bord de l'ecran. Le plafond de `useMarqueeLoop` les bornait deja a 6, mais
  // rien ne garantissait que ces 6 places aillent aux cartes VUES. C'est cette
  // liste qui sait lesquelles le sont — elle le dit maintenant.
  //
  // ⚠️ Tant qu'aucun rapport de visibilite n'est arrive (premier rendu), la
  // liste ne sait rien : on considere tout comme visible. Sans ce repli, aucun
  // nom ne defilerait tant que l'utilisateur n'a pas touche a la liste.
  const [idsVisibles, setIdsVisibles] = useState(/** @type {Set<string> | null} */ (null));

  const rapportDeVisibilite = useRef((
    /** @type {{ viewableItems?: Array<{ item?: any }> }} */ { viewableItems },
  ) => {
    setIdsVisibles(new Set(
      (viewableItems || [])
        .map((/** @type {{ item?: any }} */ entree) => entree?.item?.documentId)
        .filter(Boolean),
    ));
  }).current;

  const reglageDeVisibilite = useRef({ itemVisiblePercentThreshold: 10 }).current;

  // ANNUAIRE-E1 — sur l'annuaire, la liste défile AVEC la page : elle ne sait plus ce qui est à
  // l'écran (sa fenêtre est tout son contenu). C'est la FENÊTRE du navigateur qui le dit, carte par
  // carte : même seuil de 10 %, et les sponsors d'une carte hors de l'écran restent immobiles.
  const racineAPlatRef = useRef(/** @type {any} */ (null));
  useEffect(() => {
    const Observateur = typeof window === 'undefined' ? undefined : window.IntersectionObserver;
    if (!annuaire || Platform.OS !== 'web' || typeof Observateur !== 'function') return undefined;
    const racine = racineAPlatRef.current;
    if (!racine || typeof racine.querySelectorAll !== 'function') return undefined;
    const aLEcran = new Set();
    const observateur = new Observateur((entrees) => {
      entrees.forEach((entree) => {
        const id = String(entree.target.id || '').slice(PREFIXE_CARTE.length);
        if (entree.isIntersecting) aLEcran.add(id);
        else aLEcran.delete(id);
      });
      setIdsVisibles(new Set(aLEcran));
    }, { threshold: 0.1 });
    racine.querySelectorAll(`[id^="${PREFIXE_CARTE}"]`)
      .forEach((/** @type {Element} */ carte) => observateur.observe(carte));
    return () => observateur.disconnect();
  }, [annuaire, displayedClubs]);

  const renderItem = useCallback(({ item }) => {
    const isMultisport = Reflect.get(item || {}, '_type') === 'multisport';
    const searchMeta = Reflect.get(item || {}, '__search');
    const primaryReasonLabel = getMatchReasonLabel(searchMeta?.matchReasons?.[0]);

    const carte = (
      <ClubCard
        href={annuaire ? cheminFicheAnnuaire(item) : null}
        item={item}
        onPress={() => (isMultisport
          ? handleMultisportSelection(item.documentId)
          : handleClubSelection(item.documentId))}
        paused={idsVisibles !== null && !idsVisibles.has(item?.documentId)}
        reasonLabel={primaryReasonLabel
          ? t(
            'clubListContent.relevanceReason',
            'Tri pertinence: {{reason}}',
            { reason: primaryReasonLabel, ...SANS_ECHAPPEMENT },
          )
          : ''}
      />
    );
    // R17-INVITER : un club multisport n'est pas un club qu'une Ville rattache.
    if (!actionDeCarte || isMultisport) return carte;
    return (
      <View style={Spaces.gap[8]}>
        {carte}
        {actionDeCarte(item)}
      </View>
    );
  }, [
    actionDeCarte, annuaire, handleClubSelection, handleMultisportSelection, idsVisibles, Spaces, t,
  ]);

  const renderEmptyList = useCallback(() => {
    if (showLoadingPlaceholder) {
      return (
        <SearchResultsLoadingState
          description={t(
            'clubListContent.loading.description',
            'Nous chargeons les clubs correspondant à ta recherche.',
          )}
          title={t('clubListContent.loading.title', 'Chargement des clubs')}
        />
      );
    }

    if (requiresViewportZoom) {
      return (
        <EmptyState
          description={t(
            'clubListContent.zoomRequired.description',
            'La zone visible est trop large pour charger une liste fiable. Zoome puis relance la vue liste.', // eslint-disable-line max-len
          )}
          title={t('clubListContent.zoomRequired.title', 'Zoome pour affiner la recherche')}
        />
      );
    }

    // R17-INVITER : la Ville ne crée pas de club (son lien « Le club n'est pas sur FoundClub ? »).
    return (
      <EmptyState
        actionLabel={actionDeCarte ? undefined : t('clubList.actions.createClub')}
        onAction={actionDeCarte ? undefined : handleCreateClub}
        title={t('clubList.noData')}
      />
    );
  }, [actionDeCarte, handleCreateClub, requiresViewportZoom, showLoadingPlaceholder, t]);

  // ANNUAIRE-E1 — sur l'annuaire du site, les cartes sont posées à plat et défilent AVEC la page.
  // Une liste qui ne défile pas elle-même ne sait plus quand elle arrive au bout : sans borne, elle
  // réclamait TOUTES ses pages (banc du 25/09 : 8 sur 8). La page suivante se demande donc au
  // bouton « Voir plus », comme la planche le dessine.
  const deuxColonnes = annuaire && Platform.OS === 'web' && largeurEcran >= LARGEUR_DEUX_COLONNES;
  const enTetePertinence = isSmartSearchEnabled ? (
    <Text style={[Fonts.p3, Fonts.primary500, Spaces.marginBottom[12]]}>
      {t('clubListContent.sortedByRelevance', 'Trie par pertinence')}
    </Text>
  ) : null;
  const listeAPlat = annuaire ? (
    <View ref={racineAPlatRef} style={[Spaces.gap[16], { paddingBottom: listBottomPadding }]}>
      {enTetePertinence}
      {displayedClubs.length === 0 ? renderEmptyList() : (
        <View
          style={deuxColonnes
            ? {
              flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16,
            }
            : Spaces.gap[12]}
        >
          {displayedClubs.map((item, index) => (
            <View
              key={cleDeCarte(item, index)}
              // Rendu en `id` sur le site : c'est par lui que la fenêtre dit quelle carte est vue.
              nativeID={`${PREFIXE_CARTE}${String(item?.documentId || index)}`}
              style={deuxColonnes ? { width: '49%' } : null}
            >
              {renderItem({ item })}
            </View>
          ))}
        </View>
      )}
      {activeHasNextPage && displayedClubs.length > 0 ? (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.85}
          disabled={activeIsFetchingNext}
          onPress={handleEndReached}
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifyCenter,
            Spaces.gap[8],
            {
              alignSelf: 'center',
              borderColor: Colors.primary500,
              borderRadius: 999,
              borderWidth: 1,
              minHeight: 48,
              paddingHorizontal: 28,
            },
          ]}
        >
          {activeIsFetchingNext ? <Loader color={Colors.primary500} size="small" /> : null}
          <Text style={[Fonts.p2Bold, { color: Colors.primary300 }]}>
            {t('clubListContent.loadMore', 'Voir plus')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={annuaire ? Spaces.gap[16] : [Alignments.fill, Spaces.gap[16]]}>
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
      {/* ANNUAIRE-E1 (maquette validée le 29/09) — le sport et le lieu en deux pastilles écrites,
          qui ouvrent CHACUNE leur choix en un geste. Elles remplacent la ligne-résumé de D6
          (« Football · Lyon · 10 km »), qui ouvrait toute la fenêtre « Filtrer ». */}
      <PastillesFiltresClub filters={clubFilters} onApply={appliquerFiltres} />
      {showInlineLoadingHint ? (
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
          <Loader color={Colors.primary500} size="small" />
          <Text style={[Fonts.p4, Fonts.neutral200]}>
            {t('clubListContent.refreshing', 'Actualisation des clubs...')}
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
              {t('clubListContent.viewport.count', '{{total}}{{plus}} clubs dans la zone visible', {
                plus: isViewportTruncated ? '+' : '',
                total: viewportDisplayCount,
              })}
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
              {t('clubListContent.viewport.exit', 'Quitter')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <WithDataWrapper
        error={activeError?.message}
        isLoading={false}
        wrapperStyle={annuaire ? [] : [Alignments.fill]}
      >
        {annuaire ? listeAPlat : (
          <FlashList
            contentContainerStyle={[
              { paddingBottom: listBottomPadding },
              displayedClubs.length === 0 ? Alignments.fill : null,
            ]}
            data={displayedClubs}
            ItemSeparatorComponent={ClubsListSeparator}
            keyExtractor={cleDeCarte}
            ListEmptyComponent={renderEmptyList}
            ListHeaderComponent={enTetePertinence}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onRefresh={refreshHandler}
            // ⚠️ Ces deux-la sont FIGES dans un `ref` : react-native refuse
            // qu'ils changent d'identite en cours de route.
            onViewableItemsChanged={rapportDeVisibilite}
            ref={listeRef}
            refreshing={isActiveQueryBusy && !activeIsFetchingNext}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            viewabilityConfig={reglageDeVisibilite}
          />
        )}
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
        onApply={appliquerFiltres}
        onClose={() => setFiltersSheetVisible(false)}
      />
    </View>
  );
}

export default ClubListContent;
