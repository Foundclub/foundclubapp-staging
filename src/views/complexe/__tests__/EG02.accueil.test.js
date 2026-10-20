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
// RESA-L5A2 (14/10/2026) — le planning de la semaine et les listes du serveur L2A.
let mockPlanning = /** @type {any} */ ({});
/** @type {any[]} */
const mockPeriodes = [];
/** @type {Record<string, any>} */
let mockListes = {};
let mockTerrains = /** @type {any} */ ({});
jest.mock('@/services/complexe/complexeQueries', () => ({
  useMesComplexes: () => mockMes,
  usePlanning: (/** @type {any} */ _id, /** @type {any} */ periode) => {
    mockPeriodes.push(periode);
    return mockPlanning;
  },
  useReservationsDuComplexe: (/** @type {any} */ _id, /** @type {any} */ filtres) => (
    mockListes[filtres.vue]
  ),
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
// RESA-INSCRIPTION (19/10) : la feuille « Tu pratiques aussi un sport ? », doublée par son contrat.
let mockFeuille = /** @type {any} */ (null);
jest.mock('@/views/home/FeuillePratiqueAussi', () => function FausseFeuille(/** @type {any} */ p) {
  mockFeuille = p;
  return null;
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

const refetchMes = jest.fn();

/**
 * Une lecture par pages (`useInfiniteQuery`).
 * @param {any[]} items - Les lignes.
 * @returns {any} La lecture.
 */
const pages = (items) => ({
  data: { pages: [{ items, pagination: { page: 1, pageSize: 20, total: items.length } }] },
  isLoading: false,
});
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
  mockPeriodes.length = 0;
  mockPlanning = { data: undefined, isLoading: false };
  mockListes = { 'a-venir': pages([]), aujourdhui: pages([]), demandes: pages([]) };
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

  it('sans réservation, les chiffres sont à 0', async () => {
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

  // RESA-INSCRIPTION (19/10/2026) — un compte né « pour un complexe » n'a AUCUN rôle sportif : un
  // accueil de joueur lui offrirait des gestes que son rôle provisoire n'a pas, sans âge connu.
  // « Voir l'app en joueur » ouvre d'abord « Tu pratiques aussi un sport ? » (PAR-L12, variante
  // complexe) ; « Oui » le fait Joueur, puis l'accueil, où son parcours d'inscription reprend.
  describe('RESA-INSCRIPTION — compte sans rôle sportif : « Voir l’app en joueur »', () => {
    beforeEach(() => {
      mockRole = 'new';
      mockFeuille = null;
    });

    it('ouvre « Tu pratiques aussi un sport ? » (complexe), sans quitter le complexe', async () => {
      const arbre = await monter();
      expect(mockFeuille?.isVisible).toBe(false);
      await appuyer(arbre, 'Voir l\'app en joueur');

      expect(mockFeuille.isVisible).toBe(true);
      expect(mockFeuille.pourLeComplexe).toBe(true);
      expect(mockValeurs.get('user.complexe_mode.u-1')).toBe('on');
      expect(mockReset).not.toHaveBeenCalled();
    });

    it('« Oui » (devenu Joueur) : le mode complexe s’éteint, l’accueil revient', async () => {
      const arbre = await monter();
      await appuyer(arbre, 'Voir l\'app en joueur');
      await act(async () => {
        mockFeuille.onDone();
      });

      expect(mockValeurs.has('user.complexe_mode.u-1')).toBe(false);
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: RouteNames.HomeTab }] });
    });

    it('« Pas maintenant » : la feuille se ferme, il reste sur son complexe', async () => {
      const arbre = await monter();
      await appuyer(arbre, 'Voir l\'app en joueur');
      await act(async () => {
        mockFeuille.onClose();
      });

      expect(mockFeuille.isVisible).toBe(false);
      expect(mockValeurs.get('user.complexe_mode.u-1')).toBe('on');
      expect(mockReset).not.toHaveBeenCalled();
    });

    it('un joueur, lui, revient directement (inchangé) : la feuille reste fermée', async () => {
      mockRole = 'player';
      const arbre = await monter();
      await appuyer(arbre, 'Voir l\'app en joueur');
      expect(mockFeuille?.isVisible ?? false).toBe(false);
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: RouteNames.HomeTab }] });
    });
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
    // RESA-L5A2 : Demandes, Planning et Réservations ont leur écran ; 6 cases restent « Bientôt ».
    await appuyer(arbre, 'Planning');
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexePlanning, {
      complexeId: 'cx-five',
    });
    const complexe = parRepere(arbre, 'complexe-accueil-case-complexe');
    expect(complexe?.props.accessibilityState).toEqual({ disabled: true });
    // RESA-L5B-2 : « Clients » a son écran (E-G15) ; ce que les autres cases deviennent est
    // vérifié par `EG02.cases.L5B2.test.js`.
    expect(textes(arbre).filter((texte) => texte === 'Bientôt')).toHaveLength(3);
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

