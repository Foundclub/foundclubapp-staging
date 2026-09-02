import { Linking, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Profile from '../Profile';

// LOT D41 ① (E6) — le menu « Mon compte » n'avait AUCUN test sur ses rangees.
//
// Ce qu'il fige : une personne dont la page profil est DEJA editable ne voit
// plus « Modifier mon profil » dans son menu. Deux rangees qui menent au meme
// sujet par deux formulaires differents, c'est ce que l'audit D38 a nomme comme
// l'ecart le plus couteux du pack (« un dirigeant a trois facons d'editer son
// profil »).
//
// 🧭 CE QUE LA MESURE A CONTREDIT DANS LE PROMPT D41 : il annonce « joueur et
// entraineur gardent leurs deux rangees ». C'est FAUX depuis le lot D39
// (`0022e3e`, fusionne dans `staging` le 2026-08-08 a 18:44) : D39 a retire la
// rangee POUR EUX et l'a gardee pour le dirigeant — exactement l'inverse. D41
// ne rouvre donc pas leur cas, il termine celui du dirigeant.
//
// Pilote par le TEXTE VISIBLE, et `t` resout dans le VRAI `fr.js` : une cle
// inexistante ferait echouer le test au lieu de le rendre vert a vide.

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

const ROLE_DIRIGEANT = { name: 'Dirigeant', type: 'dirigeant' };
const ROLE_JOUEUR = { name: 'Joueur', type: 'joueur' };
const ROLE_ENTRAINEUR = { name: 'Entraineur', type: 'entraineur' };
const ROLE_SANS_PROFIL_EDITABLE = { name: 'Authenticated', type: 'authenticated' };

describe('D41 ① — « Modifier mon profil » disparait quand la page profil edite deja', () => {
  // LE temoin du lot. Le crayon de la carte identite (SelfProfileUnified.js:494)
  // reste le seul acces au formulaire complet pour un dirigeant.
  it('ne propose PLUS « Modifier mon profil » a un dirigeant', async () => {
    const libelles = await libellesDuMenu(ROLE_DIRIGEANT);

    expect(libelles).not.toContain('Modifier mon profil');
  });

  // La moitie qu'il ne faut pas casser : on retire une rangee, pas l'acces.
  it('lui laisse « Voir mon profil », qui mene a sa page editable', async () => {
    const libelles = await libellesDuMenu(ROLE_DIRIGEANT);

    expect(libelles).toContain('Voir mon profil');
  });

  // Deja vrai avant D41 (lot D39) : le figer ici evite qu'un lot futur
  // « retablisse la symetrie » en remettant la rangee a joueur et entraineur.
  it.each([
    ['joueur', ROLE_JOUEUR],
    ['entraineur', ROLE_ENTRAINEUR],
  ])('ne la propose pas non plus a un %s, dont la page est editable depuis D39', async (
    _nom,
    role,
  ) => {
    const libelles = await libellesDuMenu(role);

    expect(libelles).toContain('Voir mon profil');
    expect(libelles).not.toContain('Modifier mon profil');
  });

  // ⛔ LA RANGEE N'EST PAS SUPPRIMEE DE L'ECRAN, et c'est volontaire : un compte
  // sans role n'a pas de page profil editable. Lui retirer la rangee lui
  // enleverait son SEUL acces au formulaire, alors que le lot ne retire qu'un
  // doublon. `ProfileEdit` garde ses autres points d'entree et son URL web.
  it('la garde pour un compte dont la page profil n est PAS editable', async () => {
    const libelles = await libellesDuMenu(ROLE_SANS_PROFIL_EDITABLE);

    expect(libelles).toContain('Modifier mon profil');
  });
});

describe('R24 — un moyen de nous joindre existe DANS l app (Apple 1.5)', () => {
  // Avant ce lot, le seul bouton nomme « Nous contacter » vivait dans le tunnel
  // d'affiliation et ouvrait la fenetre « je ne trouve pas mon club » : une
  // demande aux superadmins, pas un canal vers l'editeur, et introuvable une
  // fois l'onboarding passe. La section « Mon compte » est, elle, permanente.
  it.each([
    ['dirigeant', ROLE_DIRIGEANT],
    ['joueur', ROLE_JOUEUR],
    ['entraineur', ROLE_ENTRAINEUR],
    ['compte sans role', ROLE_SANS_PROFIL_EDITABLE],
  ])('propose « Nous contacter » a un %s', async (_nom, role) => {
    const libelles = await libellesDuMenu(role);

    expect(libelles).toContain('Nous contacter');
  });

  it('ouvre vraiment un e-mail vers contact@foundclubpro.com', async () => {
    const arbre = await monterProfil(ROLE_DIRIGEANT);

    await act(async () => {
      rangeePortant(arbre, 'Nous contacter').props.onPress();
    });

    expect(Linking.openURL).toHaveBeenCalledWith('mailto:contact@foundclubpro.com');
  });
});
