import renderer, { act } from 'react-test-renderer';

import RechercheDeTerrains from '@/views/reserverTerrain/RechercheDeTerrains';

import { RouteNames } from '@/navigation/routeNames';

import {
  lisibles, parRepere, pressable, textes,
} from '@/testSupport/temoinComplexe';
import { carteDeRecherche } from '@/testSupport/temoinReserver';

// RESA-L6A (14/10/2026) — E-P01 « Réserver un terrain : la recherche » (planches EP01, RA1 ; plan
// E-P01) : la position demandée à l'ouverture (« Des terrains autour de toi »), ou une ville ; un
// seul champ « Complexe, ville ou sport », tolérant aux fautes (le serveur juge, dès 2 lettres,
// 300 ms) ; les filtres sport, jour, heure, distance, intérieur / extérieur ; une carte par
// complexe (logo, nom, pastille, distance, sports, prochains créneaux libres) ; vide, chargement,
// erreur, hors connexion. Le serveur ne rend que des créneaux VRAIMENT libres (RC-P01).

// La place de la barre d'onglets flottante : useBottomDockLayout tire @react-navigation/stack, que
// jest ne transforme pas ; doublé, comme dans les témoins de ClubListContent.
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ dockClearance: 0, floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
}));

const mockNavigate = jest.fn();
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

let mockVilles = /** @type {any[]} */ ([]);
jest.mock('@/services/places/placesQueries', () => ({
  useGetPlaces: () => ({ data: mockVilles }),
}));

let mockPositionAccordee = /** @type {any} */ (null);
let mockPositionDemandee = /** @type {any} */ (null);
const mockDemande = jest.fn();
jest.mock('@/platform/maps/searchMapGeolocation', () => ({
  readCurrentSearchMapLocationIfGranted: async () => mockPositionAccordee,
  requestCurrentSearchMapLocation: async () => {
    mockDemande();
    return mockPositionDemandee;
  },
}));

let mockVilleChoisie = /** @type {any} */ (null);
// RESA-FIN-APP : le stockage local du téléphone (la ville retenue), doublé par une table.
const mockStockage = new Map();
jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ cle) => mockStockage.get(cle),
  removeItem: (/** @type {string} */ cle) => mockStockage.delete(cle),
  setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => mockStockage.set(cle, valeur),
}));
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

const refetch = jest.fn();

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

/**
 * Appuie sur un élément par son libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {Promise<void>} Fini.
 */
const appuyer = async (arbre, libelle) => {
  await act(async () => {
    pressable(arbre, libelle).props.onPress();
  });
  await act(async () => {
    await Promise.resolve();
  });
};

/**
 * Les derniers filtres envoyés au serveur.
 * @returns {any} Les filtres.
 */
const derniersFiltres = () => mockAppels[mockAppels.length - 1]?.filtres;

// Préchauffage (demande du chef de soutien, 14/10) : le PREMIER montage paie la mise en route du
// panneau (premier rendu de tout son arbre) — 2,4 s mesurées avec un processeur chargé à 79 %,
// au-delà des 5 s du délai par témoin sous plus forte charge (« cherche autour de la position »
// rouge deux fois sur deux). Un montage à blanc ici, avec son propre délai, sort ce coût des
// témoins.
beforeAll(async () => {
  mockPositionAccordee = { lat: 48.83, lng: 1.48 };
  mockRecherche = {
    data: { complexes: [carteDeRecherche()], date: '2026-10-14' },
    error: null,
    isLoading: false,
    isRefetching: false,
    refetch,
  };
  const arbre = await monter();
  act(() => {
    arbre.unmount();
  });
}, 30000);

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  mockAppels.length = 0;
  mockVilles = [];
  mockVilleChoisie = null;
  mockStockage.clear();
  mockPositionAccordee = { lat: 48.83, lng: 1.48 };
  mockPositionDemandee = null;
  mockRecherche = {
    data: { complexes: [carteDeRecherche()], date: '2026-10-14' },
    dataUpdatedAt: new Date('2026-10-14T08:00:00Z').getTime(),
    error: null,
    isLoading: false,
    isRefetching: false,
    refetch,
  };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('E-P01 — autour de toi (position déjà accordée)', () => {
  it('cherche autour de la position, aujourd’hui à Paris, à 10 km', async () => {
    await monter();
    expect(derniersFiltres()).toEqual({
      date: '2026-10-14', lat: 48.83, lng: 1.48, rayon: 10,
    });
    expect(mockDemande).not.toHaveBeenCalled();
  });

  it('la carte d’un complexe : nom, pastille, distance, sports, créneaux, prix', async () => {
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toEqual(expect.arrayContaining([
      'Autour de moi',
      'Le Five de Montrivage',
      'Complexe de réservation',
      '2,4 km',
      'Foot à 5 · Padel',
      '18 h',
      '19 h',
      '20 h 30',
      'dès 6 € par joueur',
    ]));
    expect(vus).not.toContain('Téléphone seulement');
  });

  it('toucher la carte ouvre la page du complexe (E-P02)', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Le Five de Montrivage : voir le complexe');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverComplexe, {
      slug: 'le-five-de-montrivage',
    });
  });

  it('toucher un créneau ouvre le calendrier du terrain sur ce créneau (E-P03)', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Terrain 1, 19 h');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverCreneau, {
      date: '2026-10-14',
      from: '19:00',
      slug: 'le-five-de-montrivage',
      terrainId: 't-1',
    });
  });

  it('un complexe dont tous les terrains sont « par téléphone » le dit', async () => {
    mockRecherche.data.complexes = [carteDeRecherche({ phoneOnly: true })];
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Téléphone seulement');
  });
});

