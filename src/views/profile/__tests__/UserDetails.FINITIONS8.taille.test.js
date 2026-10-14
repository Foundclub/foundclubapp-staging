import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserDetails from '../UserDetails';

// FINITIONS8 · POINT 4 (tournee 9) — « 182 m ».
//
// Capture : .recette/tournee9/T9_A18_2_hugo_apercu_bas_sans_ajout_ni_suppression.png
// Sur « Infos profil », la fiche affichait « Taille (m) · 182 m ».
// 🧭 Trois ecrans se contredisaient : l'inscription demande des CENTIMETRES (« Taille (cm) »,
// « Ex : 180 »), la modification du profil des METRES (« Taille (m) », « 1,80 » — sur un clavier
// sans virgule), et la fiche collait « m » derriere toute valeur. Le serveur garde une chaine
// libre (`height`, string) : on y trouve les deux unites.
// ✅ Regle : on saisit des centimetres, entre 100 et 250 ; la fiche relit les deux formes et
// ecrit des metres (« 1,82 m »).
// Le controle de saisie : profileFormContract.FINITIONS8.taille.test.js.
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

// PAR-L7 (13/10) — « Mon profil » porte le bloc « Mes enfants » (`useMesEnfantsEnBref`, qui lit
// trois services) : doublure commune, « aucun enfant » par defaut.
jest.mock('@/views/profile/parent/useMesEnfantsEnBref');

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
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
 * @param {any} enfants - Les enfants React.
 * @returns {string} Le texte.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible de l'arbre rendu, concatene.
 * @param {any} arbre - L'arbre rendu.
 * @returns {string} Le texte.
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

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

/**
 * Un joueur adulte, avec une taille telle qu'elle est enregistree.
 * @param {any} height - La valeur du serveur.
 * @returns {any} Le compte.
 */
const joueurDeTaille = (height) => ({
  birthdate: '1995-04-10',
  documentId: 'autre-1',
  firstname: 'Autre',
  height,
  lastname: 'Personne',
  role: { name: 'Joueur', type: 'player' },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockBlockedRows = [];
});

describe('FINITIONS8 · point 4 — la taille se lit en metres, quelle que soit l unite', () => {
  test.each([
    ['182', '1,82 m'],
    ['1,80', '1,80 m'],
    ['1.75', '1,75 m'],
  ])('🚨 enregistree « %s » : la fiche dit « %s »', async (enregistree, attendue) => {
    mockFetchedUser = joueurDeTaille(enregistree);

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
    const texte = texteVisible(arbre);

    expect(texte).toContain(attendue);
    expect(texte).not.toMatch(/\b1\d\d m\b/);
    expect(texte).not.toContain('Taille (m)');
  });

  test('une valeur illisible n est pas affichee telle quelle avec « m »', async () => {
    mockFetchedUser = joueurDeTaille('grand');

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });

    expect(texteVisible(arbre)).not.toContain('grand m');
  });
});
