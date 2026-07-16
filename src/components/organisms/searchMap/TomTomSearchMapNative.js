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
import { WebView } from 'react-native-webview';

import useTheme from '@/theme/themeContext';

import SearchMapPreviewCard from '@/components/molecules/searchMapPreviewCard/SearchMapPreviewCard';
import SearchMapHud from '@/components/organisms/searchMap/SearchMapHud';

import { persistDiagnosticError } from '@/utils/bootDiagnostics';
import { createLogger } from '@/utils/logger/logger';
import {
  getSearchMapEmptyMessage,
  getSearchMapNoCoordinatesMessage,
} from '@/utils/searchMap';

import useSafeTimers from '@/hooks/useSafeTimers';
import { buildSearchMapRenderableModel } from '@/platform/maps/searchMapClustering';
import {
  getSearchMapLoadingCopy,
  getSearchMapProviderErrorMessage,
  SEARCH_MAP_ERROR_REASONS,
} from '@/platform/maps/searchMapCopy';
import { requestCurrentSearchMapLocation } from '@/platform/maps/searchMapGeolocation';
import { getTomTomApiKey } from '@/platform/maps/searchMapProvider';
import {
  buildSearchMapCommandScript,
  buildSearchMapRuntimeHtml,
  buildSearchMapSyncScript,
  buildTomTomProbeUrl,
  buildTomTomTileUrl,
  parseSearchMapBridgeMessage,
  resolveSearchMapMarkerColor,
  SEARCH_MAP_BRIDGE_TYPES,
  TOMTOM_TILE_PROVIDER,
} from '@/platform/maps/searchMapRuntime';

const MAP_LOAD_TIMEOUT_MS = 6500;
const searchMapLogger = createLogger('search-map-tomtom');

const CRITICAL_ERROR_REASONS = new Set([
  SEARCH_MAP_ERROR_REASONS.invalidApiKey,
  SEARCH_MAP_ERROR_REASONS.invalidTileRequest,
  SEARCH_MAP_ERROR_REASONS.leafletUnavailable,
  SEARCH_MAP_ERROR_REASONS.missingApiKey,
  SEARCH_MAP_ERROR_REASONS.runtimeError,
  SEARCH_MAP_ERROR_REASONS.webViewError,
  SEARCH_MAP_ERROR_REASONS.webViewProcessGone,
]);
const DEV_DIAGNOSTIC_LIMIT = 6;
const DEV_DIAGNOSTIC_LOG_STAGES = new Set([
  'command_applied',
  'focus_results_single',
  'focus_selected',
  'tile_error',
]);

const sanitizeDiagnosticUrl = (value) => String(value || '').replace(/key=([^&]+)/, 'key=***');
const logDevDiagnostic = (message, payload) => {
  if (!__DEV__) {
    return;
  }

  console.log(`[search-map-tomtom] ${message}`, payload);
};

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
const buildRenderStatsSummary = (value) => ({
  clusterCount: Number(value?.clusterCount || 0),
  dataCount: Number(value?.dataCount || 0),
  fallbackActive: Boolean(value?.fallbackActive),
  markerCount: Number(value?.markerCount || 0),
  renderableCount: Number(value?.renderableCount || 0),
});

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

const hasValidRegionHint = (value) => (
  !!value
  && Number.isFinite(Number(value.lat))
  && Number.isFinite(Number(value.lng))
);

const buildRuntimeState = (
  focusMode,
  items,
  renderItems,
  renderStats,
  overlayInsets,
  regionHint,
  selectedItemId,
  userLocation,
) => ({
  focusMode,
  items,
  overlayInsets,
  regionHint,
  renderItems,
  renderStats,
  selectedItemId,
  userLocation,
});

const resolveMeasuredOverlayInsets = (
  overlayInsets,
  controlsWidth,
  previewBottomOffset,
  previewHeight,
  summaryWidth,
) => ({
  bottom: Math.max(
    132,
    Number(overlayInsets?.bottom) || 0,
    previewBottomOffset + (previewHeight > 0 ? previewHeight + 18 : 44),
  ),
  left: Math.max(
    24,
    Number(overlayInsets?.left) || 0,
    summaryWidth > 0 ? Math.min(summaryWidth + 24, 204) : 0,
  ),
  right: Math.max(
    24,
    Number(overlayInsets?.right) || 0,
    controlsWidth > 0 ? controlsWidth + 24 : 0,
  ),
  top: Math.max(72, Number(overlayInsets?.top) || 0),
});

