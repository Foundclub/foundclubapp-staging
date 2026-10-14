import renderer, { act } from 'react-test-renderer';

// RESA-L6A (14/10/2026) — LES PORTES DE E-P01, interrupteur `COMPLEXES_JOUEUR` ALLUMÉ (les témoins
// l'allument ; en vrai il est éteint, `fonctionsMasquees.test.js`). Éteint, rien ne change : les
// témoins existants le prouvent (`SearchTypeSwitcher.test.js` « l'appui explique au lieu
// d'activer », `SearchHubScreen.caracterisation.test.js` témoin 6 « Bientôt disponible »).
// Allumé :
//   1. l'onglet « Réservations » du dock s'ACTIVE au lieu d'ouvrir la feuille « Bientôt » ;
//   2. le panneau « Réservations » de la recherche monte la recherche de terrains (E-P01), et lui
//      dit s'il est l'onglet visible ;
//   3. la case « Réservations » de l'accueil, elle, RESTE retirée (`RESERVATIONS_SUR_ACCUEIL`,
//      GO d'Adel) : ce lot ne la rallume pas.

jest.mock('@/config/fonctionsMasquees', () => ({
  ...jest.requireActual('@/config/fonctionsMasquees'),
  COMPLEXES_JOUEUR: true,
}));

const mockRecherche = { montages: 0, props: /** @type {any} */ (null) };
jest.mock('@/views/reserverTerrain/RechercheDeTerrains', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: function RechercheDouble(/** @type {any} */ props) {
      mockRecherche.props = props;
      React.useEffect(() => { mockRecherche.montages += 1; }, []);
      return <View testID="panneau:recherche-de-terrains" />;
    },
  };
});

const mockCoquille = { props: /** @type {any} */ (null) };
jest.mock('@/views/search/components/SearchScreenShell', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: function CoquilleDouble(/** @type {any} */ props) {
      mockCoquille.props = props;
      return <View testID="coquille">{props.children}</View>;
    },
  };
});

jest.mock('@/components/organisms/clubListContent/ClubListContent', () => () => null);
jest.mock('@/components/organisms/eventListContent/EventListContent', () => () => null);
jest.mock(
  '@/components/organisms/friendlyMatchListContent/FriendlyMatchListContent',
  () => () => null,
);
jest.mock('@/components/organisms/recrutementListContent/RecrutementListContent', () => () => null);
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: null }),
}));
jest.mock('@/domains/guidance/guidanceRuntime', () => ({ emitGuidanceInteraction: jest.fn() }));
jest.mock('@/utils/performance/searchPerformance', () => ({ markSearchPerf: jest.fn() }));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { Text } = jest.requireActual('react-native');
  return function FausseFeuille(/** @type {any} */ { isVisible }) {
    return isVisible ? <Text>feuille-ouverte</Text> : null;
  };
});

const SearchHubScreen = require('@/views/search/SearchHubScreen').default;
const SearchTypeSwitcher = require(
  '@/components/molecules/searchTypeSwitcher/SearchTypeSwitcher',
).default;
const { CARTES_ACCUEIL_MASQUEES, RESERVATIONS_SUR_ACCUEIL } = require('@/config/fonctionsMasquees');

beforeEach(() => {
  mockRecherche.montages = 0;
  mockRecherche.props = null;
});

describe('RESA-L6A — les portes de la recherche de terrains, interrupteur allumé', () => {
  it('l’onglet « Réservations » du dock s’active, sans la feuille « Bientôt »', async () => {
    const changer = jest.fn();
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<SearchTypeSwitcher activeType="events" onTypeChange={changer} />);
    });
    const onglet = arbre.root.findAll((/** @type {any} */ noeud) => (
      noeud.props?.accessibilityRole === 'tab' && noeud.props?.accessibilityLabel === 'Réservations'
      && typeof noeud.props?.onPress === 'function'
    ))[0];
    await act(async () => {
      onglet.props.onPress();
    });
    expect(changer).toHaveBeenCalledWith('reservations');
    expect(JSON.stringify(arbre.toJSON())).not.toContain('feuille-ouverte');
  });

  it('le panneau « Réservations » monte la recherche de terrains, onglet visible', async () => {
    const navigation = { navigate: jest.fn(), setParams: jest.fn() };
    const route = { params: { activeType: 'reservations' } };
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<SearchHubScreen navigation={navigation} route={route} />);
    });
    expect(mockRecherche.montages).toBe(1);
    expect(mockRecherche.props).toEqual({ refreshSignal: 0, screenActive: true });
    expect(JSON.stringify(arbre.toJSON())).not.toContain('Bientôt disponible');
  });

  it('quitter l’onglet le garde monté, mais caché (sa liste et sa position restent)', async () => {
    const navigation = { navigate: jest.fn(), setParams: jest.fn() };
    const route = { params: { activeType: 'reservations' } };
    await act(async () => {
      renderer.create(<SearchHubScreen navigation={navigation} route={route} />);
    });
    await act(async () => {
      mockCoquille.props.onTypeChange('clubs');
    });
    expect(mockRecherche.montages).toBe(1);
    expect(mockRecherche.props.screenActive).toBe(false);
  });

  it('la case « Réservations » de l’accueil RESTE retirée (GO d’Adel, pas ce lot)', () => {
    expect(RESERVATIONS_SUR_ACCUEIL).toBe(false);
    expect(CARTES_ACCUEIL_MASQUEES).toContain('search-reservations');
  });
});
