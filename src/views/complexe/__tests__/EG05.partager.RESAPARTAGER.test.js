import renderer, { act } from 'react-test-renderer';

import ComplexeReservation from '@/views/complexe/ComplexeReservation';

import { lisibles, pressable } from '@/testSupport/temoinComplexe';

// 🏟️ RESA-PARTAGER (23/10/2026, A-G32, plan E-G05 :528) — « PARTAGER DANS MON CANAL » depuis la
// fiche d'une réservation, côté gérant. Serveur (admin `canal.partagerAnnonce`) :
// `POST /complexes/:id/reservations/:reservationId/annonce/partager` pose l'annonce OUVERTE de la
// réservation en carte dans le canal ; deux fois de suite, rien n'est doublé (200 `dejaPartagee`) ;
// sans annonce ouverte : 409 « Cette réservation n’a pas d’annonce ouverte à partager. ».
// Le bouton : réservation de l'app, confirmée, à venir ; si la fiche dit son annonce (`annonce`),
// seulement quand elle est ouverte. Après le geste : « Annonce partagée dans ton canal. », puis
// « Annonce déjà partagée dans ton canal. ».

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five', reservationId: 'r-1' } }),
}));

let mockFiche = /** @type {any} */ ({});
const mockPartager = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useAnnulerNonHonoree: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useAnnulerReservation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useComplexeGere: () => ({ data: null }),
  useDeciderDemande: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useEcrireAuReserveur: () => ({ isPending: false, mutateAsync: jest.fn() }),
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
 * La fiche telle que le serveur la rend au gérant (`toManagerView`).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La fiche.
 */
const fiche = (autres = {}) => ({
  booker: {
    bookingsHere: 12, firstname: 'Julien', lastname: 'Marchal', phone: null,
  },
  createdAt: '2026-10-12T19:04:00.000Z',
  date: '2026-10-16',
  documentId: 'r-1',
  endsAt: '2026-10-16T18:00:00.000Z',
  from: '19:00',
  history: [{ at: '2026-10-12T19:04:00.000Z', kind: 'reservee' }],
  players: 10,
  price: null,
  source: 'app',
  startsAt: '2026-10-16T17:00:00.000Z',
  status: 'confirmee',
  terrain: { documentId: 't-1', name: 'Terrain 1', sport: null },
  to: '20:00',
  ...autres,
});

const REFUS_SANS_ANNONCE = 'Cette réservation n’a pas d’annonce ouverte à partager.';

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeReservation />);
  });
  return arbre;
};

const LIBELLE = 'Partager dans mon canal';
const aLeBouton = (/** @type {any} */ arbre) => {
  try {
    pressable(arbre, LIBELLE);
    return true;
  } catch {
    return false;
  }
};

/**
 * Montre la fiche avec ces changements.
 * @param {Record<string, any>} autres - Ce qui change.
 * @returns {void}
 */
const avecLaFiche = (autres) => {
  mockFiche = { ...mockFiche, data: fiche(autres) };
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
  mockFiche = { data: fiche(), isLoading: false, refetch: jest.fn() };
  mockPartager.mockResolvedValue({
    data: { chat: 'chat-canal', dejaPartagee: false, message: 'm-1' },
  });
});

describe('RESA-PARTAGER — E-G05 « Partager dans mon canal »', () => {
  it('app, confirmée, à venir : le bouton ; le geste puis « Annonce partagée »', async () => {
    const arbre = await monter();
    await act(async () => { pressable(arbre, LIBELLE).props.onPress(); });
    expect(mockPartager).toHaveBeenCalledWith({ complexeId: 'cx-five', reservationId: 'r-1' });
    expect(lisibles(arbre)).toContain('Annonce partagée dans ton canal.');
  });

  it('second appui : « Annonce déjà partagée dans ton canal. »', async () => {
    mockPartager.mockResolvedValue({
      data: { chat: 'chat-canal', dejaPartagee: true, message: 'm-1' },
    });
    const arbre = await monter();
    await act(async () => { pressable(arbre, LIBELLE).props.onPress(); });
    expect(lisibles(arbre)).toContain('Annonce déjà partagée dans ton canal.');
  });

  it('sans annonce ouverte, le refus du serveur se dit', async () => {
    mockPartager.mockRejectedValue({
      details: { code: 'COMPLEXE_RESERVATION_STATE' }, message: REFUS_SANS_ANNONCE, status: 409,
    });
    const arbre = await monter();
    await act(async () => { pressable(arbre, LIBELLE).props.onPress(); });
    expect(lisibles(arbre)).toContain(REFUS_SANS_ANNONCE);
  });

  it('la fiche dit son annonce : le bouton seulement si elle est ouverte', async () => {
    avecLaFiche({ annonce: { documentId: 'a-1', status: 'ouverte' } });
    expect(aLeBouton(await monter())).toBe(true);
    avecLaFiche({ annonce: { documentId: 'a-1', status: 'complete' } });
    expect(aLeBouton(await monter())).toBe(false);
    avecLaFiche({ annonce: null });
    expect(aLeBouton(await monter())).toBe(false);
  });

  it('ni sur une note extérieure, ni sur une réservation passée ou en attente', async () => {
    avecLaFiche({ booker: null, externalName: 'M. Dupont', source: 'exterieur' });
    expect(aLeBouton(await monter())).toBe(false);
    avecLaFiche({ date: '2026-10-13', startsAt: '2026-10-13T17:00:00.000Z' });
    expect(aLeBouton(await monter())).toBe(false);
    avecLaFiche({ expiresAt: '2026-10-15T08:00:00.000Z', status: 'en_attente' });
    expect(aLeBouton(await monter())).toBe(false);
  });
});
