import { Switch, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserDetails from '../UserDetails';

// D39 — LE CONTRAT DE ROLE du pack « Profils JOUEUR & ENTRAINEUR »
// (`claude design/export/design_handoff_profils_joueur_entraineur/`).
//
// La regle d'or du pack, mot pour mot :
//   « Le contenu vient du ROLE du compte — aucun bloc joueur atteignable sur un
//     profil coach, et inversement. »
//
// Ce fichier monte `UserDetails` (le composant de la ROUTE) et non l'ecran
// directement : c'est le seul moyen de prouver l'AIGUILLAGE — que le bon role
// atterrit sur le bon ecran — en plus du contenu. C'est aussi ce que fait le
// filet de D06 (`UserDetails.profilUnifie.test.js`), dont ce fichier est le
// prolongement pour les deux roles que D06 avait laisses de cote.
//
// Il n'observe que le TEXTE VISIBLE et les libelles d'accessibilite.

/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockPersonalStats;
const mockNavigate = jest.fn();
const mockUpdateMe = jest.fn();

// BLOQUER (02/09) — `UserDetails` lit desormais la liste des personnes que j ai
// bloquees. Ce module-la importe le client HTTP, qui refuse de se charger sans
// `.env` — absent de TOUT worktree. Sans cette doublure, la suite ENTIERE
// echoue AU CHARGEMENT, sans executer un seul test (« Test Suites: 1 failed,
// Tests: 0 »).
jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useBlockUser: () => ({ isPending: false, mutate: jest.fn() }),
  useGetMyBlockedUsers: () => ({ data: [], refetch: jest.fn() }),
  useUnblockUser: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    // Le contrat de formulaire tire `@/theme/strings` pour Joi, et ce module
    // amorce i18next au chargement : sans cette doublure, la suite ne se
    // charge pas du tout (« You are passing an undefined module »).
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
        if (repli && typeof repli === 'object' && typeof repli.defaultValue === 'string') {
          return repli.defaultValue;
        }
        if (repli && typeof repli === 'object' && typeof repli.count === 'number') {
          return String(repli.count);
        }
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
  useQuery: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: (/** @type {any} */ charge) => {
    mockUpdateMe(charge);
    return Promise.resolve({ ...charge });
  },
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthValue,
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({
    getClubInitials: (/** @type {string} */ nom) => String(nom || '').slice(0, 2).toUpperCase(),
  }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startGroupChat: jest.fn(), startWhisperChat: jest.fn() }),
}));

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: () => 'geohash-test' }),
}));

jest.mock('@/services/auth/authQueries', () => ({
  useGetUserById: () => ({
    data: undefined, error: undefined, isLoading: false, refetch: jest.fn(),
  }),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useUserCurrentLicense: () => ({ data: undefined, refetch: jest.fn() }),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetPersonalStats: () => ({ data: mockPersonalStats, isLoading: false, refetch: jest.fn() }),
}));

jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useGetMyHistories: () => ({ data: [], refetch: jest.fn() }),
  useGetUserHistories: () => ({ data: [], refetch: jest.fn() }),
}));

jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [{ documentId: 'lvl-1', name: 'Régional 1' }] }),
}));

jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({
    data: [
      { documentId: 'sec-1', name: 'Masculine' },
      { documentId: 'sec-2', name: 'Féminine' },
      { documentId: 'sec-3', name: 'Mixte' },
    ],
  }),
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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
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
      Images: {
        arrowRight: 1,
        bell: 1,
        calendar: 1,
        camera: 1,
        check: 1,
        edit: 1,
        envelope: 1,
        phone: 1,
        pin: 1,
        plus: 1,
        running: 1,
        shield: 1,
        trash: 1,
        trophy: 1,
        users: 1,
      },
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

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/organisms/userHistorySection/UserHistorySection', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>SECTION HISTORIQUE SPORTIF</TexteRN>,
  };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});

jest.mock('@/components/molecules/selectAvatar/SelectAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>SELECTEUR AVATAR</TexteRN>,
  };
});

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { club }) => <TexteRN>{`BLASON:${club?.name || ''}`}</TexteRN>,
  };
});

jest.mock('@/components/atoms/teamShield/TeamShield', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { initials }) => <TexteRN>{`ECUSSON:${initials}`}</TexteRN>,
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, isVisible }) => (
      isVisible ? <View>{children}</View> : null
    ),
  };
});

// `AutocompleteAddressInput` tire `react-native-bouncy-checkbox`, publie en ESM
// pur et absent de `transformIgnorePatterns` : sans cette doublure, la suite ne
// se charge pas du tout.
jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => (
      <TexteRN>{`CHAMP:${proprietes.label ?? ''}`}</TexteRN>
    ),
  };
});

