// HAUT-DEFILE-F1 (12/11/2026, décision d'Adel « 245 B » du 11/11 : « le haut défile »)
// — Rechercher, panneau « Réservations » (E-P01, interrupteur COMPLEXES_JOUEUR allumé).
// CORR-RECHERCHE (30/10) a fait défiler l'en-tête de la recherche (logo, cloche, profil,
// onglets) avec 5 listes ; E-P01 ne le réclamait pas. Deux effets, rouges avant ce lot :
//  1. seul, le panneau laisse la coque poser l'en-tête AU-DESSUS de son défilement : figé ;
//  2. après une autre liste (qui l'a réclamé), la coque ne le pose plus et E-P01 non plus :
//     le logo, la cloche, le profil et les ONGLETS disparaissent de l'écran.
// Banc repris de EP01.raccourciMesReservations.test.js (mêmes doublures).

import { ScrollView, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import RechercheDeTerrains from '@/views/reserverTerrain/RechercheDeTerrains';
import { useEnTeteDeRecherche } from '@/views/search/components/enTeteDeRecherche';
import SearchScreenShell from '@/views/search/components/SearchScreenShell';

import { carteDeRecherche } from '@/testSupport/temoinReserver';

const mockNavigate = jest.fn();
// Intégration RESA (soutien, 20/10) : RESA-CARTE a mis la barre d'onglets flottante dans E-P01 ;
// useBottomDockLayout tire @react-navigation/stack, que jest ne transforme pas : doublé
// comme dans EP01.carte.
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
  // RESA-JOUEUR (D51) : la liste « Recherche de joueurs ».
  useAnnoncesOuvertes: () => ({
    data: [{
      annonce: 'a-1',
      complexe: { name: 'Le Five de Montrivage' },
      date: '2026-11-11',
      distanceKm: 2.4,
      from: '19:30',
      manque: 4,
      places: 10,
      price: null,
      terrain: { name: 'Terrain 1', sport: 'Football à 5' },
      to: '21:00',
    }],
  }),
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
  // RESA-JOUEUR-2 (D54) : le nom du lieu de la position (la zone écrite) ; rien ici.
  useGetPlacesFromCoordinates: () => ({ data: null }),
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

// La coque RÉELLE ; seuls ses morceaux dessinés sont doublés (un texte chacun, pour les compter).
jest.mock('@/components/molecules/header/LeagueHeaderSwitch', () => function Logo() {
  const { Text: Texte } = jest.requireActual('react-native');
  return <Texte>LOGO</Texte>;
});
jest.mock('@/components/molecules/notificationBadge/NotificationBadge', () => function Cloche() {
  const { Text: Texte } = jest.requireActual('react-native');
  return <Texte>CLOCHE</Texte>;
});
jest.mock('@/components/molecules/profileButton/ProfileButton', () => function Profil() {
  const { Text: Texte } = jest.requireActual('react-native');
  return <Texte>PROFIL</Texte>;
});
jest.mock('@/components/molecules/searchTypeSwitcher/SearchTypeSwitcher', () => function Onglets() {
  const { Text: Texte } = jest.requireActual('react-native');
  return <Texte>ONGLETS</Texte>;
});
jest.mock('@/components/templates/ScreenContainer', () => function Cadre(/** @type {any} */ p) {
  return p.children;
});
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: {} }),
}));
jest.mock('@/domains/guidance/guidanceRuntime', () => ({ emitGuidanceInteraction: jest.fn() }));

/**
 * Une liste déjà visitée de la recherche (Événements, Clubs…) : elle réclame l'en-tête et le pose.
 * @returns {import('react').ReactElement} La liste, cachée comme dans SearchHubScreen.
 */
function ListeDejaVisitee() {
  const enTete = useEnTeteDeRecherche();
  return <View style={{ display: 'none' }}>{enTete}</View>;
}

/**
 * Monte la coque de la recherche avec E-P01, seul ou après une autre liste.
 * @param {{ apresUneAutreListe?: boolean }} [options]
 * @returns {Promise<any>} L'arbre.
 */
const monter = async ({ apresUneAutreListe = false } = {}) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <SearchScreenShell activeType="reservations" navigation={{ replace: jest.fn() }}>
        {apresUneAutreListe ? <ListeDejaVisitee /> : null}
        <RechercheDeTerrains screenActive />
      </SearchScreenShell>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return arbre;
};

/**
 * Les textes « ONGLETS » posés DANS le défilement de E-P01, et partout.
 * @param {any} arbre
 * @returns {{ dansLeDefilement: number, partout: number }} Les deux comptes.
 */
const ongletsPoses = (arbre) => {
  const estOnglets = (/** @type {any} */ n) => n.type === Text && n.props.children === 'ONGLETS';
  const defilement = arbre.root.findAllByType(ScrollView)
    .find((/** @type {any} */ s) => s.findAll((/** @type {any} */ n) => (
      n.props?.testID === 'reserver-recherche-champ')).length > 0);
  return {
    dansLeDefilement: defilement.findAll(estOnglets).length,
    // Hors de la liste cachée (display: none) : ce que le joueur voit.
    partout: arbre.root.findAll(estOnglets).filter((/** @type {any} */ n) => {
      for (let p = n.parent; p; p = p.parent) {
        const s = [p.props?.style].flat(Infinity).filter(Boolean);
        if (s.some((/** @type {any} */ x) => x.display === 'none')) return false;
      }
      return true;
    }).length,
  };
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

describe('HAUT-DEFILE-F1 — Rechercher, panneau Réservations : le haut défile', () => {
  it('seul : logo, cloche, profil, onglets défilent, avant « Mes réservations »', async () => {
    const arbre = await monter();
    expect(ongletsPoses(arbre)).toEqual({ dansLeDefilement: 1, partout: 1 });
    const defilement = arbre.root.findAllByType(ScrollView)[0];
    const textes = defilement.findAllByType(Text).map((/** @type {any} */ n) => n.props.children);
    expect(textes.slice(0, 4)).toEqual(['LOGO', 'CLOCHE', 'PROFIL', 'ONGLETS']);
    expect(textes.indexOf('ONGLETS')).toBeLessThan(textes.indexOf('Mes réservations'));
  }, 30_000);

  it('après une autre liste : les onglets restent à l écran, une seule fois', async () => {
    const arbre = await monter({ apresUneAutreListe: true });
    expect(ongletsPoses(arbre)).toEqual({ dansLeDefilement: 1, partout: 1 });
  }, 30_000);
});
