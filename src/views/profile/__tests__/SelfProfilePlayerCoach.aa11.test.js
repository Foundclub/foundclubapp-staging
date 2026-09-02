import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserDetails from '../UserDetails';

// AA11 — « L'APP ENREGISTRE SANS LE DIRE », ET « JE NE VOIS QU'UN SEUL CLUB ».
//
// Les deux constats d'Adel du 2026-08-20, sur le MEME ecran :
//   ① « quand on modifie une information du profil, on manque d'un pop-up pour
//      dire "felicitations, votre (info) a ete modifiee" » ;
//   ② (D-26) « le joueur dans deux clubs, ca marche. Mais quand je regarde dans
//      mon profil, je ne vois que le premier club. »
//
// 🧭 QUEL ECRAN ? « Mon profil » n'est PAS `UserDetails` : ce composant est un
// AIGUILLAGE (`UserDetails.js:668-676`) qui rend `SelfProfilePlayerCoach` a un
// joueur ou un entraineur, et `SelfProfileUnified` a un dirigeant. Ce fichier
// monte donc `UserDetails`, comme son voisin D39, pour prouver l'aiguillage EN
// PLUS du contenu.
//
// 🎁 LE MOTIF EST CELUI DE Y04, PAS UN SECOND. Y04 a pose une table de phrases
// nommees, chacune une clef de `fr.js`
// (`services/requests/requestAcceptanceCelebration.js`). AA11 reprend cette
// table — `services/profile/profileSaveConfirmation.js` — mais PAS sa fenetre :
// Y04 affiche un `Modal` local, et un mur qu'il faut fermer a la main entre
// deux champs est exactement ce que ce lot interdit. La phrase part donc dans
// la banniere GLOBALE qui existe deja (`AppFeedbackContext`, montee par
// `AppBannerHost`), qui s'efface toute seule, se dedoublonne et fait la queue.
//
// 🔒 LE GARDE-FOU : la banniere n'est emise QUE dans `onSuccess`. Le troisieme
// temoin ci-dessous le prouve en faisant REJETER `updateMe`.
/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockPersonalStats;
const mockNavigate = jest.fn();
const mockUpdateMe = jest.fn();
/** Les bannieres emises pendant le test, dans l'ordre. */
/** @type {any[]} */
let mockBannieres = [];
/** Quand il est vrai, `updateMe` REJETTE : c'est le chemin d'echec. */
let mockEnregistrementEchoue = false;
/** Les champs de saisie, indexes par leur libelle visible. */
/** @type {Record<string, any>} */
let mockChamps = {};

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

// AA11 — la doublure de `useMutation` du voisin ne connait QUE le succes. Ici
// le garde-fou du lot (« aucune confirmation sur un echec ») a besoin du chemin
// d'erreur : cette doublure-ci appelle `onError` quand `mutationFn` rejette,
// exactement comme react-query, et n'avale rien en silence.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: async (/** @type {any} */ entree) => {
      try {
        const resultat = await options.mutationFn(entree);
        await options.onSuccess?.(resultat);
      } catch (erreur) {
        await options.onError?.(erreur);
      }
    },
  }),
  useQuery: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