jest.mock('@/components/molecules/input/Input', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => (
      <TexteRN>{`CHAMP:${proprietes.label ?? ''}`}</TexteRN>
    ),
  };
});

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => (
      <TexteRN>{`CHAMP:${proprietes.label ?? ''}`}</TexteRN>
    ),
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
 * Le pressable portant ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const pressablePortant = (arbre, libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud
    .findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim() === libelle));

/** Le joueur du pack : stats, poste, taille/poids, une equipe. */
const joueur = {
  club: { clubVerified: true, documentId: 'club-1', name: 'Stade Marseillais UC' },
  documentId: 'user-joueur',
  firstname: 'Youss',
  height: '1.80',
  isLookingForClub: true,
  lastname: 'Barbidal',
  myTeams: [{ documentId: 'team-9', name: 'Seniors A' }],
  phoneNumber: '+33611111111',
  position: 'Ailier',
  preferredSport: 'football',
  role: { name: 'Joueur' },
  trainedTeams: [],
  weight: '80',
};

/** L'entraineur du pack : une equipe entrainee, AUCUN heritage joueur. */
const entraineur = {
  club: { clubVerified: true, documentId: 'club-1', name: 'Stade Marseillais UC' },
  documentId: 'user-coach',
  firstname: 'Pierre',
  lastname: 'Raupila',
  myTeams: [],
  phoneNumber: '+33611111111',
  preferredSport: 'football',
  role: { name: 'Entraineur' },
  trainedTeams: [{ documentId: 'team-1', name: 'Seniors A' }],
};

/**
 * Monte l'ecran pour l'utilisateur donne.
 * @param {any} utilisateurCourant
 * @param {any} [parametresRoute]
 * @returns {Promise<any>}
 */
const rendre = async (utilisateurCourant, parametresRoute = {}) => {
  mockAuthValue = {
    formatBirthdateToDisplay: (/** @type {string} */ valeur) => String(valeur || ''),
    formatBirthdateToSend: (/** @type {string} */ valeur) => String(valeur || ''),
    getAuthTokens: () => ({ token: 'jeton-test' }),
    isCurrentClubVerified: true,
    refetchUserData: jest.fn(),
    USER_ROLES: {
      coach: 'Entraineur',
      new: 'Authenticated',
      player: 'Joueur',
      president: 'Dirigeant',
      superAdmin: 'SuperAdmin',
    },
    userData: utilisateurCourant,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <UserDetails
        navigation={/** @type {any} */ ({ goBack: jest.fn(), navigate: mockNavigate })}
        route={/** @type {any} */ ({ params: parametresRoute })}
      />,
    );
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPersonalStats = undefined;
});

describe('D39 · temoin 1 — un compte JOUEUR ne voit aucun bloc de coach', () => {
  it('n\'affiche jamais « Équipes entraînées » a un joueur', async () => {
    const arbre = await rendre(joueur);

    expect(texteVisible(arbre)).not.toContain('Équipes entraînées');
  });

  it('garde ce que D06 protegeait : stats, retours du coach, ses equipes', async () => {
    mockPersonalStats = {
      overall: {
        football: { assists: 6, goals: 9 }, losses: 7, matches: 24, minutesPlayed: 1620, wins: 14,
      },
    };
    const arbre = await rendre(joueur);
    const texte = texteVisible(arbre);

    // Les six valeurs de la rangee compacte, avec leurs accents corriges :
    // le pack interdit « Passes D » et « Defaites ».
    expect(texte).toContain('Matchs');
    expect(texte).toContain('Victoires');
    expect(texte).toContain('Défaites');
    expect(texte).toContain('Minutes');
    expect(texte).toContain('Buts');
    expect(texte).toContain('Passes déc.');
    expect(texte).toContain('24');
    // Les deux rangees de « Suivi » qui remplacent les blocs de D06.
    expect(texte).toContain('Retours du coach');
    expect(texte).toContain('Mes équipes');
  });

  it('porte les champs joueur du pack, poste et corps compris', async () => {
    const arbre = await rendre(joueur);
    const texte = texteVisible(arbre);

    expect(texte).toContain('Poste');
    expect(texte).toContain('Section');
    expect(texte).toContain('Catégorie');
    expect(texte).toContain('Taille');
    expect(texte).toContain('Poids');
  });
});

