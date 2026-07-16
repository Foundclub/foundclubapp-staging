import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  getSearchMapLoadingCopy,
  getSearchMapProviderErrorMessage,
  SEARCH_MAP_ERROR_REASONS,
} from '@/platform/maps/searchMapCopy';
import {
  getSearchMapProvider,
  getTomTomApiKey,
  SEARCH_MAP_PROVIDERS,
} from '@/platform/maps/searchMapProvider';
import {
  buildSearchMapHostMessage,
  buildSearchMapRuntimeHtml,
  buildTomTomProbeUrl,
  buildTomTomTileUrl,
  LEGACY_TILE_PROVIDER,
  parseSearchMapBridgeMessage,
  resolveSearchMapMarkerColor,
  SEARCH_MAP_BRIDGE_TYPES,
  TOMTOM_TILE_PROVIDER,
} from '@/platform/maps/searchMapRuntime';

const MAP_LOAD_TIMEOUT_MS = 6500;

/**
 * @param {object} props
 * @param {any} [props.command]
 * @param {string} props.errorMessage
 * @param {'results' | 'selected' | 'user' | 'region'} [props.focusMode]
  * @param {number} [props.height]
  * @param {any[]} [props.items]
 * @param {any[]} [props.renderItems]
 * @param {{ dataCount?: number; renderableCount?: number; markerCount?: number; clusterCount?: number; fallbackActive?: boolean } | null} [props.renderStats]
 * @param {string} [props.markerColor]
 * @param {string} [props.message]
 * @param {(itemId: string) => void} [props.onOpenItem]
 * @param {(region: { lat: number; lng: number; zoom?: number }) => void} [props.onRegionChangeComplete]
 * @param {(stats: { renderableCount?: number; markerCount?: number; clusterCount?: number }) => void} [props.onRenderStats]
 * @param {(itemId: string) => void} [props.onSelectItem]
 * @param {{ top?: number; right?: number; bottom?: number; left?: number } | null} [props.overlayInsets]
 * @param {{ lat: number; lng: number; zoom?: number } | null} [props.regionHint]
 * @param {string} [props.selectedItemId]
 * @param {string} props.tileAttribution
 * @param {string} props.tileUrl
 * @param {string} [props.tileProbeUrl]
 * @param {{ lat: number; lng: number } | null} [props.userLocation]
 * @returns {import('react').ReactElement}
 */
