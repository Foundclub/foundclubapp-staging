/* eslint-disable consistent-return */

import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
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

import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import SearchMap from '@/components/organisms/searchMap/SearchMap';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useGetClubs,
} from '@/services/club/clubQueries';
import { useGetEvents } from '@/services/event/eventQueries';
import { useGetReservations } from '@/services/reservation/reservationQueries';
import {
  useSearchClubs,
  useSearchEvents,
  useSearchReservations,
} from '@/services/search/searchQueries';
import { mapSearchPayload } from '@/services/search/searchService';

import { createLogger } from '@/utils/logger/logger';
import { toSearchMapItems } from '@/utils/searchMap';

import {
  getSearchMapActiveFiltersSummary,
  getSearchMapAddressHint,
  getSearchMapSearchAreaLabel,
  getSearchMapSubtitle,
  getSearchMapTitle,
  getSearchMapUpdatingResultsCopy,
} from '@/platform/maps/searchMapCopy';
import { navigateToSearchMapDetail } from '@/platform/maps/searchMapDetailNavigation';

const logger = createLogger('search-map-screen');
const DEFAULT_RADIUS = 20;
const MOVE_THRESHOLD = 0.005;

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
  if (!address?.value || typeof address.value !== 'string') return null;
  const [lngRaw, latRaw] = address.value.split('|');
  const lat = Number.parseFloat(latRaw);
  const lng = Number.parseFloat(lngRaw);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

const parseFilterCoordinates = (filters) => {
  const lat = Number.parseFloat(String(filters?.lat ?? ''));
  const lng = Number.parseFloat(String(filters?.lon ?? ''));
  const zoom = Number.parseFloat(String(filters?.zoom ?? ''));
  return Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng, zoom: Number.isFinite(zoom) ? zoom : undefined }
    : null;
};

