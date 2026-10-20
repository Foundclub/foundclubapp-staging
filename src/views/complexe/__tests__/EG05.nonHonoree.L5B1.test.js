import renderer, { act } from 'react-test-renderer';

import ComplexeReservation from '@/views/complexe/ComplexeReservation';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';

// RESA-L5B-1 (20/10/2026) — E-G05, « non honorée » côté fiche (planche EG05 états 6 et 7 ; plan
// :546-550 ; serveur RESA-L2B : `canMarkNoShow`, `canUndoNoShow`, `noShowAt`,
// `booker.noShowsHere`, l'historique `non-honoree` et `annulee` + `late`) : « 12 réservations ici ·
// 0 non honorée sur 3 » (le seuil du complexe, `autoBanNoShows`), « Marquer non honorée » et sa
// confirmation, « Annuler le marquage » dans les 7 jours, et les lignes d'historique.

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five', reservationId: 'r-1' } }),
}));

let mockFiche = /** @type {any} */ ({});
let mockSeuil = /** @type {any} */ (3);
const mockMarquer = jest.fn();
const mockAnnulerMarquage = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useAnnulerNonHonoree: () => ({ isPending: false, mutateAsync: mockAnnulerMarquage }),
  useAnnulerReservation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  // La lecture du gérant (`toManagedView`) range les règles sous `rules`.
  useComplexeGere: () => ({ data: { rules: { autoBanNoShows: mockSeuil } } }),
  useDeciderDemande: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useMarquerNonHonoree: () => ({ isPending: false, mutateAsync: mockMarquer }),
  useModifierExterieur: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useReservationGeree: () => mockFiche,
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/molecules/input/Input', () => () => null);
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
 * La fiche d'une réservation JOUÉE hier, telle que le serveur la rend au gérant (`toManagerView`).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La fiche.
 */
const fiche = (autres = {}) => ({
  booker: {
    bookingsHere: 12,
    documentId: 'u-julien',
    firstname: 'Julien',
    lastname: 'Marchal',
    noShowsHere: 0,
    phone: null,
  },
  cancelledAt: null,
  cancelledBy: null,
  canMarkNoShow: true,
  canUndoNoShow: false,
  createdAt: '2026-10-10T19:04:00.000Z',
  date: '2026-10-13',
  dayBeforeConfirmedAt: null,
  decidedAt: null,
  documentId: 'r-1',
  endsAt: '2026-10-13T18:00:00.000Z',
  expiresAt: null,
  externalName: null,
  from: '19:00',
  history: [{ at: '2026-10-10T19:04:00.000Z', kind: 'reservee' }],
  lateCancellation: false,
  noShowAt: null,
  note: null,
  players: 10,
  price: null,
  reason: null,
  source: 'app',
  startsAt: '2026-10-13T17:00:00.000Z',
  status: 'confirmee',
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

const appuyerDans = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  const cible = parRepere(arbre, testID)
    .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0];
  await act(async () => {
    cible.props.onPress();
  });
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
  mockSeuil = 3;
  mockFiche = { data: fiche(), isLoading: false, refetch: jest.fn() };
  mockMarquer.mockResolvedValue({ data: {} });
  mockAnnulerMarquage.mockResolvedValue({ data: {} });
});

describe('RESA-L5B-1 E-G05 — commencée, moins de 7 jours (état 6)', () => {
  it('« Jouée », « 12 réservations ici · 0 non honorée sur 3 », le bouton', async () => {
    const arbre = await monter();
    const lus = lisibles(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Jouée', '12 réservations ici · 0 non honorée sur 3', 'Marquer non honorée',
    ]));
    expect(parRepere(arbre, 'fiche-annuler')).toBeNull();
  });

  it('sans seuil (« Jamais ») : le nombre seul', async () => {
    mockSeuil = 0;
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('12 réservations ici · 0 non honorée');
  });

  it('la confirmation, puis le geste et « Marquée non honorée » (N-17)', async () => {
    const arbre = await monter();
    await appuyerDans(arbre, 'fiche-marquer-non-honoree');
    expect(lisibles(arbre)).toContain(
      'Marquer la réservation de Julien M. (mardi 19 h) comme non honorée ?',
    );
    await appuyerDans(arbre, 'feuille-non-honoree-marquer');
    expect(mockMarquer).toHaveBeenCalledWith({ complexeId: 'cx-five', reservationId: 'r-1' });
    expect(lisibles(arbre)).toContain('Marquée non honorée');
  });
});

