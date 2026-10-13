import { Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeAccueil from '@/views/complexe/ComplexeAccueil';

import { RouteNames } from '@/navigation/routeNames';

import {
  COMPLEXE_FIVE,
  parRepere,
  PLAN_OUVERT,
  pressable,
  terrainDeTemoin,
  textes,
} from '@/testSupport/temoinComplexe';

// RESA-L5A1 (13/10/2026) — E-G02 « L'accueil du gestionnaire » (planche EG02) : l'en-tête, la
// bascule, UN bandeau d'état, la frise du jour, les 4 chiffres, « Prochaines réservations », les
// cases « Gérer ». Ce qui dépend des réservations (lot L2A) est dans son état vide dessiné.

const mockNavigate = jest.fn();
const mockReset = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ getParent: () => ({ reset: mockReset }), navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));
let mockParams = /** @type {any} */ ({});

let mockRole = 'player';
const mockSetPlayerMode = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    accountRoleKey: mockRole,
    setPlayerMode: mockSetPlayerMode,
    userData: { documentId: 'u-1' },
  }),
}));

let mockMes = /** @type {any} */ ({});
let mockTerrains = /** @type {any} */ ({});
jest.mock('@/services/complexe/complexeQueries', () => ({
  useMesComplexes: () => mockMes,
  useTerrains: () => mockTerrains,
}));

const mockValeurs = new Map();
jest.mock('@/store/appContext', () => ({
  storage: {
    delete: (/** @type {string} */ cle) => mockValeurs.delete(cle),
    getString: (/** @type {string} */ cle) => mockValeurs.get(cle),
    set: (/** @type {string} */ cle, /** @type {string} */ valeur) => mockValeurs.set(cle, valeur),
  },
}));

jest.mock('@/components/molecules/notificationBadge/NotificationBadge', () => () => null);
jest.mock('@/components/molecules/profileButton/ProfileButton', () => () => null);
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

const refetchMes = jest.fn();
const refetchTerrains = jest.fn();

