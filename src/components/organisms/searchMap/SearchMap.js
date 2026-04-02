import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ClusteredMapView from 'react-native-map-clustering';
import { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import useTheme from '@/theme/themeContext';

import SearchMapPreviewCard from '@/components/molecules/searchMapPreviewCard/SearchMapPreviewCard';

import { createLogger } from '@/utils/logger/logger';
import {
  buildSearchMapRegion,
  getSearchMapEmptyMessage,
  getSearchMapResultLabel,
} from '@/utils/searchMap';

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

/**
 * @param {object} props
 * @param {import('@/utils/searchMap').SearchMapItem[]} [props.items]
 * @param {(item: import('@/utils/searchMap').SearchMapItem) => void} [props.onOpenItem]
 * @param {() => void} [props.onShowList]
 * @param {(itemId: string) => void} [props.onSelectItem]
 * @param {() => void} [props.onLocateMe]
 * @param {'events' | 'clubs' | 'reservations'} [props.scope]
 * @param {string} [props.selectedItemId]
 * @param {number} [props.totalCount]
 * @returns {import('react').ReactElement}
 */
function SearchMap({
  items = [],
  onLocateMe,
  onOpenItem,
  onSelectItem,
  onShowList,
  scope = 'events',
  selectedItemId,
  totalCount = 0,
}) {
  const { t } = useTranslation();
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
          bottom: 130,
          left: 56,
          right: 56,
          top: 84,
        },
      },
    );
  }, [items]);

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
      fitToResults(false);
    }, 40);

    return () => clearTimeout(timer);
  }, [fitToResults, mapStatus]);

  const handleMarkerSelect = useCallback((item) => {
    if (selectedItemId === undefined) {
      setInternalSelectedItemId(item.id);
    }
    onSelectItem?.(item.id);
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

  const requestUserLocation = useCallback(async () => {
    if (areControlsDisabled) {
      return;
    }

    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          buttonNegative: t('permissions.location.buttonNegative', 'Annuler'),
          buttonNeutral: t('permissions.location.buttonNeutral', 'Plus tard'),
          buttonPositive: t('permissions.location.buttonPositive', 'OK'),
          message: t(
            'permissions.location.message',
            'Nous avons besoin de votre position pour afficher les résultats autour de vous.',
          ),
          title: t('permissions.location.title', 'Permission de localisation'),
        },
      );

      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        return;
      }
    }

    setShowsUserLocation(true);
    setIsLocatePending(true);
    onLocateMe?.();
  }, [areControlsDisabled, onLocateMe, t]);

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
    <View style={[styles.container, { backgroundColor: Colors.primary900 }]}>
      <ClusteredMapView
        clusterColor={markerColor}
        initialRegion={region}
        key={`search-map-${scope}-${mapRenderKey}`}
        onMapLoaded={handleMapLoaded}
        onMapReady={handleMapReady}
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
        style={[styles.overlay, { paddingHorizontal: 12, paddingTop: 12 }]}
      >
        <View style={[Alignments.row, Alignments.alignStart, Alignments.justifySpaceBetween]}>
          <View
            style={[
              ApplicationStyle.shadow200,
              {
                backgroundColor: 'rgba(6, 24, 34, 0.84)',
                borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: 18,
                borderWidth: 1,
                maxWidth: '72%',
                paddingHorizontal: 14,
                paddingVertical: 10,
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
              {`${totalResults} ${getSearchMapResultLabel(scope)}`}
            </Text>
            <Text style={[Fonts.p4, Fonts.neutral200]}>
              {`${items.length} affichables sur la carte`}
            </Text>
          </View>

          <View style={[Alignments.column, { gap: 10, opacity: areControlsDisabled ? 0.45 : 1 }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={areControlsDisabled}
              onPress={() => fitToResults(true)}
              style={[
                styles.controlButton,
                {
                  backgroundColor: 'rgba(6, 24, 34, 0.9)',
                  borderColor: `${Colors.primary500}33`,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
                Recentrer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={areControlsDisabled}
              onPress={requestUserLocation}
              style={[
                styles.controlButton,
                {
                  backgroundColor: 'rgba(6, 24, 34, 0.9)',
                  borderColor: `${Colors.primary500}33`,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
                Me localiser
              </Text>
            </TouchableOpacity>
          </View>
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
          item={selectedItem}
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
  controlButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 108,
    paddingHorizontal: 14,
    paddingVertical: 8,
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

export default SearchMap;
