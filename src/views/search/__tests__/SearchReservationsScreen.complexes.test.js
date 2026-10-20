import renderer, { act } from 'react-test-renderer';

import SearchReservationsScreen from '@/views/search/SearchReservationsScreen';

// RESA-CARTE (20/10/2026) — L'ADRESSE DU SITE /search/reservations (plan E-P01 point 2 : « site
// `/search/reservations` » ; RC-T03, « le site fait pareil »). Sur le site, l'onglet
// « Réservations » de la recherche ouvre CET écran (SearchScreenShell, chemin web), pas le panneau
// de SearchHubScreen : L6A n'y avait pas branché la recherche de terrains, le site montrait donc
// l'ancienne liste même interrupteur allumé (« masque du site absent », plan E-P01 point 9).
// Fichier sans témoin (E6) : le premier témoin décrit l'écran d'AUJOURD'HUI (interrupteur éteint =
// staging : l'ancienne liste, inchangée) ; allumé, il monte la recherche de terrains (E-P01), dans
// la même coquille.

// L'interrupteur, lu À CHAQUE rendu : un `get` dans un objet étalé (`...`) serait évalué une
// seule fois par Babel, au chargement du module.
let mockAllume = false;
jest.mock('@/config/fonctionsMasquees', () => Object.defineProperty(
  { ...jest.requireActual('@/config/fonctionsMasquees') },
  'COMPLEXES_JOUEUR',
  { enumerable: true, get: () => mockAllume },
));

jest.mock('@/views/reserverTerrain/RechercheDeTerrains', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <View testID="recherche-de-terrains" />,
  };
});

jest.mock('@/components/organisms/reservationListContent/ReservationListContent', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <View testID="ancienne-liste" />,
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

jest.mock('@/components/molecules/tutorial/TutorialFlowBoundary', () => (
  function BordureDouble(/** @type {any} */ { children }) {
    return children;
  }
));
jest.mock('@/components/molecules/onboardingWrapper/OnboardingWrapper', () => (
  function EnveloppeDouble(/** @type {any} */ { children }) {
    return children;
  }
));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: null }),
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

/**
 * Monte l'écran du site.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <SearchReservationsScreen navigation={{ setParams: jest.fn() }} route={{ params: {} }} />,
    );
  });
  return arbre;
};

const repere = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ noeud) => noeud.props?.testID === testID,
).length > 0;

describe('RESA-CARTE — /search/reservations sur le site', () => {
  it('interrupteur éteint (staging) : l’ancienne liste, coquille « Réservations »', async () => {
    mockAllume = false;
    const arbre = await monter();
    expect(mockCoquille.props.activeType).toBe('reservations');
    expect(repere(arbre, 'ancienne-liste')).toBe(true);
    expect(repere(arbre, 'recherche-de-terrains')).toBe(false);
  });

  it('interrupteur allumé : la recherche de terrains (E-P01), dans la même coquille', async () => {
    mockAllume = true;
    const arbre = await monter();
    expect(mockCoquille.props.activeType).toBe('reservations');
    expect(repere(arbre, 'recherche-de-terrains')).toBe(true);
    expect(repere(arbre, 'ancienne-liste')).toBe(false);
  });
});
