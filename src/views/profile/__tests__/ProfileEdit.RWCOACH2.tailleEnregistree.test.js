import renderer, { act } from 'react-test-renderer';

import fr from '@/theme/strings/translations/fr';

import { profileSchema } from '../profileFormContract';

// RECETTE-WEB-COACH 2 (30/10) — UNE TAILLE DEJA ENREGISTREE, HORS BORNES, NE BLOQUE PLUS LE PROFIL.
//
// Constat sur le site (compte de recette d'un entraineur, taille enregistree « 999 ») : « Continuer »
// sur « Modifier mon profil » ne fait RIEN, sans aucun message, meme pour changer la seule photo.
// Cause : les bornes de CHOIX3 (P5-24) controlent la taille et le poids a CHAQUE envoi, y compris
// quand le champ n'est pas affiche pour ce role (un entraineur n'a ni taille ni poids a l'ecran) :
// l'erreur tombe sur un champ invisible. Meme controle sur telephone (`profileSchema`).
// Regle retenue : une valeur deja enregistree et que la personne n'a pas touchee repart telle
// quelle cote controle, et ne part pas au serveur (qui la refuserait) ; seule une valeur saisie
// est bornee.
//
// ROUGE avant le lot : `updateMe` n'est jamais appele, et le contrat refuse « 999 » inchange.

import ProfileEdit from '../ProfileEdit.web';

// C10BIS · P11-16 — premier temoin de `ProfileEdit.web.js` (E6). Les doublures sont celles de
// `ProfileEdit.caracterisation.test.js` : le site monte les memes champs. Leur histoire :

// D06 (E6) : `ProfileEdit.js` fait 789 lignes et n'avait AUCUN test, alors qu'il
// est le SEUL chemin d'ecriture du profil et qu'il a CINQ points d'entree
// vivants (tour guide, HomeHub x2, carte de collection, ecran Mon compte) plus
// une URL web `/profile/edit`. Il ne peut donc pas etre supprime par le lot D06
// (regle payee par L30 : compter les points d'entree avant de retirer un ecran).
//
// Ce fichier FIGE ce que le formulaire ENVOIE aujourd'hui. Le fait qui justifie
// le lot est le premier test : modifier UN champ reposte TOUS les autres. C'est
// ce qui rend une sauvegarde champ par champ possible sans changer l'API — mais
// aussi ce qui la rend risquee si on s'y prend mal.
//
// `react-native-gesture-handler` n'est pas dans `transformIgnorePatterns` : son
// `ScrollView` est double ici, sinon la suite ne se charge pas.

/** @type {any} */
let mockAuthValue;
/** @type {Record<string, any>} */
let mockChampsFormulaire;
const mockUpdateMe = jest.fn();
const mockGoBack = jest.fn();

jest.mock('react-native-gesture-handler', () => {
  const { ScrollView } = jest.requireActual('react-native');
  return { ScrollView };
});

// `ProfileEdit` importe `Joi` depuis `@/theme/strings`, dont l'index appelle
// `i18n.use(initReactI18next)` au chargement : le mock doit fournir ce module,
// sinon la suite ne demarre pas (« You are passing an undefined module! »).
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle || '').split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: async (/** @type {any} */ entree) => {
      const resultat = await options.mutationFn(entree);
      await options.onSuccess?.(resultat);
    },
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
  }),
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: (/** @type {any} */ charge) => {
    mockUpdateMe(charge);
    return Promise.resolve({ ...charge });
  },
}));

jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [{ documentId: 'lvl-1', name: 'Départemental' }] }),
}));

jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ data: [{ documentId: 'sec-1', name: 'Masculin' }] }),
}));

// AC03 — le sport et la categorie viennent desormais des listes du SERVEUR.
// Sans ces doublures, l'ecran tire le vrai client HTTP et la suite ne se charge
// meme pas (« API_URL is missing »), comme pour les niveaux et les sections.
jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [{ documentId: 'act-1', name: 'Football' }] }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [{ documentId: 'cat-1', name: 'U13 (13 ans)' }] }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthValue,
}));

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: () => 'geohash-test' }),
}));

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

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/molecules/onboardingWrapper/OnboardingWrapper', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/molecules/tutorial/TutorialFlowBoundary', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/molecules/selectAvatar/SelectAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>CHOIX AVATAR</TexteRN>,
  };
});

jest.mock('@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>DECLARATION PARENTALE</TexteRN>,
  };
});

