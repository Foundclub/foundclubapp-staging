import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MyTeamList from '../MyTeamList';

// ==========================================================================
// GUIDE-PETIT-ECRAN (rejeu 3, 29/10, R3-03) : sur l'onglet Équipes, la bulle du
// guide (m1-wait, sans cible) se posait tout en haut et cachait le logo,
// la cloche et l'avatar : l'en-tête de l'écran n'était pas ancré. Ancré
// (`screen.header`), la bulle se pose dessous (règle GUIDE-ENTETE, 4- A).
// Écran sans aucun test : le 1er cas décrit ce qu'il montrait déjà (E6).
// ==========================================================================

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ defaut) => defaut || cle,
  }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ refetchUserData: () => {}, userData: { documentId: 'u1' } }),
}));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Alignments: new Proxy({}, { get: () => ({}) }),
    Spaces: new Proxy({}, { get: () => new Proxy({}, { get: () => ({}) }) }),
  }),
}));
/**
 * Doublure : un texte qui dit qui est rendu.
 * @param {string} nom - Nom affiché.
 * @returns {any} Module.
 */
const doublure = (nom) => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>{nom}</TexteRN> };
};
jest.mock('@/components/molecules/header/LeagueHeaderSwitch', () => doublure('LOGO'));
jest.mock('@/components/molecules/notificationBadge/NotificationBadge', () => doublure('CLOCHE'));
jest.mock('@/components/molecules/profileButton/ProfileButton', () => doublure('AVATAR'));
jest.mock('@/components/organisms/teamListContent/TeamListContent', () => doublure('LISTE'));
jest.mock('@/components/molecules/onboardingWrapper/OnboardingWrapper', () => ({
  __esModule: true,
  default: (/** @type {any} */ { children }) => children,
}));
jest.mock('@/components/molecules/tutorial/TutorialFlowBoundary', () => ({
  __esModule: true,
  default: (/** @type {any} */ { children }) => children,
}));
jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

const rendre = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <MyTeamList navigation={{ setParams: () => {} }} route={{ params: {} }} />,
    );
  });
  return arbre;
};

const textes = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ texte) => [].concat(texte.props.children).join(''));

describe('MyTeamList — onglet Équipes', () => {
  test('caractérisation : logo, cloche, avatar, puis la liste des équipes', async () => {
    const arbre = await rendre();
    expect(textes(arbre.root)).toEqual(['LOGO', 'CLOCHE', 'AVATAR', 'LISTE']);
  });

  test('GUIDE-PETIT-ECRAN : l’en-tête (logo, cloche, avatar) est ancré pour le guide', async () => {
    const arbre = await rendre();
    const entete = arbre.root.findAll((/** @type {any} */ noeud) => typeof noeud.type === 'string'
      && noeud.props.testID === 'tour.target.screen.header')[0];
    expect(entete).toBeTruthy();
    expect(textes(entete)).toEqual(['LOGO', 'CLOCHE', 'AVATAR']);
  });
});
