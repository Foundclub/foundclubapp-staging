/* eslint-disable no-unused-vars -- harnais recopie du temoin voisin (FINITIONS18 11) */
import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { updateMe } from '@/services/auth/authService';

import UserName from '../UserName';

// FINITIONS16 · POINT 2 (tournee T15, 06/10 02:37, compte neuf « Recette Age », SUR LE SITE) —
// « Qui es-tu ? » : prenom et nom remplis, date de naissance VIDE, « Continuer » ⇒ ACCEPTE
// (deux fois). L'etape suivante s'ouvrait et le profil devenait « Recette Age · Joueur » SANS
// date, contre la decision d'Adel « l'age est obligatoire » (registre des mineurs, ligne 10).
//
// 🔎 LA CAUSE, qui n'est pas dans l'ecran : le site ne charge PAS la vraie bibliotheque Joi.
// `web/vite.config.ts` remplace `joi` par `web/src/shims/joi.ts`, une doublure posee au premier
// commit du site (5642fa0, 20/07) dont CHAQUE schema dit « valide », quoi qu'on lui donne. Le
// formulaire de l'ecran ne bloquait donc rien sur le site ; le telephone, lui, a le vrai Joi.
//
// 🎯 Ce fichier monte l'ecran avec une doublure de Joi FIDELE a celle du site (chaque methode
// rend la chaine, `validate` / `validateAsync` rendent la valeur) et exige que la date reste
// obligatoire quand meme. Les memes exigences sur le vrai Joi vivent dans `UserName.test.js`.

/** @type {any} */
let mockNavigation;

jest.mock('@/store/appContext', () => ({
  storage: {
    delete: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
  },
  // AGE-OBLIGATOIRE ② - « Se deconnecter » rend le jeton de notifications,
  // comme le fait le Profil.
  useAppContext: () => [{ fcmToken: 'jeton-fcm' }, jest.fn()],
}));

// Doublure de `t` branchee sur la VRAIE fr.js : un `t` qui rend toujours son
// repli ne verrait jamais le catalogue, alors que l'ecran prend fr.js des que
// la clef existe (« Continuer » vient de la, pas d'un repli).
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle).split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud === null || noeud === undefined ? undefined : noeud[segment]
          ),
          traductions,
        );

        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

// `getFieldError` traduit le message Joi avec le `t` d'i18next (pas celui de
// react-i18next). Sans i18n initialise il rendrait `undefined`, et le test ne
// pourrait plus mesurer si un message est VISIBLE.
jest.mock('i18next', () => ({
  t: (/** @type {string} */ cle) => cle,
}));

// Le VRAI theme, jamais un Proxy : un mock en Proxy rend les echecs Jest
// illisibles (constat du lot paywall, 2026-08-02).
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

// LE JOI DU SITE (`web/src/shims/joi.ts`), recopie fidelement : toute methode rend la meme
// chaine, et la validation rend la valeur, sans jamais d'erreur.
jest.mock('@/theme/strings', () => {
  const schema = new Proxy({
    validate: (/** @type {any} */ value) => ({ value }),
    validateAsync: async (/** @type {any} */ value) => value,
  }, {
    get: (/** @type {any} */ cible, /** @type {any} */ cle) => (
      cle in cible ? cible[cle] : () => schema
    ),
  });
  const joiDuSite = new Proxy({}, {
    get: (/** @type {any} */ _cible, /** @type {any} */ cle) => (
      cle === 'defaults' ? () => joiDuSite : () => schema
    ),
  });

  return { Joi: joiDuSite };
});

/** @type {any} */
let mockUserData;
/** @type {any} */
let mockOnboardingViews;
/** @type {any[]} */
let mockAuthSessions = [];
const mockLogout = jest.fn();
const mockSwitchAccount = jest.fn();
const mockAddAccount = jest.fn();

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    addAccount: mockAddAccount,
    authSessions: mockAuthSessions,
    getNextOnboardingRoute: () => 'UserAvatar',
    getPostOnboardingHomeRoute: () => 'HomeTab',
    logoutMutation: { isPending: false, mutate: mockLogout },
    onboardingViews: mockOnboardingViews,
    refetchUserData: jest.fn(),
    switchAccount: mockSwitchAccount,
    userData: mockUserData,
    userDataError: null,
    userDataLoading: false,
  }),
}));

// Doublure fidele de react-query : la mutation appelle vraiment sa mutationFn
// puis onSuccess, sinon rien ne partirait sur le reseau.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve()
      .then(() => options.mutationFn(variables))
      .then((/** @type {any} */ data) => options.onSuccess?.(data, variables))
      .catch((/** @type {any} */ error) => options.onError?.(error, variables)),
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    setQueriesData: (/** @type {any[]} */ ...args) => mockSetQueriesData(...args),
  }),
}));

const mockSetQueriesData = jest.fn();

jest.mock('@/services/auth/authService', () => ({
  updateMe: jest.fn(),
}));

