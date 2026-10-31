import renderer, { act } from 'react-test-renderer';

import FeuillePartagerAnnonce from '@/views/complexe/components/FeuillePartagerAnnonce';

import { lisibles } from '@/testSupport/temoinComplexe';

// CORR-RESA (115 A, 31/10/2026) — « Partager une annonce » (E-G12, E-G05) : la feuille lit aussi
// les COLLECTES qui ont une annonce ouverte (vue « annonces » du serveur). Un serveur d'avant
// refuse cette vue : la feuille garde alors les réservations confirmées, sans erreur. Doublures
// recopiées de EG12.partager.RESAPARTAGER.test.js.

let mockLignes = /** @type {Record<string, any[]>} */ ({});
let mockVuesEnErreur = /** @type {string[]} */ ([]);
const mockFiltres = /** @type {any[]} */ ([]);
jest.mock('@/services/complexe/complexeQueries', () => ({
  usePartagerAnnonce: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useReservationsDuComplexe: (/** @type {any} */ complexeId, /** @type {any} */ filtres) => {
    mockFiltres.push({ complexeId, ...filtres });
    if (mockVuesEnErreur.includes(filtres.vue)) {
      return { data: undefined, isError: true, isLoading: false };
    }
    return {
      data: { pages: [{ items: mockLignes[filtres.vue] || [] }] },
      isError: false,
      isLoading: false,
    };
  },
}));

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

/**
 * Une ligne de la liste du gérant (`toManagerListItem`).
 * @param {string} documentId - La réservation.
 * @param {string} startsAt - Son début.
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La ligne.
 */
const ligne = (documentId, startsAt, autres = {}) => ({
  date: startsAt.slice(0, 10),
  documentId,
  from: '19:00',
  label: 'Julien M.',
  source: 'app',
  startsAt,
  status: 'confirmee',
  terrain: { documentId: 't-1', name: 'Terrain 1' },
  to: '20:00',
  ...autres,
});

const COLLECTE = ligne('r-collecte', '2026-10-17T17:00:00.000Z', {
  annonce: { documentId: 'a-2', status: 'ouverte' },
  status: 'en_collecte',
});

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <FeuillePartagerAnnonce complexeId="cx-five" onFait={jest.fn()} onFermer={jest.fn()} />,
    );
  });
  return arbre;
};

const lignesAffichees = (/** @type {any} */ arbre) => [...new Set(arbre.root
  .findAll((/** @type {any} */ n) => String(n.props?.testID || '').startsWith('partager-ligne-')
    && typeof n.props.onPress === 'function')
  .map((/** @type {any} */ n) => n.props.testID))];

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
  mockFiltres.length = 0;
  mockVuesEnErreur = [];
  mockLignes = {
    'a-venir': [ligne('r-jeudi', '2026-10-16T17:00:00.000Z')],
    annonces: [COLLECTE],
    aujourdhui: [],
  };
});

describe('CORR-RESA (115 A) — les collectes à annonce ouverte se partagent', () => {
  it('trois lectures : aujourd’hui, à venir (app, confirmées) et « annonces »', async () => {
    await monter();
    expect(mockFiltres).toEqual(expect.arrayContaining([
      {
        complexeId: 'cx-five', source: 'app', statut: 'confirmee', vue: 'aujourdhui',
      },
      {
        complexeId: 'cx-five', source: 'app', statut: 'confirmee', vue: 'a-venir',
      },
      { complexeId: 'cx-five', vue: 'annonces' },
    ]));
  });

  it('une collecte de l’app, à venir, annonce ouverte : elle est dans la liste', async () => {
    const arbre = await monter();
    expect(lignesAffichees(arbre)).toEqual([
      'partager-ligne-r-jeudi', 'partager-ligne-r-collecte',
    ]);
  });

  it('une ligne lue deux fois (à venir et annonces) ne s’affiche qu’une fois', async () => {
    mockLignes = {
      ...mockLignes,
      annonces: [ligne('r-jeudi', '2026-10-16T17:00:00.000Z'), COLLECTE],
    };
    const arbre = await monter();
    expect(lignesAffichees(arbre)).toEqual([
      'partager-ligne-r-jeudi', 'partager-ligne-r-collecte',
    ]);
  });

  it('un serveur d’avant refuse « annonces » : pas d’erreur, les confirmées restent', async () => {
    mockVuesEnErreur = ['annonces'];
    const arbre = await monter();
    expect(lisibles(arbre)).not.toContain('Impossible de charger tes réservations.');
    expect(lignesAffichees(arbre)).toEqual(['partager-ligne-r-jeudi']);
  });
});
