import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { createFacility, updateFacility } from '@/services/facility/facilityService';

import FacilityForm from '../FacilityForm';

// I18N-4 : le code teste lit certains textes par i18next hors composant. react-i18next
// reste double ; i18next lui-meme est initialise sur le VRAI fr.js, en francais, sans
// rien changer a ce que le temoin affirme.
const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

// COLL1D (29/09) — les types d installation des mairies (SPEC D28, « 2- oui ») dans le
// formulaire du CLUB et dans celui de la MAIRIE (le meme ecran, lot 1c). Les 5 types
// d avant restent en tete, tels quels (des lignes existent) ; le libelle suit la langue,
// la VALEUR envoyee est celle du serveur (facility/schema.json). ROUGE avant le lot : 5 types.
//
// Harnais repris de FacilityForm.test.js (memes doublures).

/** @type {any[]} */
const mockButtonProps = [];
/** @type {any[]} */
const mockInputProps = [];
/** @type {any[]} */
const mockAddressProps = [];
/** @type {any[]} */
const mockPaywallProps = [];
/** @type {any[]} */
const mockSegmentedProps = [];

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockRoute;
/** @type {any} */
let mockFacilityQuery;
/** @type {any} */
let mockUserData;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend
// les echecs Jest illisibles (constat du lot paywall, 2026-08-02), et un objet
// invente masquerait un jeton absent. `Images` est le seul element stub, pour
// ne pas faire dependre ce test de la resolution des fichiers d'assets.
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
      Images: { pin: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/facility/facilityQueries', () => ({
  useGetFacility: () => mockFacilityQuery,
}));

// COLL1C — le mode collectivite relit l installation dans la liste de la collectivite et
// enregistre par la route du gestionnaire.
/** @type {any} */
let mockCollectiviteInstallations = {
  data: undefined, error: null, isLoading: false, refetch: jest.fn(),
};
const mockSaveCollectivite = jest.fn();
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => mockCollectiviteInstallations,
  useSaveCollectiviteInstallation: () => ({ mutateAsync: mockSaveCollectivite }),
}));

jest.mock('@/services/facility/facilityService', () => ({
  createFacility: jest.fn(),
  updateFacility: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});

// Le bouton est rendu comme un vrai element pressable portant son libelle :
// c'est ce qui permet aux tests d'appuyer « sur le texte », que le libelle soit
// porte par un Button (avant) ou par un TouchableOpacity (apres).
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    mockButtonProps.push(props);
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock('@/components/molecules/input/Input', () => function InputMock(/** @type {any} */ props) {
  mockInputProps.push(props);
  return null;
});

jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => function AutocompleteAddressInputMock(/** @type {any} */ props) {
    mockAddressProps.push(props);
    return null;
  },
);

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock(/** @type {any} */ props) {
    mockPaywallProps.push(props);
    return null;
  },
);

// Doublure fidele du controle segmente partage : meme contrat (options / value /
// onChange), meme forme rendue (un pressable portant le libelle). Elle existe
// pour que la refonte D2 puisse l'adopter sans que ce fichier change.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN,
    TouchableOpacity: PressableRN,
    View: VueRN,
  } = jest.requireActual('react-native');

  return function SegmentedControlMock(/** @type {any} */ props) {
    const { onChange, options, value } = props;
    mockSegmentedProps.push(props);
    return reactActuel.createElement(
      VueRN,
      null,
      (options || []).map((/** @type {any} */ option) => reactActuel.createElement(
        PressableRN,
        {
          accessibilityState: { selected: option.value === value },
          key: option.value,
          onPress: () => onChange(option.value),
        },
        reactActuel.createElement(TexteRN, null, option.label),
      )),
    );
  };
});

// Adresse telle que la rend reellement l'autocomplete BAN : les coordonnees
// vivent dans `value`, sous la forme « lng|lat ».
const ADRESSE_GEOCODEE = {
  label: '3 Boulevard Michelet 13008 Marseille',
  value: '5.395|43.269',
};

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
 * Priorite au texte EXACT (« - » ne doit pas attraper une phrase qui contient
 * un tiret) ; a defaut, le pressable le plus profond qui le contient.
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
 * Dernieres props recues par une doublure.
 * @param {any[]} journal
 * @returns {any}
 */
const dernieresProps = (journal) => journal[journal.length - 1];

