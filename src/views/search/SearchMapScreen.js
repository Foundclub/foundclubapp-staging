/* eslint-disable consistent-return */

import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import usePlaces from '@/domains/places/usePlaces';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import GlassSurface from '@/components/atoms/glassSurface/GlassSurface';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import SearchMap from '@/components/organisms/searchMap/SearchMap';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEvents } from '@/services/event/eventQueries';
import { useGetReservations } from '@/services/reservation/reservationQueries';
import {
  useSearchClubsMap,
  useSearchEvents,
  useSearchReservations,
} from '@/services/search/searchQueries';
import { mapSearchPayload } from '@/services/search/searchService';

import { createLogger } from '@/utils/logger/logger';
import { toSearchMapItems } from '@/utils/searchMap';

import {
  getSearchMapSearchAreaLabel,
  getSearchMapUpdatingResultsCopy,
} from '@/platform/maps/searchMapCopy';
import { navigateToSearchMapDetail } from '@/platform/maps/searchMapDetailNavigation';

const logger = createLogger('search-map-screen');
const DEFAULT_RADIUS = 20;
const MIN_CLUB_MAP_QUERY_ZOOM = 9;
const MOVE_THRESHOLD = 0.005;
const DEFAULT_MAP_ASPECT_RATIO = 0.58;

const sanitizeScope = (value) => (
  value === 'clubs' || value === 'reservations' ? value : 'events'
);

const readLabel = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return String(value.label || value.name || value.title || value.value || '').trim();
};

const humanize = (value) => String(value || '')
  .trim()
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const parseAddressCoordinates = (address) => {
  const lat = Number.parseFloat(String(address?.lat ?? ''));
  const lng = Number.parseFloat(String(address?.lng ?? address?.lon ?? ''));

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  if (!address?.value || typeof address.value !== 'string') return null;
  const [lngRaw, latRaw] = address.value.split('|');
  const parsedLat = Number.parseFloat(latRaw);
  const parsedLng = Number.parseFloat(lngRaw);
  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
    ? { lat: parsedLat, lng: parsedLng }
    : null;
};

const parseAddressBbox = (address) => {
  const safeBbox = address?.bbox;
  if (!safeBbox || typeof safeBbox !== 'object') {
    return null;
  }

  const north = Number.parseFloat(String(safeBbox.north ?? ''));
  const south = Number.parseFloat(String(safeBbox.south ?? ''));
  const east = Number.parseFloat(String(safeBbox.east ?? ''));
  const west = Number.parseFloat(String(safeBbox.west ?? ''));

  if ([north, south, east, west].every((value) => Number.isFinite(value))) {
    return {
      east,
      north,
      south,
      west,
    };
  }

  return null;
};

const getAddressZoomHeuristic = (address) => {
  const type = String(address?.type || '').trim().toLowerCase();
  const postcode = String(address?.postcode || '').trim();
  if (type === 'housenumber') return 16;
  if (type === 'street') return 14;
  if (/^\d{5}$/.test(postcode)) return 13;
  if (type === 'municipality' || type === 'city' || type === 'locality') return 12;
  return 11;
};

const toRegionHintFromAddress = (address) => {
  const coordinates = parseAddressCoordinates(address);
  if (!coordinates) {
    return null;
  }

  const bbox = parseAddressBbox(address);
  if (bbox) {
    return {
      ...bbox,
      lat: coordinates.lat,
      lng: coordinates.lng,
      zoom: getAddressZoomHeuristic(address),
    };
  }

  return {
    lat: coordinates.lat,
    lng: coordinates.lng,
    zoom: getAddressZoomHeuristic(address),
  };
};

const parseFilterCoordinates = (filters) => {
  const lat = Number.parseFloat(String(filters?.lat ?? ''));
  const lng = Number.parseFloat(String(filters?.lon ?? ''));
  const zoom = Number.parseFloat(String(filters?.zoom ?? ''));
  return Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng, zoom: Number.isFinite(zoom) ? zoom : undefined }
    : null;
};

const resolvePreferredRegion = (filters, fallbackRegion = null) => {
  const directRegion = parseFilterCoordinates(filters);
  if (directRegion) {
    return directRegion;
  }

  const addressRegion = toRegionHintFromAddress(filters?.city);
  if (addressRegion) {
    return addressRegion;
  }

  return fallbackRegion;
};

const areRegionsEquivalent = (left, right) => {
  if (!left && !right) return true;
  if (!left || !right) return false;

  const leftZoom = Number.isFinite(Number(left.zoom)) ? Number(left.zoom) : undefined;
  const rightZoom = Number.isFinite(Number(right.zoom)) ? Number(right.zoom) : undefined;
  const compareOptional = (key, epsilon = 0.0001) => {
    const leftValue = Number(left?.[key]);
    const rightValue = Number(right?.[key]);
    if (!Number.isFinite(leftValue) && !Number.isFinite(rightValue)) {
      return true;
    }
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
      return false;
    }
    return Math.abs(leftValue - rightValue) < epsilon;
  };

  return (
    Math.abs(Number(left.lat) - Number(right.lat)) < 0.0001
    && Math.abs(Number(left.lng) - Number(right.lng)) < 0.0001
    && compareOptional('north')
    && compareOptional('south')
    && compareOptional('east')
    && compareOptional('west')
    && compareOptional('latitudeDelta')
    && compareOptional('longitudeDelta')
    && (
      leftZoom === rightZoom
      || (
        leftZoom !== undefined
        && rightZoom !== undefined
        && Math.abs(leftZoom - rightZoom) < 0.1
      )
    )
  );
};

const hasFiniteViewportBounds = (viewport) => (
  Number.isFinite(Number(viewport?.north))
  && Number.isFinite(Number(viewport?.south))
  && Number.isFinite(Number(viewport?.east))
  && Number.isFinite(Number(viewport?.west))
);

const resolveViewportZoom = (viewport) => {
  const explicitZoom = Number(viewport?.zoom);
  if (Number.isFinite(explicitZoom)) {
    return explicitZoom;
  }

  const longitudeDelta = Number(viewport?.longitudeDelta);
  if (Number.isFinite(longitudeDelta) && longitudeDelta > 0) {
    return Math.max(1, Math.min(20, Math.round(Math.log2(360 / longitudeDelta))));
  }

  return 11;
};

const canSearchClubViewport = (viewport) => (
  hasFiniteViewportBounds(viewport)
  && resolveViewportZoom(viewport) >= MIN_CLUB_MAP_QUERY_ZOOM
);