function SearchMapIframeRuntime({
  command = null,
  errorMessage,
  focusMode = 'results',
  height = 240,
  items = [],
  markerColor = '#01b3f4',
  message = 'Carte indisponible.',
  onOpenItem,
  onRegionChangeComplete,
  onRenderStats,
  onSelectItem,
  overlayInsets = null,
  regionHint = null,
  renderItems = [],
  renderStats = null,
  selectedItemId = '',
  tileAttribution,
  tileProbeUrl = '',
  tileUrl,
  userLocation = null,
}) {
  const iframeRef = useRef(/** @type {HTMLIFrameElement | null} */ (null));
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [mapRenderKey, setMapRenderKey] = useState(0);
  const [mapStatus, setMapStatus] = useState(
    tileUrl ? /** @type {'loading' | 'ready' | 'error'} */ ('loading') : 'error',
  );
  const mapId = useMemo(() => `search-map-web-${mapRenderKey}`, [mapRenderKey]);
  const loadingCopy = useMemo(() => getSearchMapLoadingCopy(), []);
  const runtimeState = useMemo(() => ({
    command,
    focusMode,
    items,
    overlayInsets,
    regionHint,
    renderItems,
    renderStats,
    selectedItemId,
    userLocation,
  }), [
    command,
    focusMode,
    items,
    overlayInsets,
    regionHint,
    renderItems,
    renderStats,
    selectedItemId,
    userLocation,
  ]);
  const html = useMemo(() => buildSearchMapRuntimeHtml({
    initialState: runtimeState,
    mapId,
    markerColor,
    tileAttribution,
    tileProbeUrl,
    tileUrl: tileUrl || LEGACY_TILE_PROVIDER.url,
  }), [mapId, markerColor, runtimeState, tileAttribution, tileProbeUrl, tileUrl]);

  useEffect(() => {
    setFrameLoaded(false);
    setMapStatus(tileUrl ? 'loading' : 'error');
  }, [mapRenderKey, tileUrl]);

  useEffect(() => {
    if (!frameLoaded || !iframeRef.current?.contentWindow || !tileUrl) {
      return;
    }

    iframeRef.current.contentWindow.postMessage(
      buildSearchMapHostMessage(mapId, runtimeState),
      '*',
    );
  }, [frameLoaded, mapId, runtimeState, tileUrl]);

  useEffect(() => {
    if (mapStatus !== 'loading' || !tileUrl) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setMapStatus('error');
    }, MAP_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [mapStatus, tileUrl]);

  useEffect(() => {
    const handleWindowMessage = (event) => {
      const bridgeMessage = parseSearchMapBridgeMessage(event?.data);
      if (!bridgeMessage || bridgeMessage.mapId !== mapId) {
        return;
      }

      switch (bridgeMessage.type) {
        case SEARCH_MAP_BRIDGE_TYPES.MAP_ERROR:
          console.warn(
            '[search-map-web] map error',
            bridgeMessage.payload?.reason,
            bridgeMessage.payload?.status,
            bridgeMessage.payload?.message,
            bridgeMessage.payload?.url,
          );
          setMapStatus((currentStatus) => (
            currentStatus === 'ready' ? currentStatus : 'error'
          ));
          break;
        case SEARCH_MAP_BRIDGE_TYPES.MAP_READY:
          setMapStatus('ready');
          break;
        case SEARCH_MAP_BRIDGE_TYPES.MAP_REGION_CHANGE:
          if (bridgeMessage.payload) {
            onRegionChangeComplete?.(bridgeMessage.payload);
          }
          break;
        case SEARCH_MAP_BRIDGE_TYPES.MAP_RENDER_STATS:
          if (bridgeMessage.payload) {
            onRenderStats?.(bridgeMessage.payload);
          }
          break;
        case SEARCH_MAP_BRIDGE_TYPES.MARKER_OPEN:
          if (bridgeMessage.payload?.itemId) {
            onOpenItem?.(bridgeMessage.payload.itemId);
          }
          break;
        case SEARCH_MAP_BRIDGE_TYPES.MARKER_SELECT:
          if (bridgeMessage.payload?.itemId) {
            onSelectItem?.(bridgeMessage.payload.itemId);
          }
          break;
        case SEARCH_MAP_BRIDGE_TYPES.FIT_RESULTS_DONE:
        default:
          break;
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [mapId, onOpenItem, onRegionChangeComplete, onRenderStats, onSelectItem]);

  return (
    <View
      style={{
        backgroundColor: '#061822',
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 24,
        borderWidth: 1,
        height,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <iframe
        key={mapId}
        onLoad={() => setFrameLoaded(true)}
        ref={iframeRef}
        sandbox="allow-scripts allow-same-origin"
        srcDoc={html}
        style={{
          border: 0,
          display: 'block',
          height: '100%',
          opacity: mapStatus === 'ready' ? 1 : 0.04,
          width: '100%',
        }}
        title="FoundClub map"
      />

      {mapStatus === 'loading' ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(6, 24, 34, 0.72)',
            inset: 0,
            justifyContent: 'center',
            paddingHorizontal: 22,
            position: 'absolute',
          }}
        >
          <View
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(7, 24, 35, 0.94)',
              borderColor: 'rgba(1, 179, 244, 0.2)',
              borderRadius: 22,
              borderWidth: 1,
              gap: 12,
              maxWidth: 320,
              paddingHorizontal: 18,
              paddingVertical: 18,
              width: '100%',
            }}
          >
            <ActivityIndicator color="#01b3f4" size="small" />
            <Text style={{ color: '#ffffff', fontWeight: '700', textAlign: 'center' }}>
              {loadingCopy.title}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.72)', textAlign: 'center' }}>
              {loadingCopy.body}
            </Text>
          </View>
        </View>
      ) : null}

      {mapStatus === 'error' ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(6, 24, 34, 0.76)',
            inset: 0,
            justifyContent: 'center',
            paddingHorizontal: 22,
            position: 'absolute',
          }}
        >
          <View
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(7, 24, 35, 0.95)',
              borderColor: 'rgba(255, 84, 89, 0.18)',
              borderRadius: 22,
              borderWidth: 1,
              gap: 12,
              maxWidth: 320,
              paddingHorizontal: 18,
              paddingVertical: 18,
              width: '100%',
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700', textAlign: 'center' }}>
              Impossible de charger la carte
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.72)', textAlign: 'center' }}>
              {errorMessage}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setMapRenderKey((current) => current + 1)}
                style={{
                  alignItems: 'center',
                  backgroundColor: '#01b3f4',
                  borderColor: '#01b3f4',
                  borderRadius: 999,
                  borderWidth: 1,
                  flex: 1,
                  justifyContent: 'center',
                  minHeight: 44,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: '#061822', fontWeight: '700' }}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {mapStatus === 'ready' && items.length === 0 && (!renderItems || renderItems.length === 0) ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: 'rgba(7, 24, 35, 0.58)',
            borderRadius: 14,
            bottom: 12,
            left: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            position: 'absolute',
            right: 12,
          }}
        >
          <Text style={{ color: '#e9f2ff', textAlign: 'center' }}>{message}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * @param {object} props
 * @param {'results' | 'selected' | 'user' | 'region'} [props.focusMode]
 * @param {number} [props.height]
 * @param {import('@/utils/searchMap').SearchMapItem[]} [props.items]
 * @param {any[]} [props.renderItems]
 * @param {{ dataCount?: number; renderableCount?: number; markerCount?: number; clusterCount?: number; fallbackActive?: boolean } | null} [props.renderStats]
 * @param {string} [props.message]
 * @param {(itemId: string) => void} [props.onOpenItem]
 * @param {(region: { lat: number; lng: number; zoom?: number }) => void} [props.onRegionChangeComplete]
 * @param {(stats: { renderableCount?: number; markerCount?: number; clusterCount?: number }) => void} [props.onRenderStats]
 * @param {(itemId: string) => void} [props.onSelectItem]
 * @param {{ top?: number; right?: number; bottom?: number; left?: number } | null} [props.overlayInsets]
 * @param {{ lat: number, lng: number, zoom?: number } | null} [props.regionHint]
 * @param {'events' | 'clubs' | 'reservations'} [props.scope]
 * @param {string} [props.selectedItemId]
 * @param {{ lat: number; lng: number } | null} [props.userLocation]
 * @param {any} [props.command]
 * @returns {import('react').ReactElement}
 */
