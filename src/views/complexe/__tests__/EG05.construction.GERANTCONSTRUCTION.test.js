import renderer, { act } from 'react-test-renderer';

import ComplexeReservation from '@/views/complexe/ComplexeReservation';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';

// 🏗️ GERANT-CONSTRUCTION (11/11/2026, D50) — LA FICHE D'UNE RÉSERVATION « EN CONSTRUCTION », côté
// gérant (maquette gerant-fiche.png) : la jauge « 7 sur 10 » et « Ils cherchent 3 joueurs »,
// l'évolution (qui vient, par où ; les joueurs trouvés hors de l'app ; la création), « Écrire au
// client » (MESSAGERIE-COMPLEXE) et « Partager l'annonce » (dans son canal, RESA-PARTAGER), et
// « Tant qu'elle est en construction, un autre groupe peut réserver ce créneau. ».

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five', reservationId: 'r-c1' } }),
}));

let mockFiche = /** @type {any} */ ({});
const mockPartager = jest.fn();
const mockEcrire = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useAnnulerNonHonoree: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useAnnulerReservation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useComplexeGere: () => ({ data: null }),
  useDeciderDemande: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useEcrireAuReserveur: () => ({ isPending: false, mutateAsync: mockEcrire }),
  useFideliteDuComplexe: () => ({ data: null, isLoading: false }),
  useMarquerNonHonoree: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useModifierExterieur: () => ({ isPending: false, mutateAsync: jest.fn() }),
  usePartagerAnnonce: () => ({ isPending: false, mutateAsync: mockPartager }),
  useReservationGeree: () => mockFiche,
  useValiderRecompense: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
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
 * La fiche d'une réservation en construction, telle que le serveur la rend au gérant.
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La fiche.
 */
const fiche = (autres = {}) => ({
  annonce: {
    documentId: 'an-1', joined: 1, places: 4, status: 'ouverte',
  },
  booker: {
    bookingsHere: 3, firstname: 'Julien', lastname: 'Marchal', phone: null,
  },
  construction: {
    collectDeadline: '2026-10-16T15:00:00.000Z',
    createdAt: '2026-10-14T13:26:00.000Z',
    externalPlayers: 2,
    manque: 3,
    participants: [{ label: 'Inès R.', respondedAt: '2026-10-14T15:02:00.000Z', via: 'annonce' }],
    presents: 7,
    quorum: 10,
  },
  createdAt: '2026-10-14T13:26:00.000Z',
  date: '2026-10-16',
  documentId: 'r-c1',
  endsAt: '2026-10-16T18:00:00.000Z',
  from: '19:00',
  history: [],
  players: 10,
  price: null,
  source: 'app',
  startsAt: '2026-10-16T17:00:00.000Z',
  status: 'en_collecte',
  terrain: { documentId: 't-1', name: 'Terrain 1', sport: null },
  to: '20:00',
  ...autres,
});

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeReservation />);
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
    now: new Date('2026-10-14T16:00:00.000Z'),
  });
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFiche = { data: fiche(), isLoading: false, refetch: jest.fn() };
  mockPartager.mockResolvedValue({
    data: { chat: 'chat-canal', dejaPartagee: false, message: 'm-1' },
  });
  mockEcrire.mockResolvedValue({ data: { chat: { documentId: 'chat-1' } } });
});

describe('GERANT-CONSTRUCTION — la fiche « en construction »', () => {
  it('la jauge, ce qui manque, l’évolution et la règle du créneau', async () => {
    const arbre = await monter();
    const lus = lisibles(arbre);
    expect(parRepere(arbre, 'fiche-construction')).not.toBeNull();
    [
      'EN CONSTRUCTION',
      '7 sur 10',
      'Ils cherchent 3 joueurs',
      'ÉVOLUTION',
      'Inès R. vient',
      'par l’annonce · 14/10 à 17 h 02',
      '2 joueurs trouvés hors de l’app',
      'Réservation créée en construction',
      'par Julien M. · 14/10 à 15 h 26',
      'Tant qu’elle est en construction, un autre groupe peut réserver ce créneau.',
    ].forEach((texte) => expect(lus).toContain(texte));
  });

  it('« Partager l’annonce » la pose dans son canal ; « Écrire au client » ouvre la conversation', async () => {
    const arbre = await monter();
    await act(async () => { pressable(arbre, 'Partager l’annonce').props.onPress(); });
    expect(mockPartager).toHaveBeenCalledWith({ complexeId: 'cx-five', reservationId: 'r-c1' });
    expect(lisibles(arbre)).toContain('Annonce partagée dans ton canal.');
    expect(() => pressable(arbre, 'Écrire au client')).not.toThrow();
  });

  it('sans annonce ouverte : pas de « Partager l’annonce », « Écrire au client » reste', async () => {
    mockFiche = { ...mockFiche, data: fiche({ annonce: null }) };
    const arbre = await monter();
    expect(() => pressable(arbre, 'Partager l’annonce')).toThrow();
    expect(() => pressable(arbre, 'Écrire au client')).not.toThrow();
  });

  it('une réservation confirmée ne montre pas le bloc', async () => {
    mockFiche = { ...mockFiche, data: fiche({ construction: undefined, status: 'confirmee' }) };
    const arbre = await monter();
    expect(parRepere(arbre, 'fiche-construction')).toBeNull();
  });
});
