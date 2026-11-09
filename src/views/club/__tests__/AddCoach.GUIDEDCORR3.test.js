import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';

import { RouteNames } from '@/navigation/routeNames';

import {
  createManager,
  createTrainer,
  linkTrainerToClub,
} from '@/services/auth/authService';

import AddCoach from '../AddCoach';

// Banc repris de `AddCoach.test.js` (memes doublures) ; le temoin GUIDE-D-CORR-3 est en bas.

/** @type {any[]} */
const mockButtonProps = [];
/** @type {any[]} */
const mockScreenProps = [];
/** @type {any[]} */
const mockInputProps = [];
/** @type {any[]} */
const mockPhoneProps = [];
/** @type {any[]} */
const mockPaywallProps = [];
/** @type {any[]} */
const mockInvitedModalProps = [];

/** @type {any} */
let mockClavier = null;

jest.mock('@/hooks/useKeyboardFrame', () => () => mockClavier);

/** @type {any} */
let mockTour = { currentStep: null, tourStatus: null };

jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockClubQuery;
/** @type {any} */
let mockInviteTrainer;
/** @type {any} */
let mockDecisionExtraite;

// Doublure de `t` branchee sur la VRAIE fr.js : un faux `t` qui rend toujours
// son repli ne voit jamais le fichier de traduction, alors que l'ecran reel
// prend fr.js des que la cle existe. Piege paye sur l'ecran 04 du meme lot.
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
      Images: { camera: 1, plus: 1, trash: 1 },
      Spaces: espaces,
    }),
  };
});

// Le vrai Joi, sans tirer toute la chaine i18n de `@/theme/strings`.
jest.mock('@/theme/strings', () => ({ Joi: jest.requireActual('joi') }));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    formatBirthdateToDisplay: (/** @type {string} */ texte) => texte,
    inviteTrainer: mockInviteTrainer,
    userData: { club: { documentId: 'club-1', name: 'SMUC' } },
  }),
}));

jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: () => mockDecisionExtraite,
}));

// Doublure fidele de react-query : la mutation appelle vraiment sa mutationFn
// puis onSuccess / onError, sinon rien ne partirait sur le reseau.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve()
      .then(() => options.mutationFn(variables))
      .then((/** @type {any} */ data) => options.onSuccess?.(data, variables))
      .catch((/** @type {any} */ error) => options.onError?.(error, variables)),
  }),
}));

jest.mock('@/services/auth/authService', () => ({
  createManager: jest.fn(),
  createTrainer: jest.fn(),
  linkManagerToClub: jest.fn(),
  linkTrainerToClub: jest.fn(),
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => mockClubQuery,
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock(/** @type {any} */ props) {
    mockScreenProps.push(props);
    return props.children;
  },
);

// Le bouton est rendu comme un vrai pressable portant son libelle : c'est ce
// qui permet aux tests d'appuyer « sur le texte », que le libelle soit porte
// par un Button (avant) ou par une pilule (apres la fusion).
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

// Le champ rend son LIBELLE : c'est par lui qu'on verifie qu'une date de
// naissance s'annonce optionnelle, sans aller inspecter la forme de l'arbre.
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');

  return function InputMock(/** @type {any} */ props) {
    mockInputProps.push(props);
    return reactActuel.createElement(TexteRN, null, props.label);
  };
});

jest.mock(
  '@/components/organisms/phoneInput/PhoneInput',
  () => {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN } = jest.requireActual('react-native');

    return function PhoneInputMock(/** @type {any} */ props) {
      mockPhoneProps.push(props);
      // Le libelle est rendu : c'est par lui qu'on verifie que le champ
      // s'annonce requis.
      return reactActuel.createElement(TexteRN, null, props.label);
    };
  },
);

