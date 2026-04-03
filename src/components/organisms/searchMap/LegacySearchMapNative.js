import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ClusteredMapView from 'react-native-map-clustering';
import { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import useTheme from '@/theme/themeContext';

import SearchMapPreviewCard from '@/components/molecules/searchMapPreviewCard/SearchMapPreviewCard';
import SearchMapHud from '@/components/organisms/searchMap/SearchMapHud';

import { createLogger } from '@/utils/logger/logger';
import {
  buildSearchMapRegion,
  getSearchMapEmptyMessage,
} from '@/utils/searchMap';

import { requestCurrentSearchMapLocation } from '@/platform/maps/searchMapGeolocation';

const FALLBACK_REGION = buildSearchMapRegion([]);
const MAP_LOAD_TIMEOUT_MS = 6500;
const searchMapLogger = createLogger('search-map');

/**
 * @param {number} latitude
 * @param {number} longitude
 */
const buildFocusedRegion = (latitude, longitude) => ({
  latitude,
  latitudeDelta: 0.025,
  longitude,
  longitudeDelta: 0.025,
});

const scaleRegionDeltas = (region, factor) => ({
  ...region,
  latitudeDelta: Math.max(0.002, region.latitudeDelta * factor),
  longitudeDelta: Math.max(0.002, region.longitudeDelta * factor),
});

const buildRegionBounds = (region) => ({
  east: region.longitude + (region.longitudeDelta / 2),
  north: region.latitude + (region.latitudeDelta / 2),
  south: region.latitude - (region.latitudeDelta / 2),
  west: region.longitude - (region.longitudeDelta / 2),
});

const estimateZoomFromRegion = (region) => {
  const longitudeDelta = Number(region?.longitudeDelta);
  if (!Number.isFinite(longitudeDelta) || longitudeDelta <= 0) {
    return undefined;
  }

  return Math.max(1, Math.min(20, Math.round(Math.log2(360 / longitudeDelta))));
};

const resolveOverlayInsets = (overlayInsets, previewBottomOffset) => ({
  bottom: Math.max(130, Number(overlayInsets?.bottom) || (previewBottomOffset + 120)),
  left: Math.max(40, Number(overlayInsets?.left) || 56),
  right: Math.max(40, Number(overlayInsets?.right) || 56),
  top: Math.max(72, Number(overlayInsets?.top) || 84),
});

/**
 * @param {object} props
 * @param {import('@/utils/searchMap').SearchMapItem[]} [props.items]
 * @param {boolean} [props.isLoadingResults]
 * @param {(item: import('@/utils/searchMap').SearchMapItem) => void} [props.onOpenItem]
 * @param {() => void} [props.onShowList]
 * @param {(itemId: string) => void} [props.onSelectItem]
 * @param {() => void} [props.onLocateMe]
 * @param {(stats: { renderableCount?: number, markerCount?: number, clusterCount?: number }) => void} [props.onRenderStats]
 * @param {(region: {
 *  lat: number;
 *  lng: number;
 *  latitudeDelta?: number;
 *  longitudeDelta?: number;
 *  north?: number;
 *  south?: number;
 *  east?: number;
 *  west?: number;
 *  zoom?: number;
 * }) => void} [props.onRegionChangeComplete]
 * @param {{ top?: number, right?: number, bottom?: number, left?: number } | null} [props.overlayInsets]
 * @param {{
 *  lat: number;
 *  lng: number;
 *  zoom?: number;
 *  north?: number;
 *  south?: number;
 *  east?: number;
 *  west?: number;
 *  latitudeDelta?: number;
 *  longitudeDelta?: number;
 * } | null} [props.regionHint]
 * @param {'events' | 'clubs' | 'reservations'} [props.scope]
 * @param {string} [props.selectedItemId]
 * @param {number} [props.height]
 * @param {number} [props.previewBottomOffset]
 * @param {number} [props.topMargin]
 * @param {number} [props.totalCount]
 * @param {boolean} [props.truncated]
 * @returns {import('react').ReactElement}
 */
function LegacySearchMapNative({
  height = 360,
  isLoadingResults = false,
  items = [],
  onLocateMe,
  onOpenItem,
  onRegionChangeComplete,
  onRenderStats,
  onSelectItem,
  onShowList,
  overlayInsets = null,
  previewBottomOffset = 12,
  regionHint = null,
  scope = 'events',
  selectedItemId,
  topMargin = 12,
  totalCount = 0,
  truncated = false,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
  } = useTheme();
  const mapRef = useRef(/** @type {any} */ (null));
  const mapLoadStartedAtRef = useRef(Date.now());
  const [internalSelectedItemId, setInternalSelectedItemId] = useState('');
  const [isLocatePending, setIsLocatePending] = useState(false);
  const [mapRenderKey, setMapRenderKey] = useState(0);
  const [mapStatus, setMapStatus] = useState('loading');
  const [region, setRegion] = useState(FALLBACK_REGION);
  const [showsUserLocation, setShowsUserLocation] = useState(false);

  const isClubScope = scope === 'clubs';
  const markerColor = isClubScope ? Colors.warning500 : Colors.primary500;
  const activeSelectedItemId = selectedItemId ?? internalSelectedItemId;
  const isMapReady = mapStatus === 'ready';
  const areControlsDisabled = !isMapReady;

  const selectedItem = useMemo(
    () => items.find((item) => item.id === activeSelectedItemId) || null,
    [activeSelectedItemId, items],
  );
  const resolvedOverlayInsets = useMemo(
    () => resolveOverlayInsets(overlayInsets, previewBottomOffset),
    [overlayInsets, previewBottomOffset],
  );
  const totalResults = Number.isFinite(totalCount) && totalCount > 0 ? totalCount : items.length;
  const logContext = useMemo(() => ({
    geolocatableCount: items.length,
    scope,
    totalResults,
  }), [items.length, scope, totalResults]);

  const fitToResults = useCallback((animated = true) => {
    if (!items.length) {
      setRegion(FALLBACK_REGION);
      return;
    }

    const nextRegion = buildSearchMapRegion(items);
    setRegion(nextRegion);

    if (!mapRef.current) return;

    if (items.length === 1) {
      mapRef.current.animateToRegion(nextRegion, animated ? 280 : 0);
      return;
    }

    mapRef.current.fitToCoordinates(
      items.map((item) => ({
        latitude: item.lat,
        longitude: item.lng,
      })),
      {
        animated,
        edgePadding: {
          bottom: resolvedOverlayInsets.bottom,
          left: resolvedOverlayInsets.left,
          right: resolvedOverlayInsets.right,
          top: resolvedOverlayInsets.top,
        },
      },
    );
  }, [items, resolvedOverlayInsets.bottom, resolvedOverlayInsets.left, resolvedOverlayInsets.right, resolvedOverlayInsets.top]);

  useEffect(() => {
    mapLoadStartedAtRef.current = Date.now();
    setMapStatus('loading');
    searchMapLogger.info('map cycle started', {
      ...logContext,
      retryCycle: mapRenderKey,
    });
  }, [logContext, mapRenderKey]);

  useEffect(() => {
    if (selectedItemId !== undefined) {
      return;
    }

    if (!internalSelectedItemId) {
      return;
    }

    if (!items.some((item) => item.id === internalSelectedItemId)) {
      setInternalSelectedItemId('');
    }
  }, [internalSelectedItemId, items, selectedItemId]);

  useEffect(() => {
    if (mapStatus !== 'loading') {
      return undefined;
    }

    const timeout = setTimeout(() => {
      searchMapLogger.warn('map load timeout', {
        ...logContext,
        elapsedMs: Date.now() - mapLoadStartedAtRef.current,
      });
      setMapStatus('error');
    }, MAP_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [logContext, mapStatus]);

  useEffect(() => {
    if (mapStatus !== 'ready') {
      return undefined;
    }

    const timer = setTimeout(() => {
      if (regionHint && Number.isFinite(regionHint.lat) && Number.isFinite(regionHint.lng)) {
        return;
      }
      fitToResults(false);
    }, 40);

    return () => clearTimeout(timer);
  }, [fitToResults, mapStatus, regionHint]);

  useEffect(() => {
    if (
      mapStatus !== 'ready'
      || !regionHint
      || !Number.isFinite(regionHint.lat)
      || !Number.isFinite(regionHint.lng)
    ) {
      return;
    }

    if (
      Number.isFinite(regionHint.north)
      && Number.isFinite(regionHint.south)
      && Number.isFinite(regionHint.east)
      && Number.isFinite(regionHint.west)
    ) {
      const nextRegion = {
        latitude: regionHint.lat,
        latitudeDelta: Number.isFinite(regionHint.latitudeDelta)
          ? regionHint.latitudeDelta
          : Math.max(Math.abs(regionHint.north - regionHint.south), 0.02),
        longitude: regionHint.lng,
        longitudeDelta: Number.isFinite(regionHint.longitudeDelta)
          ? regionHint.longitudeDelta
          : Math.max(Math.abs(regionHint.east - regionHint.west), 0.02),
      };

      setRegion(nextRegion);
      mapRef.current?.fitToCoordinates([
        { latitude: regionHint.north, longitude: regionHint.west },
        { latitude: regionHint.south, longitude: regionHint.east },
      ], {
        animated: true,
        edgePadding: {
          bottom: resolvedOverlayInsets.bottom,
          left: resolvedOverlayInsets.left,
          right: resolvedOverlayInsets.right,
          top: resolvedOverlayInsets.top,
        },
      });
      return;
    }

    const nextRegion = buildFocusedRegion(regionHint.lat, regionHint.lng);
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 280);
  }, [mapStatus, regionHint, resolvedOverlayInsets.bottom, resolvedOverlayInsets.left, resolvedOverlayInsets.right, resolvedOverlayInsets.top]);

  useEffect(() => {
    onRenderStats?.({
      clusterCount: 0,
      markerCount: items.length,
      renderableCount: items.length,
    });
  }, [items.length, onRenderStats]);

  const handleMarkerSelect = useCallback((item) => {
    if (selectedItemId === undefined) {
      setInternalSelectedItemId(item.id);
    }
    onSelectItem?.(item.id);
  }, [onSelectItem, selectedItemId]);

  const handleClearSelection = useCallback(() => {
    if (selectedItemId === undefined) {
      setInternalSelectedItemId('');
    }
    onSelectItem?.('');
  }, [onSelectItem, selectedItemId]);

  const handleMapReady = useCallback(() => {
    searchMapLogger.info('native map ready', logContext);
  }, [logContext]);

  const handleMapLoaded = useCallback(() => {
    searchMapLogger.info('native map loaded', {
      ...logContext,
      elapsedMs: Date.now() - mapLoadStartedAtRef.current,
    });
    setMapStatus('ready');
  }, [logContext]);

  const handleRetryMap = useCallback(() => {
    setIsLocatePending(false);
    setMapStatus('loading');
    setMapRenderKey((current) => current + 1);
  }, []);

  const handleZoom = useCallback((factor) => {
    if (areControlsDisabled) return;

    const nextRegion = scaleRegionDeltas(region, factor);
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 220);
  }, [areControlsDisabled, region]);

  const requestUserLocation = useCallback(async () => {
    if (areControlsDisabled) {
      return;
    }
    const coordinates = await requestCurrentSearchMapLocation();
    if (!coordinates) {
      return;
    }

    setShowsUserLocation(true);
    setIsLocatePending(false);
    onLocateMe?.();

    const nextRegion = buildFocusedRegion(coordinates.lat, coordinates.lng);
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 280);
  }, [areControlsDisabled, onLocateMe]);

  const handleUserLocationChange = useCallback((event) => {
    const coordinate = event?.nativeEvent?.coordinate;
    if (!isLocatePending || !coordinate) {
      return;
    }

    const nextRegion = buildFocusedRegion(coordinate.latitude, coordinate.longitude);
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 280);
    setIsLocatePending(false);
  }, [isLocatePending]);

  return (
    <View style={[styles.container, { backgroundColor: Colors.primary900, height }]}>
      <ClusteredMapView
        clusterColor={markerColor}
        initialRegion={region}
        key={`search-map-${scope}-${mapRenderKey}`}
        onMapLoaded={handleMapLoaded}
        onMapReady={handleMapReady}
        onRegionChangeComplete={(nextRegion) => {
          setRegion(nextRegion);
          const nextBounds = buildRegionBounds(nextRegion);
          onRegionChangeComplete?.({
            ...nextBounds,
            lat: nextRegion.latitude,
            latitudeDelta: nextRegion.latitudeDelta,
            lng: nextRegion.longitude,
            longitudeDelta: nextRegion.longitudeDelta,
            zoom: estimateZoomFromRegion(nextRegion),
          });
        }}
        onUserLocationChange={handleUserLocationChange}
        provider={PROVIDER_GOOGLE}
        ref={mapRef}
        showsMyLocationButton={false}
        showsUserLocation={showsUserLocation}
        style={[styles.map, !isMapReady && styles.mapHidden]}
      >
        {items.map((item) => {
          const isSelected = item.id === activeSelectedItemId;

          return (
            <Marker
              coordinate={{ latitude: item.lat, longitude: item.lng }}
              key={item.id}
              onPress={() => handleMarkerSelect(item)}
            >
              <View
                style={[
                  styles.markerOuter,
                  {
                    backgroundColor: isSelected ? markerColor : `${markerColor}CC`,
                    borderColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.72)',
                    transform: [{ scale: isSelected ? 1.08 : 1 }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.markerInner,
                    { backgroundColor: isSelected ? '#FFFFFF' : `${Colors.primary900}F4` },
                  ]}
                />
              </View>
            </Marker>
          );
        })}
      </ClusteredMapView>

      <View
        pointerEvents="box-none"
        style={[styles.overlay, { paddingHorizontal: 12, paddingTop: topMargin + 12 }]}
      >
        <View style={[Alignments.row, Alignments.alignStart, Alignments.justifySpaceBetween]}>
          <SearchMapHud
            disabled={areControlsDisabled}
            geolocatableCount={items.length}
            isLoadingResults={isLoadingResults}
            onLocateMe={requestUserLocation}
            onRecenter={() => {
              if (
                isClubScope
                && regionHint
                && Number.isFinite(regionHint.lat)
                && Number.isFinite(regionHint.lng)
              ) {
                const nextRegion = buildFocusedRegion(regionHint.lat, regionHint.lng);
                setRegion(nextRegion);
                mapRef.current?.animateToRegion(nextRegion, 280);
                return;
              }
              fitToResults(true);
            }}
            onZoomIn={() => handleZoom(0.65)}
            onZoomOut={() => handleZoom(1.45)}
            renderStats={{
              clusterCount: 0,
              markerCount: items.length,
              renderableCount: items.length,
            }}
            scope={scope}
            totalCount={totalResults}
            truncated={truncated}
          />
        </View>
      </View>

      {mapStatus === 'loading' ? (
        <View style={styles.statusOverlay}>
          <View
            style={[
              styles.statusCard,
              ApplicationStyle.shadow200,
              {
                backgroundColor: 'rgba(7, 24, 35, 0.92)',
                borderColor: `${Colors.primary500}33`,
              },
            ]}
          >
            <ActivityIndicator color={Colors.primary500} size="small" />
            <Text style={[Fonts.p2Bold, Fonts.neutral00, Fonts.textCenter]}>
              Chargement de la carte
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200, Fonts.textCenter]}>
              Nous préparons l&apos;affichage géolocalisé de vos résultats.
            </Text>
          </View>
        </View>
      ) : null}

      {mapStatus === 'error' ? (
        <View style={styles.statusOverlay}>
          <View
            style={[
              styles.statusCard,
              ApplicationStyle.shadow200,
              {
                backgroundColor: 'rgba(7, 24, 35, 0.94)',
                borderColor: `${Colors.error500}26`,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00, Fonts.textCenter]}>
              Impossible de charger la carte
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200, Fonts.textCenter]}>
              Les tuiles Google Maps ne répondent pas pour le moment. Réessayez ou revenez à la liste.
            </Text>
            <View style={[Alignments.row, Alignments.justifyCenter, { gap: 12, width: '100%' }]}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleRetryMap}
                style={[
                  styles.statusActionButton,
                  {
                    backgroundColor: Colors.primary500,
                    borderColor: Colors.primary500,
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
                  Réessayer
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onShowList?.()}
                style={[
                  styles.statusActionButton,
                  {
                    backgroundColor: 'rgba(6, 24, 34, 0.86)',
                    borderColor: `${Colors.primary500}40`,
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
                  Voir la liste
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {isMapReady && items.length === 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.emptyState,
            {
              backgroundColor: 'rgba(7, 24, 35, 0.58)',
            },
          ]}
        >
          <Text style={[Fonts.p3, Fonts.neutral00, Fonts.textCenter]}>
            {getSearchMapEmptyMessage(scope)}
          </Text>
        </View>
      ) : null}

      {isMapReady ? (
        <SearchMapPreviewCard
          bottomOffset={previewBottomOffset}
          item={selectedItem}
          onDismiss={handleClearSelection}
          onOpen={(item) => onOpenItem?.(item)}
          onShowList={() => onShowList?.()}
          scope={scope}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    flex: 1,
    minHeight: 360,
    overflow: 'hidden',
    position: 'relative',
  },
  emptyState: {
    alignItems: 'center',
    borderRadius: 14,
    bottom: 120,
    justifyContent: 'center',
    left: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    right: 24,
  },
  map: {
    height: '100%',
    width: '100%',
  },
  mapHidden: {
    opacity: 0.02,
  },
  markerInner: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  markerOuter: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 3,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  overlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  statusActionButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusCard: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    maxWidth: 320,
    paddingHorizontal: 18,
    paddingVertical: 18,
    width: '100%',
  },
  statusOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(6, 24, 34, 0.72)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 22,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});

export default LegacySearchMapNative;
