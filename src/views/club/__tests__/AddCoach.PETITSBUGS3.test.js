import { Alert, Keyboard, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import {
  createManager,
  createTrainer,
  linkTrainerToClub,
} from '@/services/auth/authService';

import { buildPreservedApiError } from '@/utils/errors/apiError';

import AddCoach from '../AddCoach';

// D51 (E6) : AddCoach.js n'avait AUCUN test alors qu'il sert DEUX routes
// (`AddCoach` et `AddClubManager`) avec un seul composant, et que le role
// decide de tout : quelle mutation part, quel message de succes s'affiche,
// et si la modale d'invitation SMS s'ouvre.
//
// Ce fichier fige ce comportement AVANT la fusion D51 (ecran 10 du pack), ou
// le role cesse d'etre impose par la route pour devenir un choix a l'ecran.
// La partie reseau doit rester INCHANGEE : les deux routes continuent d'ouvrir
// l'ecran sur le bon role par defaut.
//
// Pilote par le TEXTE VISIBLE et par ce qui part sur le reseau.

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
// PETITSBUGS-3 : les options de chaque mutation sont gardées (meta lue par le filet global).
/** @type {any[]} */
const mockMutationOptions = [];
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => (mockMutationOptions.push(options) && {
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

// Libelle du bouton d'envoi. En constante parce que la fusion D51 le change :
// un seul point a corriger, et le changement se voit. Avant D51 : « Ajouter ».
const LIBELLE_CTA = 'Envoyer l\'invitation';

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
 * Dernieres props recues par une doublure.
 * @param {any[]} journal
 * @returns {any}
 */
const dernieresProps = (journal) => journal[journal.length - 1];

/**
 * Monte l'ecran.
 * @param {{ name?: string, params?: any }} [options]
 * @returns {Promise<any>}
 */
const monterEcran = async (options = {}) => {
  const route = {
    name: options.name || RouteNames.AddCoach,
    params: options.params === undefined ? { clubId: 'club-1' } : options.params,
  };

  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<AddCoach navigation={mockNavigation} route={route} />);
  });
  return arbre;
};

/**
 * Saisit le numero de telephone.
 * @param {string} valeur
 * @returns {Promise<void>}
 */
const saisirTelephone = async (valeur) => {
  const champ = dernieresProps(mockPhoneProps);
  await act(async () => {
    champ.onChange(valeur);
  });
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

// ==========================================================================
// PETITSBUGS-3 (rejeu 4 du 29/10) — AddCoach, numéro déjà pris : DEUX alertes,
// « Failed to create trainer: Uniqueness check failed » (anglais brut) puis
// « Ce numéro de téléphone est déjà utilisé. » (filet global). Cause : le
// service aplatit l'erreur (`buildPreservedApiError`), l'écran cherchait
// encore `error.response.data.error` et retombait sur le message brut.
// ==========================================================================

/**
 * Le refus du serveur tel que le service le rejette (forme aplatie réelle).
 * @param {any} details - `error.details` de Strapi.
 * @returns {Error} Erreur aplatie.
 */
const refusUnicite = (details) => buildPreservedApiError({
  response: {
    data: { error: { details, message: 'Uniqueness check failed', status: 400 } },
    status: 400,
  },
}, 'Failed to create trainer');

const textesDesAlertes = () => /** @type {any} */ (Alert.alert).mock.calls
  .map((/** @type {any[]} */ appel) => `${appel[0]} ${appel[1]}`);

describe('PETITSBUGS-3 — numéro déjà pris : une seule alerte, en français', () => {
  beforeEach(() => { mockMutationOptions.length = 0; });

  it('numéro d’un compte existant : une alerte qui propose de l’ajouter', async () => {
    /** @type {any} */ (createTrainer).mockRejectedValue(refusUnicite({
      user: { documentId: 'u-9', firstname: 'Audit', lastname: 'Rejeu' },
    }));
    const arbre = await monterEcran();
    await saisirTelephone('+33639980001');
    await appuyerSur(arbre, LIBELLE_CTA);

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(textesDesAlertes().join(' ')).not.toContain('Failed to');
    // L'alerte de l'écran garde son geste « Ajouter au club ».
    expect(/** @type {any} */ (Alert.alert).mock.calls[0][2]).toHaveLength(2);
  });

  it('numéro pris sans fiche jointe : « … déjà utilisé. », seul', async () => {
    /** @type {any} */ (createTrainer)
      .mockRejectedValue(refusUnicite({ code: 'PHONE_NUMBER_TAKEN' }));
    const arbre = await monterEcran();
    await saisirTelephone('+33639980001');
    await appuyerSur(arbre, LIBELLE_CTA);

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(textesDesAlertes().join(' ')).not.toContain('Failed to create trainer');
    expect(textesDesAlertes().join(' ')).toContain('Ce numéro de téléphone est déjà utilisé.');
  });

  it('le filet global se tait sur la création : l’écran parle seul', async () => {
    await monterEcran();
    const creation = mockMutationOptions.find((options) => options.mutationFn === createTrainer);
    expect(creation?.meta?.preventToastError).toBe(true);
  });
});

describe('PETITSBUGS-3 — « Ajout réussi ! » sans le clavier numérique', () => {
  it('le clavier se ferme avant que la feuille s’ouvre', async () => {
    const ordre = /** @type {string[]} */ ([]);
    const fermer = jest.spyOn(Keyboard, 'dismiss')
      .mockImplementation(() => { ordre.push('clavier'); });
    const arbre = await monterEcran();
    await saisirTelephone('+33639980001');
    await appuyerSur(arbre, LIBELLE_CTA);

    expect(fermer).toHaveBeenCalled();
    expect(dernieresProps(mockInvitedModalProps).isVisible).toBe(true);
    fermer.mockRestore();
  });
});
