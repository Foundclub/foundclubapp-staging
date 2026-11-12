import renderer, { act } from 'react-test-renderer';

import RechercheDeTerrains from '@/views/reserverTerrain/RechercheDeTerrains';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { carteDeRecherche } from '@/testSupport/temoinReserver';

// RESA-JOUEUR-2 (11/11/2026) — E-P01 de la maquette validée « 232- ok » (D54 « il faut pouvoir
// voir où est-ce qu'on est localisé », D59 « la recherche du lieu […] n'ouvre pas le sélecteur ») :
//   · la zone écrite en toutes lettres (« Autour de Marseille 13e · 10 km »), la précision de la
//     position, « Changer » ; sans nom trouvé : « Autour de ta position » ;
//   · la feuille « Changer de zone » : autour de moi ou une ville (le sélecteur de lieu habituel),
//     puis le rayon 5, 10, 20 ou 50 km ;
//   · l'état vide rappelle la zone et propose « Élargir », « Changer de ville », « Voir demain » ;
//   · position refusée : « Ta position n’est pas connue », la ville, gardée pour la prochaine fois.
// Décidé (« Q3 A ») : la vue CARTE ne change pas (resa-carte.spec, 390 px) : ses puces restent.

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
    ],
  }),
}));

let mockAdresse = /** @type {any} */ (null);
jest.mock('@/services/places/placesQueries', () => ({
  useGetPlaces: () => ({ data: [] }),
  useGetPlacesFromCoordinates: (/** @type {any} */ { options }) => (
    options?.enabled === false ? { data: undefined } : { data: mockAdresse }
  ),
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
const mockStockage = new Map();
jest.mock('@/platform/storage', () => ({
  getItem: (/** @type {string} */ cle) => mockStockage.get(cle),
  removeItem: (/** @type {string} */ cle) => mockStockage.delete(cle),
  setItem: (/** @type {string} */ cle, /** @type {string} */ valeur) => {
    mockStockage.set(cle, valeur);
  },
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

const VALBRUNE = JSON.stringify({ label: 'Valbrune', lat: 48.7, lng: 1.3 });

// Préchauffage : le premier montage paie la mise en route du panneau (voir EP01.recherche).
beforeAll(async () => {
  mockPositionAccordee = { lat: 43.33, lng: 5.43 };
  mockRecherche = { data: { complexes: [carteDeRecherche()], date: '2026-10-14' }, refetch };
  const arbre = await monter();
  act(() => {
    arbre.unmount();
  });
}, 30000);

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  mockAppels.length = 0;
  mockVilleChoisie = null;
  mockStockage.clear();
  mockPositionAccordee = { accuracy: 48.6, lat: 43.33, lng: 5.43 };
  mockPositionDemandee = null;
  mockAdresse = {
    properties: {
      city: 'Marseille',
      district: 'Marseille 13e Arrondissement',
      label: '12 Rue des Lilas 13013 Marseille',
    },
  };
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

describe('RESA-JOUEUR-2 E-P01 — la zone écrite (D54)', () => {
  it('position : « Autour de Marseille 13e · 10 km », sa précision, « Changer »', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Autour de Marseille 13e · 10 km',
      'Ta position, à 50 m près',
      'Changer',
    ]));
    // Les deux puces « Autour de moi » et « 10 km » sont remplacées par la zone écrite.
    expect(lisibles(arbre)).not.toContain('Autour de moi');
    expect(lisibles(arbre)).not.toContain('10 km');
  });

  it('aucun nom trouvé pour la position : « Autour de ta position · 10 km »', async () => {
    mockAdresse = null;
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Autour de ta position · 10 km');
  });

  it('une ville choisie : « Autour de Valbrune · 10 km », « Ville choisie »', async () => {
    mockPositionAccordee = null;
    mockStockage.set('reserverTerrain.ville', VALBRUNE);
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Autour de Valbrune · 10 km',
      'Ville choisie',
    ]));
  });
});

