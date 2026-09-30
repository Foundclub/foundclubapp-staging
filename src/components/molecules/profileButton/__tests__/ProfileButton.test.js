import { Platform, StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

// 📌 PREMIER FILET de `ProfileButton.js` — l'avatar en haut à droite de l'accueil
// et de 9 autres écrans, la porte de « Mon compte » (AUCUN témoin jusqu'ici).
// Posé par le lot ACCUEIL (audit V1, A17) en application de E6, avant d'y ajouter
// le point « cotisation à payer » que la case « Mes cotisations » portait sur
// l'accueil.

const mockNavigation = { navigate: jest.fn() };
const mockEtat = { isAddingAccount: false };
const mockDispatch = jest.fn();
const mockAuth = {
  userData: {
    avatar: null, documentId: 'moi', firstname: 'Hugo', lastname: 'Lemaire',
  },
};

jest.mock('@react-navigation/native', () => ({ useNavigation: () => mockNavigation }));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuth }));
jest.mock('@/store/appContext', () => ({ useAppContext: () => [mockEtat, mockDispatch] }));
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => ({
  __esModule: true, default: () => null,
}));
jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));

// Le VRAI thème, sans le contexte React qui le porte.
jest.mock('@/theme/themeContext', () => {
  const Colors = jest.requireActual('@/theme/colors').default();
  const theme = {
    ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
    Colors,
  };
  return { __esModule: true, default: () => theme };
});

const ProfileButton = require('../ProfileButton').default;

const { colors } = jest.requireActual('@/theme/colors');

/** @type {renderer.ReactTestRenderer[]} */
const arbres = [];
afterEach(() => {
  arbres.splice(0).forEach((arbre) => act(() => { arbre.unmount(); }));
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

/**
 * Monte l'avatar.
 * @param {{ hasAlert?: boolean }} [props]
 * @returns {renderer.ReactTestRenderer}
 */
const monter = (props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<ProfileButton hasAlert={props.hasAlert} />); });
  arbres.push(arbre);
  return arbre;
};

/**
 * Le bouton (nœud hôte qui porte l'appui).
 * @param {renderer.ReactTestRenderer} arbre
 * @returns {any}
 */
const bouton = (arbre) => arbre.root.find((n) => (
  typeof n.type === 'string' && typeof n.props.onClick === 'function'
));

/**
 * Les points rouges d'alerte dessinés dans le bouton.
 * @param {renderer.ReactTestRenderer} arbre
 * @returns {any[]}
 */
const points = (arbre) => arbre.root.findAll((n) => (
  typeof n.type === 'string'
  && StyleSheet.flatten(n.props.style)?.backgroundColor === colors.error500
));

describe('E6 — l avatar AUJOURD HUI', () => {
  it('sur le téléphone, il ouvre « Mon compte » (la pile du profil)', () => {
    const arbre = monter();

    act(() => { bouton(arbre).props.onClick(); });

    expect(mockNavigation.navigate).toHaveBeenCalledWith(RouteNames.ProfileStack);
  });

  it('sur le site, il ouvre la page « Mon compte »', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const arbre = monter();

    act(() => { bouton(arbre).props.onClick(); });

    expect(mockNavigation.navigate).toHaveBeenCalledWith(RouteNames.Profile);
  });

  it('il s appelle « Profil » pour les lecteurs d écran, et ne porte aucun point', () => {
    const arbre = monter();

    expect(bouton(arbre).props.accessibilityLabel).toBe('Profil');
    expect(points(arbre)).toHaveLength(0);
  });
});

// A17 (lot ACCUEIL, 30/09) — « Mes cotisations » a quitté l'accueil pour « Mon
// compte ». Sa case portait un POINT ROUGE quand il reste une cotisation à payer
// (`maCotisationDue`, somme calculée par le serveur : `app-home-summary.ts`) —
// le seul rappel de l'app. Il n'est pas perdu : il passe sur l'avatar, la porte
// de « Mon compte ».
describe('A17 — le rappel « cotisation à payer » suit la case sur l avatar', () => {
  it('LE TEMOIN : avec une cotisation à payer, un point rouge de la charte', () => {
    const arbre = monter({ hasAlert: true });

    expect(points(arbre)).toHaveLength(1);
  });

  it('et les lecteurs d écran l entendent, pas seulement les yeux', () => {
    const arbre = monter({ hasAlert: true });

    expect(bouton(arbre).props.accessibilityLabel).toBe('Profil, une cotisation à payer');
  });
});