const hasMeaningfulMove = (nextRegion, appliedCenter) => (
  !!nextRegion
  && !!appliedCenter
  && (
    Math.abs(nextRegion.lat - appliedCenter.lat) >= MOVE_THRESHOLD
    || Math.abs(nextRegion.lng - appliedCenter.lng) >= MOVE_THRESHOLD
  )
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

const getUnavailableMessage = (scope) => {
  if (scope === 'clubs') {
    return 'Impossible de mettre à jour les clubs pour le moment.';
  }

  if (scope === 'reservations') {
    return 'Impossible de mettre à jour les réservations pour le moment.';
  }

  return 'Impossible de mettre à jour les événements pour le moment.';
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
  const { height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
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

  const [chromeHeight, setChromeHeight] = useState(0);
  const [addressSelection, setAddressSelection] = useState(undefined);
  const [appliedCenter, setAppliedCenter] = useState(null);
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
  const [selectedMapItemId, setSelectedMapItemId] = useState(
    persistedSession?.selectedItemId || '',
  );
  const [regionHint, setRegionHint] = useState(persistedSession?.region || null);

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
    setSelectedMapItemId(persistedSession?.selectedItemId || '');
    setRegionHint(persistedSession?.region || null);
  }, [persistedSession?.region, persistedSession?.selectedItemId]);

  useEffect(() => {
    setAddressSelection(activeFilters?.city || undefined);
    const directRegion = parseFilterCoordinates(activeFilters);
    const addressRegion = parseAddressCoordinates(activeFilters?.city);
    const nextRegion = directRegion
      || (addressRegion ? { ...addressRegion, zoom: 12 } : persistedSession?.region || null);

    setAppliedCenter(nextRegion);
    setRegionHint(nextRegion);
    setPendingRegion(null);
    setShowSearchThisArea(false);
  }, [activeFilters, persistedSession?.region]);

  const eventConfig = useMemo(() => ({
    ...(eventFilters || {}),
    excludeType: 'Réservation',
    pageSize: 15,
    sessionStatus: 'open',
  }), [eventFilters]);

  const clubConfig = useMemo(() => ({
    ...(clubFilters || {}),
    pageSize: 30,
  }), [clubFilters]);

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
  const activeClubSearchText = typeof clubConfig?.name === 'string'
    ? clubConfig.name.trim()
    : '';
  const activeReservationSearchText = typeof reservationConfig?.q === 'string'
    ? reservationConfig.q.trim()
    : '';

  const isEventSmartSearchEnabled = activeEventSearchText.length >= 2;
  const isClubSmartSearchEnabled = activeClubSearchText.length >= 2;
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

  const clubQuery = useGetClubs(clubConfig, {
    enabled: isClubScope && !isClubSmartSearchEnabled,
  });
  const searchedClubQuery = useSearchClubs({
    activity: clubConfig?.activity,
    lat: clubConfig?.lat,
    lon: clubConfig?.lon,
    pageSize: clubConfig?.pageSize || 30,
    q: activeClubSearchText,
    radius: clubConfig?.radius,
  }, {
    enabled: isClubScope && isClubSmartSearchEnabled,
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
    () => getActiveQueryItems(
      isClubSmartSearchEnabled,
      clubQuery,
      searchedClubQuery,
    ),
    [clubQuery, isClubSmartSearchEnabled, searchedClubQuery],
  );

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
  const totalCount = items.length;
  let activeError = getActiveQueryError(
    isEventSmartSearchEnabled,
    eventQuery,
    searchedEventQuery,
  );
  if (isClubScope) {
    activeError = getActiveQueryError(
      isClubSmartSearchEnabled,
      clubQuery,
      searchedClubQuery,
    );
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
    isLoading = getActiveQueryLoadingState(
      isClubSmartSearchEnabled,
      clubQuery,
      searchedClubQuery,
    );
  } else if (isReservationScope) {
    isLoading = getActiveQueryLoadingState(
      isReservationSmartSearchEnabled,
      reservationQuery,
      searchedReservationQuery,
    );
  }

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
    logger.info('search map opened', {
      geolocatableCount: mapItems.length,
      scope,
      totalCount,
    });

    let isCancelled = false;

    const refetchOnFocus = async () => {
      try {
        if (isClubScope) {
          await (
            isClubSmartSearchEnabled
              ? searchedClubQuery.refetch()
              : clubQuery.refetch()
          );
          return;
        }

        if (isReservationScope) {
          await (
            isReservationSmartSearchEnabled
              ? searchedReservationQuery.refetch()
              : reservationQuery.refetch()
          );
          return;
        }

        await (
          isEventSmartSearchEnabled
            ? searchedEventQuery.refetch()
            : eventQuery.refetch()
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
  }, [
    clubQuery,
    eventQuery,
    isClubScope,
    isClubSmartSearchEnabled,
    isEventSmartSearchEnabled,
    isReservationScope,
    isReservationSmartSearchEnabled,
    mapItems.length,
    reservationQuery,
    scope,
    searchedClubQuery,
    searchedEventQuery,
    searchedReservationQuery,
    totalCount,
  ]));

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
  }, [
    activeFilters,
    dispatchFilters,
    getGeohashForPointAndRadius,
    persistSessionState,
  ]);

  const handleRegionChangeComplete = useCallback((nextRegion) => {
    if (!nextRegion || !Number.isFinite(nextRegion.lat) || !Number.isFinite(nextRegion.lng)) {
      return;
    }

    persistSessionState({
      region: nextRegion,
      selectedItemId: selectedMapItemId,
    });

    if (!hasMeaningfulMove(nextRegion, appliedCenter)) {
      setPendingRegion(null);
      setShowSearchThisArea(false);
      return;
    }

    setPendingRegion(nextRegion);
    setShowSearchThisArea(true);
  }, [appliedCenter, persistSessionState, selectedMapItemId]);

  const handleSearchThisArea = useCallback(() => {
    if (!pendingRegion) {
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
  }, [
    activeFilters,
    dispatchFilters,
    getGeohashForPointAndRadius,
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

  const filterChips = useMemo(() => buildChips(scope, activeFilters), [activeFilters, scope]);
  const visibleFilterChips = useMemo(() => filterChips.slice(0, 4), [filterChips]);
  const hiddenFilterChipCount = Math.max(0, filterChips.length - visibleFilterChips.length);
  const title = t(`search.map.title.${scope}`, getSearchMapTitle(scope));
  const subtitle = t(`search.map.subtitle.${scope}`, getSearchMapSubtitle(scope));
  const activeFiltersSummary = getSearchMapActiveFiltersSummary(
    filterChips.length,
    mapItems.length,
  );
  const mapHeight = Math.max(440, viewportHeight - chromeHeight - insets.bottom - 20);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.fill,
        styles.screenContent,
        { paddingBottom: insets.bottom + 12 },
      ]}
      style={[styles.screenRoot, { paddingTop: insets.top + 12 }]}
      withHeaderPadding={false}
    >
      <View
        onLayout={(event) => setChromeHeight(event.nativeEvent.layout.height)}
        style={[styles.topSheet, ApplicationStyle.shadow200, Spaces.gap[18], Spaces.marginBottom[16]]}
      >
        <View
          style={[
            Alignments.row,
            Alignments.alignStart,
            Alignments.justifySpaceBetween,
            Spaces.gap[16],
          ]}
        >
          <View
            style={[
              Alignments.row,
              Alignments.alignStart,
              Spaces.gap[14],
              styles.headerMain,
            ]}
          >
            <HeaderBackButton onPress={handleCloseMap} withDefaultMargin={false} />
            <View style={[Spaces.gap[6], Alignments.grow1]}>
              <Text numberOfLines={2} style={[Fonts.h3Bold, Fonts.neutral00]}>
                {title}
              </Text>
              <Text style={[Fonts.p4, Fonts.neutral200]}>
                {subtitle}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleCloseMap}
            style={[styles.headerAction, ApplicationStyle.shadow200, {
              borderColor: `${Colors.primary500}4D`,
            }]}
          >
            <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
              Voir la liste
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
            Rechercher une adresse
          </Text>
          <Text style={[Fonts.p4, Fonts.neutral200]}>
            {getSearchMapAddressHint()}
          </Text>
          <AutocompleteAddressInput
            address={addressSelection}
            label=""
            placeholder={t('search.map.addressPlaceholder', 'Tapez une adresse ou une ville')}
            setAddress={handleAddressSelect}
            wrapperStyle={{ marginBottom: 0 }}
          />
        </View>

        <View style={[Spaces.gap[12]]}>
          <View
            style={[
              Alignments.row,
              Alignments.alignStart,
              Alignments.justifySpaceBetween,
              Spaces.gap[12],
            ]}
          >
            <View style={[Spaces.gap[6], Alignments.grow1]}>
              <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
                {t('search.map.activeFilters', 'Filtres actifs')}
              </Text>
              <Text style={[Fonts.p4, Fonts.neutral200]}>
                {filterChips.length > 0
                  ? activeFiltersSummary
                  : t('search.map.noFilters', 'Aucun filtre supplémentaire actif')}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleOpenFilters}
              style={[styles.secondaryPill, {
                borderColor: `${Colors.primary500}44`,
              }]}
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
                Modifier
              </Text>
            </TouchableOpacity>
          </View>

          {visibleFilterChips.length > 0 ? (
            <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
              {visibleFilterChips.map((chip) => (
                <View
                  key={chip}
                  style={[styles.filterChip, {
                    borderColor: `${Colors.primary500}2E`,
                  }]}
                >
                  <Text style={[Fonts.p4, Fonts.neutral00]}>
                    {chip}
                  </Text>
                </View>
              ))}

              {hiddenFilterChipCount > 0 ? (
                <View
                  style={[styles.filterChip, styles.filterChipMuted, {
                    borderColor: 'rgba(255,255,255,0.12)',
                  }]}
                >
                  <Text style={[Fonts.p4Bold, Fonts.neutral200]}>
                    {`+${hiddenFilterChipCount}`}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.mapStage}>
        <SearchMap
          height={mapHeight}
          items={mapItems}
          onOpenItem={handleOpenItem}
          onRegionChangeComplete={handleRegionChangeComplete}
          onSelectItem={handleSelectMapItem}
          onShowList={handleCloseMap}
          previewBottomOffset={insets.bottom + 18}
          regionHint={regionHint}
          scope={scope}
          selectedItemId={selectedMapItemId}
          topMargin={0}
          totalCount={totalCount}
        />

        <View pointerEvents="box-none" style={styles.mapTopBannerHost}>
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

          {isLoading && !activeError ? (
            <View
              pointerEvents="none"
              style={[styles.statusPill, ApplicationStyle.shadow200]}
            >
              <Text style={[Fonts.p4, Fonts.neutral00]}>
                {getSearchMapUpdatingResultsCopy()}
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
  errorBanner: {
    backgroundColor: 'rgba(32, 14, 17, 0.94)',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 12,
    maxWidth: 364,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
  },
  filterChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipMuted: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  headerAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(8, 31, 44, 0.96)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: 120,
    paddingHorizontal: 18,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  mapStage: {
    flex: 1,
    position: 'relative',
  },
  mapTopBannerHost: {
    alignItems: 'center',
    left: 0,
    paddingHorizontal: 18,
    position: 'absolute',
    right: 0,
    top: 14,
  },
  primaryFloatingAction: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  screenContent: {
    paddingHorizontal: 14,
  },
  screenRoot: {
    paddingHorizontal: 0,
  },
  secondaryPill: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 112,
    paddingHorizontal: 14,
  },
  statusPill: {
    backgroundColor: 'rgba(6, 24, 34, 0.9)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topSheet: {
    backgroundColor: 'rgba(6, 24, 34, 0.92)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
});

export default SearchMapScreen;