/**
 * Monte l'accueil.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeAccueil />);
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

const CASES = [
  'Gérer mon complexe',
  'Gérer mes installations',
  'Demandes',
  'Planning',
  'Réservations',
  'Canal',
  'Affiches',
  'Fidélité',
  'Clients',
  'Statistiques',
  'Réglages',
];

beforeAll(() => {
  // Mercredi 14 octobre 2026, 18 h 40 à Paris : seule l'horloge est figée.
  jest.useFakeTimers({
    doNotFake: [
      'nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
      'setTimeout', 'clearTimeout', 'queueMicrotask', 'requestAnimationFrame',
      'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance',
      'hrtime',
    ],
    now: new Date(2026, 9, 14, 18, 40),
  });
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockValeurs.clear();
  mockValeurs.set('user.complexe_mode.u-1', 'on');
  mockParams = { complexeId: 'cx-five', space: true };
  mockRole = 'player';
  mockMes = { data: [COMPLEXE_FIVE], isLoading: false, refetch: refetchMes };
  mockTerrains = {
    data: [
      terrainDeTemoin({ slotPlan: PLAN_OUVERT }),
      terrainDeTemoin({
        documentId: 't-2',
        name: 'Padel A',
        slotPlan: PLAN_OUVERT,
        sport: { documentId: 'a-padel', name: 'Padel' },
      }),
    ],
    isLoading: false,
    refetch: refetchTerrains,
  };
});

describe('RESA-L5A1 E-G02 — une journée normale (état 1)', () => {
  it('les blocs de la planche, dans l’ordre, sans bandeau d’état', async () => {
    const arbre = await monter();
    const lus = textes(arbre);
    const ordre = [
      'LE FIVE DE MONTRIVAGE',
      'COMPLEXE DE RÉSERVATION',
      'Tu joues aussi ?',
      'Voir l\'app en joueur',
      'AUJOURD’HUI · MERCREDI 14 OCTOBRE',
      'Terrain 1',
      'Padel A',
      'réservations aujourd’hui',
      'd’occupation cette semaine',
      'demandes en attente',
      'nouveaux favoris (7 jours)',
      'Prochaines réservations',
      'Aucune réservation à venir. Fais connaître ta page.',
      'Gérer',
      ...CASES,
    ].map((texte) => lus.indexOf(texte));
    expect(ordre.every((index) => index > -1)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    expect(parRepere(arbre, 'complexe-accueil-bandeau')).toBeNull();
    expect(parRepere(arbre, 'frise-du-jour')).not.toBeNull();
  });

  it('les chiffres partent de 0 tant que les réservations (L2A) ne sont pas servies', async () => {
    const arbre = await monter();
    expect(parRepere(arbre, 'complexe-accueil-chiffre-reservations')?.props.accessibilityLabel)
      .toBe('0 réservations aujourd’hui');
    expect(parRepere(arbre, 'complexe-accueil-chiffre-occupation')?.props.accessibilityLabel)
      .toBe('0 % d’occupation cette semaine');
  });
});

describe('RESA-L5A1 E-G02 — UN bandeau d’état, le premier vrai', () => {
  it('aucun terrain : le bandeau prend la place de la frise et des chiffres (état 2)', async () => {
    mockTerrains = { ...mockTerrains, data: [] };
    const arbre = await monter();
    expect(textes(arbre)).toContain('Ajoute ton premier terrain pour recevoir des réservations.');
    expect(parRepere(arbre, 'frise-du-jour')).toBeNull();
    expect(parRepere(arbre, 'complexe-accueil-chiffres')).toBeNull();
    expect(textes(arbre)).toEqual(expect.arrayContaining(CASES));
    await appuyer(arbre, 'Ajouter un terrain');
    expect(mockNavigate)
      .toHaveBeenCalledWith(RouteNames.ComplexeTerrain, { complexeId: 'cx-five' });
  });

  it('juste créé : « … est en ligne. Ajoute ton premier terrain. » (EG01 état 8)', async () => {
    mockTerrains = { ...mockTerrains, data: [] };
    mockParams = { ...mockParams, justeCree: true };
    const arbre = await monter();
    expect(textes(arbre))
      .toContain('Le Five de Montrivage est en ligne. Ajoute ton premier terrain.');
  });

  it('un terrain sans créneaux : « Ouvrir des créneaux » (état 6)', async () => {
    mockTerrains = {
      ...mockTerrains,
      data: [
        terrainDeTemoin({ slotPlan: PLAN_OUVERT }),
        terrainDeTemoin({ documentId: 't-2', name: 'Terrain 2', slotPlan: null }),
      ],
    };
    const arbre = await monter();
    expect(textes(arbre)).toContain('Terrain 2 n’a pas encore de créneaux.');
    await appuyer(arbre, 'Ouvrir des créneaux');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeCreneaux, {
      complexeId: 'cx-five',
      terrainId: 't-2',
    });
  });

  it('suspendu : le gérant garde son accueil, et écrit à FoundClub (état 3)', async () => {
    const ouvrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockMes = { ...mockMes, data: [{ ...COMPLEXE_FIVE, status: 'suspendu' }] };
    const arbre = await monter();
    expect(textes(arbre))
      .toContain('Ton complexe est suspendu par FoundClub : il n’apparaît plus dans l’app.');
    await appuyer(arbre, 'Écrire à FoundClub');
    expect(ouvrir).toHaveBeenCalledTimes(1);
    ouvrir.mockRestore();
  });
});

describe('RESA-L5A1 E-G02 — la bascule et les cases « Gérer »', () => {
  it('« Voir l’app en joueur » : le mode complexe s’éteint, l’accueil revient', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Voir l\'app en joueur');
    expect(mockValeurs.has('user.complexe_mode.u-1')).toBe(false);
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: RouteNames.HomeTab }] });
  });

  it('un entraîneur lit « Revenir en mode entraîneur » (planche RB, état 3)', async () => {
    mockRole = 'coach';
    const arbre = await monter();
    await appuyer(arbre, 'Revenir en mode entraîneur');
    expect(mockSetPlayerMode).toHaveBeenCalledWith(false);
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('les écrans de ce lot s’ouvrent ; les autres disent « Bientôt »', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Gérer mes installations');
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeInstallations, {
      complexeId: 'cx-five',
    });
    await appuyer(arbre, 'Réglages');
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeReglages, {
      complexeId: 'cx-five',
    });
    const planning = parRepere(arbre, 'complexe-accueil-case-planning');
    expect(planning?.props.accessibilityState).toEqual({ disabled: true });
    expect(textes(arbre).filter((texte) => texte === 'Bientôt')).toHaveLength(9);
  });
});

describe('RESA-L5A1 E-G02 — chargement, erreur, accès retiré', () => {
  it('chargement : le squelette', async () => {
    mockTerrains = { ...mockTerrains, data: undefined, isLoading: true };
    const arbre = await monter();
    expect(parRepere(arbre, 'complexe-accueil-squelette')).not.toBeNull();
  });

  it('erreur : « Impossible de charger ta journée. », les cases restent (état 5)', async () => {
    mockTerrains = {
      ...mockTerrains, data: undefined, error: new Error('boum'), isLoading: false,
    };
    const arbre = await monter();
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['Impossible de charger ta journée.', ...CASES]));
    await appuyer(arbre, 'Réessayer');
    expect(refetchTerrains).toHaveBeenCalledTimes(1);
  });

  it('le compte ne gère plus ce complexe : il le lit, et revient en mode joueur', async () => {
    mockMes = { ...mockMes, data: [] };
    const arbre = await monter();
    expect(textes(arbre)).toContain('Tu ne gères plus ce complexe.');
    await appuyer(arbre, 'Revenir en mode joueur');
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: RouteNames.HomeTab }] });
  });
});
