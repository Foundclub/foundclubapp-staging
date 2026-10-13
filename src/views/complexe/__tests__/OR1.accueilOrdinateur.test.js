import { StyleSheet } from 'react-native';
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
    useMesComplexes: () => ({ data: [temoin.COMPLEXE_FIVE] }),
    useTerrains: () => ({ data: [temoin.terrainDeTemoin({ slotPlan: temoin.PLAN_OUVERT })] }),
  };
});
jest.mock('@/store/appContext', () => ({
  storage: { delete: jest.fn(), getString: jest.fn(), set: jest.fn() },
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
});