jest.mock(
  '@/components/molecules/selectAvatar/SelectAvatar',
  () => function SelectAvatarMock() {
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

jest.mock(
  '@/components/organisms/trainerInvitedModal/TrainerInvitedModal',
  () => function TrainerInvitedModalMock(/** @type {any} */ props) {
    mockInvitedModalProps.push(props);
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
 * Monte l'ecran, hors du guide.
 * @returns {Promise<any>}
 */
const monterEcran = async () => {
  const route = { name: RouteNames.AddCoach, params: { clubId: 'club-1' } };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<AddCoach navigation={mockNavigation} route={route} />);
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockButtonProps.length = 0;
  mockScreenProps.length = 0;
  mockInputProps.length = 0;
  mockPhoneProps.length = 0;
  mockPaywallProps.length = 0;
  mockInvitedModalProps.length = 0;

  mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
  mockInviteTrainer = jest.fn();
  mockDecisionExtraite = null;
  mockClubQuery = {
    data: { documentId: 'club-1', name: 'SMUC' },
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  };

  /** @type {any} */ (createTrainer).mockResolvedValue({ documentId: 'u-1', firstname: 'Luc' });
  /** @type {any} */ (createManager).mockResolvedValue({ documentId: 'u-2', firstname: 'Ana' });
  /** @type {any} */ (linkTrainerToClub).mockResolvedValue({});
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  /** @type {any} */ (Alert.alert).mockRestore?.();
});

// GUIDE-D-CORR-3, M1078 (TestFlight 2.6.97, 09/11), guide Dirigeant, mission 2 « Ajouter un
// coach » : « Le bouton "Envoyer l'invitation" et "Annuler", qui sont fixes, prennent trop de
// place : on voit mal ce qu'on ecrit. Clavier ferme, le cadre ne prend que "numero" et "prenom" ;
// quand on veut defiler vers le bas, ca cree une sorte de bug avec ce cadre. »
// Cause du « bug » : la couche du guide fait defiler l'ecran jusqu'a une cible coupee
// (GUIDE-D-CORR-2) ; le doigt qui descend coupe « numero + prenom », le guide remonte.

/**
 * La rangee des deux boutons du bas (celle qui porte `cf-send`).
 * @param {any} arbre
 * @returns {any}
 */
const rangeeDuBas = (arbre) => arbre.root
  .find((/** @type {any} */ noeud) => noeud.props?.id === 'cf-send'
    && typeof noeud.type !== 'string')
  .parent;

const estMasquee = (/** @type {any} */ noeud) => aplatirStyle(noeud.props.style).display === 'none';

/**
 * Monte l'ecran dans un guide a l'etape donnee.
 * @param {any} etape
 * @returns {Promise<any>}
 */
const monterDansLeGuide = async (etape) => {
  const route = { name: RouteNames.AddCoach, params: { clubId: 'club-1' } };
  /** @type {any} */
  let arbre;
  mockTour = { currentStep: etape, tourStatus: 'active' };
  await act(async () => {
    arbre = renderer.create(<AddCoach navigation={mockNavigation} route={route} />);
  });
  return arbre;
};

const etape = (/** @type {string} */ id) => PRESIDENT_GUIDE.steps.find((one) => one.id === id);

describe('GUIDE-D-CORR-3 M1078 — Ajouter un coach, clavier et cadre du guide', () => {
  afterEach(() => {
    mockClavier = null;
    mockTour = { currentStep: null, tourStatus: null };
  });

  it('clavier ferme : « Envoyer l invitation » et « Annuler » sont la', async () => {
    const arbre = await monterEcran();
    expect(estMasquee(rangeeDuBas(arbre))).toBe(false);
    expect(texteDe(rangeeDuBas(arbre))).toContain('Annuler');
  });

  it('clavier ouvert : les deux boutons du bas laissent la place a la saisie', async () => {
    mockClavier = { height: 300, screenY: 500 };
    const arbre = await monterEcran();
    expect(estMasquee(rangeeDuBas(arbre))).toBe(true);
  });

  it('le guide montre « Envoyer », clavier ouvert : il se ferme, le bouton est la', async () => {
    mockClavier = { height: 300, screenY: 500 };
    const { Keyboard } = jest.requireActual('react-native');
    const fermer = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    const arbre = await monterDansLeGuide(etape('m2-send'));
    expect(fermer).toHaveBeenCalled();
    expect(estMasquee(rangeeDuBas(arbre))).toBe(false);
    fermer.mockRestore();
  });

  it('le cadre de « numero et prenom » englobe la zone qui defile et ses champs', async () => {
    const arbre = await monterEcran();
    const [cible] = etape('m2-fields').targets;
    const zone = arbre.root.find((/** @type {any} */ noeud) => noeud.props?.id === cible
      && typeof noeud.type !== 'string');
    // La zone qui defile elle-meme : elle ne sort jamais de l'ecran, le guide ne la poursuit pas.
    expect(zone.props.clipChildren).toBe(true);
    const texte = texteDe(zone);
    ['phoneNumber', 'firstname', 'lastname', 'birthdate'].forEach((champ) => {
      const libelle = jest.requireActual('@/theme/strings/translations/fr').default
        .addCoach.fields[champ].label;
      expect(texte).toContain(libelle);
    });
  });
});
