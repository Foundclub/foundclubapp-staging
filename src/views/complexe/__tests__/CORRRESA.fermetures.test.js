import renderer, { act } from 'react-test-renderer';

import ComplexeFermetures from '@/views/complexe/ComplexeFermetures';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';

// CORR-RESA (74 A, 31/10/2026) — E-G10 : « À venir » ne montre que ce qui sera vraiment fermé ;
// une fermeture rouverte part dans un repli « Rouverte (n) », fermé d'abord, qui l'affiche à
// l'appui. Doublures recopiées de EG10.fermetures.test.js.

let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));

let mockFermetures = /** @type {any} */ ({});
let mockApercu = /** @type {any} */ ({});
/** @type {any[]} */
const mockApercusLus = [];
const mockFermer = jest.fn();
const mockRouvrir = jest.fn();
const mockModifier = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useApercuFermeture: (/** @type {any[]} */ ...args) => {
    mockApercusLus.push(args);
    return mockApercu;
  },
  useComplexeChoisi: () => ({
    complexe: jest.requireActual('@/testSupport/temoinComplexe').COMPLEXE_FIVE,
    complexeId: 'cx-five',
    mes: { isLoading: false },
  }),
  useFermerTerrains: () => ({ isPending: false, mutateAsync: mockFermer }),
  useFermetures: () => mockFermetures,
  useModifierFermetures: () => ({ isPending: false, mutateAsync: mockModifier }),
  useRouvrirFermetures: () => ({ isPending: false, mutateAsync: mockRouvrir }),
  useTerrains: () => ({
    data: [
      jest.requireActual('@/testSupport/temoinComplexe').terrainDeTemoin(),
      jest.requireActual('@/testSupport/temoinComplexe').terrainDeTemoin({
        documentId: 't-2', name: 'Terrain 2',
      }),
      jest.requireActual('@/testSupport/temoinComplexe').terrainDeTemoin({
        documentId: 't-3', name: 'Padel A',
      }),
    ],
    isLoading: false,
  }),
}));

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { label, onChangeText, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChangeText} value={value} />;
  };
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseDate(/** @type {any} */ { label, onChange, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChange} value={value} />;
  };
});
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
 * Une fermeture telle que la liste du serveur la rend (`toClosureView`), avec son terrain.
 * @param {Record<string, any>} autres - Ce qui change.
 * @returns {Record<string, any>} La fermeture.
 */
const fermeture = (autres) => ({
  endDate: '2026-10-26',
  kind: 'closure',
  label: null,
  message: null,
  reason: 'travaux',
  startDate: '2026-10-25',
  status: 'active',
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
    arbre = renderer.create(<ComplexeFermetures />);
  });
  return arbre;
};

/**
 * Appuie sur le premier élément pressable du repère (ou sur le repère lui-même).
 * @param {any} arbre - L'arbre.
 * @param {string} testID - Le repère.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (arbre, testID) => {
  const noeud = parRepere(arbre, testID);
  const cible = typeof noeud.props?.onPress === 'function'
    ? noeud
    : noeud.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0];
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
  mockApercusLus.length = 0;
  mockParams = { complexeId: 'cx-five' };
  mockFermetures = {
    data: [
      fermeture({ documentId: 'f-1', terrainId: 't-1' }),
      fermeture({ documentId: 'f-2', terrainId: 't-2' }),
      fermeture({
        documentId: 'f-4',
        endDate: '2026-10-15',
        label: 'Météo',
        reason: 'autre',
        startDate: '2026-10-13',
        terrainId: 't-3',
      }),
    ],
    isLoading: false,
    refetch: jest.fn(),
  };
  mockApercu = { data: undefined, isLoading: false };
  mockFermer.mockResolvedValue({ annulees: 4, echecs: [], faits: 3 });
  mockRouvrir.mockResolvedValue({ echecs: [], faits: 2 });
  mockModifier.mockResolvedValue({ annulees: 0, echecs: [], faits: 2 });
});

describe('CORR-RESA (74 A) E-G10 — les rouvertes dans un repli', () => {
  const ROUVERTE = fermeture({
    documentId: 'f-9',
    endDate: '2026-10-30',
    startDate: '2026-10-29',
    status: 'reopened',
    terrainId: 't-1',
  });

  it('une rouverte n’est pas dans « À venir » ; le repli « Rouverte (1) » la montre', async () => {
    mockFermetures = { ...mockFermetures, data: [...mockFermetures.data, ROUVERTE] };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('25/10 – 26/10 · Travaux');
    expect(lisibles(arbre)).not.toContain('29/10 – 30/10 · Travaux');
    const repli = parRepere(arbre, 'fermetures-rouvertes');
    expect(repli).not.toBeNull();
    expect(lisibles(arbre)).toContain('Rouverte (1)');
    expect(repli.props.accessibilityState).toEqual({ expanded: false });
    await toucher(arbre, 'fermetures-rouvertes');
    expect(lisibles(arbre)).toContain('29/10 – 30/10 · Travaux');
    expect(parRepere(arbre, 'fermetures-rouvertes').props.accessibilityState)
      .toEqual({ expanded: true });
    await toucher(arbre, 'fermetures-rouvertes');
    expect(lisibles(arbre)).not.toContain('29/10 – 30/10 · Travaux');
  });

  it('seulement des rouvertes : « Aucune fermeture prévue. » et le repli', async () => {
    mockFermetures = { ...mockFermetures, data: [ROUVERTE] };
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Aucune fermeture prévue.', 'Rouverte (1)',
    ]));
    expect(lisibles(arbre)).not.toContain('29/10 – 30/10 · Travaux');
  });

  it('aucune rouverte : pas de repli', async () => {
    const arbre = await monter();
    expect(parRepere(arbre, 'fermetures-rouvertes')).toBeNull();
  });
});
