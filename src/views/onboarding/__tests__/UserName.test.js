import {
  Alert, Text, TextInput, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { updateMe } from '@/services/auth/authService';

import UserName from '../UserName';

// D66 (E6) — l'ecran fusionne « Qui es-tu ? » n'avait AUCUN test, alors qu'il
// est la PREMIERE etape obligatoire de toute inscription et que son formulaire
// change de forme selon le role (`onboardingCollectsBirthdate`).
//
// LE DEFAUT QUE CE FICHIER FIGE : un compte neuf en role dirigeant ne pouvait
// pas depasser cet ecran. `defaultValues` portait toujours day / month / year,
// meme quand l'ecran ne les demande pas ; le schema « nom seul » ne declare pas
// ces trois clefs et Joi refuse les clefs inconnues. Resultat : trois erreurs
// `object.unknown` sur des champs QUI NE SONT PAS RENDUS ⇒ bouton mort, et
// aucun message a l'ecran pour l'expliquer.
//
// Les tests sont pilotes par ce que l'utilisateur VOIT et par ce qui part sur
// le reseau, jamais par la forme de l'arbre.

/** @type {any} */
let mockNavigation;

jest.mock('@/store/appContext', () => ({
  storage: {
    delete: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
  },
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

// Le VRAI Joi, configure comme en production (`abortEarly: false`, messages
// traduits), sans tirer toute la chaine i18n de `@/theme/strings`. C'est ce
// reglage exact qui produit le defaut : sans lui le test ne prouverait rien.
jest.mock('@/theme/strings', () => {
  const JoiReel = jest.requireActual('joi');
  const validations = jest.requireActual('@/theme/strings/translations/validations').default;

  return {
    Joi: JoiReel.defaults((/** @type {any} */ schema) => schema.options({
      abortEarly: false,
      errors: { language: 'fr' },
      messages: validations,
    })),
  };
});

/** @type {any} */
let mockUserData;

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getNextOnboardingRoute: () => 'UserAvatar',
    refetchUserData: jest.fn(),
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
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

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
  /** @type {any} */ (updateMe).mockResolvedValue({ documentId: 'user-1' });
});

describe('UserName — le dirigeant peut finir son inscription (D66)', () => {
  it('un dirigeant qui remplit prenom et nom peut appuyer sur Continuer', async () => {
    const arbre = rendre('Dirigeant');

    await saisir(arbre, 'Prénom', 'Adel');
    await saisir(arbre, 'Nom', 'Ferchichi');

    // Le bouton est ATTEIGNABLE : c'est ce qui manquait a l'ecran.
    expect(bouton(arbre, LIBELLE_CTA).props.disabled).toBe(false);

    await act(async () => { bouton(arbre, LIBELLE_CTA).props.onPress(); });

    expect(updateMe).toHaveBeenCalledWith({ firstname: 'Adel', lastname: 'Ferchichi' });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('UserAvatar');
  });

  it('le bouton reste vivant apres un premier appui : plus de cul-de-sac', async () => {
    const arbre = rendre('Dirigeant');

    await saisir(arbre, 'Prénom', 'Adel');
    await saisir(arbre, 'Nom', 'Ferchichi');
    await act(async () => { bouton(arbre, LIBELLE_CTA).props.onPress(); });

    expect(bouton(arbre, LIBELLE_CTA).props.disabled).toBe(false);
  });

  it('le superadmin passe aussi : il est dans la meme liste de roles', async () => {
    const arbre = rendre('SuperAdmin');

    await saisir(arbre, 'Prénom', 'Adel');
    await saisir(arbre, 'Nom', 'Ferchichi');
    await act(async () => { bouton(arbre, LIBELLE_CTA).props.onPress(); });

    expect(updateMe).toHaveBeenCalledWith({ firstname: 'Adel', lastname: 'Ferchichi' });
  });

  it('le dirigeant ne voit AUCUN champ de date de naissance', () => {
    const arbre = rendre('Dirigeant');

    expect(champ(arbre, 'JJ')).toBeUndefined();
    expect(champ(arbre, 'MM')).toBeUndefined();
    expect(champ(arbre, 'AAAA')).toBeUndefined();
  });
});

describe('UserName — la date de naissance reste exigee de ceux qui la doivent (D66)', () => {
  it('un joueur, lui, doit toujours remplir sa date de naissance', async () => {
    const arbre = rendre('Joueur');

    await saisir(arbre, 'Prénom', 'Adel');
    await saisir(arbre, 'Nom', 'Ferchichi');
    await act(async () => { bouton(arbre, LIBELLE_CTA).props.onPress(); });

    // Sans date, rien ne part : le correctif du dirigeant ne desarme pas la
    // validation des autres roles.
    expect(updateMe).not.toHaveBeenCalled();
  });

  it('le joueur qui donne une date complete avance, date comprise', async () => {
    const arbre = rendre('Joueur');

    await saisir(arbre, 'Prénom', 'Adel');
    await saisir(arbre, 'Nom', 'Ferchichi');
    await saisir(arbre, 'JJ', '12');
    await saisir(arbre, 'MM', '06');
    await saisir(arbre, 'AAAA', '1994');
    await act(async () => { bouton(arbre, LIBELLE_CTA).props.onPress(); });

    expect(updateMe).toHaveBeenCalledWith({
      birthdate: '1994-06-12',
      firstname: 'Adel',
      lastname: 'Ferchichi',
    });
  });

  it('une date qui n existe pas (31 fevrier) est toujours refusee', async () => {
    const arbre = rendre('Joueur');

    await saisir(arbre, 'Prénom', 'Adel');
    await saisir(arbre, 'Nom', 'Ferchichi');
    await saisir(arbre, 'JJ', '31');
    await saisir(arbre, 'MM', '02');
    await saisir(arbre, 'AAAA', '1994');
    await act(async () => { bouton(arbre, LIBELLE_CTA).props.onPress(); });

    expect(updateMe).not.toHaveBeenCalled();
  });
});

describe('UserName — un refus se voit toujours a l ecran (D66)', () => {
  it('quand Continuer refuse d avancer, l ecran dit pourquoi', async () => {
    const arbre = rendre('Joueur');

    const avant = textes(arbre);

    await saisir(arbre, 'Prénom', 'Adel');
    await saisir(arbre, 'Nom', 'Ferchichi');
    await act(async () => { bouton(arbre, LIBELLE_CTA).props.onPress(); });

    // Rien n'est parti (date manquante) : l'ecran DOIT donc avoir gagne un
    // message. Un bouton qui refuse sans rien dire est un cul-de-sac.
    expect(updateMe).not.toHaveBeenCalled();
    expect(textes(arbre).length).toBeGreaterThan(avant.length);
  });
});

// LOT ENFANTS — B7-A : LE 400 « DECLARATION PARENTALE » N EST PAS UNE PANNE.
//
// ☠️ LE DEFAUT, MESURE LE 2026-09-02 : cet ecran envoie prenom + nom + date en
// UN SEUL appel. Pour un moins de 15 ans, le serveur refuse cette premiere
// ecriture avec un 400 qui porte sa raison dans `details.details.scope`
// (`minor_parental_declaration`). L ecran, lui, ne navigue vers la declaration
// parentale QUE dans `onSuccess` : il tombait donc dans `onError`, affichait
// « Erreur », et AUCUN enfant de moins de 15 ans ne pouvait s inscrire.
//
// ⚠️ Ce temoin ne remplace pas le correctif serveur (B7-B, qui laisse passer
// nom + date). Il tient l autre bout : quel que soit le serveur en face, ce
// refus-la ouvre la declaration, il n affiche jamais « Erreur ».
describe('UserName — un mineur atteint la declaration parentale (B7-A)', () => {
  /**
   * L erreur telle que `updateMe` la rejette apres le correctif de service.
   * @returns {any} L erreur portant sa portee.
   */
  const refusDeclarationParentale = () => {
    const erreur = /** @type {any} */ (new Error(
      'Failed to update user data: Parental declaration is required for users under 15 years old',
    ));
    erreur.code = 'VALIDATION_ERROR';
    erreur.details = {
      code: 'VALIDATION_ERROR',
      details: { requiredUnderAge: 15, scope: 'minor_parental_declaration' },
      error: 'Parental declaration is required for users under 15 years old',
    };
    erreur.status = 400;
    return erreur;
  };

  it('sur ce refus, l ecran ouvre la declaration parentale, pas « Erreur »', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    /** @type {any} */ (updateMe).mockRejectedValue(refusDeclarationParentale());

    const arbre = rendre('Joueur');

    await saisir(arbre, 'Prénom', 'Léa');
    await saisir(arbre, 'Nom', 'Martin');
    await saisir(arbre, 'JJ', '12');
    await saisir(arbre, 'MM', '06');
    await saisir(arbre, 'AAAA', '2012');
    await act(async () => { bouton(arbre, LIBELLE_CTA).props.onPress(); });

    expect(mockNavigation.navigate).toHaveBeenCalledWith('UserParentalDeclaration');
    expect(alerte).not.toHaveBeenCalled();

    alerte.mockRestore();
  });

  it('une VRAIE panne continue d alerter : le lot ne rend pas l ecran muet', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    /** @type {any} */ (updateMe).mockRejectedValue(new Error('Network request failed'));

    const arbre = rendre('Joueur');

    await saisir(arbre, 'Prénom', 'Léa');
    await saisir(arbre, 'Nom', 'Martin');
    await saisir(arbre, 'JJ', '12');
    await saisir(arbre, 'MM', '06');
    await saisir(arbre, 'AAAA', '2012');
    await act(async () => { bouton(arbre, LIBELLE_CTA).props.onPress(); });

    expect(alerte).toHaveBeenCalled();
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith('UserParentalDeclaration');

    alerte.mockRestore();
  });
});
