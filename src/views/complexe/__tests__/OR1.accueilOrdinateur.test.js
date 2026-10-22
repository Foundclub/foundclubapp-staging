import { Platform, StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeAccueil from '@/views/complexe/ComplexeAccueil';

import { parRepere } from '@/testSupport/temoinComplexe';

// RESA-L5A1 (13/10/2026) — OR1 « le gérant au comptoir » (le site à 1440 px, plan §2 bis) : mêmes
// blocs, même ordre que sur téléphone ; la frise prend toute la largeur (noms en clair, 120 px),
// les 4 chiffres sur UNE ligne, les cases « Gérer » en grille de 3.

let mockLargeur = 1440;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 900, scale: 1, width: mockLargeur,
  }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ getParent: () => ({ reset: jest.fn() }), navigate: jest.fn() }),
  useRoute: () => ({ params: { complexeId: 'cx-five' } }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    accountRoleKey: 'player', setPlayerMode: jest.fn(), userData: { documentId: 'u-1' },
  }),
}));
jest.mock('@/services/complexe/complexeQueries', () => {
  const temoin = jest.requireActual('@/testSupport/temoinComplexe');
  return {
    useChiffresDuComplexe: () => ({ data: undefined, isLoading: false }),
    useMesComplexes: () => ({ data: [temoin.COMPLEXE_FIVE] }),
    // RESA-L5A2 (14/10/2026) — l'accueil lit aussi le planning et les listes : vides ici.
    usePlanning: () => ({ data: undefined }),
    useReservationsDuComplexe: () => ({ data: undefined }),
    useTerrains: () => ({ data: [temoin.terrainDeTemoin({ slotPlan: temoin.PLAN_OUVERT })] }),
  };
});
jest.mock('@/store/appContext', () => ({
  storage: { delete: jest.fn(), getString: jest.fn(), set: jest.fn() },
}));
jest.mock('@/components/molecules/notificationBadge/NotificationBadge', () => () => null);
jest.mock('@/components/molecules/profileButton/ProfileButton', () => () => null);
// RESA-INSCRIPTION (19/10) : la feuille « Tu pratiques aussi un sport ? » (sa fenêtre du bas,
// @gorhom/bottom-sheet, ne se charge pas sous jest) ; ce témoin ne l'ouvre pas.
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

/**
 * Le style aplati d'un nœud.
 * @param {any} noeud - Le nœud.
 * @returns {Record<string, any>} Le style.
 */
const style = (noeud) => StyleSheet.flatten(noeud?.props?.style) || {};

/**
 * Monte l'accueil à une largeur donnée.
 * @param {number} largeur - La largeur de la fenêtre.
 * @returns {Promise<any>} L'arbre.
 */
const monterA = async (largeur) => {
  mockLargeur = largeur;
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeAccueil />);
  });
  return arbre;
};

describe('RESA-L5A1 OR1 — l’accueil du gérant sur ordinateur', () => {
  it('à 1440 px : 4 chiffres sur une ligne, cases en grille de 3, noms à 120 px', async () => {
    const arbre = await monterA(1440);
    expect(style(parRepere(arbre, 'complexe-accueil-chiffres')).flexWrap).toBe('nowrap');
    expect(style(parRepere(arbre, 'complexe-accueil-case-installations')).flexBasis).toBe('31%');
    expect(style(parRepere(arbre, 'frise-noms')).width).toBe(120);
  });

  it('sur téléphone : chiffres et cases passent à la ligne, noms à 84 px', async () => {
    const arbre = await monterA(412);
    expect(style(parRepere(arbre, 'complexe-accueil-chiffres')).flexWrap).toBe('wrap');
    expect(style(parRepere(arbre, 'complexe-accueil-case-installations')).flexBasis).toBe(140);
    expect(style(parRepere(arbre, 'frise-noms')).width).toBe(84);
  });

  // RESA-BASCULE (20/10/2026, planche RB-3 O1) — sur le site, à partir de 1 024 px, « Ton mode »
  // est en bas du menu du complexe : l'accueil ne la répète pas. Sur téléphone et tablette, elle y
  // est.
  describe('RESA-BASCULE — la bascule « Ton mode » et le menu du site', () => {
    const plateformeDOrigine = Platform.OS;
    afterEach(() => {
      Platform.OS = plateformeDOrigine;
    });

    it('site à 1 440 px : pas de bascule dans l accueil (elle est dans le menu)', async () => {
      Platform.OS = 'web';
      const arbre = await monterA(1440);
      expect(parRepere(arbre, 'ton-mode')).toBeNull();
      expect(parRepere(arbre, 'complexe-accueil-bascule')).toBeNull();
    });

    it('site à 412 px, et tablette à 1 440 px : la bascule en tête de l accueil', async () => {
      Platform.OS = 'web';
      expect(parRepere(await monterA(412), 'ton-mode')).not.toBeNull();
      Platform.OS = 'ios';
      expect(parRepere(await monterA(1440), 'ton-mode')).not.toBeNull();
    });
  });
});
