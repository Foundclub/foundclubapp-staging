import renderer, { act } from 'react-test-renderer';

import ComplexeReservations from '@/views/complexe/ComplexeReservations';

import { RouteNames } from '@/navigation/routeNames';

import {
  lisibles,
  parRepere,
  pressable,
  terrainDeTemoin,
} from '@/testSupport/temoinComplexe';

// RESA-L5A2 (14/10/2026) — E-G04 « Les réservations du complexe » (planche EG04) : onglets
// Aujourd'hui · À venir · Passées avec leurs nombres, filtres terrain · source · état, liste
// groupée par jour (heure, nom, terrain, joueurs, source, état), pages de 20, états vides.
// Doublure : `GET /complexes/:id/reservations?vue&terrain&source&statut&page` (RESA-L2A).

const mockNavigate = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

/** @type {Record<string, any>} */
let mockVues = {};
/** @type {any[]} */
const mockFiltresLus = [];
jest.mock('@/services/complexe/complexeQueries', () => ({
  // RESA-L5B-1 : les gestes « non honorée » de l'onglet Passées (témoin EG04.nonHonoree.L5B1).
  useAnnulerNonHonoree: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useMarquerNonHonoree: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useReservationsDuComplexe: (/** @type {any} */ _id, /** @type {any} */ filtres) => {
    mockFiltresLus.push(filtres);
    return mockVues[filtres.vue];
  },
  useTerrains: () => ({
    data: [
      jest.requireActual('@/testSupport/temoinComplexe').terrainDeTemoin(),
      jest.requireActual('@/testSupport/temoinComplexe').terrainDeTemoin({
        documentId: 't-2', name: 'Terrain 2',
      }),
    ],
    isLoading: false,
  }),
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => (
  jest.requireActual('@/testSupport/temoinComplexe').ongletsDeTemoin()
));
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/**
 * Une réservation de la liste du gérant (`toManagerListItem`).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La ligne.
 */
const ligne = (autres = {}) => ({
  date: '2026-10-15',
  documentId: 'r-1',
  endsAt: '2026-10-15T18:00:00.000Z',
  expiresAt: null,
  from: '19:00',
  label: 'Julien M.',
  players: 10,
  source: 'app',
  startsAt: '2026-10-15T17:00:00.000Z',
  status: 'confirmee',
  terrain: { documentId: 't-1', name: 'Terrain 1' },
  to: '20:00',
  ...autres,
});

/**
 * Une lecture par pages.
 * @param {any[]} items - Les lignes.
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {any} La lecture.
 */
const pages = (items, autres = {}) => ({
  data: { pages: [{ items, pagination: { page: 1, pageSize: 20, total: items.length } }] },
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isLoading: false,
  refetch: jest.fn(),
  ...autres,
});

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeReservations />);
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
};

/**
 * Les filtres de la dernière lecture d'une vue (l'écran lit trois vues à chaque rendu).
 * @param {string} vue - La vue.
 * @returns {any} Les filtres.
 */
const derniereLecture = (vue) => [...mockFiltresLus]
  .reverse()
  .find((filtres) => filtres.vue === vue);

/**
 * Choisit une option de la feuille d'un filtre, par son repère (les cartes de la liste portent
 * aussi « Terrain 2 » ou « Extérieur »).
 * @param {any} arbre - L'arbre.
 * @param {string} testID - Le repère de l'option.
 * @returns {Promise<void>} Fini.
 */
