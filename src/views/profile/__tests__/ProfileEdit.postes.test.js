import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { POSITIONS_BY_SPORT } from '@/constants/positions';

import ProfileEdit from '../ProfileEdit';
import ProfileEditWeb from '../ProfileEdit.web';

// LOT L44 (E6) — `ProfileEdit.js` (742 lignes) et `ProfileEdit.web.js` (533)
// n'avaient AUCUN test, et tous deux lisaient une SECONDE liste de postes
// (`sportsPositions.js`) qui contredisait celle de l'inscription
// (`constants/positions.js`).
//
// CE QU'IL PROUVE, en langage client : quand un joueur a choisi un poste a
// l'inscription, il le RETROUVE dans son ecran de profil. Aujourd'hui non :
//   - un footballeur « Attaquant » ne retrouve pas son poste (absent de L2) ;
//   - un rugbyman n'a AUCUNE liste (le rugby n'existe pas dans L2) ;
//   - un basketteur voit « Ailier Fort » la ou l'inscription a enregistre
//     « Ailier fort » (16 ecarts de casse entre les deux listes) ;
//   - et le sport tel que l'inscription l'enregistre (`UserSport.js` stocke
//     `activity.name`, donc « Football » avec une majuscule) ne trouve RIEN,
//     parce que le code compare `cle.toLowerCase()` a la valeur BRUTE.
//
// Il est pilote par le TEXTE VISIBLE : les doublures de champs impriment leur
// libelle et leurs options, et toutes les assertions lisent ces chaines. Aucune
// assertion ne porte sur la forme de l'arbre, donc les deux ecrans peuvent etre
// remis en page sans qu'une ligne d'ici ne bouge.
//
// Les DEUX ecrans passent dans le meme tableau : c'est la these du lot — l'app
// et le site doivent proposer la MEME liste.
//
// Le theme et les traductions sont les VRAIS modules : un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02).

/** @type {any} */
let mockUserData;
/** @type {any} */
let mockAuthValue;

const formatBirthdateToDisplay = (/** @type {string} */ valeur) => String(valeur || '');
const formatBirthdateToSend = (/** @type {string} */ valeur) => String(valeur || '');
const getAuthTokens = () => ({ token: 'jeton-test' });

// `react-native-gesture-handler` est publie en TypeScript non transpile et ne
// figure pas dans le `transformIgnorePatterns` du projet : le charger casse Jest
// avant meme le rendu. Seul `ScrollView` est utilise ici, et celui de
// react-native se comporte pareil pour un test — c'est un conteneur.
jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

// Le vrai catalogue de chaines : `t('a.b.c')` descend dans `fr.js`. Une cle
// absente ressort telle quelle, donc une faute de frappe echoue le test — et une
// suppression dans `fr.js` ne peut pas passer inapercue.
jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ), catalogue);
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

// `@/theme/strings` initialise i18next au chargement ; on n'en veut ici que le
// VRAI Joi, qui porte le schema de validation de l'ecran.
jest.mock('@/theme/strings', () => ({ Joi: jest.requireActual('joi') }));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthValue,
}));

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: () => null }),
}));

jest.mock('@/services/auth/authService', () => ({ updateMe: jest.fn() }));
jest.mock('@/services/level/levelQueries', () => ({ useGetLevels: () => ({ data: [] }) }));
jest.mock('@/services/section/sectionQueries', () => ({ useGetSections: () => ({ data: [] }) }));

// AC03 — le sport et la categorie viennent desormais des listes du SERVEUR.
// Sans ces doublures, l'ecran tire le vrai client HTTP et la suite ne se charge
// meme pas (« API_URL is missing »), comme pour les niveaux et les sections.
jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [{ documentId: 'act-1', name: 'Football' }] }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [{ documentId: 'cat-1', name: 'U13 (13 ans)' }] }),
}));

// Le VRAI theme, sans le contexte React qui le porte.
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

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
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
  '@/components/molecules/selectAvatar/SelectAvatar',
  () => function SelectAvatarMock() { return null; },
);
jest.mock(
  '@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard',
  () => function ParentalDeclarationCardMock() { return null; },
);
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => function AutocompleteAddressInputMock() { return null; },
);
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return react.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress },
      react.createElement(TexteRN, null, props.title),
    );
  };
});

// La doublure qui rend le lot lisible : une liste deroulante imprime son libelle
// puis CHAQUE option proposee, prefixee de ce libelle. « [choix] Poste = ... »
// et « [choix] Poste > Attaquant » sont donc du texte visible.
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const react = jest.requireActual('react');
  const { Text: TexteRN, View: VueRN } = jest.requireActual('react-native');
  return function AutocompleteSelectMock(/** @type {any} */ props) {
    const options = Array.isArray(props.options) ? props.options : [];
    return react.createElement(
      VueRN,
      null,
      react.createElement(TexteRN, { key: 'valeur' }, `[choix] ${props.label} = ${props.value || ''}`),
      ...options.map((/** @type {any} */ option, /** @type {number} */ rang) => react.createElement(
        TexteRN,
        { key: `option-${rang}` },
        `[choix] ${props.label} > ${option.label}`,
      )),
    );
  };
});

