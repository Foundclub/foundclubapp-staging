/* eslint-disable max-len -- les phrases de la maquette, comparées entières */
import renderer, { act } from 'react-test-renderer';

import ComplexeAccueil from '@/views/complexe/ComplexeAccueil';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';

// 🏗️ GERANT-CONSTRUCTION (11/11/2026, D50) — LE BLOC « EN CONSTRUCTION » DE L'ACCUEIL DU GÉRANT
// (maquette gerant-accueil.png) : dès qu'il y a une réservation en construction, un bloc la liste
// (terrain, jour, heure ; « Jour J » ; qui, « 7 sur 10 », ce qu'ils cherchent ; la jauge), avec
// « Écrire au client » et « Partager l'annonce » ; toucher la ligne ouvre la fiche. Sans réservation
// en construction : aucun bloc. Les chiffres de l'accueil ne changent pas.

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ getParent: () => ({ reset: jest.fn() }), navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five', space: true } }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ accountRoleKey: 'player', setPlayerMode: jest.fn(), userData: { documentId: 'u-1' } }),
}));

/** @type {Record<string, any>} */
let mockListes = {};
const mockPartager = jest.fn();
const mockDecider = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useChiffresDuComplexe: () => ({ data: undefined, isLoading: false }),
  useDeciderDemande: () => ({ isPending: false, mutateAsync: mockDecider }),
  useEcrireAuReserveur: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useMesComplexes: () => ({
    data: [jest.requireActual('@/testSupport/temoinComplexe').COMPLEXE_FIVE], isLoading: false, refetch: jest.fn(),
  }),
  usePartagerAnnonce: () => ({ isPending: false, mutateAsync: mockPartager }),
  usePlanning: () => ({ data: undefined, isLoading: false }),
  useReservationsDuComplexe: (/** @type {any} */ _id, /** @type {any} */ filtres) => mockListes[filtres.vue],
  useTerrains: () => ({
    data: [jest.requireActual('@/testSupport/temoinComplexe').terrainDeTemoin({
      slotPlan: jest.requireActual('@/testSupport/temoinComplexe').PLAN_OUVERT,
    })],
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

const mockValeurs = new Map([['user.complexe_mode.u-1', 'on']]);
jest.mock('@/store/appContext', () => ({
  storage: {
    delete: (/** @type {string} */ cle) => mockValeurs.delete(cle),
    getString: (/** @type {string} */ cle) => mockValeurs.get(cle),
    set: (/** @type {string} */ cle, /** @type {string} */ valeur) => mockValeurs.set(cle, valeur),
  },
}));
jest.mock('@/components/molecules/notificationBadge/NotificationBadge', () => () => null);
jest.mock('@/components/molecules/profileButton/ProfileButton', () => () => null);
jest.mock('@/views/home/FeuillePratiqueAussi', () => () => null);
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
/* eslint-disable global-require */
jest.mock('react-native-reanimated', () => require('@/testSupport/animationDouble').reanimated());
jest.mock('react-native-gesture-handler', () => (
  require('@/testSupport/animationDouble').gestureHandler()
));
/* eslint-enable global-require */
jest.mock('@/views/profile/parent/useMesEnfantsEnBref', () => ({
  __esModule: true,
  default: () => ({ lignes: [], reste: 0, total: 0 }),
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const pages = (/** @type {any[]} */ items) => ({
  data: { pages: [{ items, pagination: { page: 1, pageSize: 20, total: items.length } }] },
  isLoading: false,
});

// Mercredi 14 octobre 2026, 18 h 40 à Paris.
const LIGNE = {
  annonce: {
    documentId: 'an-1', joined: 0, places: 3, status: 'ouverte',
  },
  construction: {
    manque: 3, presents: 7, quorum: 10,
  },
  date: '2026-10-14',
  documentId: 'r-c1',
  endsAt: '2026-10-14T20:00:00.000Z',
  from: '21:00',
  label: 'Sarah K.',
  source: 'app',
  startsAt: '2026-10-14T19:00:00.000Z',
  status: 'en_collecte',
  terrain: { documentId: 't-1', name: 'Terrain 1' },
  to: '22:00',
};

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeAccueil />);
  });
  return arbre;
};

beforeAll(() => {
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
  mockListes = {
    'a-venir': pages([]), aujourdhui: pages([]), construction: pages([LIGNE]), demandes: pages([]),
  };
  mockPartager.mockResolvedValue({ data: { chat: 'chat-canal', dejaPartagee: false, message: 'm-1' } });
});

describe('GERANT-CONSTRUCTION — le bloc « En construction » de l’accueil', () => {
  it('la ligne : terrain, jour, heure, « Jour J », qui, 7 sur 10, ce qu’ils cherchent, et la règle', async () => {
    const arbre = await monter();
    expect(parRepere(arbre, 'complexe-accueil-construction')).not.toBeNull();
    const lus = lisibles(arbre);
    [
      'EN CONSTRUCTION',
      'Terrain 1 · Aujourd’hui · 21 h – 22 h',
      'Jour J',
      'Sarah K. · 7 sur 10 · Ils cherchent 3 joueurs',
      'Un autre groupe peut réserver ces créneaux tant qu’ils sont en construction.',
    ].forEach((texte) => expect(lus).toContain(texte));
    // Le bloc vient après les chiffres, avant « Prochaines réservations ».
    const ordre = ['EN CONSTRUCTION', 'Prochaines réservations'].map((texte) => lus.indexOf(texte));
    expect(ordre[0]).toBeGreaterThan(lus.findIndex((texte) => texte.includes('d’occupation')));
    expect(ordre[0]).toBeLessThan(ordre[1]);
  });

  it('toucher la ligne ouvre la fiche ; « Partager l’annonce » la pose dans son canal ; « Écrire au client » est là', async () => {
    const arbre = await monter();
    await act(async () => { pressable(arbre, 'Terrain 1 · Aujourd’hui').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeReservation, { complexeId: 'cx-five', reservationId: 'r-c1' });
    await act(async () => { pressable(arbre, 'Partager l’annonce').props.onPress(); });
    expect(mockPartager).toHaveBeenCalledWith({ complexeId: 'cx-five', reservationId: 'r-c1' });
    expect(lisibles(arbre)).toContain('Annonce partagée dans ton canal.');
    expect(() => pressable(arbre, 'Écrire au client')).not.toThrow();
  });

  // ACCEPTER-CONSTRUCTION (12/11, Adel « 263 A ») : maquette gerant-accueil.png, 2e ligne.
  it('ACCEPTER-CONSTRUCTION · sur demande : « Sur demande », « Accepter », « Voir la fiche »', async () => {
    mockDecider.mockResolvedValue({ data: {} });
    mockListes.construction = pages([{ ...LIGNE, construction: { ...LIGNE.construction, surDemande: true } }]);
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Sur demande');
    expect(() => pressable(arbre, 'Voir la fiche')).not.toThrow();
    await act(async () => { pressable(arbre, 'Accepter').props.onPress(); });
    expect(mockDecider).toHaveBeenCalledWith({ complexeId: 'cx-five', decision: 'accepter', reservationId: 'r-c1' });
    expect(lisibles(arbre)).toContain('Réservation acceptée : le créneau est gardé pour ce groupe.');
  });

  it('ACCEPTER-CONSTRUCTION · déjà acceptée : « Acceptée », les gestes d’avant reviennent', async () => {
    mockListes.construction = pages([{
      ...LIGNE, construction: { ...LIGNE.construction, acceptedAt: '2026-10-14T15:24:00.000Z', surDemande: true },
    }]);
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Acceptée');
    expect(() => pressable(arbre, 'Partager l’annonce')).not.toThrow();
    expect(lisibles(arbre)).not.toContain('Sur demande');
  });

  it('sans réservation en construction (ou avant que la liste soit lue) : aucun bloc', async () => {
    mockListes.construction = pages([]);
    expect(parRepere(await monter(), 'complexe-accueil-construction')).toBeNull();
    mockListes.construction = undefined;
    expect(parRepere(await monter(), 'complexe-accueil-construction')).toBeNull();
  });
});
