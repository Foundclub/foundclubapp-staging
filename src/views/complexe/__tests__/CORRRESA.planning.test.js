import renderer, { act } from 'react-test-renderer';

import ComplexePlanning from '@/views/complexe/ComplexePlanning';

import { parRepere, pressable, terrainDeTemoin } from '@/testSupport/temoinComplexe';

// CORR-RESA (73 A, 31/10/2026) — E-G03, vue Semaine (un terrain à la fois) : une pastille sur la
// puce de chaque terrain qui a des réservations cette semaine-là. Doublure : une deuxième lecture
// `usePlanning` sans `terrain` (tous les terrains de la semaine).

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: { complexeId: 'cx-five', date: '2026-10-16' } }),
}));

/** @type {any[]} */
const mockLectures = [];
let mockTerrains = /** @type {any} */ ({});
jest.mock('@/services/complexe/complexeQueries', () => {
  const vide = { data: undefined, isLoading: false, refetch: () => {} };
  const creneau = (/** @type {any} */ reservation) => ({
    closure: null,
    endsAt: '2026-10-15T17:00:00.000Z',
    from: '18:00',
    reservation,
    startsAt: '2026-10-15T16:00:00.000Z',
    state: reservation ? 'reserve-app' : 'libre',
    to: '19:00',
  });
  const terrain = (/** @type {string} */ id, /** @type {string} */ nom, avec = false) => ({
    bookingMode: 'automatique',
    days: [{
      date: '2026-10-15',
      slots: [creneau(avec ? {
        documentId: `r-${id}`, label: 'Julien M.', source: 'app', status: 'confirmee',
      } : null)],
    }],
    documentId: id,
    isBookable: true,
    name: nom,
  });
  return {
    useBloquerCreneau: () => ({ isPending: false, mutateAsync: jest.fn() }),
    useComplexeChoisi: () => ({
      complexe: jest.requireActual('@/testSupport/temoinComplexe').COMPLEXE_FIVE,
      complexeId: 'cx-five',
      mes: { isLoading: false },
    }),
    useNoterExterieur: () => ({ isPending: false, mutateAsync: jest.fn() }),
    usePlanning: (
      /** @type {any} */ _id,
      /** @type {any} */ periode,
      /** @type {any} */ options,
    ) => {
      mockLectures.push({ enabled: options?.enabled, periode });
      if (options && options.enabled === false) return vide;
      const semaine = { from: '2026-10-12', to: '2026-10-18' };
      if (periode?.terrain) {
        return {
          data: { ...semaine, terrains: [terrain(periode.terrain, 'Terrain 1')] },
          isLoading: false,
          refetch: () => {},
        };
      }
      // Tous les terrains : seul le terrain 2 a une réservation cette semaine.
      return {
        data: {
          ...semaine,
          terrains: [terrain('t-1', 'Terrain 1'), terrain('t-2', 'Terrain 2', true)],
        },
        isLoading: false,
        refetch: () => {},
      };
    },
    useRouvrirFermetures: () => ({ isPending: false, mutateAsync: jest.fn() }),
    useTerrains: () => mockTerrains,
  };
});

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
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexePlanning />);
  });
  return arbre;
};

/**
 * Appuie sur un élément par son libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {Promise<void>} Fini.
 */
const appuyer = async (arbre, libelle) => {
  await act(async () => {
    pressable(arbre, libelle).props.onPress();
  });
};

beforeAll(() => {
  // Mercredi 14 octobre 2026, 10 h à Paris.
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
  mockLectures.length = 0;
  mockTerrains = {
    data: [
      terrainDeTemoin(),
      terrainDeTemoin({ documentId: 't-2', name: 'Terrain 2' }),
    ],
    isLoading: false,
  };
});

describe('CORR-RESA (73 A) E-G03 — Semaine : la pastille des terrains réservés', () => {
  it('Semaine, deux terrains : tous les terrains de la semaine sont lus', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Semaine');
    expect(mockLectures).toEqual(expect.arrayContaining([{
      enabled: true, periode: { from: '2026-10-12', to: '2026-10-18' },
    }]));
  });

  it('seul le terrain 2 a des réservations : sa puce a la pastille, pas celle du 1', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Semaine');
    expect(parRepere(arbre, 'planning-terrain-pastille-t-2')).not.toBeNull();
    expect(parRepere(arbre, 'planning-terrain-pastille-t-1')).toBeNull();
    expect(parRepere(arbre, 'planning-terrain-t-2').props.accessibilityLabel)
      .toBe('Terrain 2, des réservations cette semaine');
  });

  it('vue Jour : aucune pastille', async () => {
    const arbre = await monter();
    expect(parRepere(arbre, 'planning-terrain-pastille-t-2')).toBeNull();
  });
});
