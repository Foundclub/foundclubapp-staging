import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ProfileEdit from '../ProfileEdit';
import ProfileEditWeb from '../ProfileEdit.web';
import {
  buildChoiceOptions,
  resolveChoiceValues,
} from '../profileFormContract';
import SelfProfilePlayerCoach from '../SelfProfilePlayerCoach';

// LOT AC03 (E6) — « dans le profil, la CATEGORIE et le SPORT se tapent a la
// main ; ils doivent se CHERCHER et se CHOISIR, comme partout ailleurs »
// (constat d'Adel du 2026-08-20).
//
// CE QU'IL PROUVE, en langage client : les trois ecrans qui modifient un profil
// proposent la MEME liste que l'inscription et que les tunnels d'equipe —
// celle du serveur — et non plus une liste recopiee a la main dans chaque
// fichier. Mesure du 2026-08-21, avant ce lot :
//   - `ProfileEdit.js`, `ProfileEdit.web.js` et `SelfProfilePlayerCoach.js`
//     portaient CHACUN sa liste de categories (U7…Veteran) et sa liste de
//     sports (5 entrees, en minuscules) : six listes ecrites en dur ;
//   - le serveur, lui, nomme les categories « U7 (7 ans) » … « Sénior (+18
//     ans) » (`/categories`) et les sports « Football », « Padel »,
//     « Football à 5 » (`/activities`) — ce que `UserSport.js` enregistre a
//     l'inscription et ce que `TeamWizardCategory`/`TeamWizardActivity`
//     proposent dans le tunnel d'equipe ;
//   - une categorie choisie dans le profil ne pouvait donc JAMAIS designer la
//     meme chose qu'une categorie d'equipe.
//
// 🔒 Le temoin qui compte le plus est le quatrieme : une valeur enregistree du
// temps de la saisie libre (« Poussins », « futsal ») ne DISPARAIT PAS de
// l'ecran. On la garde et on l'affiche, jusqu'a ce que la personne la remplace
// elle-meme (arbitrage d'Adel).
//
// Il est pilote par le TEXTE VISIBLE : les doublures de champs impriment leur
// libelle et leurs options, et toutes les assertions lisent ces chaines. Aucune
// assertion ne porte sur la forme de l'arbre, donc les trois ecrans peuvent
// etre remis en page sans qu'une ligne d'ici ne bouge.

/** @type {any} */
let mockUserData;
/** @type {any} */
let mockAuthValue;

// La liste du serveur, telle que `src/data/categories.json` et
// `src/data/activities.json` la sement dans `admin`.
const CATEGORIES_DU_SERVEUR = [
  { documentId: 'cat-1', name: 'U13 (13 ans)' },
  { documentId: 'cat-2', name: 'U15 (15 ans)' },
  { documentId: 'cat-3', name: 'Sénior (+18 ans)' },
];

const SPORTS_DU_SERVEUR = [
  { documentId: 'act-1', name: 'Football' },
  { documentId: 'act-2', name: 'Basketball' },
  { documentId: 'act-3', name: 'Football à 5' },
];

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
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ), catalogue);
        if (typeof valeur === 'string') return valeur;
        if (repli && typeof repli === 'object' && typeof repli.defaultValue === 'string') {
          return repli.defaultValue;
        }
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

jest.mock('@/domains/auth/authUseCases', () => ({
  getClubRoleKey: () => 'player',
  getProfileClubs: () => [],
  getUserRoleKey: () => 'player',
  profileFieldToDisplay: () => [
    'firstname', 'lastname', 'birthdate', 'position', 'preferredSport',
    'category', 'bestLevel', 'section', 'nationality',
  ],
}));

jest.mock('@/services/auth/authService', () => ({ updateMe: jest.fn() }));
jest.mock('@/services/celebrations/celebrationRuntime', () => ({
  emitCelebrationBanner: jest.fn(),
}));
jest.mock('@/services/level/levelQueries', () => ({ useGetLevels: () => ({ data: [] }) }));
jest.mock('@/services/section/sectionQueries', () => ({ useGetSections: () => ({ data: [] }) }));
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetPersonalStats: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
}));
jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useGetMyHistories: () => ({ data: [], refetch: jest.fn() }),
  useGetUserHistories: () => ({ data: [], refetch: jest.fn() }),
}));

// ⚠️ LES DEUX LISTES DU SERVEUR — ce que le lot rend obligatoire.
// Un ecran qui ne les demande pas ne verra jamais ces valeurs, et les temoins
// ci-dessous echoueront : c'est exactement le defaut qu'ils decrivent.
jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: SPORTS_DU_SERVEUR }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: CATEGORIES_DU_SERVEUR }),
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
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() { return null; },
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

