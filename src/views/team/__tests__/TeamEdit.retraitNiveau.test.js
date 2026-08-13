import renderer, { act } from 'react-test-renderer';

import TeamEdit from '../TeamEdit';

// R03 (E6) — RETIRER LE NIVEAU D'UNE EQUIPE FERMAIT L'APP.
//
// Constat d'Adel, 2026-08-13 : « quand je vais dans "modifier mon equipe" et
// que je deselectionne le niveau, j'appuie sur enregistrer, ca fait crasher
// l'app direct » — `BOOT_GLOBAL_JS_ERROR / TypeError / Cannot read property
// 'value' of undefined`.
//
// `TeamEdit.js` n'avait AUCUN test. Le filet frere
// `AutocompleteSelect.deselection.test.js` prouve le contrat : en
// mono-selection, retirer le choix courant fait remonter `undefined` a
// l'appelant. Ici on branche ce contrat sur l'ecran : la doublure du selecteur
// rend la fonction `setValue` que l'ecran lui confie, et on l'appelle avec
// exactement ce que le vrai composant enverrait.
//
// Les trois champs « profil sportif » de cet ecran (sport, categorie, niveau)
// lisaient `option.value` sans garde. Un seul d'entre eux a ete signale ; les
// trois plantaient.
//
// ⚠️ CE QU'IL NE PROUVE PAS : que le formulaire ACCEPTE d'etre enregistre sans
// niveau. Le schema Joi de l'ecran declare `level` obligatoire — c'est une
// question de produit, pas un crash, et elle est remontee a part.

const mockMutate = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockSelecteurs = new Map();

const NIVEAUX = [
  { documentId: 'niveau-1', name: 'Departemental' },
  { documentId: 'niveau-2', name: 'Regional' },
];
const CATEGORIES = [
  { documentId: 'categorie-1', name: 'U15' },
];
const SPORTS = [
  { documentId: 'sport-1', name: 'Football' },
];
const SECTIONS = [
  { documentId: 'section-1', name: 'Masculine' },
];

const EQUIPE = {
  activities: [SPORTS[0]],
  authorizedMembershipManagers: [],
  category: CATEGORIES[0],
  city: 'Lyon',
  club: { documentId: 'club-1' },
  description: '',
  documentId: 'equipe-1',
  geohash: '',
  level: NIVEAUX[1],
  name: 'Seniors A',
  section: SECTIONS[0],
  teamMembershipApprovalEnabledForCoaches: true,
  trainers: [],
};

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: mockMutate }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      return cle;
    },
  }),
}));

// Le vrai Joi, sans le bootstrap i18next que '@/theme/strings' declenche a
// l'import (il chargerait fr.js, tenu par un autre lot).
jest.mock('@/theme/strings', () => ({ Joi: jest.requireActual('joi') }));

jest.mock('@/theme/themeContext', () => {
  const feuilleDeStyle = {};
  const rampe = () => new Proxy({}, { get: () => feuilleDeStyle });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => feuilleDeStyle }),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: rampe(),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'moi', role: { name: 'Dirigeant' } } }),
}));

// ⚠️ Chaque doublure rend TOUJOURS LE MEME OBJET. Une doublure qui reconstruit
// son resultat a chaque rendu change l'identite de `clubData`/`teamData`, ce qui
// relance le `reset()` de l'ecran, donc un rendu, donc un `reset()`... et Jest
// s'arrete sur « Maximum update depth exceeded » sans jamais atteindre le test.
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeam: () => mockReponse('equipe'),
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => mockReponse('club'),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => mockReponse('sports'),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => mockReponse('categories'),
}));
jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => mockReponse('niveaux'),
}));
jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => mockReponse('sections'),
}));

jest.mock('@/services/team/teamService', () => ({
  createTeam: jest.fn(),
  deleteTeam: jest.fn(),
  updateTeam: jest.fn(),
}));

// La doublure du selecteur ne dessine rien : elle EXPOSE la fonction que
// l'ecran lui confie, pour qu'on l'appelle comme le vrai composant le ferait.
jest.mock(
  '@/components/molecules/autocompleteSelect/AutocompleteSelect',
  () => function AutocompleteSelectMock(/** @type {any} */ props) {
    mockRegistreSelecteur(props);
    return null;
  },
);

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      {
        disabled: props.disabled || props.isLoading,
        onPress: props.onPress,
        testID: `bouton-${props.title}`,
      },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});
