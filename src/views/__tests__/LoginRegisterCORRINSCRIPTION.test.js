import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Login from '@/views/Login';
import Register from '@/views/Register';

import { RouteNames } from '@/navigation/routeNames';

// CORR-INSCRIPTION, point 12 de la recette du site (30/10) — E6 : Login et Register n'avaient
// aucun témoin. Consigne d'Adel : on arrive sur « Se connecter » ; en bas, un petit bouton
// « Pas encore inscrit ? Créer ton compte » bascule sur une page identique où il est écrit
// « Créer ton compte ». Avant : le bouton de « Crée ton compte » disait « Se connecter ».

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ options) => (
      jest.requireActual('i18next').t(cle, options)
    ),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    cancelAddAccount: jest.fn(),
    canShowCodeButton: false,
    confirm: jest.fn(),
    isAddingAccount: false,
    isLoading: false,
    loginMutation: { error: null },
    otpMutation: { error: null, isPending: false, mutate: jest.fn() },
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  const theme = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
    Colors: couleurs,
    Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
    Images: new Proxy({}, { get: () => 1 }),
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});

jest.mock('@/components/organisms/otpForm/OTPForm', () => () => null);
jest.mock(
  '@/components/templates/FormScreenContainer',
  () => (/** @type {any} */ { children }) => children,
);
jest.mock('@/components/organisms/phoneInput/PhoneInput', () => () => null);

/**
 * Les textes visibles de l'écran.
 * @param {import('react-test-renderer').ReactTestRenderer} arbre - L'écran rendu
 * @returns {string[]} Les textes visibles
 */
const textes = (arbre) => arbre.root.findAllByType(Text)
  .map((n) => [].concat(n.props.children).filter((c) => typeof c === 'string').join(''))
  .filter(Boolean);

/**
 * Le bouton qui porte ce texte.
 * @param {import('react-test-renderer').ReactTestRenderer} arbre - L'écran rendu
 * @param {string} libelle - Le texte du bouton
 * @returns {any} Le bouton qui porte ce texte
 */
const bouton = (arbre, libelle) => arbre.root.findAll(
  (n) => typeof n.props.onPress === 'function'
    && n.findAllByType(Text).some((tx) => [].concat(tx.props.children).join('') === libelle),
)[0];

describe('CORR-INSCRIPTION p12 — Connexion et création de compte', () => {
  it('« Connecte-toi » : « Se connecter », et un petit bouton vers l’inscription', () => {
    const navigation = { navigate: jest.fn() };
    let arbre;
    act(() => { arbre = renderer.create(<Login navigation={navigation} />); });
    const vus = textes(arbre);
    expect(vus).toContain('Connecte-toi');
    expect(vus).toContain('Se connecter');
    expect(vus).toContain('Pas encore inscrit ? Créer ton compte');
    act(() => { bouton(arbre, 'Pas encore inscrit ? Créer ton compte').props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.Register);
  });

  it('« Crée ton compte » : même page, bouton « Créer ton compte », retour possible', () => {
    const navigation = { navigate: jest.fn() };
    let arbre;
    act(() => { arbre = renderer.create(<Register navigation={navigation} />); });
    const vus = textes(arbre);
    expect(vus).toContain('Crée ton compte');
    expect(vus).toContain('Créer ton compte');
    expect(vus).not.toContain('Se connecter');
    act(() => { bouton(arbre, 'Déjà inscrit ? Se connecter').props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.Login);
  });
});
