import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';

import useTheme from '@/theme/themeContext';

import { getTomTomApiKey } from '@/platform/maps/searchMapProvider';
import {
  buildSearchMapRuntimeHtml,
  buildSearchMapSyncScript,
  buildTomTomProbeUrl,
  buildTomTomTileUrl,
  LEGACY_TILE_PROVIDER,
  parseSearchMapBridgeMessage,
  SEARCH_MAP_BRIDGE_TYPES,
  TOMTOM_TILE_PROVIDER,
} from '@/platform/maps/searchMapRuntime';

const MAP_ID = 'pin-map-native';

/**
 * ADRESSE-CARTE (07/10) — la carte « à épingle » du téléphone. La MÊME page Leaflet que la carte de
 * recherche (`searchMapRuntime`), sans résultat, cadrée sur un point : l'écran pose l'épingle au
 * centre, et chaque déplacement rend le nouveau centre (`MAP_REGION_CHANGE`). Les tuiles suivent la
 * carte de recherche : TomTom si la clé est là, sinon OpenStreetMap.
 * Chargé SEULEMENT par `maps.native.js`, à l'ouverture (voir l'en-tête de `renderPinMap`).
 * @param {object} props
 * @param {number} props.height
 * @param {(region: object) => void} [props.onRegionChangeComplete] - Le nouveau centre.
 * @param {{ lat: number, lng: number, zoom?: number } | null} [props.regionHint]
 * @returns {import('react').ReactElement}
 */
function PinMapNative({ height, onRegionChangeComplete, regionHint = null }) {
  const { Alignments, Colors } = useTheme();
  const webViewRef = useRef(/** @type {any} */ (null));
  const [chargee, setChargee] = useState(false);
  const [prete, setPrete] = useState(false);
  const tomTomApiKey = getTomTomApiKey();

  const etat = useMemo(() => ({
    focusMode: 'region',
    items: [],
    regionHint,
    renderItems: [],
    selectedItemId: '',
  }), [regionHint]);

  // La page est construite UNE fois, sur le premier cadrage : la suite passe par `syncState`.
  const html = useRef(/** @type {string | null} */ (null));
  if (html.current === null) {
    html.current = buildSearchMapRuntimeHtml({
      initialState: etat,
      mapId: MAP_ID,
      markerColor: Colors.primary500,
      tileAttribution: tomTomApiKey
        ? TOMTOM_TILE_PROVIDER.attribution
        : LEGACY_TILE_PROVIDER.attribution,
      tileProbeUrl: tomTomApiKey ? buildTomTomProbeUrl(tomTomApiKey) : '',
      tileUrl: tomTomApiKey ? buildTomTomTileUrl(tomTomApiKey) : LEGACY_TILE_PROVIDER.url,
    });
  }

  useEffect(() => {
    if (chargee) {
      webViewRef.current?.injectJavaScript(buildSearchMapSyncScript(MAP_ID, etat));
    }
  }, [chargee, etat]);

  const handleMessage = (/** @type {any} */ event) => {
    const message = parseSearchMapBridgeMessage(event?.nativeEvent?.data);
    if (!message || message.mapId !== MAP_ID) return;
    if (message.type === SEARCH_MAP_BRIDGE_TYPES.MAP_READY) setPrete(true);
    if (message.type === SEARCH_MAP_BRIDGE_TYPES.MAP_REGION_CHANGE && message.payload) {
      onRegionChangeComplete?.(message.payload);
    }
  };

  return (
    <View
      style={[
        Alignments.relative,
        { backgroundColor: Colors.primary900, height, overflow: 'hidden' },
      ]}
    >
      <WebView
        domStorageEnabled
        javaScriptEnabled
        onLoadEnd={() => setChargee(true)}
        onMessage={handleMessage}
        originWhitelist={['*']}
        ref={webViewRef}
        setSupportMultipleWindows={false}
        // Même origine HTTPS que la carte de recherche : sans elle, Android bloque les tuiles.
        source={{ baseUrl: 'https://searchmap.foundclubpro.com/', html: html.current }}
        style={{ backgroundColor: Colors.primary900, flex: 1, opacity: prete ? 1 : 0.04 }}
      />
      {!prete ? (
        <View
          pointerEvents="none"
          style={[
            Alignments.absolute,
            Alignments.fullSize,
            Alignments.alignCenter,
            Alignments.justifyCenter,
          ]}
        >
          <ActivityIndicator color={Colors.primary500} size="small" />
        </View>
      ) : null}
    </View>
  );
}

export default PinMapNative;
