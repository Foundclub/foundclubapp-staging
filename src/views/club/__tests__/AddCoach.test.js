import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import {
  createManager,
  createTrainer,
  linkTrainerToClub,
} from '@/services/auth/authService';

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

describe('AddCoach — garde-fous de contexte', () => {
  it('sans club, l ecran ne propose pas le formulaire', async () => {
    const arbre = await monterEcran({ params: {} });

    expect(texteDe(arbre.root)).toContain('Club introuvable');
  });

  it('pendant le chargement du club, l ecran le dit', async () => {
    mockClubQuery = {
      data: null, error: null, isLoading: true, refetch: jest.fn(),
    };
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('Chargement du club');
  });

  it('si le club ne se charge pas, l ecran propose de reessayer', async () => {
    mockClubQuery = {
      data: null, error: new Error('reseau coupe'), isLoading: false, refetch: jest.fn(),
    };
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('Ajout indisponible');
  });
});

describe('AddCoach — le telephone commande tout', () => {
  it('sans telephone, rien ne part : c est lui qui declenche l invitation', async () => {
    const arbre = await monterEcran();

    await appuyerSur(arbre, LIBELLE_CTA);

    expect(createTrainer).not.toHaveBeenCalled();
    expect(createManager).not.toHaveBeenCalled();
  });

  it('avec un telephone, la creation part avec le club du contexte', async () => {
    const arbre = await monterEcran();
    await saisirTelephone('+33612345678');

    await appuyerSur(arbre, LIBELLE_CTA);

    expect(createTrainer).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: 'club-1', phoneNumber: '+33612345678' }),
    );
  });
});

describe('AddCoach — les 2 routes ouvrent le bon role par defaut', () => {
  it('la route AddCoach cree un ENTRAINEUR', async () => {
    const arbre = await monterEcran({ name: RouteNames.AddCoach });
    await saisirTelephone('+33612345678');

    await appuyerSur(arbre, LIBELLE_CTA);

    expect(createTrainer).toHaveBeenCalled();
    expect(createManager).not.toHaveBeenCalled();
  });

  it('la route AddClubManager cree un DIRIGEANT', async () => {
    const arbre = await monterEcran({ name: RouteNames.AddClubManager });
    await saisirTelephone('+33612345678');

    await appuyerSur(arbre, LIBELLE_CTA);

    expect(createManager).toHaveBeenCalled();
    expect(createTrainer).not.toHaveBeenCalled();
  });

  it('le parametre staffType=manager suffit aussi a ouvrir en dirigeant', async () => {
    const arbre = await monterEcran({ params: { clubId: 'club-1', staffType: 'manager' } });
    await saisirTelephone('+33612345678');

    await appuyerSur(arbre, LIBELLE_CTA);

    expect(createManager).toHaveBeenCalled();
  });
});

