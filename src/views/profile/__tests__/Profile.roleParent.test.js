import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Profile from '../Profile';

// PARENT (2026-09-02) — LE PROFIL D UN PARENT.
//
// Un compte de role Parent se presente comme « Parent » (et non « Membre »,
// ce que rendait getUserRoleKey('Parent') → 'new' avant ce lot), et ne voit
// aucune rangee de gestion de club : un Parent n est pas un dirigeant.
// « Declarer mon enfant » (fiche joueur sans identifiants, version A d Adel)
// est le second lot : aucune rangee « Mes enfants » n existe encore.
//
// Copie des doublures de Profile.menuProfil.test.js : `t` resout dans le VRAI
// `fr.js`, une cle absente ferait echouer le test au lieu de le rendre vert.

/** @type {any} */
let mockUserData;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
}));

jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    addAccount: jest.fn(),
    authSessions: [],
    canEditClub: () => false,
    canManageTeam: () => false,
    freeUsageSummary: null,
    logoutMutation: { mutate: jest.fn() },
    refetchUserData: jest.fn(),
    subscriptionAccessLevel: 'free',
    switchAccount: jest.fn(),
    userData: mockUserData,
    userDataError: null,
    userDataLoading: false,
  }),
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ fcmToken: 'token-test' }, jest.fn()],
}));

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

jest.mock('@/services/auth/authService', () => ({
  deleteAccount: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => function WithDataWrapperMock({ children }) { return children; },
);
jest.mock(
  '@/components/molecules/onboardingWrapper/OnboardingWrapper',
  () => function OnboardingWrapperMock({ children }) { return children; },
);
jest.mock(
  '@/components/molecules/tutorial/TutorialFlowBoundary',
  () => function TutorialFlowBoundaryMock({ children }) { return children; },
);
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock() { return null; },
);
jest.mock(
  '@/components/molecules/profileAvatar/ProfileAvatar',
  () => function ProfileAvatarMock() { return null; },
);
jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Monte « Mon compte » pour un role donne et rend ses libelles visibles.
 * @param {{ name: string, type: string }} role Le role du compte connecte.
 * @returns {Promise<string[]>} Les textes affiches.
 */
const libellesDuMenu = async (role) => {
  mockUserData = {
    club: null,
    documentId: 'user-doc-1',
    firstname: 'Nadia',
    lastname: 'Bonnet',
    multisportClubs: [],
    role,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <Profile navigation={{ navigate: jest.fn(), setParams: jest.fn() }} route={{ params: {} }} />,
    );
  });
  return arbre.root
    .findAllByType(Text)
    .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim());
};

const ROLE_PARENT = { name: 'Parent', type: 'parent' };
const ROLE_JOUEUR = { name: 'Joueur', type: 'joueur' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Profile — le profil d un Parent (PARENT)', () => {
  it('un Parent se presente comme « Parent », jamais comme « Membre »', async () => {
    const libelles = await libellesDuMenu(ROLE_PARENT);
    expect(libelles).toContain('Parent');
    expect(libelles).not.toContain('Membre');
  });

  it('un Parent ne voit pas « Gérer mon club » : un Parent n est pas un dirigeant', async () => {
    const libelles = await libellesDuMenu(ROLE_PARENT);
    expect(libelles).not.toContain('Gérer mon club');
  });

  it('un joueur, lui, ne se presente pas comme Parent', async () => {
    const libelles = await libellesDuMenu(ROLE_JOUEUR);
    expect(libelles).not.toContain('Parent');
  });
});
