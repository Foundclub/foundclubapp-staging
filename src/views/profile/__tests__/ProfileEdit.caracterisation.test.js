import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ProfileEdit from '../ProfileEdit';

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

/**
 * Aplati les enfants React en une chaine.
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
 * Tout le texte visible de l'arbre rendu.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Appuie sur le pressable portant ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const cible = arbre.root
    .findAllByType(TouchableOpacity)
    .find((/** @type {any} */ noeud) => noeud
      .findAllByType(Text)
      .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim() === libelle));
  if (!cible) throw new Error(`Aucun pressable ne porte le libelle « ${libelle} »`);
  await act(async () => {
    cible.props.onPress();
  });
};

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
const rendre = async (utilisateur, parametresRoute = {}) => {
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
        route={/** @type {any} */ ({ params: parametresRoute })}
      />,
    );
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockChampsFormulaire = {};
});

describe('ProfileEdit — ce que le formulaire ENVOIE aujourd\'hui', () => {
  it('reposte TOUS les champs quand un seul a change', async () => {
    const arbre = await rendre(joueurComplet);

    await act(async () => {
      mockChampsFormulaire.Prénom.onChangeText('Lucien');
    });
    await appuyerSur(arbre, 'Continuer');

    expect(mockUpdateMe).toHaveBeenCalledTimes(1);
    const charge = mockUpdateMe.mock.calls[0][0];

    // Le champ modifie part bien...
    expect(charge.firstname).toBe('Lucien');
    // ...mais TOUS les autres repartent avec lui, y compris ceux jamais touches.
    expect(charge.lastname).toBe('Harne');
    expect(charge.height).toBe('1.80');
    expect(charge.weight).toBe('75');
    expect(charge.position).toBe('Ailier');
    expect(charge.preferredSport).toBe('football');
    expect(charge.category).toBe('Senior');
    expect(charge.bestLevel).toBe('Départemental');
    expect(charge.nationality).toBe('Française');
    expect(charge.isLookingForClub).toBe(true);
    expect(charge.address).toEqual({ label: 'Marseille', value: '5.37|43.29' });
  });

  it('valide le formulaire par un seul bouton global, intitule « Continuer »', async () => {
    const arbre = await rendre(joueurComplet);

    expect(texteVisible(arbre)).toContain('Continuer');
    expect(texteVisible(arbre)).not.toContain('Enregistrer');
  });

  it('revient en arriere une fois la sauvegarde reussie', async () => {
    const arbre = await rendre(joueurComplet);

    await appuyerSur(arbre, 'Continuer');

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});

describe('ProfileEdit — le gating par role est deja branche ici', () => {
  it('cache taille, poids, poste et section a un DIRIGEANT', async () => {
    await rendre({ ...joueurComplet, role: { name: 'Dirigeant' } });

    expect(mockChampsFormulaire['Taille (m)']).toBeUndefined();
    expect(mockChampsFormulaire['Poids (kg)']).toBeUndefined();
    expect(mockChampsFormulaire.Poste).toBeUndefined();
    expect(mockChampsFormulaire.Section).toBeUndefined();
  });

  it('les montre a un JOUEUR', async () => {
    await rendre(joueurComplet);

    expect(mockChampsFormulaire['Taille (m)']).toBeDefined();
    expect(mockChampsFormulaire['Poids (kg)']).toBeDefined();
    expect(mockChampsFormulaire.Poste).toBeDefined();
    expect(mockChampsFormulaire.Section).toBeDefined();
  });

  it('laisse le sport et la categorie a TOUS les roles, dirigeant compris', async () => {
    await rendre({ ...joueurComplet, role: { name: 'Dirigeant' } });

    expect(mockChampsFormulaire['Sport de préférence']).toBeDefined();
    expect(mockChampsFormulaire.Catégorie).toBeDefined();
  });
});