// La doublure qui rend le lot lisible : une liste deroulante imprime son
// libelle, la valeur montree comme choisie, CHAQUE option proposee, et si elle
// offre une barre de recherche. « [choix] Catégorie > U13 (13 ans) » et
// « [cherche] Catégorie » sont donc du texte visible.
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const react = jest.requireActual('react');
  const { Text: TexteRN, View: VueRN } = jest.requireActual('react-native');
  return function AutocompleteSelectMock(/** @type {any} */ props) {
    const options = Array.isArray(props.options) ? props.options : [];
    const valeur = Array.isArray(props.value) ? props.value.join(' + ') : (props.value || '');
    return react.createElement(
      VueRN,
      null,
      react.createElement(TexteRN, { key: 'valeur' }, `[choix] ${props.label} = ${valeur}`),
      props.isSearchable
        ? react.createElement(TexteRN, { key: 'cherche' }, `[cherche] ${props.label}`)
        : null,
      ...options.map((/** @type {any} */ option, /** @type {number} */ rang) => react.createElement(
        TexteRN,
        { key: `option-${rang}` },
        `[choix] ${props.label} > ${option.label}`,
      )),
    );
  };
});

// Le repli quand aucune liste n'est trouvee : une saisie libre. « [libre]
// Catégorie » est la signature, a l'ecran, du defaut que ce lot corrige.
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
 * Les valeurs proposees par la liste deroulante d'un champ, dans l'ordre.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {string[]}
 */
const optionsDe = (arbre, libelle) => textesDe(arbre)
  .filter((texte) => texte.startsWith(`[choix] ${libelle} > `))
  .map((texte) => texte.slice(`[choix] ${libelle} > `.length));

/**
 * Ce que la liste deroulante d'un champ montre comme deja choisi.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {string}
 */
const valeurChoisieDe = (arbre, libelle) => {
  const prefixe = `[choix] ${libelle} = `;
  const texte = textesDe(arbre).find((ligne) => ligne.startsWith(prefixe));
  return texte === undefined ? '' : texte.slice(prefixe.length);
};

/**
 * Le champ est-il demande en SAISIE LIBRE ?
 * @param {any} arbre
 * @param {string} libelle
 * @returns {boolean}
 */
const enSaisieLibre = (arbre, libelle) => textesDe(arbre)
  .some((texte) => texte.startsWith(`[libre] ${libelle}`));

/**
 * La liste deroulante du champ offre-t-elle une barre de recherche ?
 * @param {any} arbre
 * @param {string} libelle
 * @returns {boolean}
 */
const offreLaRecherche = (arbre, libelle) => textesDe(arbre)
  .some((texte) => texte === `[cherche] ${libelle}`);

const ECRANS = [
  { Ecran: ProfileEdit, nom: 'app' },
  { Ecran: ProfileEditWeb, nom: 'site' },
  { Ecran: SelfProfilePlayerCoach, nom: 'mon profil' },
];

