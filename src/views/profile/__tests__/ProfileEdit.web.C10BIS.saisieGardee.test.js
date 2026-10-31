import renderer, { act } from 'react-test-renderer';

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

/** Un joueur dont le profil est deja entierement rempli. */
const joueurComplet = {
  address: { label: 'Marseille', value: '5.37|43.29' },
  bestLevel: 'Départemental',
  // Le resolveur Joi impose JJ/MM/AAAA a l'affichage : une date ISO fait echouer
  // la validation en silence, et `handleSubmit` n'appelle jamais la mutation.
  birthdate: '15/01/2000',
  category: 'Senior',
  documentId: 'user-1',
  firstname: 'Luc',
  height: '1.80',
  isLookingForClub: true,
  jerseyNumber: 10,
  lastname: 'Harne',
  nationality: 'Française',
  phoneNumber: '+33612345678',
  position: 'Ailier',
  preferredSport: 'football',
  role: { name: 'Joueur' },
  section: { documentId: 'sec-1', name: 'Masculin' },
  weight: '75',
};

/**
 * Monte l'ecran d'edition pour l'utilisateur donne.
 * @param {any} utilisateur
 * @param {any} [parametresRoute]
 * @returns {Promise<any>}
 */
/**
 * Monte (ou remonte) l'ecran du site avec l'utilisateur donne.
 * @param {any} utilisateur
 * @param {any} [arbreExistant]
 * @returns {Promise<any>}
 */
const rendre = async (utilisateur, arbreExistant = null) => {
  const { profileFieldToDisplay } = jest.requireActual('@/domains/auth/authUseCases');
  mockAuthValue = {
    formatBirthdateToDisplay: (/** @type {string} */ valeur) => String(valeur || ''),
    formatBirthdateToSend: (/** @type {string} */ valeur) => String(valeur || ''),
    getAuthTokens: () => ({ token: 'jeton-test' }),
    profileFields: profileFieldToDisplay(utilisateur?.role),
    userData: utilisateur,
  };
  const ecran = (
    <ProfileEdit
      navigation={/** @type {any} */ ({ goBack: mockGoBack, setParams: jest.fn() })}
      route={/** @type {any} */ ({ params: {} })}
    />
  );
  /** @type {any} */
  let arbre = arbreExistant;
  await act(async () => {
    if (arbre) arbre.update(ecran);
    else arbre = renderer.create(ecran);
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockChampsFormulaire = {};
});

// C10BIS · P11-16 — sur le site, un rafraichissement du profil (refetch, retour d'onglet)
// remplacait la saisie en cours par les valeurs du serveur. Meme garde que sur telephone :
// tant que le formulaire est modifie, on ne le reecrase pas (sauf changement de compte).
describe('ProfileEdit (site) — la saisie survit a un rafraichissement (C10BIS · P11-16)', () => {
  it('un profil relu pendant la saisie ne l efface pas', async () => {
    const arbre = await rendre(joueurComplet);

    await act(async () => {
      mockChampsFormulaire.Prénom.onChangeText('Lucien');
    });
    await rendre({ ...joueurComplet, weight: '76' }, arbre);

    expect(mockChampsFormulaire.Prénom.value).toBe('Lucien');
  });

  it('sans saisie, un profil relu remplit le formulaire', async () => {
    const arbre = await rendre(joueurComplet);

    await rendre({ ...joueurComplet, firstname: 'Luca' }, arbre);

    expect(mockChampsFormulaire.Prénom.value).toBe('Luca');
  });

  it('un autre compte remplace le formulaire, meme modifie', async () => {
    const arbre = await rendre(joueurComplet);

    await act(async () => {
      mockChampsFormulaire.Prénom.onChangeText('Lucien');
    });
    await rendre({ ...joueurComplet, documentId: 'user-2', firstname: 'Marie' }, arbre);

    expect(mockChampsFormulaire.Prénom.value).toBe('Marie');
  });
});

// CORR-INSCRIPTION p21 (recette du site 30/10, décision A + ajout d'Adel) — « Modifier mon profil »
// d'un parent : photo, nom, date, ville seulement, et un petit texte qui dit que c'est son compte
// parent et qu'il modifie ses champs de sport en basculant sur son compte joueur.
describe('CORR-INSCRIPTION p21 — profil d un parent', () => {
  const parent = {
    address: { label: 'Marseille', value: '5.37|43.29' },
    birthdate: '15/01/1985',
    documentId: 'parent-1',
    firstname: 'Paola',
    lastname: 'Recette',
    phoneNumber: '+33622222222',
    role: { name: 'Parent' },
  };

  it('ni catégorie, ni sport, ni recrutement ; la ville et le petit texte restent', async () => {
    const arbre = await rendre(parent);
    const textes = JSON.stringify(arbre.toJSON());
    expect(textes).not.toContain('LISTE:Catégorie');
    expect(textes).not.toContain('LISTE:Sport de préférence');
    expect(textes).not.toContain('Ouvert au recrutement');
    expect(textes).toContain('ADRESSE:Ville');
    expect(textes).toContain('CHAMP:Prénom=Paola');
    expect(textes).toContain('C’est ton profil de parent.');
  });

  it('un joueur garde tous ses champs, sans le petit texte', async () => {
    const arbre = await rendre(joueurComplet);
    const textes = JSON.stringify(arbre.toJSON());
    expect(textes).toContain('LISTE:Sport de préférence');
    expect(textes).toContain('Ouvert au recrutement');
    expect(textes).not.toContain('C’est ton profil de parent.');
  });
});