describe('AddCoach — apres la creation', () => {
  it('pour un entraineur, la modale d invitation SMS s ouvre', async () => {
    const arbre = await monterEcran();
    await saisirTelephone('+33612345678');

    await appuyerSur(arbre, LIBELLE_CTA);

    expect(dernieresProps(mockInvitedModalProps).isVisible).toBe(true);
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  it('pour un dirigeant, une alerte confirme et il n y a pas de modale SMS', async () => {
    const arbre = await monterEcran({ name: RouteNames.AddClubManager });
    await saisirTelephone('+33612345678');

    await appuyerSur(arbre, LIBELLE_CTA);

    expect(Alert.alert).toHaveBeenCalled();
    expect(mockInvitedModalProps).toHaveLength(0);
  });
});

// C'EST LE CŒUR DE L'ECRAN 10 : avant D51, le role etait impose par la route.
// Un dirigeant qui se trompait de porte devait ressortir et recommencer. Les
// deux formulaires identiques n'en font plus qu'un, et le role se choisit sur
// place — sans que les deux routes cessent d'ouvrir sur le bon role.
describe('AddCoach — fusion D51 ecran 10 : le role se choisit a l ecran', () => {
  it('les deux roles sont proposes, en toutes lettres', async () => {
    const arbre = await monterEcran();
    const texte = texteDe(arbre.root);

    expect(texte).toContain('Dirigeant·e');
    expect(texte).toContain('Entraîneur·e');
  });

  it('entre par la porte « entraineur », on peut basculer sur DIRIGEANT', async () => {
    const arbre = await monterEcran({ name: RouteNames.AddCoach });
    await saisirTelephone('+33612345678');

    await appuyerSur(arbre, 'Dirigeant·e');
    await appuyerSur(arbre, LIBELLE_CTA);

    expect(createManager).toHaveBeenCalled();
    expect(createTrainer).not.toHaveBeenCalled();
  });

  it('entre par la porte « dirigeant », on peut basculer sur ENTRAINEUR', async () => {
    const arbre = await monterEcran({ name: RouteNames.AddClubManager });
    await saisirTelephone('+33612345678');

    await appuyerSur(arbre, 'Entraîneur·e');
    await appuyerSur(arbre, LIBELLE_CTA);

    expect(createTrainer).toHaveBeenCalled();
    expect(createManager).not.toHaveBeenCalled();
  });

  it('le role choisi commande aussi la suite : bascule en dirigeant, pas de modale SMS', async () => {
    const arbre = await monterEcran({ name: RouteNames.AddCoach });
    await saisirTelephone('+33612345678');

    await appuyerSur(arbre, 'Dirigeant·e');
    await appuyerSur(arbre, LIBELLE_CTA);

    // La modale a bien ete rendue AVANT la bascule (l'ecran s'ouvrait en
    // entraineur) : ce qui compte est qu'elle ne s'OUVRE jamais.
    expect(dernieresProps(mockInvitedModalProps)?.isVisible).not.toBe(true);
    expect(Alert.alert).toHaveBeenCalled();
  });
});

describe('AddCoach — fusion D51 ecran 10 : ce que les champs annoncent', () => {
  it('le telephone dit qu il est requis — c est lui qui declenche le SMS', async () => {
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('Numéro de téléphone — requis');
  });

  it('la date de naissance dit qu elle est optionnelle, sans detour', async () => {
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('Date de naissance — optionnelle');
  });

  it('l ecran annonce l invitation SMS avant de l envoyer', async () => {
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('invitation SMS');
  });

  it('le bouton dit ce qu il envoie', async () => {
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('Envoyer l\'invitation');
  });
});

describe('AddCoach — refus d abonnement', () => {
  it('un refus ouvre la feuille de vente au lieu d une alerte seche', async () => {
    mockDecisionExtraite = {
      allowed: false,
      paywall: 'CLUB_STAFF_REQUIRED',
      reason: 'SUBSCRIPTION_REQUIRED',
    };
    /** @type {any} */ (createTrainer).mockRejectedValue(new Error('402'));

    const arbre = await monterEcran();
    await saisirTelephone('+33612345678');

    await appuyerSur(arbre, LIBELLE_CTA);

    expect(dernieresProps(mockPaywallProps).isVisible).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('une erreur ordinaire laisse la feuille fermee et alerte', async () => {
    /** @type {any} */ (createTrainer).mockRejectedValue({ message: 'boom' });

    const arbre = await monterEcran();
    await saisirTelephone('+33612345678');

    await appuyerSur(arbre, LIBELLE_CTA);

    expect(dernieresProps(mockPaywallProps).isVisible).toBe(false);
    expect(Alert.alert).toHaveBeenCalled();
  });
});

// D63 : meme ecart de forme que sur l ecran 04, que les portes de D51 ne
// pouvaient pas voir — elles ne mesurent pas la conformite a une maquette.
describe('AddCoach — D63 : l ecart entre la maquette et l ecran', () => {
  it('le contenu ne colle plus aux deux bords de l ecran', async () => {
    await monterEcran();

    const marges = mockScreenProps
      .map((/** @type {any} */ props) => aplatirStyle(props.contentContainerStyle))
      .map((/** @type {any} */ style) => style.paddingHorizontal)
      .filter((/** @type {any} */ marge) => typeof marge === 'number' && marge > 0);

    expect(marges.length).toBeGreaterThan(0);
  });

  it('« Annuler » accompagne l envoi de l invitation', async () => {
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('Annuler');
  });

  it('« Annuler » revient en arriere sans envoyer d invitation', async () => {
    const arbre = await monterEcran();

    await appuyerSur(arbre, 'Annuler');

    expect(mockNavigation.goBack).toHaveBeenCalled();
  });
});
