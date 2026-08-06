import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SearchScreenShell from '../SearchScreenShell';

// Filet D07 (E6) : ce gabarit n'avait AUCUN test et il porte l'en-tete de
// l'onglet Rechercher — le seul ecran ou vivent les annonces de match amical.
// Le lot D07 lui RETIRE une affordance (la fleche de retour) : c'est exactement
// le genre de geste qu'aucune porte ne voit, parce que les portes montent un
// ecran sans son navigateur.
//
// Mesure faite AVANT d'ecrire ce filet, et elle contredit le brief :
//   · SquadSearchScreen.js n'est PAS cet ecran (il cherche des SQUADS League) ;
//   · les 4 ecrans SearchEventsScreen / SearchClubsScreen / SearchReservations
//     Screen / SearchRecruitmentScreen consomment aussi ce gabarit mais ne sont
//     MONTES NULLE PART (routeNames.js:16-19) : le seul appelant vivant est
//     SearchHubScreen.
//
// Deux etages, comme pour l'etape 2/7 : ce qui ne doit pas bouger, puis ce que
// D07 change. Le premier reste vert des deux cotes du lot.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'moi' } }),
}));

// Le VRAI theme : un Proxy rendrait les echecs illisibles, et un objet invente
// masquerait un jeton absent.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => function ConteneurMock(
  /** @type {any} */ props,
) {
  return props.children;
});

// Les trois pieces du bandeau logo sont remplacees par des TEMOINS NOMMES :
// le lot D07 dit « le bandeau est INTOUCHE », et un temoin absent est la seule
// facon de le prouver sans dependre de leur contenu.
jest.mock('@/components/molecules/header/LeagueHeaderSwitch', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function BandeauMock() {
    return reactActuel.createElement(TexteRN, null, 'temoin-bandeau-logo');
  };
});
jest.mock('@/components/molecules/notificationBadge/NotificationBadge', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function ClocheMock() {
    return reactActuel.createElement(TexteRN, null, 'temoin-cloche');
  };
});
jest.mock('@/components/molecules/profileButton/ProfileButton', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function AvatarMock() {
    return reactActuel.createElement(TexteRN, null, 'temoin-avatar');
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function RetourMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { accessibilityRole: 'button', onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, 'temoin-fleche-retour'),
    );
  };
});

jest.mock('@/components/molecules/searchTypeSwitcher/SearchTypeSwitcher', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function ChipsMock(/** @type {any} */ props) {
    return reactActuel.createElement(TexteRN, null, `temoin-chips:${props.activeType}`);
  };
});

jest.mock('@/components/molecules/onboardingWrapper/OnboardingWrapper', () => function TourMock(
  /** @type {any} */ props,
) {
  return props.children;
});

const navigation = {
  canGoBack: jest.fn(() => true),
  goBack: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
};

/**
 * Rend le gabarit avec un contenu reconnaissable.
 * @param {any} [props] Props supplementaires passees au gabarit.
 * @returns {any} L'arbre rendu.
 */
const rendre = (props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      createElement(
        SearchScreenShell,
        { activeType: 'amicaux', navigation, ...props },
        createElement(Text, null, 'temoin-contenu'),
      ),
    );
  });
  return arbre;
};

/**
 * Tous les textes reellement affiches, dans l'ordre du rendu.
 * @param {any} arbre L'arbre rendu.
 * @returns {string[]} Les textes affiches.
 */
const textesVisibles = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ noeud) => {
    if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return;
    if (typeof noeud === 'string' || typeof noeud === 'number') {
      sortie.push(String(noeud));
      return;
    }
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    parcourir(noeud.children);
  };
  parcourir(arbre.toJSON());
  return sortie;
};

beforeEach(() => {
  navigation.canGoBack.mockClear();
  navigation.canGoBack.mockReturnValue(true);
  navigation.goBack.mockClear();
  navigation.navigate.mockClear();
});

describe('En-tete de Rechercher — CE QUI NE DOIT PAS BOUGER', () => {
  // Le lot D07 est explicite : « Le bandeau logo (FOUNDCLUB · LEAGUE + cloche
  // + avatar) est INTOUCHE. » Ces trois temoins le prouvent.
  it('garde le bandeau logo, la cloche et l avatar', () => {
    const affiches = textesVisibles(rendre());
    expect(affiches).toContain('temoin-bandeau-logo');
    expect(affiches).toContain('temoin-cloche');
    expect(affiches).toContain('temoin-avatar');
  });

  it('garde les chips de categorie, sur la categorie active', () => {
    expect(textesVisibles(rendre())).toContain('temoin-chips:amicaux');
  });

  it('affiche le contenu de l onglet', () => {
    expect(textesVisibles(rendre())).toContain('temoin-contenu');
  });

  it('rend le bandeau logo AVANT les chips, et les chips avant le contenu', () => {
    const affiches = textesVisibles(rendre());
    const rang = (/** @type {string} */ temoin) => affiches.indexOf(temoin);
    expect(rang('temoin-bandeau-logo')).toBeLessThan(rang('temoin-chips:amicaux'));
    expect(rang('temoin-chips:amicaux')).toBeLessThan(rang('temoin-contenu'));
  });

  // Le tour guide accroche son projecteur sur l'en-tete : la variante avec
  // `tutorialSteps` doit continuer a rendre exactement les memes temoins.
  it('rend les memes temoins avec le tour guide actif', () => {
    const affiches = textesVisibles(rendre({
      tutorialSteps: {
        header: {
          description: 'd', id: 'h', order: 1, title: 't',
        },
      },
    }));
    expect(affiches).toContain('temoin-bandeau-logo');
    expect(affiches).toContain('temoin-chips:amicaux');
    expect(affiches).toContain('temoin-contenu');
  });
});

describe('En-tete de Rechercher — CE QUE D07 CHANGE', () => {
  // Mesure : cet ecran est TOUJOURS pousse sur HomeHub, dans le meme onglet
  // (« Accueil »), dont la barre d'onglets reste visible. Le retour a HomeHub
  // est donc a un appui sur l'icone d'onglet, plus le retour materiel Android
  // et le retour du navigateur sur le web. La fleche faisait double emploi et
  // faisait passer un onglet pour une page poussee.
  it('n affiche plus de fleche de retour', () => {
    expect(textesVisibles(rendre())).not.toContain('temoin-fleche-retour');
  });

  it('n affiche plus le titre RECHERCHER en capitales', () => {
    const affiches = textesVisibles(rendre());
    expect(affiches).not.toContain('RECHERCHER');
    expect(affiches.join(' ')).not.toContain('RECHERCHER');
  });

  it('ne le reaffiche pas non plus quand le tour guide est actif', () => {
    const affiches = textesVisibles(rendre({
      tutorialSteps: {
        header: {
          description: 'd', id: 'h', order: 1, title: 't',
        },
      },
    }));
    expect(affiches).not.toContain('temoin-fleche-retour');
    expect(affiches.join(' ')).not.toContain('RECHERCHER');
  });

  // Le geste est PUREMENT visuel : il ne doit toucher aucune navigation. Si un
  // jour l'en-tete revient, c'est cette ligne qui dira que rien d'autre n'a
  // bouge entre-temps.
  it('ne declenche aucune navigation au simple rendu', () => {
    rendre();
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