// Le champ rend un vrai TextInput qui PORTE son libelle, et n'affiche son
// message d'erreur QUE dans les conditions du vrai Input (`error !== ' '`) :
// sans cette regle, le test croirait visible un message que l'ecran cache.
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TextInput: SaisieRN, View: VueRN } = jest.requireActual('react-native');

  return function InputMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      VueRN,
      null,
      reactActuel.createElement(SaisieRN, {
        accessibilityLabel: props.label || props.placeholder,
        onBlur: props.onBlur,
        onChangeText: props.onChangeText,
        value: props.value,
      }),
      props.error && props.error !== ' '
        ? reactActuel.createElement(TexteRN, null, props.error)
        : null,
    );
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock(
  '@/components/templates/FormScreenContainer',
  () => {
    const reactActuel = jest.requireActual('react');
    const { View: VueRN } = jest.requireActual('react-native');

    return function FormScreenContainerMock(/** @type {any} */ { children }) {
      return reactActuel.createElement(VueRN, null, children);
    };
  },
);

jest.mock(
  '@/views/onboarding/components/OnboardingStateView',
  () => {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN } = jest.requireActual('react-native');

    return function OnboardingStateViewMock(/** @type {any} */ { title }) {
      return reactActuel.createElement(TexteRN, null, title);
    };
  },
);

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

const LIBELLE_CTA = 'Continuer';

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
 * @param {any} enfants - Les enfants React.
 * @returns {string} Le texte visible.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tous les textes visibles de l'ecran.
 * @param {any} arbre - L'arbre rendu.
 * @returns {string[]} Les textes.
 */
const textes = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .filter(Boolean);

/**
 * Le champ portant ce libelle (ou ce placeholder).
 * @param {any} arbre - L'arbre rendu.
 * @param {string} libelle - Le libelle du champ.
 * @returns {any} Le noeud TextInput.
 */
const champ = (arbre, libelle) => arbre.root
  .findAllByType(TextInput)
  .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === libelle);

/**
 * Le pressable portant ce libelle.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} libelle - Le libelle du bouton.
 * @returns {any} Le noeud pressable.
 */
const bouton = (arbre, libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children).includes(libelle));

/**
 * Saisit une valeur puis quitte le champ, comme un utilisateur reel.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} libelle - Le libelle du champ.
 * @param {string} valeur - La valeur saisie.
 * @returns {Promise<void>} Rien.
 */
const saisir = async (arbre, libelle, valeur) => {
  await act(async () => { champ(arbre, libelle).props.onChangeText(valeur); });
  await act(async () => { champ(arbre, libelle).props.onBlur(); });
};

/**
 * Monte l'ecran pour un role donne.
 * @param {string} nomDuRole - Le nom du role cote serveur.
 * @returns {any} L'arbre rendu.
 */
const rendre = (nomDuRole) => {
  mockUserData = {
    documentId: 'user-1',
    firstname: '',
    lastname: '',
    role: { name: nomDuRole },
  };
  mockNavigation = {
    getState: () => ({ routeNames: ['UserName', 'UserAvatar'] }),
    navigate: jest.fn(),
  };

  let arbre;
  act(() => {
    arbre = renderer.create(
      <UserName
        navigation={/** @type {any} */ (mockNavigation)}
        route={/** @type {any} */ ({})}
      />,
    );
  });

  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOnboardingViews = undefined;
  mockAuthSessions = [];
  /** @type {any} */ (updateMe).mockResolvedValue({ documentId: 'user-1' });
});

// FINITIONS18 · POINT 11 — l'ordinateur, a la demande.
let mockOrdinateur = false;
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));

// FINITIONS18 · POINT 11 (tournee T16, site a 1 280 px) — « Qui es-tu ? » : « Continuer » toujours
// pleine largeur (560 px, x = 360). FINITIONS16 21 (planche 8) avait pose la regle « a droite,
// 200 px au moins » sur « Quel est ton statut ? » (UserRole) seulement : le temoin de FINITIONS16
// etait vert, l'ecran mesure par la T16 n'etait pas celui-la. ROUGE avant.
describe('FINITIONS18 11 — « Qui es-tu ? » : « Continuer » a droite sur ordinateur', () => {
  const { Platform, StyleSheet } = jest.requireActual('react-native');
  const osAvant = Platform.OS;
  afterEach(() => {
    Platform.OS = osAvant;
    mockOrdinateur = false;
  });
  // Le style que l ecran DONNE au bouton (la doublure de `Button` ne le transmet pas).
  const styleDonne = (/** @type {any} */ arbre) => arbre.root.findAll(
    (/** @type {any} */ n) => typeof n.type === 'function' && n.props.title === LIBELLE_CTA,
  )[0]?.props.style;

  it('🔴 sur le site, sur ordinateur : a droite, 200 px au moins', () => {
    Platform.OS = 'web';
    mockOrdinateur = true;
    const style = StyleSheet.flatten(styleDonne(rendre('Joueur'))) || {};
    expect(style.alignSelf).toBe('flex-end');
    expect(style.minWidth).toBe(200);
  });

  it('🔒 au telephone : toute la largeur, comme avant', () => {
    mockOrdinateur = true;
    const style = StyleSheet.flatten(styleDonne(rendre('Joueur'))) || {};
    expect(style.alignSelf).toBeUndefined();
  });
});
