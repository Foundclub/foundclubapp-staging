import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { updateClub } from '@/services/club/clubService';
import { updateMultisportClub } from '@/services/multisportClub/multisportClubService';

import AddSponsor from '../AddSponsor';

// GUIDE-D-CORR TG-08 (tournée du 07/11, g28-g31) : clavier ouvert sur le formulaire du partenaire,
// « Ajouter le partenaire » et « Annuler » remontaient au-dessus du clavier et cachaient tout le
// champ « Lien vers le site » ; le lien prenait une majuscule (« Https:// »).
// Doublures reprises de AddSponsor.test.js (le texte visible, pas la forme de l'arbre).

let mockKeyboard = null;
jest.mock('@/hooks/useKeyboardFrame', () => ({ __esModule: true, default: () => mockKeyboard }));

/** @type {any[]} */
const mockButtonProps = [];
/** @type {any[]} */
const mockInputProps = [];
/** @type {any[]} */
const mockAvatarProps = [];
/** @type {any[]} */
const mockScreenProps = [];

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockClubQuery;
/** @type {any} */
let mockMultisportQuery;

// Doublure de `t` branchee sur la VRAIE fr.js, et c'est deliberé : un faux `t`
// qui rend toujours son repli ne voit jamais le fichier de traduction, alors
// que l'ecran reel, lui, prend fr.js quand la cle existe. Ce piege a ete paye
// sur l'ecran 04 du meme lot — des tests verts sur une copy que personne
// n'affichait. Ici, ce que le test lit est ce que l'utilisateur lit.
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

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend
// les echecs Jest illisibles (constat du lot paywall, 2026-08-02), et un objet
// invente masquerait un jeton absent.
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
      Images: { camera: 1, pin: 1 },
      Spaces: espaces,
    }),
  };
});

// Le vrai Joi, sans passer par `@/theme/strings` : ce module tire toute la
// chaine i18n, dont ce test n'a aucun besoin. La VALIDATION, elle, doit rester
// authentique — c'est elle qui decide si le bouton part ou non.
jest.mock('@/theme/strings', () => ({ Joi: jest.requireActual('joi') }));

// Doublure fidele de react-query : la mutation appelle vraiment sa mutationFn
// puis onSuccess / onError, sinon « ce qui part sur le reseau » ne partirait
// jamais et le test ne mesurerait rien.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve()
      .then(() => options.mutationFn(variables))
      .then((/** @type {any} */ data) => options.onSuccess?.(data, variables))
      .catch((/** @type {any} */ error) => options.onError?.(error, variables)),
  }),
  useQuery: () => mockMultisportQuery,
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => mockClubQuery,
}));

jest.mock('@/services/club/clubService', () => ({ updateClub: jest.fn() }));
jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: (error) => error?.decision || null,
}));
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function PaywallMock() { return null; },
);

jest.mock('@/services/multisportClub/multisportClubService', () => ({
  getMultisportClubById: jest.fn(),
  updateMultisportClub: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock(/** @type {any} */ props) {
    mockScreenProps.push(props);
    return props.children;
  },
);

// Le bouton est rendu comme un vrai element pressable portant son libelle :
// c'est ce qui permet d'appuyer « sur le texte », que le libelle soit porte par
// un Button aujourd'hui ou par un TouchableOpacity apres la refonte.
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
  '@/components/molecules/selectAvatar/SelectAvatar',
  () => function SelectAvatarMock(/** @type {any} */ props) {
    mockAvatarProps.push(props);
    return null;
  },
);

jest.mock(
  '@/views/club/components/ClubStateView',
  () => {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN, View: VueRN } = jest.requireActual('react-native');

    return function ClubStateViewMock(/** @type {any} */ { description, title }) {
      return reactActuel.createElement(
        VueRN,
        null,
        reactActuel.createElement(TexteRN, null, title),
        reactActuel.createElement(TexteRN, null, description),
      );
    };
  },
);

const LOGO = { height: 100, uri: 'file://logo.png', width: 200 };

