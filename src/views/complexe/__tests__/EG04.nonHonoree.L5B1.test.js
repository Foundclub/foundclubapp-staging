import renderer, { act } from 'react-test-renderer';

import ComplexeReservations from '@/views/complexe/ComplexeReservations';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';

// RESA-L5B-1 (20/10/2026) — E-G04, l'onglet « Passées » (planche EG04 états 2 à 4 ; plan :496 ;
// serveur RESA-L2B : `canMarkNoShow`, `noShowAt`, `dayBeforeConfirmedAt` dans chaque ligne,
// `statut=non_honoree` en filtre) : le bouton « Non honorée » sur ce que le serveur dit marquable,
// sa confirmation (« Il en sera prévenu. »), « Marquée non honorée » et son « Annuler »
// pendant 5 s, la note d'une réservation extérieure, les pastilles « Jouée » / « Non honorée » et
// la marque « Confirmée la veille ».

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five', vue: 'passees' } }),
}));

/** @type {Record<string, any>} */
let mockVues = {};
/** @type {any[]} */
const mockFiltresLus = [];
const mockMarquer = jest.fn();
const mockAnnulerMarquage = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useAnnulerNonHonoree: () => ({ isPending: false, mutateAsync: mockAnnulerMarquage }),
  useMarquerNonHonoree: () => ({ isPending: false, mutateAsync: mockMarquer }),
  useReservationsDuComplexe: (/** @type {any} */ _id, /** @type {any} */ filtres) => {
    mockFiltresLus.push(filtres);
    return mockVues[filtres.vue];
  },
  useTerrains: () => ({ data: [], isLoading: false }),
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
 * Une ligne de la liste du gérant (`toManagerListItem`, RESA-L2B).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La ligne.
 */
const ligne = (autres = {}) => ({
  canMarkNoShow: false,
  date: '2026-10-13',
  dayBeforeConfirmedAt: null,
  documentId: 'r-1',
  endsAt: '2026-10-13T18:00:00.000Z',
  expiresAt: null,
  from: '19:00',
  label: 'Julien M.',
  noShowAt: null,
  players: 10,
  source: 'app',
  startsAt: '2026-10-13T17:00:00.000Z',
  status: 'confirmee',
  terrain: { documentId: 't-1', name: 'Terrain 1' },
  to: '20:00',
  ...autres,
});