/**
 * @param {object} props
 * @param {number} [props.height]
 * @param {boolean} [props.isLoadingResults]
 * @param {import('@/utils/searchMap').SearchMapItem[]} [props.items]
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
 * } | null} [props.focusedViewport]
 * @param {(item: import('@/utils/searchMap').SearchMapItem) => void} [props.onOpenItem]
 * @param {(region: {
 *  lat: number;
 *  lng: number;
 *  zoom?: number;
 *  north?: number;
 *  south?: number;
 *  east?: number;
 *  west?: number;
 *  latitudeDelta?: number;
 *  longitudeDelta?: number;
 * }) => void} [props.onRegionChangeComplete]
 * @param {(itemId: string) => void} [props.onSelectItem]
 * @param {'camera' | 'highlight-only'} [props.selectionFocusBehavior]
 * @param {'manual' | 'debounced-auto'} [props.refreshStrategy]
 * @param {() => void} [props.onShowList]
 * @param {(stats: {
 *  dataCount?: number,
 *  renderableCount?: number,
 *  markerCount?: number,
 *  clusterCount?: number,
 *  fallbackActive?: boolean,
 * }) => void} [props.onRenderStats]
 * @param {{ top?: number, right?: number, bottom?: number, left?: number } | null} [props.overlayInsets]
 * @param {number} [props.previewBottomOffset]
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
 * @param {string} [props.selectedItemId]
 * @param {'events' | 'clubs' | 'reservations'} [props.scope]
 * @param {number} [props.topMargin]
 * @param {number} [props.totalCount]
 * @param {boolean} [props.truncated]
 * @returns {import('react').ReactElement}
 */