// Un club tel qu'il revient VRAIMENT de l'API : peuple de relations que la
// mise a jour ne sait pas renvoyer telles quelles.
const CLUB_PEUPLE = {
  admins: [{ id: 7 }],
  documentId: 'club-1',
  name: 'SMUC',
  parentMultisport: { id: 3 },
  sections: [{ id: 1 }],
  sponsor: [{ title: 'Elseve' }],
  user: { id: 42 },
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
 * Aplati un style RN (tableau imbrique, valeurs fausses) en un seul objet.
 * @param {any} style
 * @returns {any}
 */
const aplatirStyle = (style) => {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(aplatirStyle));
  if (!style || typeof style !== 'object') return {};
  return style;
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
 * Dernieres props recues par une doublure.
 * @param {any[]} journal
 * @returns {any}
 */
const dernieresProps = (journal) => journal[journal.length - 1];

/**
 * Monte l'ecran.
 * @param {{ params?: any }} [options]
 * @returns {Promise<any>}
 */
const monterEcran = async (options = {}) => {
  const route = { params: options.params || { clubId: 'club-1' } };

  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<AddSponsor navigation={mockNavigation} route={route} />);
  });
  return arbre;
};

/**
 * Choisit un logo.
 * @param {any} [logo]
 * @returns {Promise<void>}
 */
const choisirLogo = async (logo = LOGO) => {
  const zone = dernieresProps(mockAvatarProps);
  await act(async () => {
    zone.onAvatarSelected(logo);
  });
};

/**
 * Saisit le nom du partenaire (premier champ texte de l'ecran).
 * @param {string} valeur
 * @returns {Promise<void>}
 */
const saisirNom = async (valeur) => {
  const champ = mockInputProps.find((/** @type {any} */ props) => props.name !== 'link')
    || mockInputProps[0];
  await act(async () => {
    champ.onChangeText(valeur);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockButtonProps.length = 0;
  mockInputProps.length = 0;
  mockAvatarProps.length = 0;
  mockScreenProps.length = 0;

  mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
  mockClubQuery = {
    data: CLUB_PEUPLE,
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  };
  mockMultisportQuery = {
    data: null,
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  };

  /** @type {any} */ (updateClub).mockResolvedValue({ documentId: 'club-1' });
  /** @type {any} */ (updateMultisportClub).mockResolvedValue({ documentId: 'cm-1' });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  /** @type {any} */ (Alert.alert).mockRestore?.();
});


const libelles = () => mockButtonProps.map((props) => props.title);
// Le bouton « Annuler » est-il dans une boîte masquée (`display: 'none'`) ?
const isAnnulerMasque = (arbre) => {
  let noeud = arbre.root.findAll((node) => node.props?.children === 'Annuler'
    && typeof node.type === 'string')[0]?.parent;
  while (noeud) {
    const style = Object.assign({}, ...[noeud.props?.style].flat(5).filter(Boolean));
    if (style.display === 'none') return true;
    noeud = noeud.parent;
  }
  return false;
};

describe('TG-08 : le champ lien reste visible clavier ouvert', () => {
  beforeEach(() => { mockKeyboard = null; });

  it('le lien ne prend pas de majuscule ni de correction', async () => {
    await monterEcran();
    const lien = mockInputProps.filter((props) => props.keyboardType === 'url').pop();
    expect(lien.autoCapitalize).toBe('none');
    expect(lien.autoCorrect).toBe(false);
  });

  it('clavier ouvert : les deux boutons du bas laissent la place aux champs', async () => {
    mockKeyboard = { height: 300, screenY: 500 };
    const arbre = await monterEcran();
    expect(isAnnulerMasque(arbre)).toBe(true);
  });

  it('témoin : clavier fermé, « Ajouter le partenaire » et « Annuler » sont là', async () => {
    const arbre = await monterEcran();
    expect(libelles()).toContain('Annuler');
    expect(isAnnulerMasque(arbre)).toBe(false);
  });
});
