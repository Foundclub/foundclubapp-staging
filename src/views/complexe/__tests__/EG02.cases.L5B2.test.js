import renderer, { act } from 'react-test-renderer';

import ComplexeAccueil from '@/views/complexe/ComplexeAccueil';

import { RouteNames } from '@/navigation/routeNames';

import {
  COMPLEXE_FIVE,
  lisibles,
  parRepere,
  PLAN_OUVERT,
  pressable,
  terrainDeTemoin,
} from '@/testSupport/temoinComplexe';

// RESA-L5B-2 (20/10/2026) — E-G02, CE QUE LA COMMUNAUTÉ (RESA-L4) Y CHANGE (plan :360-423 ;
// planche EG02) : les cases « Bientôt » deviennent vraies (« Gérer mon complexe », « Canal »,
// « Affiches », « Fidélité », « Clients », « Statistiques »), la tuile « occupation » et la tuile
// des nouveaux favoris (le nombre de la semaine, plus un 0 en dur) ouvrent les statistiques
// (E-G17), « Créer une affiche » sous « Aucune réservation à venir » (E-G13), et le bandeau « Ton
// complexe est suspendu » (N-11) avec « Écrire à FoundClub ».

// Le premier montage charge tout l'accueil (frise, cases, feuilles) : plus de 5 s sous charge.
jest.setTimeout(30000);

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ getParent: () => ({ reset: jest.fn() }), navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five' } }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    accountRoleKey: 'player', setPlayerMode: jest.fn(), userData: { documentId: 'u-1' },
  }),
}));

let mockMes = /** @type {any} */ ({});
let mockAVenir = /** @type {any[]} */ ([]);
/** @type {string[]} */
const mockPeriodes = [];
jest.mock('@/services/complexe/complexeQueries', () => ({
  useChiffresDuComplexe: (/** @type {any} */ _id, /** @type {string} */ periode) => {
    mockPeriodes.push(periode);
    return { data: { favoris: { nouveaux: 5, total: 214 } }, isLoading: false };
  },
  useMesComplexes: () => mockMes,
  usePlanning: () => ({ data: undefined, isLoading: false }),
  useReservationsDuComplexe: (/** @type {any} */ _id, /** @type {any} */ filtres) => ({
    data: {
      pages: [{
        items: filtres.vue === 'a-venir' ? mockAVenir : [],
        pagination: {
          page: 1, pageSize: 20, total: filtres.vue === 'a-venir' ? mockAVenir.length : 0,
        },
      }],
    },
    isLoading: false,
  }),
  useTerrains: () => ({
    data: [jest.requireActual('@/testSupport/temoinComplexe').terrainDeTemoin({
      slotPlan: jest.requireActual('@/testSupport/temoinComplexe').PLAN_OUVERT,
    })],
    isLoading: false,
  }),
}));
jest.mock('@/store/appContext', () => ({
  storage: { delete: jest.fn(), getString: () => 'on', set: jest.fn() },
}));
jest.mock('@/components/molecules/notificationBadge/NotificationBadge', () => () => null);
jest.mock('@/components/molecules/profileButton/ProfileButton', () => () => null);
// La feuille « Tu pratiques aussi un sport ? » (RESA-INSCRIPTION) charge les gestes natifs.
jest.mock('@/views/home/FeuillePratiqueAussi', () => () => null);
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
// RESA-BASCULE (20/10/2026) : la bascule « Ton mode » (planche RB-3) charge le contrôle à onglets
// et ses gestes (doublures partagées), et lit les enfants du compte (aucun ici, sauf mention).
/* eslint-disable global-require */
jest.mock('react-native-reanimated', () => require('@/testSupport/animationDouble').reanimated());
jest.mock('react-native-gesture-handler', () => (
  require('@/testSupport/animationDouble').gestureHandler()
));
/* eslint-enable global-require */
const mockEnfants = { lignes: [], reste: 0, total: 0 };
jest.mock('@/views/profile/parent/useMesEnfantsEnBref', () => ({
  __esModule: true,
  default: () => mockEnfants,
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeAccueil />);
  });
  return arbre;
};

const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  await act(async () => {
    pressable(arbre, libelle).props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPeriodes.length = 0;
  mockMes = { data: [COMPLEXE_FIVE], isLoading: false, refetch: jest.fn() };
  mockAVenir = [];
  // Le terrain de témoin a des créneaux (la frise et les chiffres s'affichent).
  expect(terrainDeTemoin({ slotPlan: PLAN_OUVERT }).slotPlan).toBe(PLAN_OUVERT);
});

describe('E-G02 — ce que la communauté du complexe change à l’accueil', () => {
  it('plus aucune case « Bientôt » : chacune ouvre son écran', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).not.toContain('Bientôt');
    const attendus = [
      ['Gérer mon complexe', RouteNames.ComplexeMaPage],
      ['Canal', RouteNames.ComplexeCanal],
      ['Affiches', RouteNames.ComplexeAffiches],
      ['Fidélité', RouteNames.ComplexeFidelite],
      ['Clients', RouteNames.ComplexeClients],
      ['Statistiques', RouteNames.ComplexeStatistiques],
    ];
    const cles = {
      Affiches: 'affiches',
      Canal: 'canal',
      Clients: 'clients',
      Fidélité: 'fidelite',
      'Gérer mon complexe': 'complexe',
      Statistiques: 'statistiques',
    };
    attendus.forEach(([libelle, route]) => {
      act(() => {
        parRepere(arbre, `complexe-accueil-case-${/** @type {any} */ (cles)[libelle]}`)
          .props.onPress();
      });
      expect(mockNavigate).toHaveBeenLastCalledWith(route, { complexeId: 'cx-five' });
    });
  });

  it('les nouveaux favoris de la semaine ; occupation et favoris ouvrent E-G17', async () => {
    const arbre = await monter();
    expect(mockPeriodes).toContain('semaine');
    expect(lisibles(arbre)).toContain('nouveaux favoris cette semaine');
    const favoris = parRepere(arbre, 'complexe-accueil-chiffre-favoris');
    expect(favoris.props.accessibilityLabel).toBe('5 nouveaux favoris cette semaine');
    await act(async () => {
      favoris.props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeStatistiques, {
      complexeId: 'cx-five',
    });
    mockNavigate.mockClear();
    await act(async () => {
      parRepere(arbre, 'complexe-accueil-chiffre-occupation').props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeStatistiques, {
      complexeId: 'cx-five',
    });
  });

  it('aucune réservation à venir : « Créer une affiche » ouvre E-G13', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Aucune réservation à venir. Fais connaître ta page.');
    await appuyer(arbre, 'Créer une affiche');
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ComplexeAffiches, {
      complexeId: 'cx-five',
    });
  });

  it('suspendu (N-11) : le bandeau de la suspension et « Écrire à FoundClub »', async () => {
    mockMes = {
      data: [{ ...COMPLEXE_FIVE, status: 'suspendu' }], isLoading: false, refetch: jest.fn(),
    };
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toContain(
      'Ton complexe est suspendu par FoundClub : il n’apparaît plus dans l’app.',
    );
    expect(vus).toContain('Écrire à FoundClub');
  });
});