// Le repli quand aucune liste n'est trouvee : une saisie libre. « [libre] Poste »
// est la signature, a l'ecran, de « ce sport n'a pas de postes ».
jest.mock('@/components/molecules/input/Input', () => {
  const react = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function InputMock(/** @type {any} */ props) {
    return react.createElement(TexteRN, null, `[libre] ${props.label} = ${props.value || ''}`);
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
 * Toutes les chaines visibles a l'ecran.
 * @param {any} arbre
 * @returns {string[]}
 */
const textesDe = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children));

/**
 * Les postes proposes par la liste deroulante « Poste », dans l'ordre.
 * @param {any} arbre
 * @returns {string[]}
 */
const postesProposes = (arbre) => textesDe(arbre)
  .filter((texte) => texte.startsWith('[choix] Poste > '))
  .map((texte) => texte.slice('[choix] Poste > '.length));

/**
 * L'ecran demande-t-il le poste en SAISIE LIBRE, faute de liste ?
 * @param {any} arbre
 * @returns {boolean}
 */
const posteEnSaisieLibre = (arbre) => textesDe(arbre)
  .some((texte) => texte.startsWith('[libre] Poste'));

const ECRANS = [
  { Ecran: ProfileEdit, nom: 'app' },
  { Ecran: ProfileEditWeb, nom: 'site' },
];

/**
 * Monte l'ecran d'edition du profil pour un joueur donne.
 * @param {any} Ecran
 * @param {{position?: string, preferredSport?: string}} profil
 * @returns {Promise<any>}
 */
const monterEcran = async (Ecran, profil) => {
  mockUserData = {
    documentId: 'user-doc-1',
    firstname: 'Zinedine',
    lastname: 'Zidane',
    phoneNumber: '+33600000000',
    role: { name: 'Joueur', type: 'joueur' },
    ...profil,
  };
  // Objet FIGE : un double de contexte recree a chaque rendu envoie Jest en
  // boucle infinie, sans message (constat du lot L03).
  mockAuthValue = {
    formatBirthdateToDisplay,
    formatBirthdateToSend,
    getAuthTokens,
    profileFields: ['firstname', 'lastname', 'birthdate', 'position', 'preferredSport'],
    refetchUserData: jest.fn(),
    userData: mockUserData,
    userDataError: null,
    userDataLoading: false,
  };

  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <Ecran
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() }}
        route={{ params: {} }}
      />,
    );
  });
  return arbre;
};

describe.each(ECRANS)('L44 — un poste, une seule liste ($nom)', ({ Ecran }) => {
  test('un footballeur « Attaquant » retrouve son poste dans la liste', async () => {
    const arbre = await monterEcran(Ecran, { position: 'Attaquant', preferredSport: 'football' });

    expect(postesProposes(arbre)).toContain('Attaquant');
  });

  test('la liste football est EXACTEMENT celle de l inscription (11 postes)', async () => {
    const arbre = await monterEcran(Ecran, { position: 'Attaquant', preferredSport: 'football' });

    expect(postesProposes(arbre)).toEqual(POSITIONS_BY_SPORT.football.map((poste) => poste.label));
  });

  test('un rugbyman a une liste de postes, pas une case a remplir', async () => {
    const arbre = await monterEcran(Ecran, { position: 'Demi de mêlée', preferredSport: 'rugby' });

    expect(postesProposes(arbre)).toEqual(POSITIONS_BY_SPORT.rugby.map((poste) => poste.label));
    expect(posteEnSaisieLibre(arbre)).toBe(false);
  });

  // `UserSport.js` enregistre `activity.name` tel que Strapi le nomme, donc
  // « Football » avec une majuscule. Les deux ecrans comparaient
  // `cle.toLowerCase()` a cette valeur BRUTE : aucun sport ne pouvait matcher.
  test('le sport ecrit comme l inscription l enregistre (« Football ») trouve sa liste', async () => {
    const arbre = await monterEcran(Ecran, { position: 'Attaquant', preferredSport: 'Football' });

    expect(postesProposes(arbre)).toContain('Attaquant');
    expect(posteEnSaisieLibre(arbre)).toBe(false);
  });

  // 16 ecarts de casse separaient les deux listes. Celui-ci est le temoin :
  // l'inscription enregistre « Ailier fort », l'edition proposait « Ailier Fort ».
  test('la casse est celle de l inscription : « Ailier fort », pas « Ailier Fort »', async () => {
    const arbre = await monterEcran(Ecran, { position: 'Ailier fort', preferredSport: 'basketball' });

    expect(postesProposes(arbre)).toContain('Ailier fort');
    expect(postesProposes(arbre)).not.toContain('Ailier Fort');
  });

  // Un sport sans postes doit TOUJOURS retomber sur la saisie libre : c'est le
  // comportement d'origine, et le lot ne le change pas.
  test('un sport sans postes garde la saisie libre', async () => {
    const arbre = await monterEcran(Ecran, { position: 'Ailier', preferredSport: 'padel' });

    expect(postesProposes(arbre)).toEqual([]);
    expect(posteEnSaisieLibre(arbre)).toBe(true);
  });
});