describe('E-P01 — la position à l’ouverture (RA1 états 1, 6)', () => {
  beforeEach(() => {
    mockPositionAccordee = null;
  });

  it('pas encore accordée : la feuille « Des terrains autour de toi », rien ne part', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Des terrains autour de toi',
      'Autorise ta position pour voir les terrains libres près de toi, triés par distance.',
      'Autoriser ma position',
      'Choisir une ville',
    ]));
    expect(mockAppels.every(({ options }) => options?.enabled === false)).toBe(true);
  });

  it('« Autoriser ma position » accordée : la recherche part autour de toi', async () => {
    mockPositionDemandee = { lat: 48.9, lng: 1.5 };
    const arbre = await monter();
    await appuyer(arbre, 'Autoriser ma position');
    expect(mockDemande).toHaveBeenCalledTimes(1);
    expect(derniersFiltres()).toEqual({
      date: '2026-10-14', lat: 48.9, lng: 1.5, rayon: 10,
    });
  });

  it('refusée : le message de l’inscription, et le choix d’une ville', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Autoriser ma position');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Localisation refusée : choisis une ville pour voir les terrains. '
        + 'Tu peux l’autoriser dans les réglages de ton téléphone.',
    ]));
    mockVilleChoisie = {
      city: 'Valbrune', label: 'Valbrune', lat: 48.7, lng: 1.3,
    };
    await appuyer(arbre, 'Tape une ville');
    expect(derniersFiltres()).toEqual({
      date: '2026-10-14', lat: 48.7, lng: 1.3, rayon: 10,
    });
    expect(lisibles(arbre)).toContain('Valbrune');
  });
});

