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
  MAP_ERROR: 'MAP_ERROR',
  MAP_READY: 'MAP_READY',
  MAP_REGION_CHANGE: 'MAP_REGION_CHANGE',
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
        transition: transform .15s ease;
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
        var lastClusterSignature = '';
        var lastItemsSignature = '';
        var lastRenderedZoom = null;
        var lastSelectedItemId = '';
        var map = null;
        var markerLayer = null;
        var markersById = {};
        var lastHandledCommandId = '';
        var readyTileCount = 0;
        var tileErrorCount = 0;

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

        var reportMapError = function (payload) {
          if (hasSentReady) return;
          if (hasSentError || hasSentReady) return;
          hasSentError = true;
          postBridgeMessage('MAP_ERROR', payload || {});
        };

        var markMapReady = function () {
          if (hasSentReady) return;
          hasSentReady = true;
          hasSentError = false;
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

          window.fetch(TILE_PROBE_URL, { method: 'GET' })
            .then(function (response) {
              if (response.ok || hasSentReady || hasSentError) {
                return;
              }

              reportMapError({
                message: 'tile_probe_failed',
                reason: classifyProbeStatus(response.status),
                status: response.status,
                url: TILE_PROBE_URL,
              });
            })
            .catch(function (error) {
              if (hasSentReady || hasSentError) {
                return;
              }
              // Let the loading timeout handle transient probe/network failures.
            });
        };

        var createMarkerIcon = function (isSelected) {
          var markerSize = isSelected ? 22 : 18;
          var borderSize = isSelected ? 3 : 2;
          var innerBackground = isSelected ? '#ffffff' : 'rgba(5, 28, 42, 0.96)';

          return window.L.divIcon({
            className: '',
            html: '<span class="fc-marker" style="' +
              'background:' + (isSelected ? MARKER_COLOR : MARKER_COLOR + 'CC') + ';' +
              'border:' + borderSize + 'px solid ' + (isSelected ? '#ffffff' : 'rgba(255,255,255,0.72)') + ';' +
              'height:' + markerSize + 'px;' +
              'transform:' + (isSelected ? 'scale(1.08)' : 'scale(1)') + ';' +
              'width:' + markerSize + 'px;' +
            '">' +
              '<span style="background:' + innerBackground + ';border-radius:999px;display:block;height:8px;width:8px;"></span>' +
            '</span>',
            iconAnchor: [markerSize / 2, markerSize / 2],
            iconSize: [markerSize, markerSize],
          });
        };

        var createClusterIcon = function (count) {
          var clusterSize = count >= 10 ? 34 : 30;
          return window.L.divIcon({
            className: '',
            html: '<span class="fc-marker" style="' +
              'background:' + MARKER_COLOR + ';' +
              'border:2px solid rgba(255,255,255,0.82);' +
              'box-shadow:0 10px 18px rgba(0,0,0,0.24);' +
              'color:#061822;' +
              'font:700 11px/1 -apple-system, BlinkMacSystemFont, \\"Segoe UI\\", sans-serif;' +
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

        var getClusterPrecision = function () {
          if (!map) return null;
          var currentZoom = map.getZoom();
          if (currentZoom >= 13) return null;
          if (currentZoom >= 11) return 3;
          if (currentZoom >= 9) return 2;
          return 1;
        };

        var buildRenderableEntries = function (items) {
          var precision = getClusterPrecision();
          if (!precision || items.length < 12) {
            return items.map(function (item) {
              return {
                isCluster: false,
                item: item,
                key: item.id,
                lat: item.lat,
                lng: item.lng,
              };
            });
          }

          var groups = {};
          items.forEach(function (item) {
            var key = item.lat.toFixed(precision) + ':' + item.lng.toFixed(precision);
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
          var safeZoom = Number.isFinite(zoom) ? zoom : map.getZoom();
          var nextCenter = window.L.latLng(lat, lng);
          if (Number.isFinite(yOffset) && yOffset !== 0) {
            nextCenter = map.unproject(
              map.project(nextCenter, safeZoom).add(window.L.point(0, yOffset)),
              safeZoom
            );
          }
          isApplyingFocus = true;
          map.setView(nextCenter, safeZoom);
        };

        var fitToResults = function () {
          var items = Array.isArray(currentState.items) ? currentState.items : [];

          if (!items.length) {
            setFocusedView(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, 6, 0);
            postBridgeMessage('FIT_RESULTS_DONE', { reason: 'empty' });
            return;
          }

          if (items.length === 1) {
            setFocusedView(items[0].lat, items[0].lng, 13, 88);
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
            paddingBottomRight: [48, 208],
            paddingTopLeft: [48, 132],
          });
          postBridgeMessage('FIT_RESULTS_DONE', { reason: 'results' });
        };

        var focusSelectedItem = function () {
          var selectedMarker = markersById[currentState.selectedItemId];
          if (!selectedMarker) {
            fitToResults();
            return;
          }

          setFocusedView(selectedMarker.getLatLng().lat, selectedMarker.getLatLng().lng, 13, 98);
          postBridgeMessage('FIT_RESULTS_DONE', { reason: 'selected' });
        };

        var focusUserLocation = function () {
          if (!currentState.userLocation || !isFinite(currentState.userLocation.lat) || !isFinite(currentState.userLocation.lng)) {
            fitToResults();
            return;
          }

          setFocusedView(currentState.userLocation.lat, currentState.userLocation.lng, 14, 88);
          postBridgeMessage('FIT_RESULTS_DONE', { reason: 'user' });
        };

        var focusRegionHint = function () {
          if (!currentState.regionHint || !isFinite(currentState.regionHint.lat) || !isFinite(currentState.regionHint.lng)) {
            fitToResults();
            return;
          }

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
          postBridgeMessage('MAP_REGION_CHANGE', {
            lat: center.lat,
            lng: center.lng,
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
            map.zoomIn();
            return;
          }

          if (currentState.command.type === 'zoom_out') {
            map.zoomOut();
          }
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
          var items = Array.isArray(currentState.items) ? currentState.items : [];
          var itemsSignature = buildItemsSignature(items);
          var renderableEntries = buildRenderableEntries(items);
          var clusterSignature = renderableEntries.map(function (entry) {
            return entry.key + ':' + entry.lat.toFixed(5) + ':' + entry.lng.toFixed(5) + ':' + (entry.count || 1);
          }).join('|');

          if (
            itemsSignature === lastItemsSignature
            && clusterSignature === lastClusterSignature
            && lastRenderedZoom === map.getZoom()
            && currentState.selectedItemId !== lastSelectedItemId
          ) {
            Object.keys(markersById).forEach(function (markerKey) {
              var marker = markersById[markerKey];
              if (!marker || marker.__fcCluster) return;
              marker.setIcon(createMarkerIcon(markerKey === currentState.selectedItemId));
            });
            lastSelectedItemId = currentState.selectedItemId;
            return;
          }

          clearMarkers();

          renderableEntries.forEach(function (entry) {
            var marker = window.L.marker([entry.lat, entry.lng], {
              icon: entry.isCluster
                ? createClusterIcon(entry.count)
                : createMarkerIcon(entry.item.id === currentState.selectedItemId),
            });

            marker.__fcCluster = Boolean(entry.isCluster);

            marker.on('click', function () {
              if (entry.isCluster) {
                map.setView([entry.lat, entry.lng], Math.min(map.getZoom() + 2, 16));
                return;
              }

              postBridgeMessage('MARKER_SELECT', { itemId: entry.item.id });
            });

            marker.addTo(markerLayer);
            markersById[entry.key] = marker;
          });

          lastItemsSignature = itemsSignature;
          lastClusterSignature = clusterSignature;
          lastRenderedZoom = map.getZoom();
          lastSelectedItemId = currentState.selectedItemId;
        };

        var ensureMap = function () {
          if (map || !window.L) {
            return Boolean(map);
          }

          map = window.L.map('map', {
            attributionControl: false,
            zoomControl: false,
          });

          markerLayer = window.L.layerGroup().addTo(map);

          var tileLayer = window.L.tileLayer(TILE_URL, {
            maxZoom: 19,
            subdomains: ${safeJson(TOMTOM_TILE_SUBDOMAINS)},
            tileSize: 256,
          });

          tileLayer.on('tileload', function () {
            readyTileCount += 1;
            markMapReady();
          });

          tileLayer.on('load', function () {
            if (readyTileCount > 0) {
              markMapReady();
            }
          });

          tileLayer.on('tileerror', function (event) {
            tileErrorCount += 1;
            if (tileErrorCount >= 3) {
              reportMapError({
                message: event && event.error && event.error.message ? event.error.message : 'tile_error',
                reason: 'tiles_unavailable',
                url: event && event.tile && event.tile.src ? event.tile.src : '',
              });
            }
          });

          probeTileAvailability();
          tileLayer.addTo(map);
          map.on('moveend', function () {
            if (isApplyingFocus) {
              isApplyingFocus = false;
              return;
            }
            emitRegionChange();
          });
          map.on('zoomend', function () {
            renderMarkers();
          });
          map.whenReady(function () {
            window.setTimeout(function () {
              map.invalidateSize();
              applyFocus();
              renderMarkers();
              emitRegionChange();
            }, 60);
          });

          return true;
        };

        var syncState = function (nextState) {
          currentState = Object.assign({}, currentState, nextState || {});

          if (!ensureMap()) {
            reportMapError({ reason: 'leaflet_unavailable' });
            return;
          }

          renderMarkers();
          applyFocus();
          applyCommand();
        };

        window.__FOUNDCLUB_SEARCH_MAP__ = {
          syncState: syncState,
        };

        window.addEventListener('message', function (event) {
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

        window.addEventListener('error', function (event) {
          reportMapError({
            message: event && event.message ? event.message : 'runtime_error',
            reason: 'runtime_error',
          });
        });

        if (!ensureMap()) {
          postBridgeMessage('MAP_ERROR', { reason: 'map_boot_failed' });
          return;
        }

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
