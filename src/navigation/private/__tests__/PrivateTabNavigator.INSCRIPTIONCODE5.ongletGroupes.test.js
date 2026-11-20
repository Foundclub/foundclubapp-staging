import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PrivateTabNavigator from '../PrivateTabNavigator';

// INSCRIPTION-CODE-5 (20/11, point c du chef, E6) — le premier témoin de RENDU de la barre du bas
// de l'app. Il rend les onglets avec les VRAIES options (getTabScreenCommonOptions) et lit, pour
// l'onglet des équipes, le mot VISIBLE (tabBarLabel) et le libellé d'accessibilité.
// Le lot 4 avait mis « Mes groupes » dans `label` ; le dock affiche `visualLabel || label`
// (commonOptions.js), donc on lisait toujours « Équipes » en judo ou en spéléologie.

/** Le compte affiché : son activité et ses droits. */
const mockCompte = { canManageTeam: false, userData: {} };

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next.t,
  }),
}));

jest.mock('@react-navigation/bottom-tabs', () => {
  const { createElement: ce, Fragment } = jest.requireActual('react');
  const { Text: Texte, View } = jest.requireActual('react-native');
  return {
    createBottomTabNavigator: () => ({
      Navigator: (/** @type {any} */ { children }) => ce(Fragment, null, children),
      Screen: (/** @type {any} */ { name, options }) => ce(
        View,
        { testID: `onglet-${name}` },
        ce(Texte, { testID: `a11y-${name}` }, options.tabBarAccessibilityLabel),
        options.tabBarLabel({ focused: false }),
      ),
    }),
  };
});

// Les options sont les VRAIES (commonOptions.js) ; seules leurs dépendances natives sont doublées.
jest.mock('@react-navigation/stack', () => ({ CardStyleInterpolators: {} }));
jest.mock('@/components/atoms/animatedTabBarButton/AnimatedTabBarButton', () => () => null);
jest.mock('@/components/atoms/glassSurface/GlassSurface', () => () => null);
jest.mock('@/components/atoms/header/Header', () => () => null);
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/components/molecules/tour/TourTarget', () => () => null);

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockCompte,
}));
jest.mock('@/domains/messaging/useUnreadMessages', () => ({
  __esModule: true,
  default: () => ({ unreadCount: 0 }),
}));
jest.mock('@/context/ClubScopeContext', () => ({ useClubScope: () => ({}) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
jest.mock('../stacks/SearchStack', () => () => null);
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return { __esModule: true, default: () => ({ Colors: couleurs, Images: {} }) };
});

/**
 * Rend la barre du bas et lit l'onglet des équipes.
 * @param {object} compte Le compte : activité, club, droits.
 * @returns {{ a11y: string, visible: string } | null} Les deux mots de l'onglet, ou null.
 */
const ongletDesEquipes = (compte) => {
  Object.assign(mockCompte, { canManageTeam: false, ...compte });
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(createElement(PrivateTabNavigator)); });
  const onglets = arbre.root.findAll((/** @type {any} */ n) => n.props.testID === 'onglet-MyTeamList');
  if (onglets.length === 0) return null;
  const textes = onglets[0].findAllByType(Text).map((n) => [n.props.testID, n.props.children]);
  return {
    a11y: textes.find(([id]) => id === 'a11y-MyTeamList')[1],
    visible: textes.find(([id]) => id !== 'a11y-MyTeamList')[1],
  };
};

describe('INSCRIPTION-CODE-5 — l’onglet « Mes groupes » de la barre du bas (rendu)', () => {
  it('sport collectif : « Équipes » à l’écran, « Mes équipes » pour le lecteur d’écran', () => {
    expect(ongletDesEquipes({ userData: { id: 1, preferredSport: 'Football' } }))
      .toEqual({ a11y: 'Mes équipes', visible: 'Équipes' });
  });

  it('raquette : les mots d’aujourd’hui', () => {
    expect(ongletDesEquipes({ userData: { id: 1, preferredSport: 'Tennis' } }))
      .toEqual({ a11y: 'Mes équipes', visible: 'Équipes' });
  });

  it.each([
    ['Judo'], ['Natation'], ['Spéléologie'], ['Théâtre'],
  ])('%s : « Groupes » à l’écran, « Mes groupes » pour le lecteur d’écran', (activite) => {
    expect(ongletDesEquipes({ userData: { id: 1, preferredSport: activite } }))
      .toEqual({ a11y: 'Mes groupes', visible: 'Groupes' });
  });

  it('dirigeant de multisport : « Club », quelle que soit l’activité', () => {
    expect(ongletDesEquipes({
      canManageTeam: true,
      userData: { id: 1, multisportClubs: [{ documentId: 'cm' }], preferredSport: 'Judo' },
    })).toEqual({ a11y: 'Mon club', visible: 'Club' });
  });

  it('activité inconnue ou vide : les mots d’aujourd’hui', () => {
    expect(ongletDesEquipes({ userData: { id: 1, preferredSport: '' } }))
      .toEqual({ a11y: 'Mes équipes', visible: 'Équipes' });
  });

  it('sans compte chargé, l’onglet n’existe pas (rien ne change)', () => {
    expect(ongletDesEquipes({ userData: {} })).toBeNull();
  });
});
