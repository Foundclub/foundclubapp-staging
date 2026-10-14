import { StyleSheet, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserDetails from '../UserDetails';

// PROFIL-CRAYON (14/10) — LE CRAYON « MODIFIER MON NOM ET MA PHOTO » ETAIT MORT.
//
// Seance emulateur du 14/10 (`.tmp/portes/ANDROIDBAR/SEANCE-1310`, capture f10) :
// compte Dirigeant, Profil > Voir mon profil > crayon : 3 appuis, aucun ecran.
// C'est le SEUL acces d'un dirigeant au formulaire complet
// (`Profile.menuProfil.test.js`, D41 : la rangee « Modifier mon profil » lui a
// ete retiree).
//
// ⛔ CE N'ETAIT PAS LA NAVIGATION. `UserDetails` est un ecran de `ProfileStack`
// (seule declaration), `ProfileEdit` aussi : le nom nu resout. Le temoin 2
// ci-dessous le fige.
//
// 🎯 LA CAUSE : L'ORDRE DE PEINTURE. Le crayon est pose en `position: absolute`
// en PREMIER enfant de la carte ; la rangee avatar + nom vient APRES lui, donc
// AU-DESSUS. Le texte du nom s'etire jusqu'au bord droit de la carte et
// recouvre le crayon presque entier (bornes relevees sur l'emulateur : nom
// [313,490][973,569], crayon [894,479][983,568]). Le doigt touche le NOM, et la
// touche remonte les PARENTS du nom — le crayon, simple voisin, ne la recoit
// jamais. Meme regle sur iPhone (hitTest) et sur le site (z-index 0 pose par
// react-native-web sur chaque vue : l'ordre du document decide).
//
// La regle du temoin 1 est celle des trois moteurs : un voisin rendu APRES est
// dessine AU-DESSUS, sauf si le crayon a un `zIndex` STRICTEMENT plus grand.

/** @type {any} */
let mockAuthValue;
const mockNavigate = jest.fn();
const mockPush = jest.fn();

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

// ST-RETOURS (02/10) — le profil lit « ce que j ai deja lu » des retours du coach. Le service
// importe le client HTTP, qui refuse de se charger sans .env : il est double ici comme les autres.
jest.mock('@/services/coachFeedback/coachFeedbackQueries', () => ({
  useGetCoachFeedbackFollow: () => ({ data: {}, isSuccess: true }),
  useUpdateCoachFeedbackFollow: () => ({ mutate: jest.fn() }),
}));

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
  useQuery: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

// Le service porte le client HTTP, qui exige `API_URL` au chargement : le tirer
// pour de vrai tue la suite entiere.
jest.mock('@/services/auth/authService', () => ({
  updateMe: (/** @type {any} */ charge) => Promise.resolve({ ...charge }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthValue,
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({
    getClubInitials: jest.requireActual('@/domains/club/clubUseCase').getClubInitials,
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
  useGetPersonalStats: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
}));

jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useGetMyHistories: () => ({ data: [], refetch: jest.fn() }),
  useGetUserHistories: () => ({ data: [], refetch: jest.fn() }),
}));

jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [] }),
}));

jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ data: [] }),
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

// LES DEUX FEUILLES DE `ClubLogoMark`, et rien de plus.
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { imageUrl }) => <TexteRN>{`IMAGE:${imageUrl || ''}`}</TexteRN>,
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

// Tire `react-native-bouncy-checkbox`, publie en ESM pur et absent de
// `transformIgnorePatterns` : sans doublure, la suite ne se charge pas.
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

jest.mock('@/components/molecules/selectAvatar/SelectAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>SELECTEUR AVATAR</TexteRN>,
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

const LIBELLE_CRAYON = 'Modifier mon nom et ma photo';

/** Le dirigeant du pack, avec un club : la carte identite complete. */
const dirigeant = {
  club: { clubVerified: true, documentId: 'club-1', name: 'US Valbrune' },
  documentId: 'user-1',
  firstname: 'Mathis',
  lastname: 'Renaud',
  myTeams: [],
  phoneNumber: '+33600000002',
  role: { name: 'Dirigeant', type: 'president' },
  trainedTeams: [],
};

/**
 * Monte l'ecran de la ROUTE (`UserDetails`), comme la pile le monte.
 * @returns {Promise<any>}
 */
const rendre = async () => {
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
    userData: dirigeant,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <UserDetails
        navigation={/** @type {any} */ ({ navigate: mockNavigate, push: mockPush })}
        route={/** @type {any} */ ({ params: {} })}
      />,
    );
  });
  return arbre;
};

/**
 * Le crayon de la carte identite, trouve par son libelle d'accessibilite.
 * @param {any} arbre
 * @returns {any}
 */
const crayon = (arbre) => {
  const trouves = arbre.root
    .findAllByType(TouchableOpacity)
    .filter((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === LIBELLE_CRAYON);
  expect(trouves).toHaveLength(1);
  return trouves[0];
};

/**
 * @param {any} noeud
 * @returns {number}
 */
const zIndexDe = (noeud) => Number(StyleSheet.flatten(noeud?.props?.style)?.zIndex) || 0;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PROFIL-CRAYON · temoin 1 — le crayon est dessine AU-DESSUS de ce qu il chevauche', () => {
  it('aucun voisin rendu apres lui ne le recouvre', async () => {
    const arbre = await rendre();
    const bouton = crayon(arbre);
    expect(StyleSheet.flatten(bouton.props.style).position).toBe('absolute');

    const voisins = bouton.parent.children;
    const rang = voisins.indexOf(bouton);
    expect(rang).toBeGreaterThanOrEqual(0);
    // Le voisin qui a recouvert le crayon sur l'emulateur : la rangee avatar + nom.
    expect(voisins.length).toBeGreaterThan(rang + 1);

    const recouvrants = voisins
      .slice(rang + 1)
      .filter((/** @type {any} */ voisin) => typeof voisin === 'object' && zIndexDe(voisin) >= zIndexDe(bouton));
    expect(recouvrants).toHaveLength(0);
  });
});

describe('PROFIL-CRAYON · temoin 2 — la navigation, elle, etait juste (hypothese eliminee)', () => {
  it('un appui ouvre « ProfileEdit », ecran de la meme pile que « UserDetails »', async () => {
    const arbre = await rendre();

    await act(async () => {
      crayon(arbre).props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('ProfileEdit');
  });
});
