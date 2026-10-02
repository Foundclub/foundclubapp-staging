import { ScrollView, StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserDetails from '../UserDetails';

// FINITIONS8 · POINT 3 (tournee 9) — LE PIED « CONTACTER / BLOQUER » RECOUVRAIT L'HISTORIQUE.
//
// Capture : .recette/tournee9/T9_DEFAUT_profil_pied_contacter_bloquer_couvre_historique_defile.png
// Sur « Infos profil », le pied « Contacter / Bloquer cette personne » recouvrait la carte
// « Historique sportif » ; l'ecran ne defilait pas plus loin, et le texte se lisait a travers
// « Bloquer ».
// 🧭 Deux causes, mesurees dans UserDetails.js :
//   · le pied flottait SANS FOND (`Colors.transparent`) ;
//   · la place reservee sous le defilement etait un nombre fixe (`insets.bottom + 128`), plus
//     court que le pied a deux boutons, pose lui-meme a `insets.bottom + 8` du bas.
// ✅ La regle verifiee ici ne depend d'aucun nombre : le bas du contenu doit pouvoir monter
// AU-DESSUS du haut du pied, quelle que soit la hauteur que le pied MESURE (`onLayout`).
// Le fond reprend celui du pied de la fiche club (FINITIONS5/F6-5) : `primary900`, opaque.
// Banc : les doublures de UserDetails.bloquer.test.js, recopiees telles quelles (fabrique).

/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockFetchedUser;
/** @type {any} */
let mockBlockedRows;
const mockNavigate = jest.fn();
const mockBlockMutate = jest.fn();
const mockUnblockMutate = jest.fn();

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
  default: () => ({
    startGroupChat: jest.fn(),
    startWhisperChat: jest.fn(),
  }),
}));

jest.mock('@/services/auth/authQueries', () => ({
  useGetUserById: () => ({
    data: mockFetchedUser,
    error: undefined,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useUserCurrentLicense: () => ({ data: undefined, refetch: jest.fn() }),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetPersonalStats: () => ({
    data: undefined,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useGetMyHistories: () => ({ refetch: jest.fn() }),
  useGetUserHistories: () => ({ refetch: jest.fn() }),
}));

// ⚠️ AUCUN `requireActual` ici : ce module importe le client HTTP, qui refuse
// de se charger sans `.env` -- absent de TOUT worktree. Un `requireActual`
// ferait echouer la suite ENTIERE au chargement, sans executer un seul test.
jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useBlockUser: () => ({ isPending: false, mutate: mockBlockMutate }),
  useGetMyBlockedUsers: () => ({ data: mockBlockedRows, refetch: jest.fn() }),
  useUnblockUser: () => ({ isPending: false, mutate: mockUnblockMutate }),
}));

// ST-RETOURS (02/10) — le profil lit « ce que j ai deja lu » des retours du coach. Le service
// importe le client HTTP, qui refuse de se charger sans .env : il est double ici comme les autres.
jest.mock('@/services/coachFeedback/coachFeedbackQueries', () => ({
  useGetCoachFeedbackFollow: () => ({ data: {}, isSuccess: true }),
  useUpdateCoachFeedbackFollow: () => ({ mutate: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

jest.mock('@/views/profile/SelfProfileUnified', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>ECRAN PROFIL UNIFIE</TexteRN>,
  };
});

jest.mock('@/views/profile/SelfProfilePlayerCoach', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>ECRAN PROFIL JOUEUR OU ENTRAINEUR</TexteRN>,
  };
});

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
        calendar: 1,
        check: 1,
        edit: 1,
        envelope: 1,
        phone: 1,
        pin: 1,
        running: 1,
        shield: 1,
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

/**
 * Monte l'ecran pour l'utilisateur courant donne.
 * @param {any} utilisateurCourant - Celui qui regarde.
 * @param {any} [parametresRoute] - Les parametres de route.
 * @returns {Promise<any>} L'arbre rendu.
 */
const rendre = async (utilisateurCourant, parametresRoute = {}) => {
  mockAuthValue = {
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
        navigation={/** @type {any} */ ({ navigate: mockNavigate })}
        route={/** @type {any} */ ({ params: parametresRoute })}
      />,
    );
  });
  return arbre;
};

const dirigeantConnecte = { documentId: 'moi', role: { name: 'Dirigeant', type: 'president' } };

const personneRegardee = {
  birthdate: '1995-04-10',
  documentId: 'autre-1',
  firstname: 'Autre',
  lastname: 'Personne',
  role: { name: 'Joueur', type: 'player' },
};

const COULEURS = jest.requireActual('@/theme/colors').default();

/**
 * Le pied flottant : le bloc pose en absolu qui porte « Bloquer cette personne ».
 * @param {any} arbre - L'arbre rendu.
 * @returns {any} Le noeud, ou undefined.
 */
const lePied = (arbre) => arbre.root.findAll((/** @type {any} */ noeud) => (
  typeof noeud.type === 'string'
  && StyleSheet.flatten(noeud.props?.style)?.position === 'absolute'
  && noeud.findAll(
    (/** @type {any} */ enfant) => enfant.props?.title === 'Bloquer cette personne',
  ).length > 0
))[0];

/**
 * La place reservee sous le contenu qui defile.
 * @param {any} arbre - L'arbre rendu.
 * @returns {number} La marge du bas.
 */
const margeDuBas = (arbre) => Number(
  StyleSheet.flatten(
    arbre.root.findAllByType(ScrollView)[0].props.contentContainerStyle,
  )?.paddingBottom,
);

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchedUser = personneRegardee;
  mockBlockedRows = [];
});

describe('FINITIONS8 · point 3 — le pied ne recouvre plus la fiche', () => {
  test('🚨 le pied a un fond OPAQUE : on ne lit plus la carte a travers « Bloquer »', async () => {
    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
    const pied = lePied(arbre);

    expect(pied).toBeDefined();
    expect(StyleSheet.flatten(pied.props.style).backgroundColor).toBe(COULEURS.primary900);
  });

  test.each([140, 190, 260])(
    '🚨 pied mesure a %i : le bas du contenu remonte au-dessus du haut du pied',
    async (hauteur) => {
      const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
      const pied = lePied(arbre);

      await act(async () => {
        pied.props.onLayout?.({
          nativeEvent: {
            layout: {
              height: hauteur, width: 375, x: 0, y: 0,
            },
          },
        });
      });

      const piedApres = lePied(arbre);
      const hautDuPied = Number(StyleSheet.flatten(piedApres.props.style).bottom || 0) + hauteur;
      expect(margeDuBas(arbre)).toBeGreaterThanOrEqual(hautDuPied);
    },
  );

  test('jumeau : sur MON profil, aucun pied', async () => {
    mockFetchedUser = { ...personneRegardee, documentId: 'moi' };

    const arbre = await rendre(dirigeantConnecte, { userId: 'moi' });

    expect(lePied(arbre)).toBeUndefined();
  });
});
