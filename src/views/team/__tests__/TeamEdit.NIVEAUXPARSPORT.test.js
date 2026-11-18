import renderer, { act } from 'react-test-renderer';

import TeamEdit from '../TeamEdit';

// NIVEAUX-PAR-SPORT (17/11/2026) — echafaudage repris de TeamEdit.retraitNiveau.test.js.

// Le rangement reel (compareLevels) charge le service, qui charge le client HTTP.
jest.mock('@/services/client', () => ({ __esModule: true, default: { get: jest.fn() } }));

const mockMutate = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockSelecteurs = new Map();

// Forme rendue par le serveur (controleur level.find) : chaque niveau porte ses sports relies.
// Rangee comme getLevels la rend (compareLevels).
const NIVEAUX = [
  { activities: [], documentId: 'niveau-1', name: 'Departemental' },
  { activities: [], documentId: 'niveau-2', name: 'Regional' },
  {
    activities: [{ documentId: 'sport-speleo' }],
    documentId: 'niveau-s3',
    name: '3 - Confirmé',
    rank: 3,
  },
  {
    activities: [{ documentId: 'sport-speleo' }],
    documentId: 'niveau-s1',
    name: '1 - Débutant',
    rank: 1,
  },
].sort(jest.requireActual('@/services/level/levelService').compareLevels);
const CATEGORIES = [
  { documentId: 'categorie-1', name: 'U15' },
];
const SPORTS = [
  { documentId: 'sport-1', name: 'Football' },
  { documentId: 'sport-speleo', name: 'Spéléologie' },
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
  level: NIVEAUX.find((niveau) => niveau.documentId === 'niveau-2'),
  name: 'Seniors A',
  section: SECTIONS[0],
  teamMembershipApprovalEnabledForCoaches: true,
  trainers: [],
};

// FINITIONS14 — la doublure GARDE les options de chaque mutation (`onSuccess` compris),
// pour que le temoin du point 3 rejoue ce que fait l'ecran apres « Enregistrer ».
const mockOptionsMutations = [];
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => {
    mockOptionsMutations.push(options);
    return { isPending: false, mutate: mockMutate };
  },
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
  useGetTeam: () => global.mockReponse('equipe'),
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => global.mockReponse('club'),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => global.mockReponse('sports'),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => global.mockReponse('categories'),
}));
jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => global.mockReponse('niveaux'),
}));
jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => global.mockReponse('sections'),
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
    global.mockRegistreSelecteur(props);
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
 * Selectionne une valeur dans le champ nomme.
 * @param {string} champ Le nom du champ.
 * @returns {any} Ce que le selecteur affiche pour ce champ.
 */
const valeurAfficheeDu = (champ) => mockSelecteurs.get(`teamEdit.fields.${champ}.label`).value;

/**
 * Les libelles proposes par le selecteur de niveau.
 * @returns {string[]} Les libelles, dans l'ordre.
 */
const niveauxProposes = () => mockSelecteurs.get('teamEdit.fields.level.label').options.map(
  (/** @type {any} */ option) => option.label,
);

describe('NIVEAUX-PAR-SPORT · TeamEdit — les niveaux proposes suivent le sport', () => {
  beforeEach(() => {
    mockSelecteurs.clear();
  });

  it('equipe de Football : les niveaux de competition, sans ceux de la speleo', () => {
    monter();
    expect(niveauxProposes()).toEqual(['Departemental', 'Regional']);
  });

  it('passer le sport a Speleologie : seulement ses niveaux, dans l ordre du rang', () => {
    monter();
    act(() => {
      setValueDu('activities')({ label: 'Spéléologie', value: 'sport-speleo' });
    });
    expect(niveauxProposes()).toEqual(['1 - Débutant', '3 - Confirmé']);
  });

  it('le niveau deja pose reste affiche, meme s il sort de la liste du nouveau sport', () => {
    monter();
    act(() => {
      setValueDu('activities')({ label: 'Spéléologie', value: 'sport-speleo' });
    });
    expect(valeurAfficheeDu('level')).toBe('Regional');
  });
});