describe('RESA-JOUEUR-2 E-P01 — la feuille « Changer de zone » (D54, D59)', () => {
  it('le rayon : 5, 10, 20 ou 50 km ; « Voir les terrains » cherche à 50 km', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Changer');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Où cherches-tu ?',
      'Autour de moi · Marseille 13e',
      'Une autre ville',
      'Rayon',
      '5 km',
      '50 km',
      'Ta position a été lue à 10 h, à 50 m près. Si elle est fausse, choisis une ville.',
    ]));
    await appuyer(arbre, '50 km');
    await appuyer(arbre, 'Voir les terrains');
    expect(lisibles(arbre)).not.toContain('Où cherches-tu ?');
    expect(derniersFiltres()).toEqual({
      date: '2026-10-14', lat: 43.33, lng: 5.43, rayon: 50,
    });
    expect(lisibles(arbre)).toContain('Autour de Marseille 13e · 50 km');
  });

  it('« Une autre ville » ouvre le sélecteur de lieu habituel ; la ville est retenue', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Changer');
    expect(lisibles(arbre)).not.toContain('Tape une ville');
    await appuyer(arbre, 'Une autre ville');
    mockVilleChoisie = {
      city: 'Aix-en-Provence', label: 'Aix-en-Provence', lat: 43.53, lng: 5.45,
    };
    await appuyer(arbre, 'Tape une ville');
    await appuyer(arbre, 'Voir les terrains');
    expect(derniersFiltres()).toEqual({
      date: '2026-10-14', lat: 43.53, lng: 5.45, rayon: 10,
    });
    expect(lisibles(arbre)).toContain('Autour de Aix-en-Provence · 10 km');
    expect(JSON.parse(mockStockage.get('reserverTerrain.ville')).label).toBe('Aix-en-Provence');
  });

  it('« Autour de moi » depuis une ville redemande la position', async () => {
    mockPositionAccordee = null;
    mockPositionDemandee = { lat: 43.33, lng: 5.43 };
    mockStockage.set('reserverTerrain.ville', VALBRUNE);
    const arbre = await monter();
    await appuyer(arbre, 'Changer');
    await appuyer(arbre, 'Autour de moi');
    await appuyer(arbre, 'Voir les terrains');
    expect(mockDemande).toHaveBeenCalledTimes(1);
    expect(derniersFiltres()).toEqual({
      date: '2026-10-14', lat: 43.33, lng: 5.43, rayon: 10,
    });
  });
});

describe('RESA-JOUEUR-2 E-P01 — l’état vide rappelle la zone', () => {
  it('sans filtre : jour, rayon et lieu ; élargir, changer de ville, voir demain', async () => {
    mockRecherche.data.complexes = [];
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Aucun terrain libre aujourd’hui à moins de 10 km de Marseille 13e.',
      'Élargir à 20 km',
      'Changer de ville',
      'Voir demain',
    ]));
    await appuyer(arbre, 'Voir demain');
    expect(lisibles(arbre))
      .toContain('Aucun terrain libre demain à moins de 10 km de Marseille 13e.');
    await appuyer(arbre, 'Changer de ville');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining(['Où cherches-tu ?', 'Tape une ville']));
  });
});

describe('RESA-JOUEUR-2 E-P01 — position refusée ou inconnue', () => {
  it('le dire, ouvrir les réglages, choisir une ville gardée pour la prochaine fois', async () => {
    mockPositionAccordee = null;
    const arbre = await monter();
    await appuyer(arbre, 'Autoriser ma position');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Ta position n’est pas connue',
      'Ouvrir les réglages',
      'Choisis une ville',
      'Ta ville sert à calculer les distances. Elle est gardée pour ta prochaine recherche.',
    ]));
  });
});

describe('RESA-JOUEUR-2 E-P01 — la vue carte ne change pas (« Q3 A »)', () => {
  it('en carte : les puces « Autour de moi » et « 10 km », la phrase du vide d’avant', async () => {
    mockRecherche.data.complexes = [];
    const arbre = await monter();
    await act(async () => {
      parRepere(arbre, 'reserver-recherche-vue-carte').props.onPress();
    });
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Autour de moi',
      '10 km',
      'Aucun terrain disponible pour l’instant dans cette zone.',
    ]));
    expect(lisibles(arbre)).not.toContain('Autour de Marseille 13e · 10 km');
  });
});