describe('E-P01 — le champ et les filtres (RA1 état 4, EP01 état 4)', () => {
  it('le nom part au serveur 300 ms après la frappe, dès 2 lettres', async () => {
    const arbre = await monter();
    const champ = parRepere(arbre, 'reserver-recherche-champ');
    await act(async () => {
      champ.props.onChangeText('padl valbr');
    });
    expect(derniersFiltres().q).toBeUndefined();
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(derniersFiltres()).toEqual({
      date: '2026-10-14', lat: 48.83, lng: 1.48, q: 'padl valbr', rayon: 10,
    });
  });

  it('un sport qui ressemble au texte devient un filtre', async () => {
    const arbre = await monter();
    await act(async () => {
      parRepere(arbre, 'reserver-recherche-champ').props.onChangeText('squa');
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await appuyer(arbre, 'Filtrer les terrains de Squash');
    expect(derniersFiltres()).toEqual({
      date: '2026-10-14', lat: 48.83, lng: 1.48, rayon: 10, sport: 'a-squash',
    });
  });

  it('la feuille des filtres : sport, jour, heure, distance, terrain', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Filtrer');
    await appuyer(arbre, 'Padel');
    await appuyer(arbre, 'Demain');
    await appuyer(arbre, 'Après 18 h');
    await appuyer(arbre, '20 km');
    await appuyer(arbre, 'Intérieur');
    await appuyer(arbre, 'Voir les terrains');
    expect(derniersFiltres()).toEqual({
      apres: '18:00',
      cadre: 'interieur',
      date: '2026-10-15',
      lat: 48.83,
      lng: 1.48,
      rayon: 20,
      sport: 'a-padel',
    });
  });

  it('« Avant 12 h » ne garde que les créneaux du matin', async () => {
    mockRecherche.data.complexes = [carteDeRecherche({
      slots: [
        { ...carteDeRecherche().slots[0], from: '10:00', to: '11:00' },
        carteDeRecherche().slots[1],
      ],
    })];
    const arbre = await monter();
    await appuyer(arbre, 'Filtrer');
    await appuyer(arbre, 'Avant 12 h');
    await appuyer(arbre, 'Voir les terrains');
    const vus = lisibles(arbre);
    expect(vus).toContain('10 h');
    expect(vus).not.toContain('19 h');
  });
});

describe('E-P01 — les états', () => {
  it('chargement : trois cartes en squelette', async () => {
    mockRecherche = { ...mockRecherche, data: undefined, isLoading: true };
    const arbre = await monter();
    expect(parRepere(arbre, 'reserver-recherche-squelette')).not.toBeNull();
  });

  it('erreur : « Réessayer » relit', async () => {
    mockRecherche = { ...mockRecherche, data: undefined, error: new Error('x') };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de charger les terrains.');
    await appuyer(arbre, 'Réessayer');
    expect(refetch).toHaveBeenCalled();
  });

  it('hors connexion avec une liste déjà lue : la liste reste, avec un bandeau daté', async () => {
    mockRecherche = { ...mockRecherche, error: { code: 'ERR_NETWORK', message: 'Network Error' } };
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toContain('Le Five de Montrivage');
    expect(vus).toContain(
      'Hors connexion : les créneaux affichés datent de 10 h et peuvent être pris.',
    );
  });

  it('vide : deux façons d’élargir', async () => {
    mockRecherche.data.complexes = [];
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Aucun terrain libre avec ces filtres.');
    await appuyer(arbre, 'Élargir à 20 km');
    expect(derniersFiltres().rayon).toBe(20);
    await appuyer(arbre, 'Voir demain');
    expect(derniersFiltres().date).toBe('2026-10-15');
  });

  it('rien trouvé pour un nom : le texte est redit', async () => {
    mockRecherche.data.complexes = [];
    const arbre = await monter();
    await act(async () => {
      parRepere(arbre, 'reserver-recherche-champ').props.onChangeText('squash');
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(lisibles(arbre)).toContain('Aucun terrain pour « squash » autour de toi.');
  });
});

// RESA-FIN-APP (20/10/2026) — tournées 1 et 2 : la carte montrait « 17 h » TROIS fois (une puce par terrain,
// le nom du terrain seulement dans la lecture d'écran). Une heure partagée par plusieurs terrains dit son
// terrain (« 17 h · Padel A ») ; une heure seule reste courte (plan E-P01 §3.5 : « 18 h », « 19 h »). Et chaque
// puce est dessinée en un seul mot (Android 16 : un texte gras de plusieurs mots perd son dernier mot).
describe('RESA-FIN-APP (3) E-P01 — une heure partagée par plusieurs terrains dit son terrain', () => {
  const aDixSeptHeures = (/** @type {string} */ id, /** @type {string} */ nom) => ({
    from: '17:00',
    price: { amount: 60, perPlayer: 6, unit: 'creneau' },
    startsAt: '2026-10-14T15:00:00.000Z',
    terrain: { bookingMode: 'automatique', documentId: id, name: nom },
    to: '18:00',
  });

  it('« 17 h · Padel A », « 17 h · Terrain 1 », « 17 h · Terrain 2 », puis « 18 h »', async () => {
    const base = carteDeRecherche();
    mockRecherche = {
      ...mockRecherche,
      data: {
        complexes: [carteDeRecherche({
          slots: [
            aDixSeptHeures('t-padel', 'Padel A'), aDixSeptHeures('t-1', 'Terrain 1'),
            aDixSeptHeures('t-2', 'Terrain 2'), base.slots[0],
          ],
        })],
        date: '2026-10-14',
      },
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      '17 h · Padel A', '17 h · Terrain 1', '17 h · Terrain 2', '18 h',
    ]));
    expect(lisibles(arbre).filter((texte) => texte === '17 h')).toEqual([]);
    const puce = textes(arbre).find((texte) => texte.includes('Padel A') && texte.includes('17'));
    expect(puce).not.toMatch(/ /);
  });
});

// RESA-FIN-APP (20/10/2026) — tournées 1 et 2 : la ville choisie n'était pas gardée d'une visite à l'autre
// (« Réserver ailleurs » rouvrait la feuille de position 30 min après). Elle est retenue sur le téléphone ; la
// position, si on l'autorise ensuite, la remplace.
describe('RESA-FIN-APP (4) E-P01 — la ville choisie est gardée', () => {
  beforeEach(() => {
    mockPositionAccordee = null;
  });

  it('choisir une ville la retient ; la visite suivante cherche autour d’elle, sans redemander', async () => {
    const premiere = await monter();
    await appuyer(premiere, 'Choisir une ville');
    mockVilleChoisie = {
      city: 'Valbrune', label: 'Valbrune', lat: 48.7, lng: 1.3,
    };
    await appuyer(premiere, 'Tape une ville');
    expect(derniersFiltres()).toEqual({
      date: '2026-10-14', lat: 48.7, lng: 1.3, rayon: 10,
    });
    act(() => {
      premiere.unmount();
    });
    mockAppels.length = 0;
    const seconde = await monter();
    expect(lisibles(seconde)).not.toContain('Des terrains autour de toi');
    expect(lisibles(seconde)).toContain('Valbrune');
    expect(derniersFiltres()).toEqual({
      date: '2026-10-14', lat: 48.7, lng: 1.3, rayon: 10,
    });
  });
});