jest.mock('@/components/molecules/input/Input', () => function InputMock() {
  return null;
});
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() {
    return null;
  },
);
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => function AutocompleteAddressInputMock() {
    return null;
  },
);
jest.mock(
  '@/components/organisms/createTrainerModal/CreateTrainerModal',
  () => function CreateTrainerModalMock() {
    return null;
  },
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual('react-native').View,
}));

const CLUB = { city: 'Lyon', documentId: 'club-1', geohash: 'u05' };

/**
 * Les reponses des requetes, construites UNE FOIS pour toutes.
 * @type {Record<string, any>}
 */
const REPONSES = {
  categories: CATEGORIES,
  club: CLUB,
  equipe: EQUIPE,
  niveaux: NIVEAUX,
  sections: SECTIONS,
  sports: SPORTS,
};
const ENVELOPPES = Object.fromEntries(
  Object.entries(REPONSES).map(([cle, donnees]) => [
    cle,
    {
      data: donnees, error: null, isLoading: false, refetch: jest.fn(),
    },
  ]),
);

// Les doublures de `jest.mock` sont hissees avant les constantes : ces fonctions
// (prefixees `mock`, seule forme que Jest laisse traverser) les lisent au moment
// du rendu, quand elles existent.
global.mockReponse = (/** @type {string} */ cle) => ENVELOPPES[cle];
global.mockRegistreSelecteur = (/** @type {any} */ props) => {
  mockSelecteurs.set(props.label, props);
};

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  setOptions: jest.fn(),
};

/**
 * Monte l'ecran « modifier mon equipe ».
 * @returns {any} L'arbre monte.
 */
const monter = () => {
  let arbre;
  act(() => {
    arbre = renderer.create(
      <TeamEdit
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params: { teamId: 'equipe-1' } })}
      />,
    );
  });
  return arbre;
};

/**
 * Rend la fonction que l'ecran a confiee au selecteur d'un champ.
 * @param {string} champ Le nom du champ (`level`, `category`, `activities`...).
 * @returns {Function} La fonction `setValue` du selecteur.
 */
const setValueDu = (champ) => {
  const props = mockSelecteurs.get(`teamEdit.fields.${champ}.label`);
  if (!props) throw new Error(`Selecteur introuvable pour le champ « ${champ} »`);
  return props.setValue;
};

/**
 * @param {string} champ Le nom du champ.
 * @returns {any} Ce que le selecteur affiche pour ce champ.
 */
const valeurAfficheeDu = (champ) => mockSelecteurs.get(`teamEdit.fields.${champ}.label`).value;

describe('R03 · TeamEdit — retirer le niveau de l equipe', () => {
  beforeEach(() => {
    mockSelecteurs.clear();
    mockMutate.mockClear();
  });

  it('temoin 1 — retirer le niveau ne ferme plus l app', () => {
    monter();
    expect(valeurAfficheeDu('level')).toBe('Regional');

    // Exactement ce que `AutocompleteSelect` envoie quand on deselectionne
    // (prouve par AutocompleteSelect.deselection.test.js, temoin 1).
    expect(() => {
      act(() => {
        setValueDu('level')(undefined);
      });
    }).not.toThrow();

    expect(valeurAfficheeDu('level')).toBe('');
  });

  it('temoin 2 — choisir un niveau marche toujours', () => {
    monter();

    act(() => {
      setValueDu('level')({ label: 'Departemental', value: 'niveau-1' });
    });

    expect(valeurAfficheeDu('level')).toBe('Departemental');
  });

  it('temoin 3 — retirer puis remettre un niveau marche', () => {
    monter();

    act(() => {
      setValueDu('level')(undefined);
    });
    expect(valeurAfficheeDu('level')).toBe('');

    act(() => {
      setValueDu('level')({ label: 'Regional', value: 'niveau-2' });
    });
    expect(valeurAfficheeDu('level')).toBe('Regional');
  });

  it.each([
    ['la categorie', 'category', 'U15'],
    ['le sport', 'activities', 'Football'],
  ])('temoin 4 — retirer %s ne ferme pas l app non plus', (_libelle, champ, valeurDepart) => {
    monter();
    expect(valeurAfficheeDu(champ)).toBe(valeurDepart);

    expect(() => {
      act(() => {
        setValueDu(champ)(undefined);
      });
    }).not.toThrow();

    expect(valeurAfficheeDu(champ)).toBe('');
  });

  it('temoin 5 — le champ voisin deja protege (section) se comporte pareil', () => {
    monter();

    expect(() => {
      act(() => {
        setValueDu('section')(null);
      });
    }).not.toThrow();

    expect(valeurAfficheeDu('section')).toBe('');
  });
});