describe('RESA-L5A2 E-G02 — l’accueil branché sur le serveur RESA-L2A', () => {
  /**
   * Un créneau d'une heure du planning (heure d'été : Paris = UTC+2).
   * @param {string} date - Le jour.
   * @param {number} heure - L'heure, à Paris.
   * @param {string} state - L'état.
   * @param {any} [reservation] - La réservation.
   * @returns {Record<string, any>} Le créneau.
   */
  const creneau = (date, heure, state, reservation = null) => ({
    closure: null,
    endsAt: `${date}T${String(heure - 1).padStart(2, '0')}:00:00.000Z`,
    from: `${String(heure).padStart(2, '0')}:00`,
    reservation,
    startsAt: `${date}T${String(heure - 2).padStart(2, '0')}:00:00.000Z`,
    state,
    to: `${String(heure + 1).padStart(2, '0')}:00`,
  });

  beforeEach(() => {
    mockPlanning = {
      data: {
        terrains: [{
          days: [
            {
              date: '2026-10-13',
              slots: [
                creneau('2026-10-13', 18, 'reserve-app'),
                creneau('2026-10-13', 19, 'reserve-app'),
              ],
            },
            {
              date: '2026-10-14',
              slots: [
                creneau('2026-10-14', 18, 'reserve-app', { documentId: 'r-1', label: 'Julien M.' }),
                creneau('2026-10-14', 19, 'libre'),
              ],
            },
          ],
          documentId: 't-1',
          name: 'Terrain 1',
        }],
      },
      isLoading: false,
    };
    mockListes.demandes = pages([{ documentId: 'd-1' }, { documentId: 'd-2' }]);
    mockListes['a-venir'] = pages([{
      date: '2026-10-15',
      documentId: 'r-9',
      from: '19:00',
      label: 'Lina T.',
      source: 'app',
      startsAt: '2026-10-15T17:00:00.000Z',
      status: 'confirmee',
      terrain: { documentId: 't-1', name: 'Terrain 1' },
      to: '20:00',
    }]);
  });

  it('le planning lu : du lundi (ou d’hier) au dimanche de la semaine', async () => {
    await monter();
    expect(mockPeriodes[mockPeriodes.length - 1]).toEqual({ from: '2026-10-12', to: '2026-10-18' });
  });

  it('la frise : une réservation ouvre sa fiche, une case libre le planning', async () => {
    const arbre = await monter();
    expect(textes(arbre)).toContain('Julien M.');
    await act(async () => {
      parRepere(arbre, 'frise-creneau-t-1-18:00').props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeReservation, {
      complexeId: 'cx-five', reservationId: 'r-1',
    });
    await act(async () => {
      parRepere(arbre, 'frise-creneau-t-1-19:00').props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexePlanning, {
      complexeId: 'cx-five', date: '2026-10-14', terrainId: 't-1',
    });
  });

  it('les chiffres du serveur ; « réservations » et « demandes » s’ouvrent', async () => {
    const arbre = await monter();
    const libelle = (/** @type {string} */ cle) => (
      parRepere(arbre, `complexe-accueil-chiffre-${cle}`)?.props.accessibilityLabel
    );
    expect(libelle('reservations')).toBe('1 réservations aujourd’hui');
    expect(libelle('occupation')).toBe('75 % d’occupation cette semaine');
    expect(libelle('demandes')).toBe('2 demandes en attente');
    await act(async () => {
      parRepere(arbre, 'complexe-accueil-chiffre-reservations').props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeReservations, {
      complexeId: 'cx-five', vue: 'aujourdhui',
    });
    await act(async () => {
      parRepere(arbre, 'complexe-accueil-chiffre-demandes').props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeDemandes, {
      complexeId: 'cx-five',
    });
  });

  it('« Prochaines réservations » : la carte ouvre sa fiche, « Tout voir » la liste', async () => {
    const arbre = await monter();
    expect(textes(arbre)).toEqual(expect.arrayContaining(['19 h – 20 h', 'Lina T. · Terrain 1']));
    expect(textes(arbre)).not.toContain('Aucune réservation à venir. Fais connaître ta page.');
    await act(async () => {
      parRepere(arbre, 'complexe-accueil-prochaine-r-9').props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeReservation, {
      complexeId: 'cx-five', reservationId: 'r-9',
    });
    await appuyer(arbre, 'Tout voir');
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeReservations, {
      complexeId: 'cx-five', vue: 'a-venir',
    });
  });

  it('l’alerte « Hier » : « Vérifier » ouvre les réservations passées', async () => {
    const arbre = await monter();
    expect(textes(arbre)).toContain('Hier : 2 réservations. Quelqu’un n’est pas venu ?');
    await appuyer(arbre, 'Vérifier');
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeReservations, {
      complexeId: 'cx-five', vue: 'passees',
    });
  });
});