/**
 * Monte l'ecran.
 * @param {{ facility?: any, params?: any }} [options]
 * @returns {Promise<any>}
 */
const monterEcran = async (options = {}) => {
  mockRoute = { params: options.params || {} };
  mockFacilityQuery = {
    data: options.facility || null,
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  };

  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<FacilityForm />);
  });
  return arbre;
};

/**
 * Saisit le nom de l'installation.
 * @param {string} valeur
 * @returns {Promise<void>}
 */
const saisirNom = async (valeur) => {
  const champ = dernieresProps(mockInputProps);
  await act(async () => {
    champ.onChangeText(valeur);
  });
};

/**
 * Choisit une adresse dans l'autocomplete.
 * @param {any} adresse
 * @returns {Promise<void>}
 */
const choisirAdresse = async (adresse) => {
  const champ = dernieresProps(mockAddressProps);
  await act(async () => {
    champ.setAddress(adresse);
  });
};

/**
 * Remplit le minimum valide : un nom et une adresse geocodee.
 * @returns {Promise<void>}
 */
const remplirLeMinimumValide = async () => {
  await saisirNom('Terrain Honneur');
  await choisirAdresse(ADRESSE_GEOCODEE);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockButtonProps.length = 0;
  mockInputProps.length = 0;
  mockAddressProps.length = 0;
  mockPaywallProps.length = 0;
  mockSegmentedProps.length = 0;

  mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
  mockUserData = { club: { documentId: 'club-1' } };

  /** @type {any} */ (createFacility).mockResolvedValue({ data: { documentId: 'fac-9' } });
  /** @type {any} */ (updateFacility).mockResolvedValue({ data: { documentId: 'fac-9' } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  /** @type {any} */ (Alert.alert).mockRestore?.();
});

const LIBELLES_ATTENDUS = [
  'Terrain', 'Gymnase', 'Salle vidéo', 'Vestiaire', 'Club House',
  'Dojo', 'Piste d’athlétisme', 'Terrain de rugby', 'Piscine', 'Court de tennis', 'Salle de sport',
  'Terrain multisport', 'Skatepark',
];

/**
 * Les pastilles du champ « Type », dans l'ordre de rendu (dernier rendu).
 * @returns {string[]}
 */
const pastillesDeType = () => {
  const titres = mockButtonProps.map((props) => props.title);
  const debut = titres.lastIndexOf('Terrain');
  return debut < 0 ? [] : titres.slice(debut, debut + LIBELLES_ATTENDUS.length);
};

describe('COLL1D — les types d installation des mairies (D28), dans les DEUX formulaires', () => {
  it('le formulaire du CLUB propose les 13 types, les 5 d avant en tete', async () => {
    await monterEcran();
    expect(pastillesDeType()).toEqual(LIBELLES_ATTENDUS);
  });

  it('le formulaire de la MAIRIE propose les memes 13 types', async () => {
    await monterEcran({ params: { collectiviteId: 'ville-de-recette' } });
    expect(pastillesDeType()).toEqual(LIBELLES_ATTENDUS);
  });

  it('la mairie cree un « Dojo » : la valeur envoyee est celle du serveur', async () => {
    mockSaveCollectivite.mockResolvedValue({ data: { documentId: 'dojo-neuf' } });
    mockCollectiviteInstallations = {
      data: undefined, error: null, isLoading: false, refetch: jest.fn(),
    };
    const arbre = await monterEcran({ params: { collectiviteId: 'ville-de-recette' } });
    const champNom = mockInputProps
      .filter((props) => props.label === 'Nom de l\'installation')
      .pop();
    await act(async () => {
      champNom.onChangeText('Dojo municipal');
    });
    await choisirAdresse(ADRESSE_GEOCODEE);
    await appuyerSur(arbre, 'Dojo');
    await appuyerSur(arbre, 'Créer');

    expect(mockSaveCollectivite).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Dojo municipal', type: 'Dojo' }),
    }));
  });

  it('le club choisit une « Piste d athlétisme » : la valeur du serveur part', async () => {
    const arbre = await monterEcran();
    await remplirLeMinimumValide();
    await appuyerSur(arbre, 'Piste d’athlétisme');
    await appuyerSur(arbre, 'Créer');

    expect(createFacility).toHaveBeenCalledWith(expect.objectContaining({
      type: 'Piste d\'athlétisme',
    }));
  });
});