describe('RESA-L5B-1 E-G05 — non honorée, moins de 7 jours (état 7)', () => {
  beforeEach(() => {
    mockFiche = {
      ...mockFiche,
      data: fiche({
        booker: { ...fiche().booker, noShowsHere: 1 },
        canMarkNoShow: false,
        canUndoNoShow: true,
        history: [
          { at: '2026-10-10T19:04:00.000Z', kind: 'reservee' },
          { at: '2026-10-13T19:30:00.000Z', kind: 'non-honoree' },
        ],
        noShowAt: '2026-10-13T19:30:00.000Z',
      }),
    };
  });

  it('la pastille, la ligne d’historique, « 1 non honorée sur 3 »', async () => {
    const arbre = await monter();
    expect(parRepere(arbre, 'pastille-etat-non_honoree')).not.toBeNull();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Marquée non honorée par toi le 13/10 à 21 h 30',
      '12 réservations ici · 1 non honorée sur 3',
      'Annuler le marquage',
    ]));
    expect(parRepere(arbre, 'fiche-marquer-non-honoree')).toBeNull();
  });

  it('« Annuler le marquage » : le geste, « Marquage annulé. »', async () => {
    const arbre = await monter();
    await appuyerDans(arbre, 'fiche-annuler-marquage');
    expect(mockAnnulerMarquage)
      .toHaveBeenCalledWith({ complexeId: 'cx-five', reservationId: 'r-1' });
    expect(lisibles(arbre)).toContain('Marquage annulé.');
  });

  it('refusé (plus de 7 jours) : la phrase du serveur, en haut de la fiche', async () => {
    mockAnnulerMarquage.mockRejectedValueOnce({
      details: { code: 'COMPLEXE_RESERVATION_STATE' },
      message: 'Plus de 7 jours ont passé : le marquage ne s’annule plus.',
      status: 409,
    });
    const arbre = await monter();
    await appuyerDans(arbre, 'fiche-annuler-marquage');
    expect(lisibles(arbre)).toContain('Plus de 7 jours ont passé : le marquage ne s’annule plus.');
  });

  it('plus de 7 jours : ni marquer, ni annuler', async () => {
    mockFiche = { ...mockFiche, data: { ...mockFiche.data, canUndoNoShow: false } };
    const arbre = await monter();
    expect(parRepere(arbre, 'fiche-annuler-marquage')).toBeNull();
    expect(parRepere(arbre, 'fiche-marquer-non-honoree')).toBeNull();
  });
});

describe('RESA-L5B-1 E-G05 — le nom du réserveur ouvre sa fiche client (E-G15, morceau A2)', () => {
  it('un lien sur le nom, vers la fiche client du complexe', async () => {
    const arbre = await monter();
    const lien = parRepere(arbre, 'fiche-voir-client');
    expect(lien.props.accessibilityRole).toBe('link');
    await act(async () => {
      lien.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeClient, {
      complexeId: 'cx-five', joueurId: 'u-julien',
    });
  });

  it('une note extérieure n’a pas de fiche client', async () => {
    mockFiche = {
      ...mockFiche,
      data: fiche({
        booker: null, externalName: 'M. Dupont', source: 'exterieur',
      }),
    };
    const arbre = await monter();
    expect(parRepere(arbre, 'fiche-voir-client')).toBeNull();
  });
});

describe('RESA-L5B-1 E-G05 — l’annulation hors délai (AT-07)', () => {
  it('« Annulée par Julien M. le … — hors délai »', async () => {
    mockFiche = {
      ...mockFiche,
      data: fiche({
        cancelledAt: '2026-10-13T16:30:00.000Z',
        cancelledBy: 'reserveur',
        canMarkNoShow: false,
        history: [
          { at: '2026-10-10T19:04:00.000Z', kind: 'reservee' },
          {
            at: '2026-10-13T16:30:00.000Z', by: 'reserveur', kind: 'annulee', late: true,
          },
        ],
        lateCancellation: true,
        status: 'annulee',
      }),
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Annulée par Julien M. le 13/10 à 18 h 30 — hors délai');
  });
});