// Le SEUL point d'observation du lot : la banniere globale. `emitCelebrationBanner`
// est la porte imperative de `AppFeedbackContext` (`celebrationRuntime.js:20`),
// montee une fois pour toute l'app par `AppBannerHost` (`App.js:291`) et par le
// site (`web/src/bridge/WebDeferredHosts.tsx:6`).
jest.mock('@/services/celebrations/celebrationRuntime', () => ({
  emitCelebrationBanner: (/** @type {any} */ charge) => {
    mockBannieres.push(charge);
    return charge;
  },
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: (/** @type {any} */ charge) => {
    mockUpdateMe(charge);
    if (mockEnregistrementEchoue) {
      return Promise.reject(new Error('Le serveur a refuse'));
    }
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

// AA11 — la doublure du voisin n'affiche que le libelle. Celle-ci s'ENREGISTRE
// sous son libelle visible : le test peut alors SAISIR dans un champ, et c'est
// la seule facon de prouver qu'une valeur qui a vraiment change est nommee.
jest.mock('@/components/molecules/input/Input', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => {
      mockChamps[proprietes.label] = proprietes;
      return <TexteRN>{`CHAMP:${proprietes.label ?? ''}`}</TexteRN>;
    },
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

/**
 * Un club de la charge `/me`, dans la forme que `sanitizeClubSummary` rend.
 * @param {string} documentId
 * @param {string} name
 * @returns {any}
 */
const unClub = (documentId, name) => ({
  clubPartner: false, clubVerified: false, documentId, logo: null, name,
});

const MARSEILLE = unClub('club-1', 'Stade Marseillais UC');
const GAILLON = unClub('club-2', 'Olympique de Gaillon');
const PACY = unClub('club-3', 'Etoile Sportive Pacy');
const LOUVIERS = unClub('club-4', 'Avenir Louviers');
const EVREUX = unClub('club-5', 'Union Evreux');

/**
 * Le joueur du pack, dans N clubs. `club` = le club principal, `clubs` = le
 * tableau que le serveur rend deja (`firebase-auth.ts:516`).
 * @param {any[]} clubs
 * @param {any} [extra]
 * @returns {any}
 */
const joueurDansLesClubs = (clubs, extra = {}) => ({
  ...joueur,
  ...extra,
  club: clubs[0] || null,
  clubs,
});

/**
 * Appuie sur le pressable portant ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const cible = pressablePortant(arbre, libelle);
  if (!cible) throw new Error(`Aucun pressable ne porte le libelle « ${libelle} »`);
  await act(async () => {
    cible.props.onPress();
  });
};

beforeEach(() => {
  mockBannieres = [];
  mockChamps = {};
  mockEnregistrementEchoue = false;
});

/**
 * Saisit une valeur dans le champ portant ce libelle.
 * @param {string} libelle
 * @param {any} valeur
 * @returns {Promise<void>}
 */
const saisir = async (libelle, valeur) => {
  const champ = mockChamps[libelle];
  if (!champ) throw new Error(`Aucun champ ne porte le libelle « ${libelle} »`);
  await act(async () => {
    champ.onChangeText(valeur);
  });
};

describe('AA11 · temoin 1 — enregistrer NOMME ce qui a change', () => {
  it('annonce le champ modifie, avec son libelle d\'ecran', async () => {
    const arbre = await rendre(joueur);

    await saisir('Nom', 'Barbidalou');
    await appuyerSur(arbre, 'Enregistrer');

    expect(mockUpdateMe).toHaveBeenCalledTimes(1);
    expect(mockBannieres).toHaveLength(1);
    expect(String(mockBannieres[0]?.body)).toContain('Nom');
    // ⛔ Ni « OK » creux, ni « Succes » : la phrase doit DIRE quoi.
    expect(String(mockBannieres[0]?.title)).not.toBe('Succès');
    expect(String(mockBannieres[0]?.body)).not.toBe('OK');
  });

  it('nomme les DEUX champs quand deux ont change', async () => {
    const arbre = await rendre(joueur);

    await saisir('Nom', 'Barbidalou');
    await saisir('Prénom', 'Youssef');
    await appuyerSur(arbre, 'Enregistrer');

    expect(mockBannieres).toHaveLength(1);
    expect(String(mockBannieres[0]?.body)).toContain('Nom');
    expect(String(mockBannieres[0]?.body)).toContain('Prénom');
  });

  it('n\'annonce RIEN quand aucune valeur n\'a bouge', async () => {
    const arbre = await rendre(joueur);

    await appuyerSur(arbre, 'Enregistrer');

    expect(mockUpdateMe).toHaveBeenCalledTimes(1);
    expect(mockBannieres).toHaveLength(0);
  });
});

describe('AA11 · temoin 2 — AUCUNE confirmation sur un ECHEC', () => {
  it('n\'emet aucune banniere quand le serveur refuse l\'enregistrement', async () => {
    mockEnregistrementEchoue = true;
    const arbre = await rendre(joueur);

    await saisir('Nom', 'Barbidalou');
    await appuyerSur(arbre, 'Enregistrer');

    expect(mockUpdateMe).toHaveBeenCalledTimes(1);
    expect(mockBannieres).toHaveLength(0);
  });
});

describe('AA11 · temoin 3 — trois modifications d\'affilee ne bloquent pas', () => {
  it('laisse enchainer sans jamais fermer une fenetre a la main', async () => {
    const arbre = await rendre(joueur);

    await saisir('Nom', 'Barbidalou');
    await appuyerSur(arbre, 'Enregistrer');
    await saisir('Prénom', 'Youssef');
    await appuyerSur(arbre, 'Enregistrer');
    await saisir('Nom', 'Barbidal');
    await appuyerSur(arbre, 'Enregistrer');

    expect(mockUpdateMe).toHaveBeenCalledTimes(3);
    expect(mockBannieres).toHaveLength(3);
    // 🚨 CE QUI PROUVE QUE CE N'EST PAS UN MUR : le bouton « Enregistrer »
    // repond encore au troisieme tour — aucune fenetre modale ne s'est
    // interposee, et l'ecran n'a jamais eu besoin d'etre ferme.
    expect(pressablePortant(arbre, 'Enregistrer')).toBeDefined();
    // 🧯 Ce qui prouve qu'elle s'efface TOUTE SEULE : c'est une `banniere`, et
    // `AppFeedbackContext` en retire une au bout de `DEFAULT_BANNER_DURATION_MS`
    // (`AppFeedbackContext.js:14`). Aucune action a presser n'est attachee : il
    // n'y a donc rien a fermer pour continuer.
    mockBannieres.forEach((banniere) => {
      expect(banniere?.variant).toBe('banner');
      expect(banniere?.onAction).toBeUndefined();
      expect(banniere?.actionLabel).toBeUndefined();
    });
  });
});

describe('AA11 · temoin 4 — le profil montre TOUS les clubs', () => {
  it('affiche les DEUX clubs, pas seulement le premier', async () => {
    const arbre = await rendre(joueurDansLesClubs([MARSEILLE, GAILLON]));
    const texte = texteVisible(arbre);

    expect(texte).toContain('Stade Marseillais UC');
    expect(texte).toContain('Olympique de Gaillon');
  });

  it('affiche les CINQ clubs quand il y en a cinq', async () => {
    const arbre = await rendre(
      joueurDansLesClubs([MARSEILLE, GAILLON, PACY, LOUVIERS, EVREUX]),
    );
    const texte = texteVisible(arbre);

    [MARSEILLE, GAILLON, PACY, LOUVIERS, EVREUX].forEach((club) => {
      expect(texte).toContain(club.name);
    });
  });

  it('lit aussi `clubAffiliations` quand la charge n\'aplatit pas `clubs`', async () => {
    const arbre = await rendre({
      ...joueur,
      club: MARSEILLE,
      clubAffiliations: [{ club: GAILLON, documentId: 'aff-1' }],
      clubs: undefined,
    });
    const texte = texteVisible(arbre);

    expect(texte).toContain('Stade Marseillais UC');
    expect(texte).toContain('Olympique de Gaillon');
  });

  it('ne repete pas un club present a la fois en principal et en affiliation', async () => {
    const arbre = await rendre({
      ...joueur,
      club: MARSEILLE,
      clubAffiliations: [{ club: MARSEILLE, documentId: 'aff-1' }],
      clubs: [MARSEILLE, GAILLON],
    });

    expect(texteVisible(arbre).split('BLASON:Stade Marseillais UC')).toHaveLength(2);
  });
});

describe('AA11 · le cas limite — un role DIFFERENT dans chaque club', () => {
  it('dit « Joueur » la ou il joue et « Entraîneur » la ou il entraine', async () => {
    const arbre = await rendre(joueurDansLesClubs([MARSEILLE, GAILLON], {
      myTeams: [{ club: MARSEILLE, documentId: 'team-9', name: 'Seniors A' }],
      trainedTeams: [{ club: GAILLON, documentId: 'team-2', name: 'U15' }],
    }));
    const texte = texteVisible(arbre);

    expect(texte).toContain('Joueur');
    expect(texte).toContain('Entraîneur');
  });
});

describe('AA11 · temoin 5 — avec UN SEUL club, l\'ecran ne devient pas bizarre', () => {
  it('ne montre ni liste de clubs, ni compteur, ni nom en double', async () => {
    const arbre = await rendre(joueurDansLesClubs([MARSEILLE]));
    const texte = texteVisible(arbre);

    expect(texte.split('Stade Marseillais UC')).toHaveLength(2);
    expect(texte).not.toContain('Mes clubs');
  });

  it('n\'invente rien quand il n\'y a AUCUN club', async () => {
    const arbre = await rendre(joueurDansLesClubs([]));

    expect(texteVisible(arbre)).not.toContain('Mes clubs');
  });
});
