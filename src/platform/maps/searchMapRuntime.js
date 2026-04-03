import LEAFLET_CSS_SOURCE from '@/platform/maps/vendor/leafletCssSource';
import LEAFLET_JS_SOURCE from '@/platform/maps/vendor/leafletJsSource';

const OSM_TILE_ATTRIBUTION = 'OpenStreetMap';
const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const SEARCH_MAP_BRIDGE_SOURCE = 'foundclub-search-map';
const SEARCH_MAP_HOST_SOURCE = 'foundclub-search-map-host';
const TOMTOM_TILE_ATTRIBUTION = 'TomTom';
const TOMTOM_TILE_SUBDOMAINS = ['a', 'b', 'c', 'd'];
const TOMTOM_TILE_STYLE = 'basic/night';

const DEFAULT_CENTER = {
  lat: 43.2965,
  lng: 5.3698,
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const safeJson = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026');

export const SEARCH_MAP_BRIDGE_TYPES = Object.freeze({
  FIT_RESULTS_DONE: 'FIT_RESULTS_DONE',
  MAP_DIAGNOSTIC: 'MAP_DIAGNOSTIC',
  MAP_ERROR: 'MAP_ERROR',
  MAP_READY: 'MAP_READY',
  MAP_REGION_CHANGE: 'MAP_REGION_CHANGE',
  MAP_RENDER_STATS: 'MAP_RENDER_STATS',
  MARKER_OPEN: 'MARKER_OPEN',
  MARKER_SELECT: 'MARKER_SELECT',
  SYNC_STATE: 'SYNC_STATE',
});

export const resolveSearchMapMarkerColor = (scope) => (
  scope === 'clubs' ? '#ffd700' : '#01b3f4'
);

export const buildTomTomTileUrl = (apiKey) => (
  `https://{s}.api.tomtom.com/map/1/tile/${TOMTOM_TILE_STYLE}/{z}/{x}/{y}.png?tileSize=256&key=${encodeURIComponent(apiKey)}`
);

export const buildTomTomProbeUrl = (apiKey) => (
  buildTomTomTileUrl(apiKey)
    .replace('{s}', TOMTOM_TILE_SUBDOMAINS[0])
    .replace('{z}', '0')
    .replace('{x}', '0')
    .replace('{y}', '0')
);

export const buildSearchMapHostMessage = (mapId, payload) => ({
  mapId,
  payload,
  source: SEARCH_MAP_HOST_SOURCE,
  type: SEARCH_MAP_BRIDGE_TYPES.SYNC_STATE,
});

export const buildSearchMapSyncScript = (mapId, payload) => {
  const encodedPayload = encodeURIComponent(JSON.stringify(payload));
  return `
    (function() {
      var nextState = JSON.parse(decodeURIComponent('${encodedPayload}'));
      if (window.__FOUNDCLUB_SEARCH_MAP__ && typeof window.__FOUNDCLUB_SEARCH_MAP__.syncState === 'function') {
        window.__FOUNDCLUB_SEARCH_MAP__.syncState(nextState);
      } else {
        window.dispatchEvent(new MessageEvent('message', {
          data: ${safeJson(buildSearchMapHostMessage(mapId, payload))}
        }));
      }
    })();
    true;
  `;
};

export const buildSearchMapCommandScript = (mapId, command) => {
  const encodedCommand = encodeURIComponent(JSON.stringify(command));
  return `
    (function() {
      var nextCommand = JSON.parse(decodeURIComponent('${encodedCommand}'));
      if (
        window.__FOUNDCLUB_SEARCH_MAP__
        && typeof window.__FOUNDCLUB_SEARCH_MAP__.dispatchCommand === 'function'
      ) {
        window.__FOUNDCLUB_SEARCH_MAP__.dispatchCommand(nextCommand);
      } else if (
        window.__FOUNDCLUB_SEARCH_MAP__
        && typeof window.__FOUNDCLUB_SEARCH_MAP__.syncState === 'function'
      ) {
        window.__FOUNDCLUB_SEARCH_MAP__.syncState({ command: nextCommand });
      } else {
        window.dispatchEvent(new MessageEvent('message', {
          data: ${safeJson(buildSearchMapHostMessage(mapId, { command }))}
        }));
      }
    })();
    true;
  `;
};

export const parseSearchMapBridgeMessage = (rawMessage) => {
  if (!rawMessage) {
    return null;
  }

  let parsed = rawMessage;
  if (typeof rawMessage === 'string') {
    try {
      parsed = JSON.parse(rawMessage);
    } catch (error) {
      return null;
    }
  }

  if (
    !parsed
    || typeof parsed !== 'object'
    || parsed.source !== SEARCH_MAP_BRIDGE_SOURCE
    || typeof parsed.type !== 'string'
  ) {
    return null;
  }

  return parsed;
};

export const buildSearchMapRuntimeHtml = ({
  initialState,
  mapId,
  markerColor,
  tileAttribution,
  tileProbeUrl,
  tileUrl,
}) => `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    />
    <style>
      ${LEAFLET_CSS_SOURCE}

      html, body {
        background: #061822;
        height: 100%;
        margin: 0;
        overflow: hidden;
        padding: 0;
        width: 100%;
      }

      #map {
        background:
          radial-gradient(circle at top, rgba(0, 179, 244, 0.18), transparent 44%),
          linear-gradient(180deg, #0b1f2b 0%, #061822 100%);
        height: 100%;
        width: 100%;
      }

      .leaflet-container {
        background: transparent;
        color: #f3f8ff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        height: 100%;
        width: 100%;
      }

      .leaflet-control-zoom {
        border: 1px solid rgba(255,255,255,0.1) !important;
        box-shadow: 0 12px 24px rgba(0,0,0,0.22) !important;
      }

      .leaflet-control-zoom a {
        background: rgba(6, 24, 34, 0.92) !important;
        color: #f3f8ff !important;
      }

      .fc-marker {
        align-items: center;
        border-radius: 999px;
        display: flex;
        justify-content: center;
        transition: opacity .16s ease, transform .16s ease;
      }

      @keyframes fcMarkerPulse {
        0% {
          opacity: .92;
          transform: scale(.92);
        }
        70% {
          opacity: 0;
          transform: scale(1.12);
        }
        100% {
          opacity: 0;
          transform: scale(1.14);
        }
      }

      .fc-provider-badge {
        backdrop-filter: blur(12px);
        background: rgba(6, 24, 34, 0.84);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 999px;
        bottom: 12px;
        color: rgba(255,255,255,0.72);
        font: 600 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        left: 12px;
        padding: 7px 10px;
        position: absolute;
        z-index: 900;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div class="fc-provider-badge">${escapeHtml(tileAttribution)}</div>
    <script>
      ${LEAFLET_JS_SOURCE}

      (function () {
        var DEFAULT_CENTER = ${safeJson(DEFAULT_CENTER)};
        var HOST_SOURCE = ${safeJson(SEARCH_MAP_HOST_SOURCE)};
        var INITIAL_STATE = ${safeJson(initialState)};
        var MAP_ID = ${safeJson(mapId)};
        var MARKER_COLOR = ${safeJson(markerColor)};
        var SOURCE = ${safeJson(SEARCH_MAP_BRIDGE_SOURCE)};
        var TILE_URL = ${safeJson(tileUrl)};
        var TILE_PROBE_URL = ${safeJson(tileProbeUrl || '')};
        var currentState = INITIAL_STATE;
        var hasSentError = false;
        var hasSentReady = false;
        var isApplyingFocus = false;
        var isWaitingForFocusedTiles = true;
        var lastClusterSignature = '';
        var lastItemsSignature = '';
        var lastAppliedFocusSignature = '';
        var lastRenderStatsSignature = '';
        var lastRenderedZoom = null;
        var lastSelectedItemId = '';
        var map = null;
        var markerLayer = null;
        var markersById = {};
        var lastHandledCommandId = '';
        var readyTileCount = 0;
        var tileErrorCount = 0;
        var firstRenderedItemsCount = null;

        var sanitizeUrl = function (value) {
          if (!value) return '';
          return String(value).replace(/key=([^&]+)/, 'key=***');
        };

        var postBridgeMessage = function (type, payload) {
          var message = {
            mapId: MAP_ID,
            payload: payload || {},
            source: SOURCE,
            type: type,
          };

          if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
            window.ReactNativeWebView.postMessage(JSON.stringify(message));
            return;
          }

          if (window.parent && window.parent !== window) {
            window.parent.postMessage(message, '*');
          }
        };

        var postDiagnostic = function (stage, payload) {
          postBridgeMessage('MAP_DIAGNOSTIC', Object.assign({
            stage: stage,
          }, payload || {}));
        };

        var buildRuntimeErrorPayload = function (phase, error, extra) {
          var payload = Object.assign({
            message: error && error.message ? error.message : 'runtime_error',
            name: error && error.name ? error.name : '',
            phase: phase || '',
            reason: 'runtime_error',
            stack: error && error.stack ? String(error.stack) : '',
          }, extra || {});

          if (payload.url) {
            payload.url = sanitizeUrl(payload.url);
          }

          return payload;
        };

        var runSafely = function (phase, callback, extra) {
          try {
            return callback();
          } catch (error) {
            reportMapError(buildRuntimeErrorPayload(phase, error, extra));
            return null;
          }
        };

        var reportMapError = function (payload) {
          if (hasSentReady) return;
          if (hasSentError || hasSentReady) return;
          hasSentError = true;
          postBridgeMessage('MAP_ERROR', payload || {});
        };

        var markMapReady = function () {
          if (isWaitingForFocusedTiles) return;
          if (hasSentReady) return;
          var center = map ? map.getCenter() : null;
          hasSentReady = true;
          hasSentError = false;
          postDiagnostic('map_ready', {
            centerLat: center ? center.lat : undefined,
            centerLng: center ? center.lng : undefined,
            readyTileCount: readyTileCount,
            tileErrorCount: tileErrorCount,
            zoom: map ? map.getZoom() : undefined,
          });
          postBridgeMessage('MAP_READY');
        };

        var classifyProbeStatus = function (status) {
          if (status === 401 || status === 403) return 'invalid_api_key';
          if (status === 400) return 'invalid_tile_request';
          if (status === 429) return 'rate_limited';
          if (status >= 500) return 'provider_unavailable';
          return 'tile_error';
        };

        var probeTileAvailability = function () {
          if (!TILE_PROBE_URL || typeof window.fetch !== 'function') return;

          postDiagnostic('probe_start', {
            url: sanitizeUrl(TILE_PROBE_URL),
          });

          window.fetch(TILE_PROBE_URL, { method: 'GET' })
            .then(function (response) {
              if (response.ok || hasSentReady || hasSentError) {
                postDiagnostic('probe_ok', {
                  status: response.status,
                  url: sanitizeUrl(TILE_PROBE_URL),
                });
                return;
              }

              postDiagnostic('probe_failed', {
                status: response.status,
                url: sanitizeUrl(TILE_PROBE_URL),
              });
              reportMapError({
                message: 'tile_probe_failed',
                reason: classifyProbeStatus(response.status),
                status: response.status,
                url: sanitizeUrl(TILE_PROBE_URL),
              });
            })
            .catch(function (error) {
              if (hasSentReady || hasSentError) {
                return;
              }
              postDiagnostic('probe_network_error', buildRuntimeErrorPayload(
                'tile_probe',
                error,
                { url: sanitizeUrl(TILE_PROBE_URL) }
              ));
            });
        };

        var createMarkerIcon = function (entry, isSelected, showSequenceLabel) {
          var isEventMarker = entry && entry.item && entry.item.type === 'events';
          var markerSize = isSelected
            ? (isEventMarker ? 40 : 42)
            : (isEventMarker ? 34 : 36);
          var haloSize = markerSize + (isEventMarker ? 18 : 18);
          var borderSize = isSelected ? 3 : 2;
          var markerLabel = showSequenceLabel && entry && Number.isFinite(entry.order)
            ? String(entry.order)
            : '';
          var backgroundColor = isSelected ? '#ffffff' : MARKER_COLOR;
          var borderColor = isSelected ? MARKER_COLOR : 'rgba(255,255,255,0.86)';
          var haloColor = isSelected
            ? 'rgba(1, 179, 244, 0.36)'
            : (isEventMarker ? 'rgba(1, 179, 244, 0.24)' : 'rgba(255, 215, 0, 0.32)');
          var shadow = isSelected
            ? '0 16px 30px rgba(0,0,0,0.34)'
            : '0 12px 24px rgba(0,0,0,0.28)';
          var contentHtml = markerLabel
            ? '<span style="' +
                'color:' + (isSelected ? '#061822' : (isEventMarker ? '#ffffff' : '#061822')) + ';' +
                'font:700 13px/1 -apple-system, BlinkMacSystemFont, \\"Segoe UI\\", sans-serif;' +
              '">' + markerLabel + '</span>'
            : '<span style="' +
                'background:' + (isSelected ? MARKER_COLOR : '#ffffff') + ';' +
                'border-radius:999px;' +
                'display:block;' +
                'height:' + (isSelected ? 10 : 8) + 'px;' +
                'width:' + (isSelected ? 10 : 8) + 'px;' +
              '"></span>';
          var offset = (haloSize - markerSize) / 2;

          return window.L.divIcon({
            className: '',
            html: '<span class="fc-marker" style="' +
              'height:' + haloSize + 'px;' +
              'position:relative;' +
              'width:' + haloSize + 'px;' +
            '">' +
              '<span style="' +
                'animation:' + (isSelected ? 'fcMarkerPulse 1.9s ease-out infinite' : 'none') + ';' +
                'background:' + haloColor + ';' +
                'border-radius:999px;' +
                'display:block;' +
                'height:' + haloSize + 'px;' +
                'left:0;' +
                'position:absolute;' +
                'top:0;' +
                'width:' + haloSize + 'px;' +
              '"></span>' +
              '<span style="' +
                'align-items:center;' +
                'background:' + backgroundColor + ';' +
                'border:' + borderSize + 'px solid ' + borderColor + ';' +
                'border-radius:999px;' +
                'box-shadow:' + shadow + ';' +
                'display:flex;' +
                'height:' + markerSize + 'px;' +
                'justify-content:center;' +
                'left:' + offset + 'px;' +
                'position:absolute;' +
                'top:' + offset + 'px;' +
                'transform:' + (isSelected ? 'scale(1.06)' : 'scale(1)') + ';' +
                'width:' + markerSize + 'px;' +
              '">' +
                contentHtml +
              '</span>' +
            '</span>',
            iconAnchor: [haloSize / 2, haloSize / 2],
            iconSize: [haloSize, haloSize],
          });
        };

        var createClusterIcon = function (count) {
          var clusterSize = count >= 100 ? 56 : (count >= 10 ? 50 : 46);
          return window.L.divIcon({
            className: '',
            html: '<span class="fc-marker" style="' +
              'background:' + MARKER_COLOR + ';' +
              'border:3px solid rgba(255,255,255,0.84);' +
              'box-shadow:0 0 0 7px rgba(255,255,255,0.16), 0 16px 28px rgba(0,0,0,0.32);' +
              'color:#061822;' +
              'font:700 ' + (count >= 100 ? '13px' : '12px') + '/1 -apple-system, BlinkMacSystemFont, \\"Segoe UI\\", sans-serif;' +
              'height:' + clusterSize + 'px;' +
              'width:' + clusterSize + 'px;' +
            '">' +
              '<span style="align-items:center;display:flex;height:100%;justify-content:center;width:100%;">' + count + '</span>' +
            '</span>',
            iconAnchor: [clusterSize / 2, clusterSize / 2],
            iconSize: [clusterSize, clusterSize],
          });
        };

        var buildItemsSignature = function (items) {
          return items.map(function (item) {
            return item.id + ':' + item.lat.toFixed(5) + ':' + item.lng.toFixed(5);
          }).join('|');
        };

        var getOverlayInsets = function () {
          var insets = currentState && currentState.overlayInsets ? currentState.overlayInsets : {};
          return {
            bottom: isFinite(insets.bottom) ? Math.max(96, insets.bottom) : 208,
            left: isFinite(insets.left) ? Math.max(24, insets.left) : 48,
            right: isFinite(insets.right) ? Math.max(24, insets.right) : 48,
            top: isFinite(insets.top) ? Math.max(72, insets.top) : 132,
          };
        };

        var getFocusYOffset = function () {
          var insets = getOverlayInsets();
          return Math.max(0, Math.min(168, Math.round((insets.bottom - insets.top) * 0.26)));
        };

        var getClusterCellSize = function () {
          if (!map) return null;
          var currentZoom = map.getZoom();
          if (currentZoom >= 16) return null;
          if (currentZoom >= 14) return 54;
          if (currentZoom >= 12) return 62;
          if (currentZoom >= 10) return 74;
          return 88;
        };

        var buildRenderableEntries = function (items) {
          var cellSize = getClusterCellSize();
          var indexedItems = items.map(function (item, index) {
            return Object.assign({
              __fcOrder: index + 1,
            }, item);
          });

          if (!cellSize || indexedItems.length < 10 || !map || typeof map.project !== 'function') {
            return indexedItems.map(function (item) {
              return {
                isCluster: false,
                item: item,
                key: item.id,
                lat: item.lat,
                lng: item.lng,
                order: item.__fcOrder,
              };
            });
          }

          var groups = {};
          indexedItems.forEach(function (item) {
            var projected = map.project(window.L.latLng(item.lat, item.lng), map.getZoom());
            var key = Math.floor(projected.x / cellSize) + ':' + Math.floor(projected.y / cellSize);
            groups[key] = groups[key] || [];
            groups[key].push(item);
          });

          return Object.keys(groups).map(function (key) {
            var groupItems = groups[key];
            if (groupItems.length === 1) {
              var single = groupItems[0];
              return {
                isCluster: false,
                item: single,
                key: single.id,
                lat: single.lat,
                lng: single.lng,
                order: single.__fcOrder,
              };
            }

            var center = groupItems.reduce(function (acc, item) {
              return {
                lat: acc.lat + item.lat,
                lng: acc.lng + item.lng,
              };
            }, { lat: 0, lng: 0 });

            return {
              count: groupItems.length,
              isCluster: true,
              items: groupItems,
              key: key,
              lat: center.lat / groupItems.length,
              lng: center.lng / groupItems.length,
            };
          });
        };

        var clearMarkers = function () {
          if (!markerLayer) return;
          markerLayer.clearLayers();
          markersById = {};
        };

        var setFocusedView = function (lat, lng, zoom, yOffset) {
          runSafely('set_focused_view', function () {
            var safeZoom = Number.isFinite(zoom) ? zoom : map.getZoom();
            var nextCenter = window.L.latLng(lat, lng);
            if (Number.isFinite(yOffset) && yOffset !== 0) {
              try {
                nextCenter = map.unproject(
                  map.project(nextCenter, safeZoom).add(window.L.point(0, yOffset)),
                  safeZoom
                );
              } catch (error) {
                postDiagnostic('focus_offset_fallback', buildRuntimeErrorPayload(
                  'focus_offset',
                  error,
                  {
                    lat: lat,
                    lng: lng,
                    yOffset: yOffset,
                    zoom: safeZoom,
                  }
                ));
              }
            }
            isApplyingFocus = true;
            map.setView(nextCenter, safeZoom);
          }, {
            lat: lat,
            lng: lng,
            yOffset: yOffset,
            zoom: zoom,
          });
        };

        var fitToResults = function () {
          var items = Array.isArray(currentState.items) ? currentState.items : [];
          var overlayInsets = getOverlayInsets();
          postDiagnostic('focus_results', {
            itemsCount: items.length,
          });

          if (!items.length) {
            setFocusedView(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, 6, 0);
            postBridgeMessage('FIT_RESULTS_DONE', { reason: 'empty' });
            return;
          }

          if (items.length === 1) {
            postDiagnostic('focus_results_single', {
              lat: items[0].lat,
              lng: items[0].lng,
              zoom: 13,
              yOffset: getFocusYOffset(),
            });
            setFocusedView(items[0].lat, items[0].lng, 13, getFocusYOffset());
            postBridgeMessage('FIT_RESULTS_DONE', { reason: 'single' });
            return;
          }

          var bounds = window.L.latLngBounds(
            items.map(function (item) {
              return [item.lat, item.lng];
            })
          );

          map.fitBounds(bounds, {
            maxZoom: 13,
            paddingBottomRight: [overlayInsets.right, overlayInsets.bottom],
            paddingTopLeft: [overlayInsets.left, overlayInsets.top],
          });
          postBridgeMessage('FIT_RESULTS_DONE', { reason: 'results' });
        };

        var focusSelectedItem = function () {
          var selectedMarker = markersById[currentState.selectedItemId];
          if (!selectedMarker) {
            fitToResults();
            return;
          }

          var selectedLatLng = selectedMarker.getLatLng();

          postDiagnostic('focus_selected', {
            lat: selectedLatLng.lat,
            lng: selectedLatLng.lng,
            selectedItemId: currentState.selectedItemId,
            zoom: 13,
            yOffset: getFocusYOffset(),
          });
          setFocusedView(selectedLatLng.lat, selectedLatLng.lng, 13, getFocusYOffset());
          postBridgeMessage('FIT_RESULTS_DONE', { reason: 'selected' });
        };

        var focusUserLocation = function () {
          if (!currentState.userLocation || !isFinite(currentState.userLocation.lat) || !isFinite(currentState.userLocation.lng)) {
            fitToResults();
            return;
          }

          postDiagnostic('focus_user', {
            lat: currentState.userLocation.lat,
            lng: currentState.userLocation.lng,
          });
          setFocusedView(currentState.userLocation.lat, currentState.userLocation.lng, 14, getFocusYOffset());
          postBridgeMessage('FIT_RESULTS_DONE', { reason: 'user' });
        };

        var focusRegionHint = function () {
          if (!currentState.regionHint || !isFinite(currentState.regionHint.lat) || !isFinite(currentState.regionHint.lng)) {
            fitToResults();
            return;
          }

          if (
            isFinite(currentState.regionHint.north)
            && isFinite(currentState.regionHint.south)
            && isFinite(currentState.regionHint.east)
            && isFinite(currentState.regionHint.west)
          ) {
            var hintedBounds = window.L.latLngBounds(
              [currentState.regionHint.south, currentState.regionHint.west],
              [currentState.regionHint.north, currentState.regionHint.east]
            );

            postDiagnostic('focus_region_bounds', {
              east: currentState.regionHint.east,
              north: currentState.regionHint.north,
              south: currentState.regionHint.south,
              west: currentState.regionHint.west,
              zoom: currentState.regionHint.zoom,
            });

            map.fitBounds(hintedBounds, {
              maxZoom: isFinite(currentState.regionHint.zoom) ? currentState.regionHint.zoom : 13,
              paddingBottomRight: [getOverlayInsets().right, getOverlayInsets().bottom],
              paddingTopLeft: [getOverlayInsets().left, getOverlayInsets().top],
            });
            postBridgeMessage('FIT_RESULTS_DONE', { reason: 'region' });
            return;
          }

          postDiagnostic('focus_region', {
            lat: currentState.regionHint.lat,
            lng: currentState.regionHint.lng,
            zoom: currentState.regionHint.zoom,
          });
          setFocusedView(
            currentState.regionHint.lat,
            currentState.regionHint.lng,
            currentState.regionHint.zoom,
            0
          );
          postBridgeMessage('FIT_RESULTS_DONE', { reason: 'region' });
        };

        var emitRegionChange = function () {
          if (!map) return;
          var center = map.getCenter();
          var bounds = typeof map.getBounds === 'function' ? map.getBounds() : null;
          var north = bounds && typeof bounds.getNorth === 'function' ? bounds.getNorth() : undefined;
          var south = bounds && typeof bounds.getSouth === 'function' ? bounds.getSouth() : undefined;
          var east = bounds && typeof bounds.getEast === 'function' ? bounds.getEast() : undefined;
          var west = bounds && typeof bounds.getWest === 'function' ? bounds.getWest() : undefined;
          postBridgeMessage('MAP_REGION_CHANGE', {
            east: east,
            lat: center.lat,
            latitudeDelta: isFinite(north) && isFinite(south) ? Math.abs(north - south) : undefined,
            lng: center.lng,
            longitudeDelta: isFinite(east) && isFinite(west) ? Math.abs(east - west) : undefined,
            north: north,
            south: south,
            west: west,
            zoom: map.getZoom(),
          });
        };

        var applyCommand = function () {
          if (!map || !currentState.command || !currentState.command.id) {
            return;
          }

          if (currentState.command.id === lastHandledCommandId) {
            return;
          }

          lastHandledCommandId = currentState.command.id;

          if (currentState.command.type === 'zoom_in') {
            postDiagnostic('command_applied', {
              type: currentState.command.type,
              zoomBefore: map.getZoom(),
            });
            map.zoomIn();
            return;
          }

          if (currentState.command.type === 'zoom_out') {
            postDiagnostic('command_applied', {
              type: currentState.command.type,
              zoomBefore: map.getZoom(),
            });
            map.zoomOut();
            return;
          }

          if (currentState.command.type === 'focus_results') {
            postDiagnostic('command_applied', {
              type: currentState.command.type,
              zoomBefore: map.getZoom(),
            });
            fitToResults();
            return;
          }

          if (currentState.command.type === 'focus_region') {
            postDiagnostic('command_applied', {
              type: currentState.command.type,
              zoomBefore: map.getZoom(),
            });
            focusRegionHint();
          }
        };

        var buildFocusSignature = function () {
          var items = Array.isArray(currentState.items) ? currentState.items : [];
          var regionHint = currentState.regionHint || null;
          var userLocation = currentState.userLocation || null;
          var focusMode = currentState.focusMode || 'results';
          var selectedItem = currentState.selectedItemId
            ? items.find(function (item) { return item.id === currentState.selectedItemId; })
            : null;
          var focusTargetSignature = '';

          if (focusMode === 'results') {
            focusTargetSignature = items.map(function (item) {
              return item.id + ':' + item.lat.toFixed(5) + ':' + item.lng.toFixed(5);
            }).join('|');
          } else if (focusMode === 'selected') {
            focusTargetSignature = [
              currentState.selectedItemId || '',
              selectedItem ? selectedItem.lat.toFixed(5) : '',
              selectedItem ? selectedItem.lng.toFixed(5) : '',
            ].join(':');
          } else if (focusMode === 'region' && regionHint) {
            focusTargetSignature = [
              regionHint.lat,
              regionHint.lng,
              regionHint.zoom || '',
              regionHint.north || '',
              regionHint.south || '',
              regionHint.east || '',
              regionHint.west || '',
            ].join(':');
          } else if (focusMode === 'user' && userLocation) {
            focusTargetSignature = [userLocation.lat, userLocation.lng].join(':');
          }

          return [
            focusMode,
            focusTargetSignature,
          ].join('||');
        };

        var applyFocus = function () {
          if (!map) return;

          if (currentState.focusMode === 'region' && currentState.regionHint) {
            focusRegionHint();
            return;
          }

          if (currentState.focusMode === 'user') {
            focusUserLocation();
            return;
          }

          if (currentState.focusMode === 'selected' && currentState.selectedItemId) {
            focusSelectedItem();
            return;
          }

          fitToResults();
        };

        var renderMarkers = function () {
          return runSafely('render_markers', function () {
            var items = Array.isArray(currentState.items) ? currentState.items : [];
            var itemsSignature = buildItemsSignature(items);
            var renderableEntries = buildRenderableEntries(items);
            var markerCount = renderableEntries.filter(function (entry) { return !entry.isCluster; }).length;
            var clusterCount = renderableEntries.filter(function (entry) { return entry.isCluster; }).length;
            var renderStatsSignature = [
              renderableEntries.length,
              markerCount,
              clusterCount,
            ].join(':');
            var clusterSignature = renderableEntries.map(function (entry) {
              return entry.key + ':' + entry.lat.toFixed(5) + ':' + entry.lng.toFixed(5) + ':' + (entry.count || 1);
            }).join('|');

            if (firstRenderedItemsCount !== items.length) {
              firstRenderedItemsCount = items.length;
              postDiagnostic('markers_render', {
                itemsCount: items.length,
                zoom: map.getZoom(),
              });
            }

            var showSequenceLabel = items.length <= 9;

            if (
              itemsSignature === lastItemsSignature
              && clusterSignature === lastClusterSignature
              && lastRenderedZoom === map.getZoom()
              && currentState.selectedItemId !== lastSelectedItemId
            ) {
              Object.keys(markersById).forEach(function (markerKey) {
                var marker = markersById[markerKey];
                if (!marker || marker.__fcCluster) return;
                marker.setIcon(createMarkerIcon(
                  marker.__fcEntry,
                  markerKey === currentState.selectedItemId,
                  showSequenceLabel
                ));
              });
              lastSelectedItemId = currentState.selectedItemId;
              if (lastRenderStatsSignature !== renderStatsSignature) {
                lastRenderStatsSignature = renderStatsSignature;
                postBridgeMessage('MAP_RENDER_STATS', {
                  clusterCount: clusterCount,
                  markerCount: markerCount,
                  renderableCount: renderableEntries.length,
                });
              }
              return;
            }

            clearMarkers();

            renderableEntries.forEach(function (entry) {
              var marker = window.L.marker([entry.lat, entry.lng], {
                icon: entry.isCluster
                  ? createClusterIcon(entry.count)
                  : createMarkerIcon(
                    entry,
                    entry.item.id === currentState.selectedItemId,
                    showSequenceLabel
                  ),
              });

              marker.__fcCluster = Boolean(entry.isCluster);
              marker.__fcEntry = entry;

              marker.on('click', function () {
                runSafely('marker_click', function () {
                  if (entry.isCluster) {
                    map.setView([entry.lat, entry.lng], Math.min(map.getZoom() + 2, 16));
                    return;
                  }

                  if (currentState.selectedItemId === entry.item.id) {
                    postBridgeMessage('MARKER_OPEN', { itemId: entry.item.id });
                    return;
                  }

                  postBridgeMessage('MARKER_SELECT', { itemId: entry.item.id });
                }, {
                  itemId: entry.item && entry.item.id ? entry.item.id : '',
                  isCluster: Boolean(entry.isCluster),
                });
              });

              marker.addTo(markerLayer);
              markersById[entry.key] = marker;
            });

            lastItemsSignature = itemsSignature;
            lastClusterSignature = clusterSignature;
            lastRenderedZoom = map.getZoom();
            lastSelectedItemId = currentState.selectedItemId;
            if (lastRenderStatsSignature !== renderStatsSignature) {
              lastRenderStatsSignature = renderStatsSignature;
              postBridgeMessage('MAP_RENDER_STATS', {
                clusterCount: clusterCount,
                markerCount: markerCount,
                renderableCount: renderableEntries.length,
              });
            }
          });
        };

        var ensureMap = function () {
          if (map || !window.L) {
            return Boolean(map);
          }

          postDiagnostic('leaflet_ready', {
            version: window.L && window.L.version ? window.L.version : '',
          });

          map = runSafely('create_map', function () {
            return window.L.map('map', {
              attributionControl: false,
              zoomControl: false,
            });
          });
          if (!map) {
            return false;
          }
          postDiagnostic('map_created');

          markerLayer = window.L.layerGroup().addTo(map);

          var tileLayer = window.L.tileLayer(TILE_URL, {
            maxZoom: 19,
            subdomains: ${safeJson(TOMTOM_TILE_SUBDOMAINS)},
            tileSize: 256,
          });
          postDiagnostic('tile_layer_created', {
            tileUrl: sanitizeUrl(TILE_URL),
          });

          tileLayer.on('tileload', function () {
            readyTileCount += 1;
            if (readyTileCount === 1) {
              postDiagnostic('first_tile_load', {
                tileUrl: sanitizeUrl(TILE_URL),
              });
            }
            markMapReady();
          });

          tileLayer.on('load', function () {
            if (readyTileCount > 0) {
              markMapReady();
            }
          });

          tileLayer.on('tileerror', function (event) {
            tileErrorCount += 1;
            postDiagnostic('tile_error', {
              count: tileErrorCount,
              url: sanitizeUrl(event && event.tile && event.tile.src ? event.tile.src : ''),
            });
            if (tileErrorCount >= 3) {
              reportMapError({
                message: event && event.error && event.error.message ? event.error.message : 'tile_error',
                reason: 'tiles_unavailable',
                url: sanitizeUrl(event && event.tile && event.tile.src ? event.tile.src : ''),
              });
            }
          });

          probeTileAvailability();
          tileLayer.addTo(map);
          map.on('moveend', function () {
            runSafely('moveend', function () {
              if (isApplyingFocus) {
                isApplyingFocus = false;
                return;
              }
              emitRegionChange();
            });
          });
          map.on('zoomend', function () {
            runSafely('zoomend', function () {
              renderMarkers();
            });
          });
          map.whenReady(function () {
            window.setTimeout(function () {
              runSafely('when_ready', function () {
                map.invalidateSize();
                readyTileCount = 0;
                postDiagnostic('focus_bootstrap_start', {
                  focusMode: currentState.focusMode || 'results',
                  itemsCount: Array.isArray(currentState.items) ? currentState.items.length : 0,
                });
                applyFocus();
                lastAppliedFocusSignature = buildFocusSignature();
                isWaitingForFocusedTiles = false;
                renderMarkers();
                emitRegionChange();
              });
            }, 60);
          });

          return true;
        };

        var syncState = function (nextState) {
          runSafely('sync_state', function () {
            currentState = Object.assign({}, currentState, nextState || {});
            var items = Array.isArray(currentState.items) ? currentState.items : [];
            var firstItem = items[0] || null;
            postDiagnostic('sync_state', {
              focusMode: currentState.focusMode || 'results',
              firstItemLat: firstItem && isFinite(firstItem.lat) ? firstItem.lat : undefined,
              firstItemLng: firstItem && isFinite(firstItem.lng) ? firstItem.lng : undefined,
              hasRegionHint: Boolean(currentState.regionHint),
              itemsCount: items.length,
              selectedItemId: currentState.selectedItemId || '',
            });

            if (!ensureMap()) {
              reportMapError({ reason: 'leaflet_unavailable' });
              return;
            }

            var nextFocusSignature = buildFocusSignature();
            renderMarkers();
            if (nextFocusSignature !== lastAppliedFocusSignature) {
              applyFocus();
              lastAppliedFocusSignature = nextFocusSignature;
            }
            applyCommand();
          });
        };

        var dispatchCommand = function (nextCommand) {
          runSafely('dispatch_command', function () {
            if (!nextCommand || !nextCommand.id) {
              return;
            }

            currentState = Object.assign({}, currentState, {
              command: nextCommand,
            });
            applyCommand();
          });
        };

        window.__FOUNDCLUB_SEARCH_MAP__ = {
          dispatchCommand: dispatchCommand,
          syncState: syncState,
        };

        window.addEventListener('message', function (event) {
          runSafely('host_message', function () {
            var data = event.data;
            if (typeof data === 'string') {
              try {
                data = JSON.parse(data);
              } catch (error) {
                return;
              }
            }

            if (
              !data
              || data.source !== HOST_SOURCE
              || data.mapId !== MAP_ID
              || data.type !== 'SYNC_STATE'
            ) {
              return;
            }

            syncState(data.payload || {});
          });
        });

        window.addEventListener('error', function (event) {
          reportMapError({
            colno: event && event.colno ? event.colno : undefined,
            filename: event && event.filename ? String(event.filename) : '',
            lineno: event && event.lineno ? event.lineno : undefined,
            message: event && event.message ? event.message : 'runtime_error',
            reason: 'runtime_error',
            stack: event && event.error && event.error.stack ? String(event.error.stack) : '',
          });
        });

        window.addEventListener('unhandledrejection', function (event) {
          reportMapError(buildRuntimeErrorPayload(
            'unhandled_rejection',
            event && event.reason ? event.reason : null,
          ));
        });

        if (!ensureMap()) {
          postBridgeMessage('MAP_ERROR', { reason: 'map_boot_failed' });
          return;
        }

        postDiagnostic('runtime_boot');
        syncState(currentState);
      })();
    </script>
  </body>
</html>`;

export const LEGACY_TILE_PROVIDER = Object.freeze({
  attribution: OSM_TILE_ATTRIBUTION,
  url: OSM_TILE_URL,
});

export const TOMTOM_TILE_PROVIDER = Object.freeze({
  attribution: TOMTOM_TILE_ATTRIBUTION,
  url: buildTomTomTileUrl,
});

export default {
  buildSearchMapHostMessage,
  buildSearchMapRuntimeHtml,
  buildSearchMapSyncScript,
  buildTomTomTileUrl,
  parseSearchMapBridgeMessage,
  resolveSearchMapMarkerColor,
  SEARCH_MAP_BRIDGE_TYPES,
};
