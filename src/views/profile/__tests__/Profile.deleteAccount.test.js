import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Profile from '../Profile';

// LOT L28 (E6) — Profile.js fait 30 000 caracteres et n'avait AUCUN test.
//
// Ce qu'il prouve : avant de confirmer la suppression de son compte, la personne
// lit ce que la suppression VA FAIRE — retirer ses inscriptions a venir, prevenir
// ses entraineurs, conserver son historique. C'est la moitie « app » de L28 ; sa
// moitie « serveur » execute cette promesse (admin, `deleteAccount`).
//
// Il est pilote par le TEXTE VISIBLE : on cherche le lien qui porte « Supprimer
// mon compte », on appuie dessus, et on lit le message affiche. Aucune assertion
// ne porte sur la forme de l'arbre, donc l'ecran peut etre remis en page sans
// qu'une ligne d'ici ne bouge.
//
// `t` n'est PAS un mock qui renvoie la cle : il resout dans le VRAI `fr.js`.
// Sans ca, le test passerait au vert avec une cle inexistante.

/** @type {any} */
let mockUserData;
/** @type {any} */
let mockNavigation;
/** @type {any[]} */
const mockDeleteMutations = [];

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
}));

// `react-native-gesture-handler` est publie en TypeScript non transpile et ne
// figure pas dans le `transformIgnorePatterns` du projet : le charger casse Jest
// avant meme le rendu. Seul `ScrollView` est utilise ici, et celui de
// react-native se comporte pareil pour un test — c'est un conteneur.
jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => {
    const journal = { mutate: jest.fn(), options };
    mockDeleteMutations.push(journal);
    return { isPending: false, mutate: journal.mutate };
  },
}));

// Le vrai catalogue de chaines : `t('a.b.c')` descend dans `fr.js`. Une cle
// absente ressort telle quelle, donc une faute de frappe echoue le test.
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
 * Texte visible sous un noeud de l'arbre rendu.
 * @param {any} noeud
 * @returns {string}
 */
const texteDe = (noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children))
  .join(' ');

/**
 * Appuie sur l'element pressable qui porte ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const candidats = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
    .filter((/** @type {any} */ noeud) => texteDe(noeud).includes(libelle));

  if (candidats.length === 0) {
    throw new Error(`Aucun element pressable ne porte le libelle « ${libelle} »`);
  }

  const cible = candidats.find((/** @type {any} */ noeud) => texteDe(noeud).trim() === libelle)
    || candidats[candidats.length - 1];

  await act(async () => {
    cible.props.onPress();
  });
};

/**
 * Monte l'ecran Profil.
 * @returns {Promise<any>}
 */
const monterEcran = async () => {
  mockNavigation = { navigate: jest.fn(), setParams: jest.fn() };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<Profile navigation={mockNavigation} route={{ params: {} }} />);
  });
  return arbre;
};

/**
 * Derniere alerte affichee : { titre, message, boutons }.
 * @returns {any}
 */
const derniereAlerte = () => {
  const appels = /** @type {any} */ (Alert.alert).mock.calls;
  const [titre, message, boutons] = appels[appels.length - 1] || [];
  return { boutons: boutons || [], message, titre };
};

beforeEach(() => {
  mockDeleteMutations.length = 0;
  mockUserData = {
    club: null,
    documentId: 'user-doc-1',
    firstname: 'Zinedine',
    lastname: 'Zidane',
    multisportClubs: [],
    role: { name: 'Joueur', type: 'joueur' },
  };
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('L28 — avant de confirmer, l ecran annonce le retrait des inscriptions a venir', async () => {
  const arbre = await monterEcran();

  await appuyerSur(arbre, 'Supprimer mon compte');

  const { message, titre } = derniereAlerte();
  expect(titre).toBe('Supprimer ton compte ?');
  expect(message).toContain('inscriptions aux événements à venir seront retirées');
  expect(message).toContain('entraîneurs');
  expect(message).toContain('historique passé est conservé');
});

test('L28 — l ecran ne renvoie plus vers un formulaire de contact', async () => {
  const arbre = await monterEcran();

  await appuyerSur(arbre, 'Supprimer mon compte');

  // L'ancien message disait « remplis le formulaire de contact » alors que ce
  // bouton supprime le compte immediatement : c'etait une promesse fausse.
  expect(derniereAlerte().message).not.toContain('formulaire de contact');
});

test('TEMOIN — la confirmation declenche toujours la suppression, l annulation jamais', async () => {
  const arbre = await monterEcran();

  await appuyerSur(arbre, 'Supprimer mon compte');
  const { boutons } = derniereAlerte();

  const annuler = boutons.find((/** @type {any} */ bouton) => bouton.text === 'Annuler');
  const confirmer = boutons.find((/** @type {any} */ bouton) => bouton.text === 'Supprimer');
  expect(annuler).toBeDefined();
  expect(annuler.onPress).toBeUndefined();
  expect(confirmer.style).toBe('destructive');

  const suppression = mockDeleteMutations[0];
  expect(suppression.mutate).not.toHaveBeenCalled();

  await act(async () => { confirmer.onPress(); });
  expect(suppression.mutate).toHaveBeenCalledTimes(1);
});