function TomTomSearchMapNative({
  aggregates = null,
  focusedViewport = null,
  height = 360,
  isLoadingResults = false,
  items = [],
  onOpenItem,
  onRegionChangeComplete,
  onRenderStats,
  onSelectItem,
  onShowList,
  overlayInsets = null,
  previewBottomOffset = 12,
  refreshStrategy = 'manual',
  regionHint = null,
  scope = 'events',
  selectedItemId,
  selectionFocusBehavior = 'camera',
  topMargin = 12,
  totalCount = 0,
  truncated = false,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const tomTomApiKey = getTomTomApiKey();
  const { clearSafeTimer, setSafeTimeout } = useSafeTimers();
  const webViewRef = useRef(/** @type {import('react-native-webview').WebView | null} */ (null));
  const mapLoadStartedAtRef = useRef(Date.now());
  const reportedRenderStatsSignatureRef = useRef('');
  const providerRenderStatsSignatureRef = useRef('');
  const mismatchSignatureRef = useRef('');
  const [focusMode, setFocusMode] = useState(
    /** @type {'results' | 'selected' | 'user' | 'region'} */ ('results'),
  );
  const [internalSelectedItemId, setInternalSelectedItemId] = useState('');
  const [mapErrorReason, setMapErrorReason] = useState('');
  const [mapRenderKey, setMapRenderKey] = useState(0);
  const [providerRenderStats, setProviderRenderStats] = useState(null);
  const [mapStatus, setMapStatus] = useState(
    /** @type {'loading' | 'ready' | 'error'} */ ('loading'),
  );
  const [diagnosticTrail, setDiagnosticTrail] = useState([]);
  const [userLocation, setUserLocation] = useState(
    /** @type {{ lat: number; lng: number } | null} */ (null),
  );
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const [focusedRegion, setFocusedRegion] = useState(regionHint);
  const [visibleViewport, setVisibleViewport] = useState(focusedViewport || regionHint || null);
  const [hudControlsWidth, setHudControlsWidth] = useState(0);
  const [hudSummaryWidth, setHudSummaryWidth] = useState(0);
  const [previewCardHeight, setPreviewCardHeight] = useState(0);

  const mapId = useMemo(
    () => `search-map-${scope}-${mapRenderKey}`,
    [mapRenderKey, scope],
  );
  const markerColor = useMemo(() => resolveSearchMapMarkerColor(scope), [scope]);
  const activeSelectedItemId = selectedItemId ?? internalSelectedItemId;
  const selectedItem = useMemo(
    () => items.find((item) => item.id === activeSelectedItemId) || null,
    [activeSelectedItemId, items],
  );
  const totalResults = Number.isFinite(totalCount) && totalCount > 0
    ? totalCount
    : items.length;
  const activeViewport = visibleViewport || focusedViewport || focusedRegion || regionHint || null;
  const renderModel = useMemo(
    () => buildSearchMapRenderableModel({
      aggregates,
      items,
      viewport: activeViewport,
    }),
    [activeViewport, aggregates, items],
  );
  const renderItems = renderModel.entries;
  const renderStats = renderModel.stats;
  const renderStatsSignature = useMemo(
    () => toStableJson(renderStats || null),
    [renderStats],
  );
  const sharedRenderStatsSignature = useMemo(
    () => toStableJson(buildRenderStatsSummary(renderStats)),
    [renderStats],
  );
  const visibleMarkerCount = Math.max(
    0,
    Number(renderStats?.markerCount || 0) + Number(renderStats?.clusterCount || 0),
  );
  const resolvedOverlayInsets = useMemo(
    () => resolveMeasuredOverlayInsets(
      overlayInsets,
      hudControlsWidth,
      previewBottomOffset,
      previewCardHeight,
      hudSummaryWidth,
    ),
    [hudControlsWidth, hudSummaryWidth, overlayInsets, previewBottomOffset, previewCardHeight],
  );
  const isMapReady = mapStatus === 'ready';
  const areControlsDisabled = !isMapReady;
  const runtimeState = useMemo(
    () => buildRuntimeState(
      focusMode,
      items,
      renderItems,
      renderStats,
      resolvedOverlayInsets,
      focusedRegion,
      activeSelectedItemId,
      userLocation,
    ),
    [
      activeSelectedItemId,
      focusMode,
      focusedRegion,
      items,
      renderItems,
      renderStats,
      resolvedOverlayInsets,
      userLocation,
    ],
  );
  const bootstrapHtmlRef = useRef({ html: '', mapId: '' });
  if (bootstrapHtmlRef.current.mapId !== mapId) {
    bootstrapHtmlRef.current = {
      html: buildSearchMapRuntimeHtml({
        initialState: runtimeState,
        mapId,
        markerColor,
        tileAttribution: TOMTOM_TILE_PROVIDER.attribution,
        tileProbeUrl: buildTomTomProbeUrl(tomTomApiKey || 'missing-key'),
        tileUrl: buildTomTomTileUrl(tomTomApiKey || 'missing-key'),
      }),
      mapId,
    };
  }
  const htmlSource = bootstrapHtmlRef.current.html;
  const logContext = useMemo(
    () => ({
      // En mode agrégats, tout le total est représenté sur la carte.
      geolocatableCount: renderModel.stats.aggregated ? totalResults : items.length,
      provider: 'tomtom',
      refreshStrategy,
      scope,
      totalResults,
    }),
    [items.length, refreshStrategy, renderModel.stats.aggregated, scope, totalResults],
  );
  const emptyMessage = totalResults > 0 && items.length === 0
    ? getSearchMapNoCoordinatesMessage(scope, totalResults)
    : getSearchMapEmptyMessage(scope);
  const loadingCopy = useMemo(() => getSearchMapLoadingCopy(), []);

  useEffect(() => {
    if (!regionHint || !Number.isFinite(regionHint.lat) || !Number.isFinite(regionHint.lng)) {
      return;
    }

    setFocusedRegion((current) => (
      areRegionsEquivalent(current, regionHint) ? current : regionHint
    ));
    setFocusMode((current) => (
      areRegionsEquivalent(focusedRegion, regionHint) && current === 'region'
        ? current
        : 'region'
    ));
  }, [focusedRegion, regionHint]);

  useEffect(() => {
    if (!focusedViewport || !Number.isFinite(Number(focusedViewport.lat)) || !Number.isFinite(Number(focusedViewport.lng))) {
      return;
    }

    setVisibleViewport((current) => (
      areRegionsEquivalent(current, focusedViewport) ? current : focusedViewport
    ));
  }, [focusedViewport]);

  useEffect(() => {
    logDevDiagnostic('FOCUS_MODE_CHANGED', {
      ...logContext,
      focusMode,
      hasRegionHint: hasValidRegionHint(focusedRegion),
      selectedItemId: activeSelectedItemId || '',
    });
  }, [activeSelectedItemId, focusMode, focusedRegion, logContext]);

  useEffect(() => {
    if (!__DEV__ || !providerRenderStats) {
      return;
    }

    const providerSignature = toStableJson(buildRenderStatsSummary(providerRenderStats));

    if (sharedRenderStatsSignature === providerSignature) {
      mismatchSignatureRef.current = '';
      return;
    }

    const nextMismatchSignature = `${sharedRenderStatsSignature}::${providerSignature}`;
    if (mismatchSignatureRef.current !== nextMismatchSignature) {
      mismatchSignatureRef.current = nextMismatchSignature;
      logDevDiagnostic('MAP_RENDER_STATS provider mismatch', {
        provider: providerRenderStats,
        shared: renderStats,
      });
    }
  }, [providerRenderStats, renderStats, sharedRenderStatsSignature]);

  useEffect(() => {
    mapLoadStartedAtRef.current = Date.now();
    mismatchSignatureRef.current = '';
    providerRenderStatsSignatureRef.current = '';
    reportedRenderStatsSignatureRef.current = '';
    setWebViewLoaded(false);
    setDiagnosticTrail([]);
    setMapStatus(tomTomApiKey ? 'loading' : 'error');
    setMapErrorReason(tomTomApiKey ? '' : 'missing_api_key');
    setProviderRenderStats(null);
    searchMapLogger.info('map cycle started', {
      ...logContext,
      retryCycle: mapRenderKey,
    });
  }, [logContext, mapRenderKey, tomTomApiKey]);

  useEffect(() => {
    if (!__DEV__ || !tomTomApiKey) {
      return undefined;
    }

    let isCancelled = false;
    const probeUrl = buildTomTomProbeUrl(tomTomApiKey);

    const runPreflight = async () => {
      try {
        logDevDiagnostic('tomtom native preflight started', {
          ...logContext,
          url: sanitizeDiagnosticUrl(probeUrl),
        });

        const response = await fetch(probeUrl, { method: 'GET' });
        if (isCancelled) {
          return;
        }

        logDevDiagnostic('tomtom native preflight result', {
          ...logContext,
          ok: response.ok,
          status: response.status,
          url: sanitizeDiagnosticUrl(probeUrl),
        });
      } catch (error) {
        if (isCancelled) {
          return;
        }

        searchMapLogger.warn('tomtom native preflight failed', {
          ...logContext,
          message: error?.message,
          stack: error?.stack,
          url: sanitizeDiagnosticUrl(probeUrl),
        });
      }
    };

    runPreflight();
    return () => {
      isCancelled = true;
    };
  }, [logContext, tomTomApiKey]);

  useEffect(() => {
    if (selectedItemId !== undefined) {
      setFocusMode((current) => {
        if (selectedItemId) {
          if (selectionFocusBehavior !== 'highlight-only') {
            return 'selected';
          }

          if (current === 'user') {
            return current;
          }

          return hasValidRegionHint(regionHint) ? 'region' : 'results';
        }

        if (current === 'user') {
          return current;
        }

        return hasValidRegionHint(regionHint) ? 'region' : 'results';
      });
      return;
    }

    if (!internalSelectedItemId) {
      return;
    }

    if (!items.some((item) => item.id === internalSelectedItemId)) {
      setInternalSelectedItemId('');
      setFocusMode(hasValidRegionHint(regionHint) ? 'region' : 'results');
    }
  }, [internalSelectedItemId, items, regionHint, selectedItemId, selectionFocusBehavior]);

  useEffect(() => {
    if (!webViewLoaded || !tomTomApiKey || mapStatus === 'error') {
      return;
    }

    webViewRef.current?.injectJavaScript(buildSearchMapSyncScript(mapId, runtimeState));
  }, [mapId, mapStatus, runtimeState, tomTomApiKey, webViewLoaded]);

  useEffect(() => {
    if (reportedRenderStatsSignatureRef.current === renderStatsSignature) {
      return;
    }

    reportedRenderStatsSignatureRef.current = renderStatsSignature;
    onRenderStats?.(renderStats || null);
  }, [onRenderStats, renderStats, renderStatsSignature]);

  useEffect(() => {
    if (mapStatus !== 'loading' || !tomTomApiKey) {
      return undefined;
    }

    const timeout = setSafeTimeout(() => {
      searchMapLogger.warn('map load timeout', {
        ...logContext,
        elapsedMs: Date.now() - mapLoadStartedAtRef.current,
      });
      setMapErrorReason((currentReason) => (
        currentReason || SEARCH_MAP_ERROR_REASONS.tilesUnavailable
      ));
      setMapStatus('error');
    }, MAP_LOAD_TIMEOUT_MS);

    return () => clearSafeTimer(timeout);
  }, [clearSafeTimer, logContext, mapStatus, setSafeTimeout, tomTomApiKey]);

  const handleMarkerSelect = useCallback((itemId) => {
    if (selectedItemId === undefined) {
      setInternalSelectedItemId(itemId);
    }

    setFocusMode((current) => {
      if (selectionFocusBehavior !== 'highlight-only') {
        return 'selected';
      }

      if (current === 'user') {
        return current;
      }

      if (hasValidRegionHint(focusedRegion)) {
        return 'region';
      }

      return current === 'selected' ? 'results' : current;
    });
    searchMapLogger.info('map marker selected', {
      ...logContext,
      itemId,
    });
    onSelectItem?.(itemId);
  }, [focusedRegion, logContext, onSelectItem, selectedItemId, selectionFocusBehavior]);

  const handleMarkerOpen = useCallback((itemId) => {
    const targetItem = items.find((item) => item.id === itemId);
    if (!targetItem) {
      return;
    }

    searchMapLogger.info('map marker opened', {
      ...logContext,
      itemId,
    });
    onOpenItem?.(targetItem);
  }, [items, logContext, onOpenItem]);

  const handleClearSelection = useCallback(() => {
    if (selectedItemId === undefined) {
      setInternalSelectedItemId('');
    }

    setFocusMode(hasValidRegionHint(focusedRegion) ? 'region' : 'results');
    onSelectItem?.('');
  }, [focusedRegion, onSelectItem, selectedItemId]);

  const handleRetryMap = useCallback(() => {
    setWebViewLoaded(false);
    setMapErrorReason('');
    setFocusMode(hasValidRegionHint(focusedRegion) ? 'region' : 'results');
    setMapRenderKey((current) => current + 1);
  }, [focusedRegion]);

  const handleWebViewProcessGone = useCallback((event) => {
    const didCrash = Boolean(event?.nativeEvent?.didCrash);
    const error = new Error(`MAP_WEBVIEW_PROCESS_GONE${didCrash ? '_CRASH' : ''}`);
    const payload = persistDiagnosticError(error, 'MAP_WEBVIEW_PROCESS_GONE', {
      isFatal: false,
    });

    searchMapLogger.error('tomtom webview process gone', {
      ...logContext,
      didCrash,
      payload,
    });
    setWebViewLoaded(false);
    setProviderRenderStats(null);
    setMapErrorReason(SEARCH_MAP_ERROR_REASONS.webViewProcessGone);
    setMapStatus('error');

    return true;
  }, [logContext]);

  const issueCommand = useCallback((type) => {
    const nextCommand = {
      id: `${type}-${Date.now()}`,
      type,
    };

    logDevDiagnostic('tomtom command queued', {
      ...logContext,
      type,
    });

    if (!webViewLoaded || !webViewRef.current) {
      searchMapLogger.warn('tomtom command skipped because webview is not ready', {
        ...logContext,
        type,
      });
      return;
    }

    webViewRef.current.injectJavaScript(
      buildSearchMapCommandScript(mapId, nextCommand),
    );
  }, [logContext, mapId, webViewLoaded]);

  const requestUserLocation = useCallback(async () => {
    if (areControlsDisabled) {
      return;
    }

    const coordinates = await requestCurrentSearchMapLocation();
    if (!coordinates) {
      searchMapLogger.warn('user location unavailable', logContext);
      return;
    }

    setUserLocation(coordinates);
    setFocusMode('user');
    searchMapLogger.info('map user location acquired', {
      ...logContext,
      lat: coordinates.lat,
      lng: coordinates.lng,
    });
  }, [areControlsDisabled, logContext]);

  const handleMessage = useCallback((event) => {
    const bridgeMessage = parseSearchMapBridgeMessage(event?.nativeEvent?.data);
    if (!bridgeMessage || bridgeMessage.mapId !== mapId) {
      return;
    }

    switch (bridgeMessage.type) {
      case SEARCH_MAP_BRIDGE_TYPES.MAP_DIAGNOSTIC: {
        const payload = bridgeMessage.payload || {};
        const nextDiagnostic = {
          centerLat: Number.isFinite(Number(payload.centerLat))
            ? Number(payload.centerLat)
            : undefined,
          centerLng: Number.isFinite(Number(payload.centerLng))
            ? Number(payload.centerLng)
            : undefined,
          firstItemLat: Number.isFinite(Number(payload.firstItemLat))
            ? Number(payload.firstItemLat)
            : undefined,
          firstItemLng: Number.isFinite(Number(payload.firstItemLng))
            ? Number(payload.firstItemLng)
            : undefined,
          lat: Number.isFinite(Number(payload.lat)) ? Number(payload.lat) : undefined,
          lng: Number.isFinite(Number(payload.lng)) ? Number(payload.lng) : undefined,
          message: String(payload.message || ''),
          phase: String(payload.phase || ''),
          readyTileCount: Number.isFinite(Number(payload.readyTileCount))
            ? Number(payload.readyTileCount)
            : undefined,
          selectedItemId: String(payload.selectedItemId || ''),
          stack: String(payload.stack || ''),
          stage: String(payload.stage || ''),
          status: String(payload.status || ''),
          url: sanitizeDiagnosticUrl(payload.url || payload.tileUrl || ''),
          yOffset: Number.isFinite(Number(payload.yOffset))
            ? Number(payload.yOffset)
            : undefined,
          zoom: Number.isFinite(Number(payload.zoom)) ? Number(payload.zoom) : undefined,
        };

        setDiagnosticTrail((current) => (
          [...current, nextDiagnostic].slice(-DEV_DIAGNOSTIC_LIMIT)
        ));

        if (__DEV__ && DEV_DIAGNOSTIC_LOG_STAGES.has(nextDiagnostic.stage)) {
          logDevDiagnostic(
            `tomtom map diagnostic stage=${nextDiagnostic.stage || ''} `
            + `phase=${nextDiagnostic.phase || ''} `
            + `status=${nextDiagnostic.status || ''} `
            + `message=${nextDiagnostic.message || ''} `
            + `url=${nextDiagnostic.url || ''}`,
            {
              centerLat: nextDiagnostic.centerLat,
              centerLng: nextDiagnostic.centerLng,
              firstItemLat: nextDiagnostic.firstItemLat,
              firstItemLng: nextDiagnostic.firstItemLng,
              lat: nextDiagnostic.lat,
              ...logContext,
              lng: nextDiagnostic.lng,
              readyTileCount: nextDiagnostic.readyTileCount,
              selectedItemId: nextDiagnostic.selectedItemId,
              stack: nextDiagnostic.stack,
              yOffset: nextDiagnostic.yOffset,
              zoom: nextDiagnostic.zoom,
            },
          );
        }
        break;
      }
      case SEARCH_MAP_BRIDGE_TYPES.MAP_ERROR: {
        const payload = bridgeMessage.payload || {};
        const nextReason = String(payload.reason || SEARCH_MAP_ERROR_REASONS.tileError);
        searchMapLogger.warn(
          `tomtom map error reason=${nextReason} `
          + `phase=${String(payload.phase || '')} `
          + `status=${String(payload.status || '')} `
          + `message=${String(payload.message || '')} `
          + `filename=${String(payload.filename || '')} `
          + `line=${String(payload.lineno || '')} `
          + `column=${String(payload.colno || '')} `
          + `url=${String(payload.url || '')}`,
          {
            ...logContext,
            elapsedMs: Date.now() - mapLoadStartedAtRef.current,
            stack: payload.stack,
          },
        );

        setMapErrorReason(nextReason);

        if (mapStatus !== 'ready' && CRITICAL_ERROR_REASONS.has(nextReason)) {
          setMapStatus('error');
        }
        break;
      }
      case SEARCH_MAP_BRIDGE_TYPES.MAP_READY:
        searchMapLogger.info('tomtom map ready', {
          ...logContext,
          elapsedMs: Date.now() - mapLoadStartedAtRef.current,
        });
        setMapErrorReason('');
        setMapStatus('ready');
        break;
      case SEARCH_MAP_BRIDGE_TYPES.MAP_REGION_CHANGE:
        if (bridgeMessage.payload) {
          setVisibleViewport(bridgeMessage.payload);
          onRegionChangeComplete?.(bridgeMessage.payload);
        }
        break;
      case SEARCH_MAP_BRIDGE_TYPES.MAP_RENDER_STATS:
      {
        const nextRenderStats = bridgeMessage.payload || null;
        const nextSignature = toStableJson(nextRenderStats);
        if (providerRenderStatsSignatureRef.current !== nextSignature) {
          providerRenderStatsSignatureRef.current = nextSignature;
          setProviderRenderStats(nextRenderStats);
        }
        break;
      }
      case SEARCH_MAP_BRIDGE_TYPES.MARKER_OPEN:
        if (bridgeMessage.payload?.itemId) {
          handleMarkerOpen(String(bridgeMessage.payload.itemId));
        }
        break;
      case SEARCH_MAP_BRIDGE_TYPES.MARKER_SELECT:
        if (bridgeMessage.payload?.itemId) {
          handleMarkerSelect(String(bridgeMessage.payload.itemId));
        }
        break;
      case SEARCH_MAP_BRIDGE_TYPES.FIT_RESULTS_DONE:
      default:
        break;
    }
  }, [handleMarkerOpen, handleMarkerSelect, logContext, mapId, mapStatus, onRegionChangeComplete]);

  const latestDiagnostic = diagnosticTrail[diagnosticTrail.length - 1] || null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: Colors.primary900,
          height,
        },
      ]}
    >
      <WebView
        domStorageEnabled
        geolocationEnabled
        javaScriptEnabled
        key={`search-map-${scope}-${mapRenderKey}`}
        onContentProcessDidTerminate={handleWebViewProcessGone}
        onError={() => {
          searchMapLogger.warn('tomtom webview error', logContext);
          setMapErrorReason(SEARCH_MAP_ERROR_REASONS.webViewError);
          setMapStatus('error');
        }}
        onLoadEnd={() => {
          setWebViewLoaded(true);
        }}
        onMessage={handleMessage}
        onRenderProcessGone={handleWebViewProcessGone}
        originWhitelist={['*']}
        ref={webViewRef}
        setSupportMultipleWindows={false}
        // baseUrl HTTPS : sans lui, source={{html}} donne une origine opaque (null)
        // et Android WebView bloque le chargement des tuiles HTTPS (elles marchent
        // pourtant dans un vrai navigateur). Une origine sécurisée débloque le rendu.
        source={{ baseUrl: 'https://searchmap.foundclubpro.com/', html: htmlSource }}
        style={[styles.map, !isMapReady && styles.mapHidden]}
      />

      <View
        pointerEvents="box-none"
        style={[styles.overlay, { paddingHorizontal: 14, paddingTop: topMargin + 14 }]}
      >
        <SearchMapHud
          disabled={areControlsDisabled}
          geolocatableCount={renderModel.stats.aggregated ? totalResults : items.length}
          isLoadingResults={isLoadingResults}
          onControlsWidthChange={setHudControlsWidth}
          onLocateMe={requestUserLocation}
          onRecenter={() => {
            const shouldFocusRegion = scope !== 'reservations' && hasValidRegionHint(focusedRegion);
            setFocusMode(shouldFocusRegion ? 'region' : 'results');
            issueCommand(shouldFocusRegion ? 'focus_region' : 'focus_results');
          }}
          onSummaryWidthChange={setHudSummaryWidth}
          onZoomIn={() => issueCommand('zoom_in')}
          onZoomOut={() => issueCommand('zoom_out')}
          renderStats={renderStats}
          scope={scope}
          totalCount={totalResults}
          truncated={truncated}
        />
      </View>

      {mapStatus === 'loading' ? (
        <View style={styles.statusOverlay}>
          <View
            style={[
              styles.statusCard,
              ApplicationStyle.shadow200,
              {
                backgroundColor: 'rgba(7, 24, 35, 0.94)',
                borderColor: `${Colors.primary500}33`,
              },
            ]}
          >
            <ActivityIndicator color={Colors.primary500} size="small" />
            <Text style={[Fonts.p2Bold, Fonts.neutral00, Fonts.textCenter]}>
              {loadingCopy.title}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200, Fonts.textCenter]}>
              {loadingCopy.body}
            </Text>
            {__DEV__ && latestDiagnostic?.stage ? (
              <Text style={[Fonts.p4, Fonts.neutral200, Fonts.textCenter]}>
                {`Diagnostic: ${latestDiagnostic.stage}`}
              </Text>
            ) : null}
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
                backgroundColor: 'rgba(7, 24, 35, 0.95)',
                borderColor: `${Colors.error500}26`,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00, Fonts.textCenter]}>
              Impossible de charger la carte
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200, Fonts.textCenter]}>
              {getSearchMapProviderErrorMessage(mapErrorReason)}
            </Text>
            {__DEV__ && latestDiagnostic ? (
              <Text style={[Fonts.p4, Fonts.neutral200, Fonts.textCenter]}>
                {`Diagnostic: ${latestDiagnostic.stage || latestDiagnostic.phase || mapErrorReason}${
                  latestDiagnostic.status ? ` (${latestDiagnostic.status})` : ''
                }`}
              </Text>
            ) : null}
            <View
              style={[
                Alignments.row,
                Alignments.justifyCenter,
                Alignments.wrap,
                Spaces.gap[12],
                { width: '100%' },
              ]}
            >
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
                <Text style={[Fonts.p4Bold, { color: Colors.primary900 }]}>
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

      {isMapReady && items.length === 0 && renderModel.entries.length === 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.emptyState,
            {
              backgroundColor: 'rgba(7, 24, 35, 0.7)',
            },
          ]}
        >
          <Text style={[Fonts.p3, Fonts.neutral00, Fonts.textCenter]}>
            {emptyMessage}
          </Text>
        </View>
      ) : null}

      {isMapReady && items.length > 0 && visibleMarkerCount > 0 && !selectedItem ? (
        <View
          pointerEvents="none"
          style={[styles.selectionHint, { bottom: Math.max(24, previewBottomOffset + previewCardHeight + 10) }]}
        >
          <Text style={[Fonts.p4Bold, Fonts.neutral00, Fonts.textCenter]}>
            Touchez un repere pour voir la fiche
          </Text>
        </View>
      ) : null}

      {isMapReady ? (
        <SearchMapPreviewCard
          bottomOffset={previewBottomOffset}
          item={selectedItem}
          onDismiss={handleClearSelection}
          onHeightChange={setPreviewCardHeight}
          onOpen={(item) => {
            searchMapLogger.info('map detail opened', {
              ...logContext,
              itemId: item?.id,
            });
            onOpenItem?.(item);
          }}
          onShowList={() => onShowList?.()}
          scope={scope}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 28,
    flex: 1,
    minHeight: 360,
    overflow: 'hidden',
    position: 'relative',
  },
  emptyState: {
    alignItems: 'center',
    borderRadius: 18,
    bottom: 132,
    justifyContent: 'center',
    left: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    position: 'absolute',
    right: 20,
  },
  map: {
    backgroundColor: '#061822',
    height: '100%',
    width: '100%',
  },
  mapHidden: {
    opacity: 0.01,
  },
  overlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  selectionHint: {
    backgroundColor: 'rgba(6, 24, 34, 0.84)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    bottom: 26,
    left: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    position: 'absolute',
    right: 18,
  },
  statusActionButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: 132,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  statusCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    maxWidth: 340,
    paddingHorizontal: 20,
    paddingVertical: 20,
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

export default TomTomSearchMapNative;