const buildViewportFromRegionCandidate = (region, aspectRatio = DEFAULT_MAP_ASPECT_RATIO) => {
  if (!region) {
    return null;
  }

  const lat = Number(region.lat);
  const lng = Number(region.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const north = Number(region.north);
  const south = Number(region.south);
  const east = Number(region.east);
  const west = Number(region.west);
  const zoom = Number.isFinite(Number(region.zoom)) ? Number(region.zoom) : 11;

  if ([north, south, east, west].every((value) => Number.isFinite(value))) {
    return {
      east,
      lat,
      latitudeDelta: Math.max(Math.abs(north - south), 0.02),
      lng,
      longitudeDelta: Math.max(Math.abs(east - west), 0.02),
      north,
      south,
      west,
      zoom,
    };
  }

  const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0
    ? aspectRatio
    : DEFAULT_MAP_ASPECT_RATIO;
  const longitudeDelta = Math.max(360 / (2 ** zoom), 0.02);
  const latitudeDelta = Math.max(longitudeDelta / safeAspectRatio, 0.02);

  return {
    east: lng + (longitudeDelta / 2),
    lat,
    latitudeDelta,
    lng,
    longitudeDelta,
    north: lat + (latitudeDelta / 2),
    south: lat - (latitudeDelta / 2),
    west: lng - (longitudeDelta / 2),
    zoom,
  };
};

const areViewportsEquivalent = (left, right) => {
  if (!left && !right) return true;
  if (!left || !right) return false;

  const compare = (key, epsilon = 0.0005) => (
    Math.abs(Number(left?.[key]) - Number(right?.[key])) < epsilon
  );

  return (
    compare('lat')
    && compare('lng')
    && compare('north')
    && compare('south')
    && compare('east')
    && compare('west')
    && (
      !Number.isFinite(Number(left?.zoom))
      || !Number.isFinite(Number(right?.zoom))
      || Math.abs(Number(left.zoom) - Number(right.zoom)) < 0.1
    )
  );
};

const hasMeaningfulMove = (nextRegion, appliedCenter) => (
  !!nextRegion
  && !!appliedCenter
  && (
    Math.abs(nextRegion.lat - appliedCenter.lat) >= MOVE_THRESHOLD
    || Math.abs(nextRegion.lng - appliedCenter.lng) >= MOVE_THRESHOLD
  )
);

const hasMeaningfulViewportMove = (nextViewport, executedViewport) => (
  !!nextViewport
  && !!executedViewport
  && !areViewportsEquivalent(nextViewport, executedViewport)
);

const formatDateChip = (value, prefix) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${prefix} ${format(parsed, 'd MMM', { locale: fr })}`;
};

const getFilterActionType = (isClubScope, isReservationScope) => {
  if (isClubScope) {
    return 'SET_CLUB_FILTERS';
  }

  if (isReservationScope) {
    return 'SET_RESERVATION_FILTERS';
  }

  return 'SET_EVENT_FILTERS';
};

const buildClubMapViewportQuery = (filters, viewport, view = 'map') => {
  if (!viewport || !canSearchClubViewport(viewport)) {
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
    pageSize: view === 'map' ? 1500 : 30,
    q: q.length >= 2 ? q : undefined,
    south: viewport.south,
    view,
    west: viewport.west,
    zoom: resolveViewportZoom(viewport),
  };
};

const buildClubMapFilterSignature = (filters) => JSON.stringify({
  activity: Array.isArray(filters?.activity)
    ? filters.activity.map((item) => (
      item?.value
      || item?.documentId
      || item?.id
      || String(item || '')
    ))
    : (
      filters?.activity?.value
      || filters?.activity?.documentId
      || filters?.activity?.id
      || filters?.activity
      || null
    ),
  q: typeof filters?.name === 'string' && filters.name.trim().length >= 2
    ? filters.name.trim()
    : '',
});

const buildStableSignature = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => buildStableSignature(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const nextValue = buildStableSignature(value[key]);
        if (nextValue !== undefined) {
          acc[key] = nextValue;
        }
        return acc;
      }, {});
  }

  return value;
};

const toStableJson = (value) => JSON.stringify(buildStableSignature(value));

const logClubMapLifecycle = (event, payload = {}) => {
  if (!__DEV__) {
    return;
  }

  logger.info(`[clubs-map] ${event}`, payload);
};

const getActiveQueryItems = (
  isSmartSearchEnabled,
  regularQuery,
  searchedQuery,
) => (
  isSmartSearchEnabled
    ? searchedQuery.data?.pages?.reduce(
      (acc, page) => acc.concat(mapSearchPayload(page)),
      [],
    ) || []
    : regularQuery.data?.pages?.reduce(
      (acc, page) => acc.concat(page?.data || []),
      [],
    ) || []
);

const getActiveQueryError = (
  isSmartSearchEnabled,
  regularQuery,
  searchedQuery,
) => (
  isSmartSearchEnabled ? searchedQuery.error : regularQuery.error
);

const getActiveQueryLoadingState = (
  isSmartSearchEnabled,
  regularQuery,
  searchedQuery,
) => (
  isSmartSearchEnabled ? searchedQuery.isLoading : regularQuery.isLoading
);

const getActiveQueryTotalCount = (
  isSmartSearchEnabled,
  regularQuery,
  searchedQuery,
) => {
  const activeQuery = isSmartSearchEnabled ? searchedQuery : regularQuery;
  const total = Number(activeQuery?.data?.pages?.[0]?.meta?.pagination?.total);
  return Number.isFinite(total) && total > 0 ? total : 0;
};

const getUnavailableMessage = (scope) => {
  if (scope === 'clubs') {
    return 'Impossible de mettre à jour les clubs pour le moment.';
  }

  if (scope === 'reservations') {
    return 'Impossible de mettre à jour les réservations pour le moment.';
  }

  return 'Impossible de mettre à jour les événements pour le moment.';
};

const getMapHeading = (scope) => {
  if (scope === 'clubs') {
    return 'Clubs';
  }

  if (scope === 'reservations') {
    return 'Reservations';
  }

  return 'Evenements';
};

const buildChips = (scope, filters) => {
  const chips = [];
  const push = (value) => {
    const safeValue = String(value || '').trim();
    if (safeValue) {
      chips.push(safeValue);
    }
  };

  if (scope === 'events') {
    push(filters.q ? `Recherche : ${filters.q}` : '');
    push(readLabel(filters.activity));
    push(readLabel(filters.club));
    push(humanize(filters.category));
    push(humanize(filters.level));
    push(readLabel(filters.type));
    push(filters.city?.label);
    push(filters.radius ? `${filters.radius} km` : '');
    push(filters.sessionStatus === 'open' ? 'Ouverts' : '');
    push(formatDateChip(filters.startDateAfter, 'Dès le'));
    push(formatDateChip(filters.startDateBefore, 'Jusqu’au'));
  }

  if (scope === 'clubs') {
    push(filters.name ? `Recherche : ${filters.name}` : '');
    push(readLabel(filters.activity));
    push(filters.city?.label);
    push(filters.radius ? `${filters.radius} km` : '');
  }

  if (scope === 'reservations') {
    push(filters.q ? `Recherche : ${filters.q}` : '');
    push(filters.city?.label);
    push(filters.radius ? `${filters.radius} km` : '');
    push(readLabel(filters.activity));
    push(humanize(filters.activitySlug));
    push(humanize(filters.category));
    push(humanize(filters.level));
    push(
      filters.maxPricePerPerson || filters.maxPrice
        ? `Budget max ${filters.maxPricePerPerson || filters.maxPrice}€`
        : '',
    );
    push(humanize(filters.reservationMode));
    push(formatDateChip(filters.startDateAfter, 'Dès le'));
    push(formatDateChip(filters.startDateBefore, 'Jusqu’au'));
  }

  return [...new Set(chips.filter(Boolean))];
};

/**
 * @param {object} props
 * @param {any} props.navigation
 * @param {any} props.route
 * @returns {import('react').ReactElement}
 */
function SearchMapScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { userData } = useAuth();
  const { getGeohashForPointAndRadius } = usePlaces();
  const [{
    clubFilters,
    eventFilters,
    reservationFilters,
    searchMapSessions,
  }, appDispatch] = useAppContext();

  const [topOverlayHeight, setTopOverlayHeight] = useState(156);
  const [topBannerHeight, setTopBannerHeight] = useState(0);
  const [addressSelection, setAddressSelection] = useState(undefined);
  const [appliedCenter, setAppliedCenter] = useState(null);
  const [isAddressSearchActive, setIsAddressSearchActive] = useState(false);
  const [renderStats, setRenderStats] = useState(null);
  // currentViewport: visible viewport currently displayed by the map runtime
  const [currentViewport, setCurrentViewport] = useState(null);
  // executedViewport: last viewport explicitly searched against /search/clubs/map
  const [executedViewport, setExecutedViewport] = useState(null);
  const [executedClubMapQuery, setExecutedClubMapQuery] = useState(null);
  const [clubMapLastResultMeta, setClubMapLastResultMeta] = useState(null);
  // pendingRegion: viewport moved by the user but not yet committed via "Rechercher dans cette zone"
  const [pendingRegion, setPendingRegion] = useState(null);
  const [showSearchThisArea, setShowSearchThisArea] = useState(false);
  const [isSubmittingRegionSearch, setIsSubmittingRegionSearch] = useState(false);

  const scope = sanitizeScope(route?.params?.scope);
  const isClubScope = scope === 'clubs';
  const isReservationScope = scope === 'reservations';
  const isAuthenticated = Boolean(userData?.documentId);

  const activeFilters = useMemo(() => {
    if (isClubScope) return clubFilters || {};
    if (isReservationScope) return reservationFilters || {};
    return eventFilters || {};
  }, [clubFilters, eventFilters, isClubScope, isReservationScope, reservationFilters]);

  const persistedSession = searchMapSessions?.[scope] || {};
  const initialViewportRegion = resolvePreferredRegion(
    activeFilters,
    persistedSession?.region || null,
  );
  const hydratedScopeRef = useRef(null);
  const isBootstrappingClubViewportRef = useRef(false);
  const shouldAutoSubmitViewportRef = useRef(false);
  const pendingAddressViewportTimeoutRef = useRef(null);
  const pendingVisibleViewportTimeoutRef = useRef(null);
  const clubMapFilterSignatureRef = useRef(null);
  const persistedRegionTimeoutRef = useRef(null);
  const focusMetricsRef = useRef({ geolocatableCount: 0, totalCount: 0 });
  const focusRefreshConfigRef = useRef({
    hasClubQuery: false,
    isClubScope: false,
    isEventSmartSearchEnabled: false,
    isReservationScope: false,
    isReservationSmartSearchEnabled: false,
    shouldRefetchClubMap: false,
  });
  const clubMapRefetchRef = useRef(() => Promise.resolve());
  const eventRefetchRef = useRef(() => Promise.resolve());
  const searchedEventRefetchRef = useRef(() => Promise.resolve());
  const reservationRefetchRef = useRef(() => Promise.resolve());
  const searchedReservationRefetchRef = useRef(() => Promise.resolve());
  const clubMapHasResolvedRef = useRef(false);
  const lastCommittedClubMapQuerySignatureRef = useRef('');
  const lastPersistedRegionMetaSignatureRef = useRef('');
  const lastPersistedRenderStatsSignatureRef = useRef('');
  const lastPersistedRegionRef = useRef(initialViewportRegion);
  const lastPersistedVisibleViewportRef = useRef(null);
  const [selectedMapItemId, setSelectedMapItemId] = useState(
    persistedSession?.selectedItemId || '',
  );
  const [regionHint, setRegionHint] = useState(initialViewportRegion);
  const persistedExecutedViewport = persistedSession?.searchedViewport
    || persistedSession?.executedViewport
    || null;
  const persistedVisibleViewport = persistedSession?.visibleViewport
    || persistedExecutedViewport
    || null;
  const persistedLastResultMeta = persistedSession?.lastResultMeta || null;
  const persistedLastRenderStats = persistedSession?.lastRenderStats || null;

  const persistSessionState = useCallback((state) => {
    appDispatch({
      payload: { scope, state },
      type: 'SET_SEARCH_MAP_SESSION_STATE',
    });
  }, [appDispatch, scope]);

  const dispatchFilters = useCallback((payload) => {
    appDispatch({
      payload,
      type: getFilterActionType(isClubScope, isReservationScope),
    });
  }, [appDispatch, isClubScope, isReservationScope]);

  useEffect(() => {
    if (hydratedScopeRef.current === scope) {
      return;
    }

    const restoredViewport = isClubScope
      && persistedExecutedViewport
      && hasFiniteViewportBounds(persistedExecutedViewport)
      ? persistedExecutedViewport
      : null;
    const restoredVisibleViewport = isClubScope
      && persistedVisibleViewport
      && hasFiniteViewportBounds(persistedVisibleViewport)
      ? persistedVisibleViewport
      : restoredViewport;
    const nextRestoredRegion = resolvePreferredRegion(
      activeFilters,
      persistedSession?.region || null,
    );
    const restoredQuery = restoredViewport
      ? buildClubMapViewportQuery(activeFilters, restoredViewport, 'map')
      : null;

    setAddressSelection(activeFilters?.city || undefined);
    setAppliedCenter(nextRestoredRegion);
    setCurrentViewport(restoredVisibleViewport);
    setExecutedViewport(restoredViewport);
    setExecutedClubMapQuery(restoredQuery);
    setClubMapLastResultMeta(isClubScope ? persistedLastResultMeta : null);
    setRenderStats(isClubScope ? persistedLastRenderStats : null);
    setPendingRegion(null);
    setRegionHint(nextRestoredRegion);
    setSelectedMapItemId(persistedSession?.selectedItemId || '');
    setShowSearchThisArea(false);
    isBootstrappingClubViewportRef.current = isClubScope && !restoredViewport;
    shouldAutoSubmitViewportRef.current = false;
    clubMapFilterSignatureRef.current = buildClubMapFilterSignature(activeFilters);
    clubMapHasResolvedRef.current = false;
    lastCommittedClubMapQuerySignatureRef.current = restoredQuery ? toStableJson(restoredQuery) : '';
    lastPersistedRegionMetaSignatureRef.current = toStableJson(isClubScope ? persistedLastResultMeta : null);
    lastPersistedRenderStatsSignatureRef.current = toStableJson(isClubScope ? persistedLastRenderStats : null);
    hydratedScopeRef.current = scope;
    lastPersistedRegionRef.current = nextRestoredRegion;
    lastPersistedVisibleViewportRef.current = restoredVisibleViewport;
  }, [
    activeFilters,
    isClubScope,
    persistedExecutedViewport,
    persistedVisibleViewport,
    persistedLastResultMeta,
    persistedLastRenderStats,
    persistedSession?.region,
    persistedSession?.selectedItemId,
    scope,
  ]);

  useEffect(() => {
    setAddressSelection(activeFilters?.city || undefined);
    const nextRegion = resolvePreferredRegion(activeFilters, null);

    if (nextRegion) {
      setAppliedCenter((current) => (
        areRegionsEquivalent(current, nextRegion) ? current : nextRegion
      ));
      setRegionHint((current) => (
        areRegionsEquivalent(current, nextRegion) ? current : nextRegion
      ));
    }
    setPendingRegion(null);
    setShowSearchThisArea(false);
  }, [activeFilters]);

  useEffect(() => () => {
    if (pendingAddressViewportTimeoutRef.current) {
      clearTimeout(pendingAddressViewportTimeoutRef.current);
    }
    if (pendingVisibleViewportTimeoutRef.current) {
      clearTimeout(pendingVisibleViewportTimeoutRef.current);
    }
    if (persistedRegionTimeoutRef.current) {
      clearTimeout(persistedRegionTimeoutRef.current);
    }
  }, []);

  const persistViewportRegion = useCallback((nextRegion) => {
    if (!nextRegion || !Number.isFinite(nextRegion.lat) || !Number.isFinite(nextRegion.lng)) {
      return;
    }

    if (persistedRegionTimeoutRef.current) {
      clearTimeout(persistedRegionTimeoutRef.current);
    }

    persistedRegionTimeoutRef.current = setTimeout(() => {
      if (areRegionsEquivalent(lastPersistedRegionRef.current, nextRegion)) {
        persistedRegionTimeoutRef.current = null;
        return;
      }

      persistSessionState({ region: nextRegion });
      lastPersistedRegionRef.current = nextRegion;
      persistedRegionTimeoutRef.current = null;
    }, 180);
  }, [persistSessionState]);

  const persistVisibleViewport = useCallback((nextViewport) => {
    if (!isClubScope || !nextViewport || !hasFiniteViewportBounds(nextViewport)) {
      return;
    }

    if (pendingVisibleViewportTimeoutRef.current) {
      clearTimeout(pendingVisibleViewportTimeoutRef.current);
    }

    pendingVisibleViewportTimeoutRef.current = setTimeout(() => {
      if (areViewportsEquivalent(lastPersistedVisibleViewportRef.current, nextViewport)) {
        pendingVisibleViewportTimeoutRef.current = null;
        return;
      }

      persistSessionState({ visibleViewport: nextViewport });
      lastPersistedVisibleViewportRef.current = nextViewport;
      pendingVisibleViewportTimeoutRef.current = null;
    }, 180);
  }, [isClubScope, persistSessionState]);

  const executeClubViewportSearch = useCallback((viewport, view = 'map') => {
    if (!isClubScope || !viewport || !hasFiniteViewportBounds(viewport)) {
      return;
    }

    if (pendingAddressViewportTimeoutRef.current) {
      clearTimeout(pendingAddressViewportTimeoutRef.current);
      pendingAddressViewportTimeoutRef.current = null;
    }

    const normalizedViewport = {
      east: Number(viewport.east),
      lat: Number(viewport.lat),
      latitudeDelta: Number.isFinite(Number(viewport.latitudeDelta))
        ? Number(viewport.latitudeDelta)
        : undefined,
      lng: Number(viewport.lng),
      longitudeDelta: Number.isFinite(Number(viewport.longitudeDelta))
        ? Number(viewport.longitudeDelta)
        : undefined,
      north: Number(viewport.north),
      south: Number(viewport.south),
      west: Number(viewport.west),
      zoom: resolveViewportZoom(viewport),
    };
    const nextRegion = {
      lat: normalizedViewport.lat,
      lng: normalizedViewport.lng,
      zoom: normalizedViewport.zoom,
    };
    const nextQuery = buildClubMapViewportQuery(activeFilters, normalizedViewport, view);
    const nextQuerySignature = nextQuery ? toStableJson(nextQuery) : '';

    logClubMapLifecycle('SEARCH_VIEWPORT_COMMITTED', {
      hasBounds: hasFiniteViewportBounds(normalizedViewport),
      lat: normalizedViewport.lat,
      lng: normalizedViewport.lng,
      view,
      zoom: normalizedViewport.zoom,
    });

    if (!nextQuery) {
      setAppliedCenter(nextRegion);
      setCurrentViewport(normalizedViewport);
      setExecutedViewport(null);
      setExecutedClubMapQuery(null);
      setClubMapLastResultMeta(null);
      setPendingRegion(null);
      setShowSearchThisArea(false);
      setIsSubmittingRegionSearch(false);
      clubMapHasResolvedRef.current = false;
      lastCommittedClubMapQuerySignatureRef.current = '';
      persistSessionState({
        executedClubMapQuery: null,
        executedViewport: null,
        lastResultMeta: null,
        region: nextRegion,
        searchedViewport: null,
        selectedItemId: '',
        visibleViewport: normalizedViewport,
      });
      lastPersistedRegionRef.current = nextRegion;
      lastPersistedVisibleViewportRef.current = normalizedViewport;
      return;
    }

    if (
      nextQuerySignature
      && lastCommittedClubMapQuerySignatureRef.current === nextQuerySignature
      && areViewportsEquivalent(normalizedViewport, executedViewport)
    ) {
      setAppliedCenter(nextRegion);
      setCurrentViewport(normalizedViewport);
      setPendingRegion(null);
      setShowSearchThisArea(false);
      setIsSubmittingRegionSearch(false);
      persistSessionState({
        region: nextRegion,
        visibleViewport: normalizedViewport,
      });
      lastPersistedRegionRef.current = nextRegion;
      lastPersistedVisibleViewportRef.current = normalizedViewport;
      return;
    }

    setAppliedCenter(nextRegion);
    setCurrentViewport(normalizedViewport);
    setExecutedViewport(normalizedViewport);
    setExecutedClubMapQuery(nextQuery);
    setRenderStats(null);
    setSelectedMapItemId('');
    setPendingRegion(null);
    setShowSearchThisArea(false);
    setIsSubmittingRegionSearch(true);
    clubMapHasResolvedRef.current = false;
    lastCommittedClubMapQuerySignatureRef.current = nextQuerySignature;
    logClubMapLifecycle('CLUB_MAP_QUERY_STARTED', {
      north: nextQuery.north,
      q: nextQuery.q || '',
      south: nextQuery.south,
      view,
      zoom: nextQuery.zoom,
    });
    persistSessionState({
      executedClubMapQuery: nextQuery,
      executedViewport: normalizedViewport,
      region: nextRegion,
      searchedViewport: normalizedViewport,
      selectedItemId: '',
      visibleViewport: normalizedViewport,
    });
    lastPersistedRegionRef.current = nextRegion;
    lastPersistedVisibleViewportRef.current = normalizedViewport;
  }, [activeFilters, executedViewport, isClubScope, persistSessionState]);

  const eventConfig = useMemo(() => ({
    ...(eventFilters || {}),
    excludeType: 'Réservation',
    pageSize: 15,
    sessionStatus: 'open',
  }), [eventFilters]);

  const reservationConfig = useMemo(() => {
    const nextConfig = {
      ...(reservationFilters || {}),
      pageSize: 15,
    };
    if (!nextConfig.startDateAfter) {
      nextConfig.startDateAfter = new Date().toISOString();
    }
    return nextConfig;
  }, [reservationFilters]);

  const activeEventSearchText = typeof eventConfig?.q === 'string'
    ? eventConfig.q.trim()
    : '';
  const activeReservationSearchText = typeof reservationConfig?.q === 'string'
    ? reservationConfig.q.trim()
    : '';

  const isEventSmartSearchEnabled = activeEventSearchText.length >= 2;
  const isReservationSmartSearchEnabled = activeReservationSearchText.length >= 2;

  const eventQuery = useGetEvents(eventConfig, {
    enabled: !isClubScope && !isReservationScope && !isEventSmartSearchEnabled,
  });
  const searchedEventQuery = useSearchEvents({
    activity: eventConfig?.activity,
    category: eventConfig?.category,
    club: eventConfig?.club?.value || eventConfig?.club,
    excludeType: eventConfig?.excludeType,
    lat: eventConfig?.lat,
    level: eventConfig?.level,
    lon: eventConfig?.lon,
    pageSize: eventConfig?.pageSize || 15,
    q: activeEventSearchText,
    radius: eventConfig?.radius,
    sessionStatus: eventConfig?.sessionStatus,
    startDateAfter: eventConfig?.startDateAfter,
    startDateBefore: eventConfig?.startDateBefore,
    teamIds: eventConfig?.teamIds,
    type: eventConfig?.type,
  }, {
    enabled: !isClubScope && !isReservationScope && isEventSmartSearchEnabled,
  });

  const clubMapQuery = useSearchClubsMap(executedClubMapQuery || {}, {
    enabled: isClubScope && Boolean(executedClubMapQuery),
  });

  const reservationQuery = useGetReservations(reservationConfig, {
    enabled: isReservationScope && !isReservationSmartSearchEnabled,
  });
  const searchedReservationQuery = useSearchReservations({
    activity: reservationConfig?.activity || reservationConfig?.activitySlug,
    category: reservationConfig?.category,
    club: reservationConfig?.club,
    lat: reservationConfig?.lat,
    level: reservationConfig?.level,
    lon: reservationConfig?.lon,
    maxPricePerPerson: reservationConfig?.maxPricePerPerson || reservationConfig?.maxPrice,
    pageSize: reservationConfig?.pageSize || 15,
    q: activeReservationSearchText,
    radius: reservationConfig?.radius,
    reservationMode: reservationConfig?.reservationMode,
    startDateAfter: reservationConfig?.startDateAfter,
    startDateBefore: reservationConfig?.startDateBefore,
  }, {
    enabled: isReservationScope && isReservationSmartSearchEnabled,
  });

  const eventItems = useMemo(
    () => getActiveQueryItems(
      isEventSmartSearchEnabled,
      eventQuery,
      searchedEventQuery,
    ),
    [eventQuery, isEventSmartSearchEnabled, searchedEventQuery],
  );

  const clubItems = useMemo(
    () => clubMapQuery.data?.pages?.reduce(
      (acc, page) => acc.concat(mapSearchPayload(page)),
      [],
    ) || [],
    [clubMapQuery.data?.pages],
  );
  const clubMapMeta = clubMapQuery?.data?.pages?.[0]?.meta || null;

  const reservationItems = useMemo(
    () => getActiveQueryItems(
      isReservationSmartSearchEnabled,
      reservationQuery,
      searchedReservationQuery,
    ),
    [isReservationSmartSearchEnabled, reservationQuery, searchedReservationQuery],
  );

  let items = eventItems;
  if (isClubScope) {
    items = clubItems;
  } else if (isReservationScope) {
    items = reservationItems;
  }
  const mapItems = useMemo(() => toSearchMapItems(items, scope), [items, scope]);
  let totalCount = getActiveQueryTotalCount(
    isEventSmartSearchEnabled,
    eventQuery,
    searchedEventQuery,
  );
  if (isClubScope) {
    const clubTotalInBounds = Number(clubMapMeta?.totalInBounds);
    const clubPagedTotal = Number(clubMapMeta?.pagination?.total);
    if (Number.isFinite(clubTotalInBounds) && clubTotalInBounds > 0) {
      totalCount = clubTotalInBounds;
    } else if (Number.isFinite(clubPagedTotal) && clubPagedTotal > 0) {
      totalCount = clubPagedTotal;
    } else {
      totalCount = 0;
    }
  } else if (isReservationScope) {
    totalCount = getActiveQueryTotalCount(
      isReservationSmartSearchEnabled,
      reservationQuery,
      searchedReservationQuery,
    );
  }
  if (!totalCount) {
    totalCount = items.length;
  }
  let activeError = getActiveQueryError(
    isEventSmartSearchEnabled,
    eventQuery,
    searchedEventQuery,
  );
  if (isClubScope) {
    activeError = clubMapQuery.error;
  } else if (isReservationScope) {
    activeError = getActiveQueryError(
      isReservationSmartSearchEnabled,
      reservationQuery,
      searchedReservationQuery,
    );
  }

  let isLoading = getActiveQueryLoadingState(
    isEventSmartSearchEnabled,
    eventQuery,
    searchedEventQuery,
  );
  if (isClubScope) {
    isLoading = clubMapQuery.isLoading || clubMapQuery.isFetching;
  } else if (isReservationScope) {
    isLoading = getActiveQueryLoadingState(
      isReservationSmartSearchEnabled,
      reservationQuery,
      searchedReservationQuery,
    );
  }

  useEffect(() => {
    focusMetricsRef.current = {
      geolocatableCount: mapItems.length,
      totalCount,
    };
  }, [mapItems.length, totalCount]);

  useEffect(() => {
    clubMapRefetchRef.current = clubMapQuery.refetch;
  }, [clubMapQuery.refetch]);

  useEffect(() => {
    eventRefetchRef.current = eventQuery.refetch;
  }, [eventQuery.refetch]);

  useEffect(() => {
    searchedEventRefetchRef.current = searchedEventQuery.refetch;
  }, [searchedEventQuery.refetch]);

  useEffect(() => {
    reservationRefetchRef.current = reservationQuery.refetch;
  }, [reservationQuery.refetch]);

  useEffect(() => {
    searchedReservationRefetchRef.current = searchedReservationQuery.refetch;
  }, [searchedReservationQuery.refetch]);

  useEffect(() => {
    focusRefreshConfigRef.current = {
      hasClubQuery: Boolean(executedClubMapQuery),
      isClubScope,
      isEventSmartSearchEnabled,
      isReservationScope,
      isReservationSmartSearchEnabled,
      shouldRefetchClubMap: Boolean(executedClubMapQuery) && !clubMapQuery.isFetched,
    };
  }, [
    clubMapQuery.isFetched,
    executedClubMapQuery,
    isClubScope,
    isEventSmartSearchEnabled,
    isReservationScope,
    isReservationSmartSearchEnabled,
  ]);

  useEffect(() => {
    if (!selectedMapItemId || mapItems.some((item) => item.id === selectedMapItemId)) {
      return;
    }

    setSelectedMapItemId('');
    persistSessionState({ selectedItemId: '' });
  }, [mapItems, persistSessionState, selectedMapItemId]);

  useEffect(() => {
    if (!isLoading) {
      setIsSubmittingRegionSearch(false);
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isClubScope) {
      return;
    }

    if (clubMapQuery.isFetched && executedClubMapQuery) {
      clubMapHasResolvedRef.current = true;
    }

    const nextMeta = clubMapMeta;
    setClubMapLastResultMeta(nextMeta);
    const nextSignature = toStableJson(nextMeta || null);
    if (lastPersistedRegionMetaSignatureRef.current !== nextSignature) {
      persistSessionState({ lastResultMeta: nextMeta });
      lastPersistedRegionMetaSignatureRef.current = nextSignature;
    }

    if (nextMeta) {
      logClubMapLifecycle('CLUB_MAP_QUERY_RESOLVED', {
        queryMode: nextMeta.queryMode,
        returnedCount: nextMeta.returnedCount,
        totalInBounds: nextMeta.totalInBounds,
        truncated: nextMeta.truncated,
      });
    }
  }, [clubMapMeta, clubMapQuery.isFetched, executedClubMapQuery, isClubScope, persistSessionState]);

  useEffect(() => {
    if (!isClubScope) {
      return;
    }

    const nextSignature = toStableJson(renderStats || null);
    if (lastPersistedRenderStatsSignatureRef.current === nextSignature) {
      return;
    }

    persistSessionState({ lastRenderStats: renderStats || null });
    lastPersistedRenderStatsSignatureRef.current = nextSignature;
    logClubMapLifecycle('MAP_RENDER_STATS', renderStats || {});
  }, [isClubScope, persistSessionState, renderStats]);

  useEffect(() => {
    if (!isClubScope) {
      return;
    }

    logClubMapLifecycle('MAP_ITEMS_BUILT', {
      geolocatableCount: mapItems.length,
      totalCount,
    });
  }, [isClubScope, mapItems.length, totalCount]);

  useEffect(() => {
    if (!isClubScope || totalCount <= 0) {
      return undefined;
    }

    const visibleMarkerCount = Math.max(
      0,
      Number(renderStats?.markerCount || 0) + Number(renderStats?.clusterCount || 0),
    );

    if (visibleMarkerCount > 0 || isLoading) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      logClubMapLifecycle('MAP_RENDER_STALLED', {
        geolocatableCount: mapItems.length,
        totalCount,
        visibleMarkerCount,
      });
    }, 500);

    return () => clearTimeout(timeout);
  }, [isClubScope, isLoading, mapItems.length, renderStats, totalCount]);

  useEffect(() => {
    if (!isClubScope) {
      clubMapFilterSignatureRef.current = null;
      return;
    }

    const nextSignature = buildClubMapFilterSignature(activeFilters);
    if (clubMapFilterSignatureRef.current === null) {
      clubMapFilterSignatureRef.current = nextSignature;
      return;
    }

    if (clubMapFilterSignatureRef.current === nextSignature) {
      return;
    }

    clubMapFilterSignatureRef.current = nextSignature;

    if (shouldAutoSubmitViewportRef.current) {
      return;
    }

    const viewport = executedViewport || currentViewport;
    if (!viewport || !hasFiniteViewportBounds(viewport)) {
      return;
    }

    executeClubViewportSearch(viewport, 'map');
  }, [
    activeFilters,
    currentViewport,
    executeClubViewportSearch,
    executedViewport,
    isClubScope,
  ]);

  useEffect(() => {
    if (mapItems.length !== 1) {
      return;
    }

    const nextSelectedItemId = mapItems[0]?.id || '';
    if (!nextSelectedItemId || selectedMapItemId === nextSelectedItemId) {
      return;
    }

    setSelectedMapItemId(nextSelectedItemId);
    persistSessionState({ selectedItemId: nextSelectedItemId });
  }, [mapItems, persistSessionState, selectedMapItemId]);

  useFocusEffect(useCallback(() => {
    const { geolocatableCount, totalCount: loggedTotalCount } = focusMetricsRef.current;
    logger.info('search map opened', {
      geolocatableCount,
      scope,
      totalCount: loggedTotalCount,
    });

    let isCancelled = false;

    const refetchOnFocus = async () => {
      const focusRefreshConfig = focusRefreshConfigRef.current;

      try {
        if (focusRefreshConfig.isClubScope) {
          if (focusRefreshConfig.shouldRefetchClubMap && focusRefreshConfig.hasClubQuery) {
            await clubMapRefetchRef.current?.();
          }
          return;
        }

        if (focusRefreshConfig.isReservationScope) {
          await (
            focusRefreshConfig.isReservationSmartSearchEnabled
              ? searchedReservationRefetchRef.current?.()
              : reservationRefetchRef.current?.()
          );
          return;
        }

        await (
          focusRefreshConfig.isEventSmartSearchEnabled
            ? searchedEventRefetchRef.current?.()
            : eventRefetchRef.current?.()
        );
      } catch (error) {
        if (!isCancelled) {
          logger.warn('search map refetch failed on focus', {
            message: error?.message,
            scope,
          });
        }
      }
    };

    refetchOnFocus();

    return () => {
      isCancelled = true;
    };
  }, [scope]));

  const handleCloseMap = useCallback(() => {
    if (navigation.canGoBack()) {
      return navigation.goBack();
    }
    if (isClubScope) {
      return navigation.navigate(RouteNames.SearchClubs);
    }
    if (isReservationScope) {
      return navigation.navigate(RouteNames.SearchReservations);
    }
    return navigation.navigate(RouteNames.SearchEvents);
  }, [isClubScope, isReservationScope, navigation]);

  const handleShowList = useCallback(() => {
    if (!isClubScope) {
      handleCloseMap();
      return;
    }

    const viewport = currentViewport || executedViewport;
    const nextListQuery = buildClubMapViewportQuery(activeFilters, viewport, 'list');

    if (viewport && nextListQuery) {
      persistSessionState({
        executedClubMapQuery: nextListQuery,
        executedViewport: viewport,
        lastResultMeta: clubMapLastResultMeta,
        region: {
          lat: viewport.lat,
          lng: viewport.lng,
          zoom: viewport.zoom,
        },
        searchedViewport: viewport,
        selectedItemId: selectedMapItemId || '',
        visibleViewport: viewport,
      });
    }

    handleCloseMap();
  }, [
    activeFilters,
    clubMapLastResultMeta,
    currentViewport,
    executedViewport,
    handleCloseMap,
    isClubScope,
    persistSessionState,
    selectedMapItemId,
  ]);

  const handleOpenFilters = useCallback(() => {
    logger.info('search map filters opened', { scope });
    if (isClubScope) {
      return navigation.navigate(RouteNames.ClubStack, {
        screen: RouteNames.ClubFilters,
      });
    }
    if (isReservationScope) {
      return navigation.navigate(RouteNames.ReservationFilters);
    }
    return navigation.navigate(RouteNames.EventStack, {
      screen: RouteNames.EventFilters,
    });
  }, [isClubScope, isReservationScope, navigation, scope]);

  const handleAddressSelect = useCallback((nextAddress) => {
    setAddressSelection(nextAddress);
    const coordinates = parseAddressCoordinates(nextAddress);
    if (!coordinates) {
      return;
    }

    if (isClubScope) {
      const nextRegion = toRegionHintFromAddress(nextAddress) || {
        lat: coordinates.lat,
        lng: coordinates.lng,
        zoom: getAddressZoomHeuristic(nextAddress),
      };
      const derivedViewport = buildViewportFromRegionCandidate(nextRegion, mapAspectRatio);

      logClubMapLifecycle('ADDRESS_SELECTED', {
        bbox: parseAddressBbox(nextAddress),
        label: readLabel(nextAddress),
        lat: coordinates.lat,
        lng: coordinates.lng,
        type: nextAddress?.type,
        zoom: nextRegion.zoom,
      });

      dispatchFilters({
        ...activeFilters,
        city: nextAddress,
      });

      setSelectedMapItemId('');
      setRegionHint(nextRegion);
      setAppliedCenter(nextRegion);
      setPendingRegion(null);
      setShowSearchThisArea(false);
      persistSessionState({
        region: nextRegion,
        selectedItemId: '',
      });
      lastPersistedRegionRef.current = nextRegion;
      shouldAutoSubmitViewportRef.current = true;
      if (pendingAddressViewportTimeoutRef.current) {
        clearTimeout(pendingAddressViewportTimeoutRef.current);
      }
      pendingAddressViewportTimeoutRef.current = setTimeout(() => {
        if (!shouldAutoSubmitViewportRef.current) {
          pendingAddressViewportTimeoutRef.current = null;
          return;
        }

        shouldAutoSubmitViewportRef.current = false;
        if (derivedViewport && canSearchClubViewport(derivedViewport)) {
          executeClubViewportSearch(derivedViewport, 'map');
        }
        pendingAddressViewportTimeoutRef.current = null;
      }, 300);
      return;
    }

    const radius = Number(activeFilters?.radius || DEFAULT_RADIUS);
    const nextRegion = {
      lat: coordinates.lat,
      lng: coordinates.lng,
      zoom: 12,
    };

    dispatchFilters({
      ...activeFilters,
      city: nextAddress,
      geohash: getGeohashForPointAndRadius(
        coordinates.lat,
        coordinates.lng,
        radius,
      ),
      lat: coordinates.lat,
      lon: coordinates.lng,
      radius,
      zoom: 12,
    });

    setSelectedMapItemId('');
    setRegionHint(nextRegion);
    setAppliedCenter(nextRegion);
    setPendingRegion(null);
    setShowSearchThisArea(false);
    setIsSubmittingRegionSearch(true);
    persistSessionState({
      region: nextRegion,
      selectedItemId: '',
    });
    lastPersistedRegionRef.current = nextRegion;
  }, [
    activeFilters,
    dispatchFilters,
    executeClubViewportSearch,
    getGeohashForPointAndRadius,
    isClubScope,
    mapAspectRatio,
    persistSessionState,
  ]);

  const handleRegionChangeComplete = useCallback((nextRegion) => {
    if (!nextRegion || !Number.isFinite(nextRegion.lat) || !Number.isFinite(nextRegion.lng)) {
      return;
    }

    persistViewportRegion(nextRegion);

    if (isClubScope) {
      if (!hasFiniteViewportBounds(nextRegion)) {
        return;
      }

      const nextViewport = {
        east: Number(nextRegion.east),
        lat: Number(nextRegion.lat),
        latitudeDelta: Number.isFinite(Number(nextRegion.latitudeDelta))
          ? Number(nextRegion.latitudeDelta)
          : undefined,
        lng: Number(nextRegion.lng),
        longitudeDelta: Number.isFinite(Number(nextRegion.longitudeDelta))
          ? Number(nextRegion.longitudeDelta)
          : undefined,
        north: Number(nextRegion.north),
        south: Number(nextRegion.south),
        west: Number(nextRegion.west),
        zoom: resolveViewportZoom(nextRegion),
      };

      setCurrentViewport(nextViewport);
      persistVisibleViewport(nextViewport);
      logClubMapLifecycle('MAP_REGION_APPLIED', {
        lat: nextViewport.lat,
        lng: nextViewport.lng,
        zoom: nextViewport.zoom,
      });

      if (shouldAutoSubmitViewportRef.current) {
        shouldAutoSubmitViewportRef.current = false;
        if (pendingAddressViewportTimeoutRef.current) {
          clearTimeout(pendingAddressViewportTimeoutRef.current);
          pendingAddressViewportTimeoutRef.current = null;
        }
        if (canSearchClubViewport(nextViewport)) {
          executeClubViewportSearch(nextViewport, 'map');
        } else {
          setPendingRegion(null);
          setShowSearchThisArea(false);
        }
        return;
      }

      if (isBootstrappingClubViewportRef.current && !executedViewport) {
        isBootstrappingClubViewportRef.current = false;
        if (canSearchClubViewport(nextViewport)) {
          executeClubViewportSearch(nextViewport, 'map');
        }
        return;
      }

      if (!executedViewport) {
        setPendingRegion(null);
        setShowSearchThisArea(false);
        return;
      }

      if (!canSearchClubViewport(nextViewport)) {
        setPendingRegion(null);
        setShowSearchThisArea(false);
        return;
      }

      if (hasMeaningfulViewportMove(nextViewport, executedViewport)) {
        setPendingRegion(nextViewport);
        setShowSearchThisArea(true);
        return;
      }

      setPendingRegion(null);
      setShowSearchThisArea(false);
      return;
    }

    if (!hasMeaningfulMove(nextRegion, appliedCenter)) {
      setPendingRegion(null);
      setShowSearchThisArea(false);
      return;
    }

    setPendingRegion(nextRegion);
    setShowSearchThisArea(true);
  }, [
    appliedCenter,
    executeClubViewportSearch,
    executedViewport,
    isClubScope,
    persistViewportRegion,
    persistVisibleViewport,
  ]);

  const handleSearchThisArea = useCallback(() => {
    if (!pendingRegion) {
      return;
    }

    if (isClubScope) {
      logClubMapLifecycle('SEARCH_THIS_AREA_TRIGGERED', {
        lat: pendingRegion.lat,
        lng: pendingRegion.lng,
        zoom: pendingRegion.zoom,
      });
      executeClubViewportSearch(pendingRegion, 'map');
      return;
    }

    const radius = Number(activeFilters?.radius || DEFAULT_RADIUS);
    const nextRegion = {
      lat: pendingRegion.lat,
      lng: pendingRegion.lng,
      zoom: pendingRegion.zoom,
    };

    dispatchFilters({
      ...activeFilters,
      geohash: getGeohashForPointAndRadius(
        pendingRegion.lat,
        pendingRegion.lng,
        radius,
      ),
      lat: pendingRegion.lat,
      lon: pendingRegion.lng,
      radius,
      zoom: pendingRegion.zoom,
    });

    setSelectedMapItemId('');
    setRegionHint(nextRegion);
    setAppliedCenter(nextRegion);
    setPendingRegion(null);
    setShowSearchThisArea(false);
    setIsSubmittingRegionSearch(true);
    persistSessionState({
      region: nextRegion,
      selectedItemId: '',
    });
    lastPersistedRegionRef.current = nextRegion;
  }, [
    activeFilters,
    dispatchFilters,
    executeClubViewportSearch,
    getGeohashForPointAndRadius,
    isClubScope,
    pendingRegion,
    persistSessionState,
  ]);

  const handleOpenItem = useCallback((item) => {
    const rawItem = item?.raw;
    logger.info('search map item opened', {
      itemId: item?.id,
      scope,
    });

    navigateToSearchMapDetail({
      isAuthenticated,
      navigation,
      rawItem,
      scope,
    });
  }, [isAuthenticated, navigation, scope]);

  const handleSelectMapItem = useCallback((itemId) => {
    setSelectedMapItemId(itemId);
    persistSessionState({ selectedItemId: itemId });
  }, [persistSessionState]);

  const handleMapRenderStats = useCallback((nextStats) => {
    setRenderStats(nextStats || null);
  }, []);

  const filterChips = useMemo(() => buildChips(scope, activeFilters), [activeFilters, scope]);
  const hasActiveFilters = filterChips.length > 0;
  const title = t(`search.map.heading.${scope}`, getMapHeading(scope));
  const mapHeight = Math.max(480, viewportHeight - insets.top - insets.bottom - 24);
  const mapAspectRatio = Math.max(0.42, Math.min(1.15, viewportWidth / mapHeight));
  const searchAreaTop = topOverlayHeight + 14;
  const mapHudTop = topOverlayHeight + topBannerHeight + 24;
  const overlayInsets = useMemo(() => ({
    bottom: Math.max(156, insets.bottom + 142),
    left: 28,
    right: 156,
    top: Math.max(120, mapHudTop + 74),
  }), [insets.bottom, mapHudTop]);
  const shouldSuspendMapForSearch = Platform.OS === 'android' && isAddressSearchActive;
  const shouldDisableGlassBlur = Platform.OS === 'android';
  const shouldShowClubZoomHint = isClubScope
    && currentViewport
    && !canSearchClubViewport(currentViewport)
    && !showSearchThisArea
    && !isLoading
    && !activeError;
  const shouldShowClubTruncatedHint = isClubScope
    && Boolean(clubMapMeta?.truncated)
    && !showSearchThisArea
    && !isLoading
    && !activeError
    && !shouldShowClubZoomHint;

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.fill,
        styles.screenContent,
        { paddingBottom: insets.bottom + 8 },
      ]}
      style={[styles.screenRoot, { paddingTop: insets.top + 8 }]}
      withHeaderPadding={false}
    >
      <View style={styles.mapStage}>
        <View style={[styles.mapFrame, { paddingBottom: insets.bottom + 8 }]}>
          {shouldSuspendMapForSearch ? (
            <View style={[styles.mapPausePlaceholder, { height: mapHeight }]}>
              <View style={styles.mapPauseVeil} />
            </View>
          ) : (
            <SearchMap
              height={mapHeight}
              isLoadingResults={Boolean(isLoading || isSubmittingRegionSearch)}
              items={mapItems}
              onOpenItem={handleOpenItem}
              onRegionChangeComplete={handleRegionChangeComplete}
              onRenderStats={handleMapRenderStats}
              onSelectItem={handleSelectMapItem}
              onShowList={handleShowList}
              overlayInsets={overlayInsets}
              previewBottomOffset={insets.bottom + 12}
              regionHint={regionHint}
              scope={scope}
              selectedItemId={selectedMapItemId}
              topMargin={mapHudTop}
              totalCount={totalCount}
              truncated={Boolean(clubMapMeta?.truncated)}
            />
          )}
        </View>

        <View
          onLayout={(event) => setTopOverlayHeight(event.nativeEvent.layout.height)}
          pointerEvents="box-none"
          style={styles.topOverlayHost}
        >
          <View style={styles.topOverlayStack}>
            <GlassSurface
              blurAmount={18}
              borderColor="rgba(255,255,255,0.08)"
              borderRadius={24}
              disableBlur={shouldDisableGlassBlur}
              fallbackColor="rgba(7, 22, 33, 0.76)"
              style={ApplicationStyle.shadow200}
              tintColor="rgba(7, 26, 37, 0.24)"
              topHighlightColor="rgba(255,255,255,0.04)"
              topHighlightHeight={1}
            >
              <View style={styles.headerSurface}>
                <View
                  style={[
                    Alignments.row,
                    Alignments.alignCenter,
                    Alignments.justifySpaceBetween,
                    Spaces.gap[12],
                  ]}
                >
                  <View
                    style={[
                      Alignments.row,
                      Alignments.alignCenter,
                      Spaces.gap[12],
                      styles.headerMain,
                    ]}
                  >
                    <HeaderBackButton
                      onPress={handleCloseMap}
                      style={styles.backButton}
                      withDefaultMargin={false}
                    />
                    <Text numberOfLines={1} style={[Fonts.h3Bold, Fonts.neutral00, styles.headerTitle]}>
                      {title}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleShowList}
                    style={[styles.headerAction, {
                      borderColor: `${Colors.primary500}36`,
                    }]}
                  >
                    <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
                      Liste
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </GlassSurface>

            <GlassSurface
              blurAmount={16}
              borderColor="rgba(255,255,255,0.07)"
              borderRadius={22}
              disableBlur={shouldDisableGlassBlur}
              fallbackColor="rgba(7, 22, 33, 0.72)"
              style={ApplicationStyle.shadow200}
              tintColor="rgba(7, 26, 37, 0.22)"
              topHighlightColor="rgba(255,255,255,0.03)"
              topHighlightHeight={1}
            >
              <View style={styles.searchSurface}>
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[10]]}>
                  <View style={styles.searchIconBadge}>
                    <Image
                      source={Images.search}
                      style={styles.searchIcon}
                    />
                  </View>
                  <View style={styles.searchSlot}>
                    <AutocompleteAddressInput
                      address={addressSelection}
                      label=""
                      lightMode
                      onBlur={() => setIsAddressSearchActive(false)}
                      onFocus={() => setIsAddressSearchActive(true)}
                      placeholder={t('search.map.addressPlaceholder', 'Tapez une adresse ou une ville')}
                      setAddress={handleAddressSelect}
                      wrapperStyle={styles.searchInputWrapper}
                    />
                  </View>
                </View>
              </View>
            </GlassSurface>

            <ScrollView
              contentContainerStyle={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleOpenFilters}
                style={[styles.filterActionChip, ApplicationStyle.shadow200, {
                  borderColor: `${Colors.primary500}40`,
                }]}
              >
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                  <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
                    Filtres
                  </Text>
                  {hasActiveFilters ? (
                    <View style={styles.filterCountBadge}>
                      <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                        {filterChips.length}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>

              {hasActiveFilters ? filterChips.map((chip) => (
                <View
                  key={chip}
                  style={[styles.filterChip, ApplicationStyle.shadow200, {
                    borderColor: 'rgba(255,255,255,0.1)',
                  }]}
                >
                  <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral00]}>
                    {chip}
                  </Text>
                </View>
              )) : null}
            </ScrollView>
          </View>
        </View>

        <View
          onLayout={(event) => setTopBannerHeight(event.nativeEvent.layout.height)}
          pointerEvents="box-none"
          style={[styles.mapTopBannerHost, { top: searchAreaTop }]}
        >
          {showSearchThisArea ? (
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={isSubmittingRegionSearch}
              onPress={handleSearchThisArea}
              style={[
                styles.primaryFloatingAction,
                ApplicationStyle.shadow200,
                {
                  backgroundColor: isSubmittingRegionSearch
                    ? 'rgba(1, 179, 244, 0.66)'
                    : Colors.primary500,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.primary900 }]}>
                {getSearchMapSearchAreaLabel(isSubmittingRegionSearch)}
              </Text>
            </TouchableOpacity>
          ) : null}

          {isLoading && !activeError && !showSearchThisArea ? (
            <View
              pointerEvents="none"
              style={[styles.statusPill, ApplicationStyle.shadow200]}
            >
              <Text style={[Fonts.p4, Fonts.neutral00]}>
                {getSearchMapUpdatingResultsCopy()}
              </Text>
            </View>
          ) : null}

          {shouldShowClubZoomHint ? (
            <View
              pointerEvents="none"
              style={[styles.statusPill, ApplicationStyle.shadow200]}
            >
              <Text style={[Fonts.p4, Fonts.neutral00]}>
                Zoomez ou recherchez une ville pour afficher les clubs.
              </Text>
            </View>
          ) : null}

          {shouldShowClubTruncatedHint ? (
            <View
              pointerEvents="none"
              style={[styles.statusPill, ApplicationStyle.shadow200]}
            >
              <Text style={[Fonts.p4, Fonts.neutral00]}>
                Zoomez pour afficher tous les clubs de cette zone.
              </Text>
            </View>
          ) : null}

          {activeError ? (
            <View
              style={[
                styles.errorBanner,
                ApplicationStyle.shadow200,
                { borderColor: `${Colors.error500}33` },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
                Recherche indisponible
              </Text>
              <Text style={[Fonts.p4, Fonts.neutral200, Spaces.marginTop[6]]}>
                {activeError?.message || getUnavailableMessage(scope)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: {
    backgroundColor: 'rgba(8, 31, 44, 0.44)',
    padding: 8,
  },
  errorBanner: {
    backgroundColor: 'rgba(32, 14, 17, 0.94)',
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 364,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
  },
  filterActionChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 31, 44, 0.68)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterChip: {
    backgroundColor: 'rgba(8, 31, 44, 0.52)',
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 180,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipMuted: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterCountBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(1, 179, 244, 0.14)',
    borderColor: 'rgba(1, 179, 244, 0.22)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  headerAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 31, 44, 0.4)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 92,
    paddingHorizontal: 14,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  headerSurface: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerTitle: {
    flex: 1,
  },
  mapFrame: {
    flex: 1,
    paddingHorizontal: 16,
  },
  mapPausePlaceholder: {
    backgroundColor: '#071621',
    borderRadius: 24,
    overflow: 'hidden',
  },
  mapPauseVeil: {
    backgroundColor: 'rgba(6, 24, 34, 0.92)',
    flex: 1,
  },
  mapStage: {
    flex: 1,
    position: 'relative',
  },
  mapTopBannerHost: {
    alignItems: 'center',
    gap: 12,
    left: 16,
    position: 'absolute',
    right: 16,
  },
  primaryFloatingAction: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  screenContent: {
    paddingHorizontal: 0,
  },
  screenRoot: {
    paddingHorizontal: 0,
  },
  searchIcon: {
    height: 18,
    tintColor: 'rgba(255,255,255,0.78)',
    width: 18,
  },
  searchIconBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  searchInputWrapper: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    marginBottom: 0,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  searchSlot: {
    flex: 1,
    marginTop: 0,
  },
  searchSurface: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusPill: {
    backgroundColor: 'rgba(6, 24, 34, 0.9)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 12,
    maxWidth: 260,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topOverlayHost: {
    left: 16,
    position: 'absolute',
    right: 16,
    top: 0,
  },
  topOverlayStack: {
    gap: 10,
  },
});

export default SearchMapScreen;