export const renderMap = ({
  command = null,
  focusMode = 'results',
  height = 240,
  items = [],
  message = 'Carte web indisponible.',
  onOpenItem,
  onRegionChangeComplete,
  onRenderStats,
  onSelectItem,
  overlayInsets = null,
  regionHint = null,
  renderItems = [],
  renderStats = null,
  scope = 'events',
  selectedItemId = '',
  userLocation = null,
} = {}) => {
  const provider = getSearchMapProvider();
  const tomTomApiKey = getTomTomApiKey();
  const markerColor = resolveSearchMapMarkerColor(scope);

  if (provider === SEARCH_MAP_PROVIDERS.tomtom) {
    return (
      <SearchMapIframeRuntime
        command={command}
        errorMessage={tomTomApiKey
          ? getSearchMapProviderErrorMessage(SEARCH_MAP_ERROR_REASONS.tilesUnavailable)
          : getSearchMapProviderErrorMessage(SEARCH_MAP_ERROR_REASONS.missingApiKey)}
        focusMode={focusMode}
        height={height}
        items={items}
        markerColor={markerColor}
        message={message}
        onOpenItem={onOpenItem}
        onRegionChangeComplete={onRegionChangeComplete}
        onRenderStats={onRenderStats}
        onSelectItem={onSelectItem}
        overlayInsets={overlayInsets}
        regionHint={regionHint}
        renderItems={renderItems}
        renderStats={renderStats}
        selectedItemId={selectedItemId}
        tileAttribution={tomTomApiKey
          ? TOMTOM_TILE_PROVIDER.attribution
          : LEGACY_TILE_PROVIDER.attribution}
        tileProbeUrl={tomTomApiKey ? buildTomTomProbeUrl(tomTomApiKey) : ''}
        tileUrl={tomTomApiKey ? buildTomTomTileUrl(tomTomApiKey) : ''}
        userLocation={userLocation}
      />
    );
  }

  return (
    <SearchMapIframeRuntime
      command={command}
      errorMessage="Les tuiles de la carte legacy ne répondent pas pour le moment."
      focusMode={focusMode}
      height={height}
      items={items}
      markerColor={markerColor}
      message={message}
      onOpenItem={onOpenItem}
      onRegionChangeComplete={onRegionChangeComplete}
      onRenderStats={onRenderStats}
      onSelectItem={onSelectItem}
      overlayInsets={overlayInsets}
      regionHint={regionHint}
      renderItems={renderItems}
      renderStats={renderStats}
      selectedItemId={selectedItemId}
      tileAttribution={LEGACY_TILE_PROVIDER.attribution}
      tileProbeUrl=""
      tileUrl={LEGACY_TILE_PROVIDER.url}
      userLocation={userLocation}
    />
  );
};

export const openExternalMap = async ({ label, latitude, longitude }) => {
  if (typeof window === 'undefined') {
    return;
  }

  const query = encodeURIComponent(label || `${latitude},${longitude}`);
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${query}`,
    '_blank',
    'noopener,noreferrer',
  );
};

export default {
  openExternalMap,
  renderMap,
};