const choisir = async (arbre, testID) => {
  await act(async () => {
    parRepere(arbre, testID).props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFiltresLus.length = 0;
  mockParams = { complexeId: 'cx-five', vue: 'a-venir' };
  mockVues = {
    'a-venir': pages([
      ligne(),
      ligne({
        documentId: 'r-2',
        externalName: 'M. Dupont',
        from: '20:00',
        label: 'M. Dupont',
        players: null,
        source: 'exterieur',
        to: '21:00',
      }),
      ligne({
        date: '2026-10-16',
        documentId: 'r-3',
        from: '18:00',
        label: 'Lina T.',
        players: 6,
        status: 'en_attente',
        terrain: { documentId: 't-2', name: 'Terrain 2' },
      }),
    ]),
    aujourdhui: pages([ligne({ date: '2026-10-14', documentId: 'r-0' })]),
    passees: pages([]),
  };
});

describe('RESA-L5A2 E-G04 — À venir (état 1)', () => {
  it('les onglets avec leurs nombres, la liste groupée par jour', async () => {
    const arbre = await monter();
    const lus = lisibles(arbre);
    const ordre = [
      'RÉSERVATIONS',
      'Aujourd’hui (1)',
      'À venir (3)',
      'Passées',
      'Terrain',
      'Source',
      'État',
      'JEUDI 15 OCTOBRE',
      '19 h',
      'Julien M. · Terrain 1',
      '10 joueurs',
      '20 h',
      'M. Dupont · Terrain 1',
      'VENDREDI 16 OCTOBRE',
      'Lina T. · Terrain 2',
      'En attente',
    ].map((texte) => lus.indexOf(texte));
    expect(ordre.every((index) => index > -1)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    // Une note « extérieur » confirmée : sa source, sans pastille d'état.
    const etats = parRepere(arbre, 'reservation-r-2')
      .findAll((/** @type {any} */ n) => n.props?.testID === 'pastille-etat-confirmee');
    expect(etats).toHaveLength(0);
  });

  it('toucher une carte ouvre sa fiche (E-G05)', async () => {
    const arbre = await monter();
    await act(async () => {
      parRepere(arbre, 'reservation-r-3').props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeReservation, {
      complexeId: 'cx-five', reservationId: 'r-3',
    });
  });

  it('un filtre : la feuille de ses choix, puis la liste relue avec lui', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Source');
    await choisir(arbre, 'filtre-option-exterieur');
    expect(derniereLecture('a-venir')).toEqual({ source: 'exterieur', vue: 'a-venir' });
    await appuyer(arbre, 'Terrain');
    await choisir(arbre, 'filtre-option-t-2');
    expect(derniereLecture('a-venir'))
      .toEqual({ source: 'exterieur', terrain: 't-2', vue: 'a-venir' });
    await appuyer(arbre, 'État');
    await choisir(arbre, 'filtre-option-annulee');
    expect(derniereLecture('a-venir')).toEqual({
      source: 'exterieur', statut: 'annulee', terrain: 't-2', vue: 'a-venir',
    });
  });

  it('plus de 20 : « Voir plus »', async () => {
    const fetchNextPage = jest.fn();
    mockVues['a-venir'] = pages([ligne()], { fetchNextPage, hasNextPage: true });
    const arbre = await monter();
    await appuyer(arbre, 'Voir plus');
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});

describe('RESA-L5A2 E-G04 — les onglets et leurs états vides (états 5 à 8)', () => {
  it('Passées, vide : une phrase', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Passées');
    expect(lisibles(arbre)).toContain('Aucune réservation passée.');
  });

  it('Aujourd’hui, vide ; À venir, vide', async () => {
    mockParams = { complexeId: 'cx-five' };
    mockVues.aujourdhui = pages([]);
    mockVues['a-venir'] = pages([]);
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Aucune réservation aujourd’hui.');
    await appuyer(arbre, 'À venir (0)');
    expect(lisibles(arbre)).toContain('Aucune réservation à venir.');
  });

  it('chargement, puis erreur et « Réessayer »', async () => {
    mockVues['a-venir'] = pages([], { data: undefined, isLoading: true });
    let arbre = await monter();
    expect(parRepere(arbre, 'reservations-squelette')).not.toBeNull();
    const refetch = jest.fn();
    mockVues['a-venir'] = pages([], { data: undefined, error: new Error('boum'), refetch });
    arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de charger les réservations.');
    await appuyer(arbre, 'Réessayer');
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('RESA-L5A2 E-G04 — les terrains du filtre', () => {
  it('le filtre « Terrain » propose « Tous les terrains » et chaque terrain', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Terrain');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Tous les terrains', terrainDeTemoin().name, 'Terrain 2',
    ]));
  });
});
