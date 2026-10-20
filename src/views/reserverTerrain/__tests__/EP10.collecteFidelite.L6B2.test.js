import renderer, { act } from 'react-test-renderer';

import {
  ONGLETS_DE_MES_RESERVATIONS,
  periodeDeLOnglet,
  reservationsDeLOnglet,
} from '@/domains/complexe/reservationsDuJoueur';

import ReserverMesReservations from '@/views/reserverTerrain/ReserverMesReservations';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';
import { groupe, maReservation, reservationDeParticipant } from '@/testSupport/temoinReserver';

// RESA-L6B-2 (20/10/2026) — E-P10, ce que les serveurs RESA-L3 / L4 ouvrent (planche EP10 états 1
// et 2 ; plan E-P10 ; RC-P03, A-G20, RC-G10, D3) :
//   · l'onglet « En collecte » (À venir · En collecte · Passées · Refusées et annulées) : chaque
//     collecte avec sa jauge et sa date limite (« 6 sur 10 · date limite mercredi 20 h ») ; « À
//     venir » garde les confirmées et les demandes ;
//   · une partie où l'on est invité : « Invité par Julien M. » ;
//   · « MA FIDÉLITÉ » : une carte par complexe (n/x, ce qui reste ; ou la récompense) ⇒ E-P02.

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: {} }),
}));

/** @type {Record<string, any>} */
let mockLectures = {};
let mockFidelite = /** @type {any} */ ({});
let mockGroupes = /** @type {Record<string, any>} */ ({});
const mockGroupesLus = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useGroupesDeReservations: (/** @type {string[]} */ ids, /** @type {any} */ options) => {
    mockGroupesLus(ids, options);
    return { groupes: options?.enabled === false ? {} : mockGroupes };
  },
  useMaFidelite: () => mockFidelite,
  useMesReservations: (/** @type {string} */ periode) => mockLectures[periode],
}));
jest.mock('@/views/reserverTerrain/ReserverMaReservation', () => () => null);
jest.mock('@/views/search/searchRouteHelpers', () => ({ navigateToSearchHub: jest.fn() }));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/navigation/useBottomDockLayout', () => () => ({ dockClearance: 0 }));
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

const COLLECTE = maReservation({
  canCancel: false,
  date: '2026-10-16',
  documentId: 'r-c',
  from: '20:00',
  startsAt: '2026-10-16T18:00:00.000Z',
  status: 'en_collecte',
  to: '21:00',
});
const INVITE = reservationDeParticipant({ date: '2026-10-18', documentId: 'r-i', from: '19:00' });

/**
 * Une lecture réussie.
 * @param {any[]} liste - Les réservations.
 * @returns {any} La lecture.
 */
const lue = (liste) => ({
  data: liste, error: null, isLoading: false, isRefetching: false, refetch: jest.fn(),
});

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverMesReservations />);
  });
  return arbre;
};

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  mockLectures = {
    'a-venir': lue([maReservation(), COLLECTE, INVITE]),
    passees: lue([]),
    refusees: lue([]),
  };
  mockGroupes = {
    'r-c': groupe({
      collecte: {
        collectDeadline: '2026-10-15T18:00:00.000Z',
        failure: null,
        presents: 6,
        quorum: 10,
        reachedAt: null,
      },
      reservation: 'r-c',
      status: 'en_collecte',
    }),
  };
  mockFidelite = {
    data: [
      {
        complexe: { logo: null, name: 'Le Five de Montrivage', slug: 'le-five-de-montrivage' },
        count: 8,
        disponible: false,
        restant: 2,
        reward: '1 partie offerte',
        threshold: 10,
      },
      {
        complexe: { logo: null, name: 'Padel Club Valbrune', slug: 'padel-club-valbrune' },
        count: 10,
        disponible: true,
        restant: 0,
        reward: '1 partie offerte',
        threshold: 10,
      },
    ],
  };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('les onglets (règle pure)', () => {
  it('quatre onglets ; « En collecte » lit la période « à venir » du serveur', () => {
    expect(ONGLETS_DE_MES_RESERVATIONS).toEqual(['a-venir', 'en-collecte', 'passees', 'refusees']);
    expect(periodeDeLOnglet('en-collecte')).toBe('a-venir');
    expect(periodeDeLOnglet('passees')).toBe('passees');
    const toutes = [maReservation(), COLLECTE, INVITE];
    expect(reservationsDeLOnglet('en-collecte', toutes).map((r) => r.documentId)).toEqual(['r-c']);
    expect(reservationsDeLOnglet('a-venir', toutes).map((r) => r.documentId))
      .toEqual(['r-1', 'r-i']);
    expect(reservationsDeLOnglet('passees', toutes)).toHaveLength(3);
  });
});

describe('E-P10 — À venir', () => {
  it('quatre onglets ; pas de collecte dans « À venir » ; « Invité par Julien M. »', async () => {
    const vus = lisibles(await monter());
    expect(vus).toEqual(expect.arrayContaining([
      'À venir', 'En collecte', 'Passées', 'Refusées et annulées', 'Tu as réservé',
      'Invité par Julien M.',
    ]));
    expect(vus).not.toContain('20 h · Le Five de Montrivage · Terrain 1');
  });

  it('« MA FIDÉLITÉ » : une carte par complexe ; toucher ouvre le complexe (E-P02)', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'MA FIDÉLITÉ',
      'Le Five de Montrivage',
      '8/10',
      'Encore 2 réservations avant « 1 partie offerte »',
      'Padel Club Valbrune',
      '« 1 partie offerte » t’attend : présente-toi à l’accueil.',
    ]));
    const carteDuFive = arbre.root.findAll((/** @type {any} */ noeud) => (
      noeud.props?.accessibilityLabel === 'Le Five de Montrivage'
      && typeof noeud.props?.onPress === 'function'
    ))[0];
    await act(async () => {
      carteDuFive.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverComplexe, {
      slug: 'le-five-de-montrivage',
    });
  });

  it('sans programme de fidélité : pas de « MA FIDÉLITÉ »', async () => {
    mockFidelite = { data: [] };
    expect(lisibles(await monter())).not.toContain('MA FIDÉLITÉ');
  });
});

describe('E-P10 — En collecte (état 2)', () => {
  it('chaque collecte : sa jauge, sa date limite, « En collecte · 6/10 »', async () => {
    const arbre = await monter();
    await act(async () => {
      parRepere(arbre, 'mes-reservations-onglet-en-collecte').props.onPress();
    });
    expect(mockGroupesLus).toHaveBeenLastCalledWith(['r-c'], { enabled: true });
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      '20 h · Le Five de Montrivage · Terrain 1',
      '6 sur 10 · date limite jeudi 20 h',
      'En collecte · 6/10',
    ]));
    expect(lisibles(arbre)).not.toContain('Tu as réservé');
    expect(lisibles(arbre)).not.toContain('MA FIDÉLITÉ');
  });

  it('aucune collecte : « Aucune collecte en cours. »', async () => {
    mockLectures['a-venir'] = lue([maReservation()]);
    const arbre = await monter();
    await act(async () => {
      parRepere(arbre, 'mes-reservations-onglet-en-collecte').props.onPress();
    });
    expect(lisibles(arbre)).toContain('Aucune collecte en cours.');
  });
});
