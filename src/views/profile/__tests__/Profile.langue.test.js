import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Profile from '../Profile';

// 🔤 I18N-0 — la rangée « Langue » de « Mon compte ».
//
// Ce qu'il fige : on peut forcer la langue de l'app depuis son profil, en
// français, en anglais, ou revenir à celle du téléphone — et le choix est
// retenu ET appliqué tout de suite (sans redémarrer l'app).
// Échafaudage repris du témoin D41 (`Profile.menuProfil.test.js`) : mêmes
// doublures, `t` résout dans le VRAI `fr.js`.

/** @type {'fr' | 'en' | null} */
let mockChoix = null;
const mockChangeLanguage = jest.fn();
const mockEnregistrer = jest.fn((/** @type {'fr' | 'en' | null} */ choix) => {
  mockChoix = choix;
});

jest.mock('@/theme/strings/langue', () => ({
  enregistrerChoixDeLangue: (/** @type {any} */ choix) => mockEnregistrer(choix),
  // Le téléphone de ce témoin est réglé en ANGLAIS : « langue du téléphone »
  // doit donc rendre 'en', et un choix « Français » doit l'emporter.
  langueEffective: () => mockChoix || 'en',
  lireChoixDeLangue: () => mockChoix,
}));

/** @type {any} */
let mockUserData;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
}));

// `react-native-gesture-handler` est publie en TypeScript non transpile et ne
// figure pas dans le `transformIgnorePatterns` du projet.
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
      i18n: { changeLanguage: (/** @type {string} */ langue) => mockChangeLanguage(langue) },
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

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02).
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
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
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
const monterProfil = async (role) => {
  mockUserData = {
    club: null,
    documentId: 'user-doc-1',
    firstname: 'Zinedine',
    lastname: 'Zidane',
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

  return arbre;
};

/**
 * Monte « Mon compte » pour un role donne et rend ses libelles visibles.
 * @param {{ name: string, type: string }} role Le role du compte connecte.
 * @returns {Promise<string[]>} Les textes affiches.
 */
const libellesDuMenu = async (role) => (await monterProfil(role)).root
  .findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim());

/**
 * La rangee de menu qui porte exactement ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const rangeePortant = (arbre, libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud
    .findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim() === libelle));

const ROLE_JOUEUR = { name: 'Joueur', type: 'joueur' };

/**
 * Appuie sur la rangee qui porte ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyer = (arbre, libelle) => act(async () => {
  rangeePortant(arbre, libelle).props.onPress();
});

beforeEach(() => {
  mockChoix = null;
  mockChangeLanguage.mockClear();
  mockEnregistrer.mockClear();
});

describe('I18N-0 — « Mon compte » permet de choisir la langue', () => {
  it('affiche la rangée « Langue », sur la langue du téléphone par défaut', async () => {
    const libelles = await libellesDuMenu(ROLE_JOUEUR);

    expect(libelles).toContain('Langue · Langue du téléphone');
  });

  it('déplie les trois choix, chacun dans sa propre langue', async () => {
    const arbre = await monterProfil(ROLE_JOUEUR);

    await appuyer(arbre, 'Langue · Langue du téléphone');
    const libelles = arbre.root.findAllByType(Text)
      .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim());

    expect(libelles).toEqual(
      expect.arrayContaining(['Langue du téléphone', 'Français', 'English']),
    );
  });

  it('choisir « English » retient le choix et parle anglais tout de suite', async () => {
    const arbre = await monterProfil(ROLE_JOUEUR);

    await appuyer(arbre, 'Langue · Langue du téléphone');
    await appuyer(arbre, 'English');

    expect(mockEnregistrer).toHaveBeenCalledWith('en');
    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
    // Le panneau se replie sur la rangée, qui nomme le choix.
    expect(rangeePortant(arbre, 'Langue · English')).toBeDefined();
    expect(rangeePortant(arbre, 'Français')).toBeUndefined();
  });

  it('« Français » l’emporte sur un téléphone en anglais', async () => {
    const arbre = await monterProfil(ROLE_JOUEUR);

    await appuyer(arbre, 'Langue · Langue du téléphone');
    await appuyer(arbre, 'Français');

    expect(mockEnregistrer).toHaveBeenCalledWith('fr');
    expect(mockChangeLanguage).toHaveBeenCalledWith('fr');
  });

  it('« Langue du téléphone » efface le choix et revient à la langue du téléphone', async () => {
    mockChoix = 'fr';
    const arbre = await monterProfil(ROLE_JOUEUR);

    await appuyer(arbre, 'Langue · Français');
    await appuyer(arbre, 'Langue du téléphone');

    expect(mockEnregistrer).toHaveBeenCalledWith(null);
    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
  });
});
