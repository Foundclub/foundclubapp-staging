import renderer, { act } from 'react-test-renderer';

import ComplexeCanal from '@/views/complexe/ComplexeCanal';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';

// 🏟️ RESA-PARTAGER (23/10/2026, A-G32, plan E-G12 :848) — « PARTAGER UNE ANNONCE » DEPUIS LE CANAL
// DU COMPLEXE : le gérant choisit une partie à compléter d'une réservation de SON complexe et la
// publie dans son canal (la même route que E-G05). La liste : les réservations de l'app,
// confirmées, à venir (aujourd'hui puis les jours suivants), dans l'ordre chronologique ; si une
// ligne dit son annonce, seulement les annonces ouvertes. Liste vide : une phrase, pas d'écran
// blanc. Un choix : le geste, la feuille se ferme, « Annonce partagée dans ton canal. ».

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five' } }),
}));

let mockLignes = /** @type {Record<string, any[]>} */ ({});
const mockFiltres = /** @type {any[]} */ ([]);
const mockPartager = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useCanalDuComplexe: () => ({
    data: { chatId: 'chat-canal-five', liste: [], membres: 214 },
    isLoading: false,
    refetch: jest.fn(),
  }),
  useComplexeChoisi: (/** @type {any} */ complexeId) => ({
    complexe: { documentId: complexeId, name: 'Le Five de Montrivage' },
    complexeId,
    mes: { data: [], isLoading: false },
  }),
  usePartagerAnnonce: () => ({ isPending: false, mutateAsync: mockPartager }),
  useReservationsDuComplexe: (/** @type {any} */ complexeId, /** @type {any} */ filtres) => {
    mockFiltres.push({ complexeId, ...filtres });
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

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeCanal />);
  });
  return arbre;
};

const ouvrirLaFeuille = async (/** @type {any} */ arbre) => {
  await act(async () => { pressable(arbre, 'Partager une annonce').props.onPress(); });
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
  mockLignes = {
    'a-venir': [
      ligne('r-jeudi', '2026-10-16T17:00:00.000Z'),
      ligne('r-sans-annonce', '2026-10-17T17:00:00.000Z', { annonce: null }),
      ligne('r-ouverte', '2026-10-18T17:00:00.000Z', {
        annonce: { documentId: 'a-1', status: 'ouverte' },
      }),
    ],
    aujourdhui: [
      ligne('r-ce-matin', '2026-10-14T05:00:00.000Z'),
      ligne('r-ce-soir', '2026-10-14T16:00:00.000Z'),
    ],
  };
  mockPartager.mockResolvedValue({
    data: { chat: 'chat-canal-five', dejaPartagee: false, message: 'm-1' },
  });
});

describe('RESA-PARTAGER — E-G12 « Partager une annonce »', () => {
  it('la liste : l’app, confirmées, à venir, dans l’ordre, annonces ouvertes', async () => {
    const arbre = await monter();
    await ouvrirLaFeuille(arbre);
    expect(lisibles(arbre))
      .toContain('Choisis la partie à compléter : elle arrive en carte dans ton canal.');
    expect(lignesAffichees(arbre)).toEqual([
      'partager-ligne-r-ce-soir', 'partager-ligne-r-jeudi', 'partager-ligne-r-ouverte',
    ]);
    expect(mockFiltres).toEqual(expect.arrayContaining([
      {
        complexeId: 'cx-five', source: 'app', statut: 'confirmee', vue: 'aujourdhui',
      },
      {
        complexeId: 'cx-five', source: 'app', statut: 'confirmee', vue: 'a-venir',
      },
    ]));
  });

  it('un choix : le geste, la feuille se ferme, « Annonce partagée dans ton canal. »', async () => {
    const arbre = await monter();
    await ouvrirLaFeuille(arbre);
    const choix = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.testID === 'partager-ligne-r-jeudi' && typeof n.props.onPress === 'function'))[0];
    await act(async () => { choix.props.onPress(); });
    expect(mockPartager).toHaveBeenCalledWith({ complexeId: 'cx-five', reservationId: 'r-jeudi' });
    expect(lignesAffichees(arbre)).toEqual([]);
    expect(lisibles(arbre)).toContain('Annonce partagée dans ton canal.');
  });

  it('un refus du serveur reste dans la feuille', async () => {
    mockPartager.mockRejectedValue({
      details: { code: 'COMPLEXE_RESERVATION_STATE' },
      message: 'Cette réservation n’a pas d’annonce ouverte à partager.',
      status: 409,
    });
    const arbre = await monter();
    await ouvrirLaFeuille(arbre);
    const choix = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.testID === 'partager-ligne-r-jeudi' && typeof n.props.onPress === 'function'))[0];
    await act(async () => { choix.props.onPress(); });
    expect(lisibles(arbre)).toContain('Cette réservation n’a pas d’annonce ouverte à partager.');
    expect(lignesAffichees(arbre).length).toBe(3);
  });

  it('liste vide : une phrase, pas d’écran blanc', async () => {
    mockLignes = { 'a-venir': [], aujourdhui: [] };
    const arbre = await monter();
    await ouvrirLaFeuille(arbre);
    expect(parRepere(arbre, 'partager-aucune')).not.toBeNull();
    expect(lisibles(arbre).join(' ')).toContain('Aucune partie à compléter en ce moment.');
  });
});
