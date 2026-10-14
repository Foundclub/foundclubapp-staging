import renderer, { act } from 'react-test-renderer';

import ComplexeDemandes from '@/views/complexe/ComplexeDemandes';
import ComplexeReservations from '@/views/complexe/ComplexeReservations';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';

// RESA-L5A2 (14/10/2026) — planche OR1 « le gérant au comptoir » : sur ordinateur (≥ 1024 px),
// E-G04 + E-G05 et E-G06 en DEUX VOLETS — la liste à gauche, la fiche à droite ; toucher une ligne
// ouvre sa fiche dans le volet (la ligne choisie est marquée) au lieu de changer d'écran ; dans
// « Demandes », Refuser / Accepter vivent dans le volet, pas sur chaque carte. Sous 1024 px, un
// écran à la fois, comme sur téléphone.

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five', vue: 'a-venir' } }),
}));

let mockOrdinateur = true;
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));

/**
 * Une lecture par pages.
 * @param {any[]} items - Les lignes.
 * @returns {any} La lecture.
 */
const mockPages = (items) => ({
  data: { pages: [{ items, pagination: { page: 1, pageSize: 20, total: items.length } }] },
  isLoading: false,
});
const mockLigne = (/** @type {string} */ id, /** @type {string} */ status) => ({
  date: '2026-10-16',
  documentId: id,
  endsAt: '2026-10-16T18:00:00.000Z',
  expiresAt: '2026-10-14T13:10:00.000Z',
  from: '19:00',
  label: `Joueur ${id}`,
  players: null,
  source: 'app',
  startsAt: '2026-10-16T17:00:00.000Z',
  status,
  terrain: { documentId: 't-1', name: 'Terrain 1' },
  to: '20:00',
});
jest.mock('@/services/complexe/complexeQueries', () => ({
  useComplexeChoisi: () => ({
    complexe: jest.requireActual('@/testSupport/temoinComplexe').COMPLEXE_FIVE,
    complexeId: 'cx-five',
    mes: { isLoading: false },
  }),
  useDeciderDemande: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useReservationsDuComplexe: (/** @type {any} */ _id, /** @type {any} */ filtres) => (
    filtres.vue === 'demandes' || filtres.vue === 'traitees'
      ? mockPages([mockLigne('d-1', 'en_attente'), mockLigne('d-2', 'en_attente')])
      : mockPages([mockLigne('r-1', 'confirmee'), mockLigne('r-2', 'confirmee')])
  ),
  useTerrains: () => ({
    data: [
      jest.requireActual('@/testSupport/temoinComplexe').terrainDeTemoin({ bookingMode: 'manuel' }),
    ],
    isLoading: false,
  }),
}));

// La fiche elle-même a son témoin (EG05) : ici, on regarde seulement QUELLE fiche le volet montre.
jest.mock('@/views/complexe/components/FicheReservation', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  return function FausseFiche(/** @type {any} */ { reservationId }) {
    return <Texte>{`Fiche ${reservationId}`}</Texte>;
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/molecules/input/Input', () => () => null);
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
 * Monte un écran.
 * @param {any} Ecran - L'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async (Ecran) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<Ecran />);
  });
  return arbre;
};

beforeAll(() => {
  jest.useFakeTimers({
    doNotFake: [
      'nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
      'setTimeout', 'clearTimeout', 'queueMicrotask', 'requestAnimationFrame',
      'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance',
      'hrtime',
    ],
    now: new Date('2026-10-14T08:00:00.000Z'),
  });
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockOrdinateur = true;
});

describe('RESA-L5A2 OR1 — E-G04 + E-G05 en deux volets', () => {
  it('la 1re ligne s’ouvre dans le volet ; une autre la remplace, même écran', async () => {
    const arbre = await monter(ComplexeReservations);
    expect(parRepere(arbre, 'volet-fiche')).not.toBeNull();
    expect(lisibles(arbre)).toContain('Fiche r-1');
    await act(async () => {
      parRepere(arbre, 'reservation-r-2').props.onPress();
    });
    expect(lisibles(arbre)).toContain('Fiche r-2');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(parRepere(arbre, 'reservation-r-2').props.accessibilityState)
      .toEqual({ selected: true });
  });

  it('sous 1024 px : un écran à la fois, la carte ouvre la fiche', async () => {
    mockOrdinateur = false;
    const arbre = await monter(ComplexeReservations);
    expect(parRepere(arbre, 'volet-fiche')).toBeNull();
    await act(async () => {
      parRepere(arbre, 'reservation-r-2').props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});

describe('RESA-L5A2 OR1 — E-G06 en deux volets', () => {
  it('la file à gauche, la demande choisie à droite ; pas de boutons sur les cartes', async () => {
    const arbre = await monter(ComplexeDemandes);
    expect(lisibles(arbre)).toContain('Fiche d-1');
    expect(parRepere(arbre, 'demande-accepter-d-1')).toBeNull();
    await act(async () => {
      parRepere(arbre, 'demande-d-2').props.onPress();
    });
    expect(lisibles(arbre)).toContain('Fiche d-2');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('sous 1024 px : les boutons sur chaque carte, comme sur téléphone', async () => {
    mockOrdinateur = false;
    const arbre = await monter(ComplexeDemandes);
    expect(parRepere(arbre, 'volet-fiche')).toBeNull();
    expect(parRepere(arbre, 'demande-accepter-d-1')).not.toBeNull();
  });
});
