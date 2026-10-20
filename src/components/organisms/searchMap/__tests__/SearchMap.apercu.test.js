import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import LegacySearchMapNative from '@/components/organisms/searchMap/LegacySearchMapNative';
import SearchMapWeb from '@/components/organisms/searchMap/SearchMap.web';
import TomTomSearchMapNative from '@/components/organisms/searchMap/TomTomSearchMapNative';

// RESA-CARTE (20/10/2026) — L'APERÇU EN BAS DES TROIS CARTES DE RECHERCHE (site, TomTom, Google).
//
// Carte des appelants (R2), mesurée le 20/10 : `SearchMap` (téléphone : TomTom ou Google selon
// FC_SEARCH_MAP_PROVIDER, `tomtom` en recette et en production ; site : SearchMap.web.js) n'avait
// qu'UN appelant, la carte de l'annuaire (views/search/SearchMapScreen.js). Aucune des trois
// n'avait de témoin (E6) : les premiers témoins décrivent ce qu'elles font AUJOURD'HUI — un
// repère choisi montre SON aperçu (SearchMapPreviewCard) en bas de la carte.
// La recherche de terrains (E-P01, planche EP01 état 2) montre sous la carte la carte DU COMPLEXE
// (ses créneaux à toucher), pas cet aperçu : `showPreviewCard={false}` le retire, et rien d'autre.
// Absent, il vaut vrai : l'annuaire ne change pas.

const mockWebViews = /** @type {any[]} */ ([]);
jest.mock('react-native-webview', () => ({
  WebView: (/** @type {any} */ props) => {
    mockWebViews.push(props);
    return null;
  },
}));

const mockCartesGoogle = /** @type {any[]} */ ([]);
jest.mock('react-native-maps', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');
  const MapView = forwardRef((/** @type {any} */ props, /** @type {any} */ ref) => {
    useImperativeHandle(ref, () => ({ animateToRegion: () => {}, fitToCoordinates: () => {} }));
    mockCartesGoogle.push(props);
    return props.children || null;
  });
  return {
    __esModule: true,
    default: MapView,
    Marker: () => null,
    PROVIDER_GOOGLE: 'google',
  };
});

jest.mock('@/platform/maps/searchMapGeolocation', () => ({
  readCurrentSearchMapLocationIfGranted: async () => null,
  requestCurrentSearchMapLocation: async () => null,
}));

jest.mock('@/components/organisms/searchMap/SearchMapHud', () => () => null);

// L'aperçu doublé : il dit seulement QUEL repère il montre.
jest.mock('@/components/molecules/searchMapPreviewCard/SearchMapPreviewCard', () => (
  function FauxApercu(/** @type {any} */ { item }) {
    const { Text: Texte } = jest.requireActual('react-native');
    return item ? <Texte testID="apercu">{item.title}</Texte> : null;
  }
));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const REPERE = {
  badge: 'Club',
  dateLabel: '',
  distanceLabel: '',
  id: 'repere-1',
  imageUrl: '',
  lat: 48.85,
  lng: 2.35,
  priceLabel: '',
  raw: {},
  subtitle: 'Paris',
  timeLabel: '',
  title: 'US Valbrune',
  type: 'clubs',
};

const choisir = () => {};

/**
 * Les aperçus montrés par un arbre.
 * @param {any} arbre - L'arbre.
 * @returns {string[]} Les titres des aperçus.
 */
const apercus = (arbre) => arbre.root.findAll((/** @type {any} */ noeud) => (
  noeud.type === Text && noeud.props.testID === 'apercu'
)).map((/** @type {any} */ noeud) => noeud.props.children);

/**
 * Monte une carte et la rend prête (le message « carte prête » de la page Leaflet pour TomTom,
 * « carte chargée » pour Google ; le site n'attend rien).
 * @param {import('react').ReactElement} element - La carte.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async (element) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(element);
  });
  const webView = mockWebViews[mockWebViews.length - 1];
  if (webView) {
    await act(async () => {
      webView.onLoadEnd?.();
      webView.onMessage?.({
        nativeEvent: {
          data: JSON.stringify({
            mapId: 'search-map-clubs-0', source: 'foundclub-search-map', type: 'MAP_READY',
          }),
        },
      });
    });
  }
  const google = mockCartesGoogle[mockCartesGoogle.length - 1];
  if (google) {
    await act(async () => {
      google.onMapLoaded?.();
    });
  }
  return arbre;
};

const CARTES = /** @type {Array<[string, any]>} */ ([
  ['site (SearchMap.web.js)', SearchMapWeb],
  ['téléphone, TomTom (TomTomSearchMapNative.js)', TomTomSearchMapNative],
  ['téléphone, Google (LegacySearchMapNative.js)', LegacySearchMapNative],
]);

let espionLog = /** @type {any} */ (null);

beforeAll(() => {
  // La clef TomTom des témoins (searchMapProvider.js lit ces surcharges sous jest).
  Reflect.set(global, 'fcSearchMapTestOverrides', { TOMTOM_API_KEY: 'cle-de-temoin' });
  // Les cartes écrivent leurs relevés de rendu en développement : rien à en lire ici.
  espionLog = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  Reflect.deleteProperty(global, 'fcSearchMapTestOverrides');
  espionLog?.mockRestore();
});

beforeEach(() => {
  mockWebViews.length = 0;
  mockCartesGoogle.length = 0;
});

describe('RESA-CARTE — l’aperçu en bas des cartes de recherche', () => {
  it.each(CARTES)('%s : un repère choisi montre son aperçu (annuaire)', async (_nom, Carte) => {
    const arbre = await monter(
      <Carte
        height={360}
        items={[REPERE]}
        onSelectItem={choisir}
        scope="clubs"
        selectedItemId={REPERE.id}
      />,
    );
    expect(apercus(arbre)).toEqual(['US Valbrune']);
  });

  it.each(CARTES)('%s : showPreviewCard={false} ne montre AUCUN aperçu', async (_nom, Carte) => {
    const arbre = await monter(
      <Carte
        height={360}
        items={[REPERE]}
        onSelectItem={choisir}
        scope="clubs"
        selectedItemId={REPERE.id}
        showPreviewCard={false}
      />,
    );
    expect(apercus(arbre)).toEqual([]);
  });
});
