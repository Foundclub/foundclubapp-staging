import renderer, { act } from 'react-test-renderer';

import TomTomSearchMapNative from '@/components/organisms/searchMap/TomTomSearchMapNative';

// BUGHUNT C02 (25/10/2026) — Q3-20 : la carte native déjà prête repassait en « chargement » quand
// les résultats arrivaient (l'effet « map cycle started » dépendait du nombre de résultats), mais
// la WebView ne se recharge pas : MAP_READY ne revenait jamais et « Impossible de charger la
// carte » s'affichait environ 6,5 s plus tard.

const mockWebViews = /** @type {any[]} */ ([]);
jest.mock('react-native-webview', () => ({
  WebView: (/** @type {any} */ props) => {
    mockWebViews.push(props);
    return null;
  },
}));

jest.mock('@/platform/maps/searchMapGeolocation', () => ({
  readCurrentSearchMapLocationIfGranted: async () => null,
  requestCurrentSearchMapLocation: async () => null,
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const DOUZE = Array.from({ length: 12 }, (_, i) => ({
  id: `c${i}`, lat: 48.8 + (i * 0.01), lng: 2.3, title: `C${i}`,
}));

beforeEach(() => {
  Reflect.set(global, 'fcSearchMapTestOverrides', { TOMTOM_API_KEY: 'cle-de-temoin' });
  jest.useFakeTimers();
});

afterEach(() => {
  Reflect.deleteProperty(global, 'fcSearchMapTestOverrides');
  jest.useRealTimers();
});

describe('Q3-20 — carte native : les résultats qui arrivent ne relancent pas le chargement', () => {
  it('carte prête, puis 12 résultats : toujours pas d’erreur 7 s plus tard', () => {
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(
        <TomTomSearchMapNative
          items={[]}
          scope="complexes"
          showPreviewCard={false}
          totalCount={0}
        />,
      );
    });
    const webView = mockWebViews[mockWebViews.length - 1];
    act(() => {
      webView.onLoadEnd();
      webView.onMessage({
        nativeEvent: {
          data: JSON.stringify({
            mapId: 'search-map-complexes-0', source: 'foundclub-search-map', type: 'MAP_READY',
          }),
        },
      });
    });
    act(() => {
      arbre.update(
        <TomTomSearchMapNative
          items={DOUZE}
          scope="complexes"
          showPreviewCard={false}
          totalCount={12}
        />,
      );
    });
    act(() => {
      jest.advanceTimersByTime(7000);
    });
    expect(JSON.stringify(arbre.toJSON())).not.toContain('Impossible de charger la carte');
  });
});
