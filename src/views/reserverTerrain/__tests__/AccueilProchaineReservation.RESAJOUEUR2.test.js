import fs from 'fs';
import path from 'path';

import renderer, { act } from 'react-test-renderer';

import CarteProchaineReservation
  from '@/views/reserverTerrain/components/CarteProchaineReservation';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, pressable } from '@/testSupport/temoinComplexe';
import { maReservation } from '@/testSupport/temoinReserver';

// RESA-JOUEUR-2 (11/11/2026) — Accueil « Ta prochaine réservation » (maquette « 232- ok ») :
// une carte en haut de l'accueil, tant qu'une réservation est à venir — le jour et l'heure, le
// complexe et le terrain, son état (« En collecte · 6/10 » pour une réservation en construction),
// « Ouvrir » (sa fiche) et « Toutes mes réservations (3) ». Rien sans réservation à venir, rien
// quand la lecture échoue (elle reste discrète). Les cases de l'accueil ne changent pas.

const mockNavigate = jest.fn();
let mockAVenir = /** @type {any} */ ({ data: [] });
let mockGroupes = /** @type {any} */ ({});
const mockLectures = /** @type {any[]} */ ([]);
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useGroupesDeReservations: (/** @type {string[]} */ ids, /** @type {any} */ options) => {
    mockLectures.push({ ids, options });
    return { groupes: mockGroupes };
  },
  useMesReservations: (/** @type {string} */ periode, /** @type {any} */ options) => {
    mockLectures.push({ options, periode });
    return mockAVenir;
  },
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/**
 * Monte la carte.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CarteProchaineReservation navigation={{ navigate: mockNavigate }} />);
  });
  return arbre;
};

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-15T08:00:00Z') });
  jest.clearAllMocks();
  mockLectures.length = 0;
  mockGroupes = {};
  mockAVenir = {
    data: [
      maReservation({
        date: '2026-10-20', documentId: 'r-3', startsAt: '2026-10-20T16:00:00.000Z',
      }),
      maReservation({
        date: '2026-10-16',
        documentId: 'r-1',
        from: '19:30',
        startsAt: '2026-10-16T17:30:00.000Z',
        status: 'en_collecte',
        to: '21:00',
      }),
      maReservation({ documentId: 'r-2', status: 'annulee' }),
      maReservation({
        date: '2026-10-18', documentId: 'r-4', startsAt: '2026-10-18T16:00:00.000Z',
      }),
    ],
  };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('RESA-JOUEUR-2 — Accueil « Ta prochaine réservation »', () => {
  it('la plus proche : demain, l’heure, le lieu, son état, « Toutes (3) »', async () => {
    mockGroupes = { 'r-1': { collecte: { presents: 6, quorum: 10 } } };
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Ta prochaine réservation',
      'Demain · 19 h 30 – 21 h',
      'Le Five de Montrivage · Terrain 1',
      'En collecte · 6/10',
      'Ouvrir',
      'Toutes mes réservations (3)',
    ]));
    // La lecture « à venir » est discrète : une panne ne dit rien à l'accueil.
    expect(mockLectures.find((l) => l.periode === 'a-venir').options)
      .toEqual(expect.objectContaining({ meta: { preventToastError: true }, retry: false }));
    // Le compte des présents n'est lu que pour une réservation en construction.
    expect(mockLectures.find((l) => l.ids).ids).toEqual(['r-1']);
  });

  it('« Ouvrir » ouvre sa fiche ; « Toutes mes réservations » ouvre la liste', async () => {
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Ouvrir').props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverMaReservation, {
      reservationId: 'r-1',
    });
    await act(async () => {
      pressable(arbre, 'Toutes mes réservations').props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ReserverMesReservations);
  });

  it('aucune réservation à venir, ou une lecture en panne : rien', async () => {
    mockAVenir = { data: [maReservation({ status: 'annulee' })] };
    expect((await monter()).toJSON()).toBeNull();
    mockAVenir = { data: undefined, error: new Error('réseau') };
    expect((await monter()).toJSON()).toBeNull();
  });
});

describe('RESA-JOUEUR-2 — l’accueil pose la carte une fois, sous son titre', () => {
  it('HomeHub monte CarteProchaineReservation après le titre, avant les sections', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'home', 'HomeHub.js'),
      'utf8',
    );
    const pose = source.indexOf('<CarteProchaineReservation');
    expect(pose).toBeGreaterThan(source.indexOf('<TourResumePill />'));
    expect(pose).toBeLessThan(source.indexOf("registerSectionAnchor('manage'"));
    expect(source.split('<CarteProchaineReservation').length).toBe(2);
  });
});