// Les trois saisies sont doublees par un composant qui s'ENREGISTRE sous son
// libelle visible : le test pilote ensuite par ce libelle, jamais par la forme
// de l'arbre.
jest.mock('@/components/molecules/input/Input', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => {
      mockChampsFormulaire[proprietes.label] = proprietes;
      return <TexteRN>{`CHAMP:${proprietes.label}=${proprietes.value ?? ''}`}</TexteRN>;
    },
  };
});

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => {
      mockChampsFormulaire[proprietes.label] = proprietes;
      return <TexteRN>{`LISTE:${proprietes.label}`}</TexteRN>;
    },
  };
});

jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => {
      mockChampsFormulaire[proprietes.label] = proprietes;
      return <TexteRN>{`ADRESSE:${proprietes.label}`}</TexteRN>;
    },
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { disabled, onPress, title }) => (
      <Pressable disabled={disabled} onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </Pressable>
    ),
  };
});


/** Un entraineur : ni taille ni poids a l'ecran, mais une taille illisible en base. */
const entraineurTaille999 = {
  address: { label: 'Marseille', value: '5.37|43.29' },
  birthdate: '15/04/1995',
  documentId: 'coach-1',
  firstname: 'Julien',
  height: '999',
  lastname: 'Marchal',
  phoneNumber: '+33600000003',
  preferredSport: 'Football',
  role: { name: 'Entraineur' },
};

/**
 * Monte l'ecran d'edition du site pour l'utilisateur donne.
 * @param {any} utilisateur
 * @returns {Promise<any>}
 */
const rendre = async (utilisateur) => {
  const { profileFieldToDisplay } = jest.requireActual('@/domains/auth/authUseCases');
  mockAuthValue = {
    formatBirthdateToDisplay: (/** @type {string} */ valeur) => String(valeur || ''),
    formatBirthdateToSend: (/** @type {string} */ valeur) => String(valeur || ''),
    getAuthTokens: () => ({ token: 'jeton-test' }),
    profileFields: profileFieldToDisplay(utilisateur?.role),
    userData: utilisateur,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <ProfileEdit
        navigation={/** @type {any} */ ({ goBack: mockGoBack, setParams: jest.fn() })}
        route={/** @type {any} */ ({ params: {} })}
      />,
    );
  });
  return arbre;
};

/**
 * Appuie sur le bouton d'envoi, retrouve par son libelle visible.
 * @param {any} arbre
 */
const envoyer = async (arbre) => {
  const { TouchableOpacity } = jest.requireActual('react-native');
  const bouton = arbre.root.findAll((/** @type {any} */ n) => n.type === TouchableOpacity)
    .find((/** @type {any} */ n) => n.findAll(
      (/** @type {any} */ t) => t.props?.children === fr.profile.actions.save,
    ).length > 0);
  await act(async () => {
    await bouton.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockChampsFormulaire = {};
});

describe('Profil (site) — une taille enregistree hors bornes ne bloque pas l envoi', () => {
  it('un entraineur change son prenom : le profil part, sans la taille (le serveur la garde)', async () => {
    const arbre = await rendre(entraineurTaille999);

    await act(async () => {
      mockChampsFormulaire.Prénom.onChangeText('Julio');
    });
    await envoyer(arbre);

    expect(mockUpdateMe).toHaveBeenCalledTimes(1);
    expect(mockUpdateMe.mock.calls[0][0]).toEqual(expect.objectContaining({
      firstname: 'Julio',
    }));
    expect(mockUpdateMe.mock.calls[0][0].height).toBeUndefined();
  });
});

describe('Contrat du profil (telephone) — meme regle', () => {
  const valider = (/** @type {any} */ champs, /** @type {any} */ chargees) => profileSchema.validate(
    { firstname: 'Julien', lastname: 'Marchal', ...champs },
    { context: { valeursChargees: chargees } },
  );

  it('« 999 » deja enregistre et non retouche : accepte, et part tel quel', () => {
    const { error, value } = valider({ height: '999' }, { height: '999' });

    expect(error).toBeUndefined();
    expect(value.height).toBe('999');
  });

  it('« 998 » saisi a la place de « 999 » : refuse, la borne s applique toujours', () => {
    const { error } = valider({ height: '998' }, { height: '999' });

    expect(error?.details?.[0]?.message).toBe('profile.fields.height.invalid');
  });
});
