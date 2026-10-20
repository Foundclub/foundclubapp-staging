// RESA-L6B-1 (19/10/2026) — LE RACCOURCI « MES RÉSERVATIONS » DANS E-P01 (planche EP10 état 5,
// choix du design S-19 : « raccourci aussi dans E-P01 » ; la planche EP01 ne dessine pas sa place :
// le plan la laisse au design, ce lot le pose EN TÊTE du panneau, avant le champ de recherche).
// E-P01 n'est rendu que l'interrupteur `COMPLEXES_JOUEUR` allumé (SearchHubScreen).
// Banc repris de EP01.recherche.test.js (mêmes doublures).

import renderer, { act } from 'react-test-renderer';

import RechercheDeTerrains from '@/views/reserverTerrain/RechercheDeTerrains';

import { RouteNames } from '@/navigation/routeNames';

import { pressable } from '@/testSupport/temoinComplexe';
import { carteDeRecherche } from '@/testSupport/temoinReserver';

// RESA-L6A (14/10/2026) — E-P01 « Réserver un terrain : la recherche » (planches EP01, RA1 ; plan
// E-P01) : la position demandée à l'ouverture (« Des terrains autour de toi »), ou une ville ; un
// seul champ « Complexe, ville ou sport », tolérant aux fautes (le serveur juge, dès 2 lettres,
// 300 ms) ; les filtres sport, jour, heure, distance, intérieur / extérieur ; une carte par
// complexe (logo, nom, pastille, distance, sports, prochains créneaux libres) ; vide, chargement,
// erreur, hors connexion. Le serveur ne rend que des créneaux VRAIMENT libres (RC-P01).

const mockNavigate = jest.fn();
// Intégration RESA (soutien, 20/10) : RESA-CARTE a mis la barre d'onglets flottante dans E-P01 ;
// useBottomDockLayout tire @react-navigation/stack, que jest ne transforme pas : doublé comme dans EP01.carte.
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ dockClearance: 0, floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

let mockRecherche = /** @type {any} */ ({});
const mockAppels = /** @type {any[]} */ ([]);
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useRechercheDeTerrains: (/** @type {any} */ filtres, /** @type {any} */ options) => {
    mockAppels.push({ filtres, options });
    return mockRecherche;
  },
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({
    data: [
      { documentId: 'a-five', name: 'Football à 5' },
      { documentId: 'a-padel', name: 'Padel' },
      { documentId: 'a-tennis', name: 'Tennis' },
      { documentId: 'a-squash', name: 'Squash' },
    ],
  }),
}));

const mockVilles = /** @type {any[]} */ ([]);
jest.mock('@/services/places/placesQueries', () => ({
  useGetPlaces: () => ({ data: mockVilles }),
}));

let mockPositionAccordee = /** @type {any} */ (null);
const mockPositionDemandee = /** @type {any} */ (null);
const mockDemande = jest.fn();
jest.mock('@/platform/maps/searchMapGeolocation', () => ({
  readCurrentSearchMapLocationIfGranted: async () => mockPositionAccordee,
  requestCurrentSearchMapLocation: async () => {
    mockDemande();
    return mockPositionDemandee;
  },
}));

const mockVilleChoisie = /** @type {any} */ (null);
jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => (
  function FausseVille(/** @type {any} */ { placeholder, setAddress }) {
    const { Text: Texte, TouchableOpacity: Touche } = jest.requireActual('react-native');
    return (
      <Touche accessibilityLabel={placeholder} onPress={() => setAddress(mockVilleChoisie)}>
        <Texte>{placeholder}</Texte>
      </Touche>
    );
  }
));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/**
 * Monte le panneau et laisse passer la lecture de la position.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<RechercheDeTerrains screenActive />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return arbre;
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockPositionAccordee = { lat: 48.83, lng: 1.48 };
  mockRecherche = {
    data: { complexes: [carteDeRecherche()], date: '2026-10-14' },
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  };
});

it('« Mes réservations » est en tête du panneau et ouvre E-P10', async () => {
  const arbre = await monter();
  const raccourci = pressable(arbre, 'Mes réservations');
  const champ = arbre.root.findAll((/** @type {any} */ n) => (
    n.props?.testID === 'reserver-recherche-champ'
  ))[0];
  const tous = arbre.root.findAll(() => true);
  expect(tous.indexOf(raccourci)).toBeLessThan(tous.indexOf(champ));
  await act(async () => {
    raccourci.props.onPress();
  });
  expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverMesReservations);
  // Le premier montage de E-P01 dépasse 5 s sous charge (constaté par RESA-L6A, EP01.portes).
}, 30_000);