describe('D39 · temoin 1 bis — un compte ENTRAINEUR ne voit aucun bloc de joueur', () => {
  it('ne porte AUCUN des blocs que le pack range en « heritage joueur »', async () => {
    mockPersonalStats = {
      overall: {
        football: { assists: 6, goals: 9 }, losses: 7, matches: 24, minutesPlayed: 1620, wins: 14,
      },
    };
    const arbre = await rendre(entraineur);
    const texte = texteVisible(arbre);

    // La liste « SUPPRIMÉS » de PROMPT_PROFIL_ENTRAINEUR.md, mot pour mot.
    expect(texte).not.toContain('Matchs');
    expect(texte).not.toContain('Passes déc.');
    expect(texte).not.toContain('Retours du coach');
    expect(texte).not.toContain('Poste');
    expect(texte).not.toContain('Section');
    expect(texte).not.toContain('Catégorie');
    expect(texte).not.toContain('Taille');
    expect(texte).not.toContain('Poids');
    expect(texte).not.toContain('Numéro de maillot');
    expect(texte).not.toContain('Équipes joueur');
  });

  it('porte bien ce que le pack lui accorde', async () => {
    const arbre = await rendre(entraineur);
    const texte = texteVisible(arbre);

    expect(texte).toContain('Entraîneur');
    expect(texte).toContain('Sport de préférence');
    expect(texte).toContain('Nationalité');
    expect(texte).toContain('Équipes entraînées');
    expect(texte).toContain('Historique sportif');
  });
});

describe('D39 · la page est EDITABLE — la fusion des deux onglets', () => {
  it('titre « Mon profil », et un couple Enregistrer / Annuler', async () => {
    const arbre = await rendre(joueur);
    const texte = texteVisible(arbre);

    expect(texte).toContain('Mon profil');
    expect(texte).not.toContain('INFOS PROFIL');
    expect(texte).toContain('Enregistrer');
    expect(texte).toContain('Annuler');
    // « Continuer » etait le libelle de l'ancien formulaire : il ne reste rien.
    expect(texte).not.toContain('Continuer');
  });

  it('precharge les VRAIES valeurs, jamais un placeholder gris', async () => {
    const arbre = await rendre(joueur);

    expect(texteVisible(arbre)).toContain('Youss Barbidal');
    expect(texteVisible(arbre)).toContain('Seniors A · Stade Marseillais UC');
  });

  it('« Enregistrer » n\'envoie AUCUN champ interdit au role', async () => {
    const arbre = await rendre(entraineur);

    const bouton = pressablePortant(arbre, 'Enregistrer');
    expect(bouton).toBeDefined();
    await act(async () => {
      await bouton.props.onPress();
    });

    expect(mockUpdateMe).toHaveBeenCalledTimes(1);
    const charge = mockUpdateMe.mock.calls[0][0];
    expect(charge).not.toHaveProperty('position');
    expect(charge).not.toHaveProperty('height');
    expect(charge).not.toHaveProperty('weight');
    expect(charge).not.toHaveProperty('section');
    expect(charge).not.toHaveProperty('category');
    expect(charge).not.toHaveProperty('jerseyNumber');
    expect(charge).toHaveProperty('preferredSport');
  });

  it('porte UN seul interrupteur de visibilite, pas deux', async () => {
    const arbre = await rendre(joueur);

    // 🔴 Le pack en dessine DEUX. Le serveur ne connait qu'`isLookingForClub` :
    // en afficher un second qui ecrit le meme champ serait un mensonge.
    // Ce test FIGE l'etat honnete — il devra passer a 2 le jour ou le champ
    // serveur existe.
    expect(arbre.root.findAllByType(Switch)).toHaveLength(1);
    expect(texteVisible(arbre)).toContain('Profil visible');
  });
});

describe('D39 · « Voir mon profil comme les autres »', () => {
  it('ouvre son propre profil en mode apercu', async () => {
    const arbre = await rendre(joueur);

    const bouton = pressablePortant(arbre, 'Voir mon profil comme les autres');
    expect(bouton).toBeDefined();
    await act(async () => {
      bouton.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      'UserDetails',
      { preview: true, userId: 'user-joueur' },
    );
  });

  it('l\'apercu ne montre RIEN de prive, et pas de bouton « Contacter »', async () => {
    const arbre = await rendre(joueur, { preview: true, userId: 'user-joueur' });
    const texte = texteVisible(arbre);

    // On est bien retombe sur le rendu public, pas sur la page editable.
    expect(texte).not.toContain('Enregistrer');
    // Les retours du coach sont prives : jamais dans l'apercu.
    expect(texte).not.toContain('Retours du coach');
    expect(pressablePortant(arbre, 'Contacter')).toBeUndefined();
  });
});