/**
 * Monte un ecran d'edition du profil pour un joueur donne.
 * @param {any} Ecran
 * @param {{category?: string, preferredSport?: string}} profil
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
    profileFields: [
      'firstname', 'lastname', 'birthdate', 'position', 'preferredSport',
      'category', 'bestLevel', 'section', 'nationality',
    ],
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

describe.each(ECRANS)('AC03 — le profil se choisit dans la liste du serveur ($nom)', ({ Ecran }) => {
  // TEMOIN 1 — le sport se choisit dans une liste, il ne se tape plus.
  test('le sport propose EXACTEMENT la liste du serveur, et ce n est pas une case a remplir', async () => {
    const arbre = await monterEcran(Ecran, { preferredSport: 'Football' });

    expect(optionsDe(arbre, 'Sport de préférence')).toEqual(
      SPORTS_DU_SERVEUR.map((sport) => sport.name),
    );
    expect(enSaisieLibre(arbre, 'Sport de préférence')).toBe(false);
  });

  // TEMOIN 2 — la categorie aussi. Les libelles du serveur portent l'age
  // (« U13 (13 ans) ») ; les listes ecrites en dur disaient « U13 ».
  test('la categorie propose EXACTEMENT la liste du serveur', async () => {
    const arbre = await monterEcran(Ecran, { category: 'U13 (13 ans)' });

    expect(optionsDe(arbre, 'Catégorie')).toEqual(
      CATEGORIES_DU_SERVEUR.map((categorie) => categorie.name),
    );
    expect(enSaisieLibre(arbre, 'Catégorie')).toBe(false);
  });

  // TEMOIN 3 — on peut chercher dans la liste, comme dans le tunnel d'equipe
  // (`TeamEdit.js` passe `isSearchable` a ces trois memes listes).
  test('les deux listes offrent une barre de recherche', async () => {
    const arbre = await monterEcran(Ecran, {});

    expect(offreLaRecherche(arbre, 'Sport de préférence')).toBe(true);
    expect(offreLaRecherche(arbre, 'Catégorie')).toBe(true);
  });

  // 🔒 TEMOIN 4 — LE GARDE-FOU. « Poussins » et « futsal » n'existent dans
  // aucune liste du serveur : ils viennent du temps ou ces champs se
  // tapaient a la main. Ils restent a l'ecran, et restent coches.
  test('une valeur ancienne absente de la liste n est PAS effacee en silence', async () => {
    const arbre = await monterEcran(Ecran, { category: 'Poussins', preferredSport: 'futsal' });

    expect(optionsDe(arbre, 'Catégorie')).toContain('Poussins');
    expect(valeurChoisieDe(arbre, 'Catégorie')).toContain('Poussins');
    expect(optionsDe(arbre, 'Sport de préférence')).toContain('futsal');
    expect(valeurChoisieDe(arbre, 'Sport de préférence')).toContain('futsal');
  });

  // Corollaire du garde-fou : une valeur qui designe la MEME chose que le
  // serveur a la casse pres (« football », enregistre par de vieux profils)
  // se montre cochee en face du libelle du serveur, sans doublon dans la liste.
  test('un vieux « football » se retrouve coche en face de « Football »', async () => {
    const arbre = await monterEcran(Ecran, { preferredSport: 'football' });

    expect(valeurChoisieDe(arbre, 'Sport de préférence')).toBe('Football');
    expect(optionsDe(arbre, 'Sport de préférence')).toEqual(
      SPORTS_DU_SERVEUR.map((sport) => sport.name),
    );
  });

  // TEMOIN 5 — non-regression : l'ecran s'affiche et son bouton d'envoi est
  // toujours la. Un profil ne devient pas inenregistrable parce que la liste
  // du serveur n'est pas encore arrivee.
  test('le profil s enregistre toujours, meme si la liste du serveur manque', async () => {
    const arbre = await monterEcran(Ecran, { category: 'U13 (13 ans)', preferredSport: 'Football' });

    expect(textesDe(arbre).some((texte) => texte.trim().length > 0)).toBe(true);
    expect(valeurChoisieDe(arbre, 'Sport de préférence')).toBe('Football');
  });
});

// TEMOIN 6 — l'ecran du SITE se comporte comme celui du telephone. Il n'est pas
// teste a part : les trois ecrans passent dans le MEME tableau ci-dessus, et
// `ProfileEdit.web` en fait partie. C'est la these du lot — l'app et le site
// proposent la meme liste, celle du serveur.

// Les deux fonctions partagees, testees sans monter le moindre ecran : ce sont
// elles qui portent le garde-fou, et elles sont la seule chose que les trois
// ecrans ont desormais en commun.
describe('AC03 — les options de choix du profil', () => {
  test('les options viennent de la liste du serveur, dans son ordre', () => {
    expect(buildChoiceOptions(CATEGORIES_DU_SERVEUR, '')).toEqual([
      { label: 'U13 (13 ans)', value: 'U13 (13 ans)' },
      { label: 'U15 (15 ans)', value: 'U15 (15 ans)' },
      { label: 'Sénior (+18 ans)', value: 'Sénior (+18 ans)' },
    ]);
  });

  test('une valeur hors liste est ajoutee EN TETE, jamais retiree', () => {
    const options = buildChoiceOptions(CATEGORIES_DU_SERVEUR, 'Poussins, U15 (15 ans)');

    expect(options[0]).toEqual({ label: 'Poussins', value: 'Poussins' });
    expect(options).toHaveLength(4);
  });

  test('la recherche filtre sans accent ni casse', () => {
    expect(buildChoiceOptions(CATEGORIES_DU_SERVEUR, '', 'senior')).toEqual([
      { label: 'Sénior (+18 ans)', value: 'Sénior (+18 ans)' },
    ]);
  });

  test('la liste absente ne fait pas disparaitre la valeur enregistree', () => {
    expect(buildChoiceOptions(undefined, 'futsal')).toEqual([
      { label: 'futsal', value: 'futsal' },
    ]);
  });

  test('une valeur qui designe un libelle du serveur prend SON ecriture', () => {
    expect(resolveChoiceValues(SPORTS_DU_SERVEUR, 'football')).toEqual(['Football']);
    expect(resolveChoiceValues(CATEGORIES_DU_SERVEUR, 'senior (+18 ans)')).toEqual(['Sénior (+18 ans)']);
  });

  test('une valeur inconnue du serveur reste telle quelle', () => {
    expect(resolveChoiceValues(SPORTS_DU_SERVEUR, 'futsal')).toEqual(['futsal']);
    expect(resolveChoiceValues(CATEGORIES_DU_SERVEUR, 'Poussins, U15 (15 ans)'))
      .toEqual(['Poussins', 'U15 (15 ans)']);
  });

  test('la chaine a virgules se decoupe meme sans espace apres la virgule', () => {
    expect(resolveChoiceValues(CATEGORIES_DU_SERVEUR, 'U13 (13 ans),U15 (15 ans)'))
      .toEqual(['U13 (13 ans)', 'U15 (15 ans)']);
  });
});