const pages = (/** @type {any[]} */ items) => ({
  data: { pages: [{ items, pagination: { page: 1, pageSize: 20, total: items.length } }] },
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isLoading: false,
  refetch: jest.fn(),
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
 * Appuie sur le premier élément pressable DANS le repère.
 * @param {any} arbre - L'arbre.
 * @param {string} testID - Le repère du conteneur.
 * @returns {Promise<void>} Fini.
 */
const appuyerDans = async (arbre, testID) => {
  const cible = parRepere(arbre, testID)
    .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0];
  await act(async () => {
    cible.props.onPress();
  });
};

/**
 * Un nœud de l'arbre, lu comme un arbre par les outils du banc (`parRepere`, `pressable`).
 * @param {any} noeud - Le nœud.
 * @returns {{ root: any }} L'arbre.
 */
const dans = (noeud) => ({ root: noeud });

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00.000Z') });
  jest.clearAllMocks();
  mockFiltresLus.length = 0;
  mockMarquer.mockResolvedValue({ data: {} });
  mockAnnulerMarquage.mockResolvedValue({ data: {} });
  mockVues = {
    'a-venir': pages([
      ligne({
        date: '2026-10-15',
        dayBeforeConfirmedAt: '2026-10-14T16:12:00.000Z',
        documentId: 'r-9',
        endsAt: '2026-10-15T18:00:00.000Z',
        startsAt: '2026-10-15T17:00:00.000Z',
      }),
    ]),
    aujourdhui: pages([]),
    passees: pages([
      ligne({ canMarkNoShow: true }),
      ligne({
        documentId: 'r-2', from: '20:00', label: 'Karim B.', noShowAt: '2026-10-13T19:30:00.000Z',
      }),
      ligne({
        documentId: 'r-3', from: '21:00', label: 'Mme Roux', players: null, source: 'exterieur',
      }),
    ]),
  };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('RESA-L5B-1 E-G04 — l’onglet Passées (états 2 à 4)', () => {
  it('« Non honorée » là où le serveur le permet ; « Jouée », « Non honorée »', async () => {
    const arbre = await monter();
    expect(parRepere(arbre, 'non-honoree-r-1')).not.toBeNull();
    expect(parRepere(arbre, 'non-honoree-r-2')).toBeNull();
    expect(parRepere(arbre, 'non-honoree-r-3')).toBeNull();
    expect(parRepere(dans(parRepere(arbre, 'reservation-r-1')), 'pastille-etat-jouee'))
      .not.toBeNull();
    expect(parRepere(dans(parRepere(arbre, 'reservation-r-2')), 'pastille-etat-non_honoree'))
      .not.toBeNull();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Jouée', 'Non honorée', 'Une réservation extérieure ne se marque pas.',
    ]));
  });

  it('la confirmation, « Marquer », « Marquée non honorée » et « Annuler » (N-17)', async () => {
    const arbre = await monter();
    await appuyerDans(arbre, 'non-honoree-r-1');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Marquer la réservation de Julien M. (mardi 19 h) comme non honorée ?',
      'Il en sera prévenu.',
    ]));
    await appuyerDans(arbre, 'feuille-non-honoree-marquer');
    expect(mockMarquer).toHaveBeenCalledWith({ complexeId: 'cx-five', reservationId: 'r-1' });
    expect(parRepere(arbre, 'feuille-non-honoree')).toBeNull();
    expect(lisibles(arbre)).toContain('Marquée non honorée');
    await act(async () => {
      pressable(dans(parRepere(arbre, 'reservations-bulle')), 'Annuler').props.onPress();
    });
    expect(mockAnnulerMarquage)
      .toHaveBeenCalledWith({ complexeId: 'cx-five', reservationId: 'r-1' });
    expect(lisibles(arbre)).toContain('Marquage annulé.');
  });

  it('le message et son « Annuler » s’effacent au bout de 5 s', async () => {
    const arbre = await monter();
    await appuyerDans(arbre, 'non-honoree-r-1');
    await appuyerDans(arbre, 'feuille-non-honoree-marquer');
    expect(parRepere(arbre, 'reservations-bulle')).not.toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(parRepere(arbre, 'reservations-bulle')).toBeNull();
  });

  it('un refus du serveur reste dans la feuille, qui reste ouverte', async () => {
    mockMarquer.mockRejectedValueOnce({
      details: { code: 'COMPLEXE_RESERVATION_STATE' },
      message: 'Plus de 7 jours ont passé : la réservation ne se marque plus.',
      status: 409,
    });
    const arbre = await monter();
    await appuyerDans(arbre, 'non-honoree-r-1');
    await appuyerDans(arbre, 'feuille-non-honoree-marquer');
    expect(parRepere(arbre, 'feuille-non-honoree')).not.toBeNull();
    expect(lisibles(arbre))
      .toContain('Plus de 7 jours ont passé : la réservation ne se marque plus.');
  });

  it('le filtre « État » propose « Non honorée » (statut=non_honoree)', async () => {
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'État').props.onPress();
    });
    await act(async () => {
      parRepere(arbre, 'filtre-option-non_honoree').props.onPress();
    });
    const derniere = [...mockFiltresLus].reverse().find((filtres) => filtres.vue === 'passees');
    expect(derniere).toEqual({ statut: 'non_honoree', vue: 'passees' });
  });
});

describe('RESA-L5B-1 E-G04 — « Confirmée la veille » (état 1, RG-VEILLE)', () => {
  it('la marque cyan sur la carte confirmée la veille', async () => {
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'À venir').props.onPress();
    });
    expect(parRepere(dans(parRepere(arbre, 'reservation-r-9')), 'pastille-veille')).not.toBeNull();
    expect(lisibles(arbre)).toContain('Confirmée la veille');
  });
});
