import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserDetails from '../UserDetails';

// BLOQUER (E6) — LE BOUTON, LA OU APPLE LE CHERCHE : SUR LA FICHE D'UNE PERSONNE.
//
// 🔴 LA MESURE DU 2026-09-02, avant ce lot :
//   grep -rniE "bloquer cet utilisateur|blockUser|block-user" app/src -> 0.
//   Le SIGNALEMENT d'un message existait ; le BLOCAGE d'une personne, non.
//   Apple 1.2 exige quatre dispositifs pour le contenu produit par les
//   utilisateurs — filtrage, signalement, BLOCAGE, coordonnées — et Google Play
//   écrit « must provide an in-app functionality for blocking users ».
//
// ⚠️ LE BOUTON N'EST PAS RESERVE AUX ENCADRANTS. « Contacter » l'est
// (`canContact` : entraîneur ou dirigeant seulement) ; bloquer ne peut pas
// l'être — un joueur qui reçoit des messages déplacés doit pouvoir se protéger.
// C'est le témoin 4 qui le fige.
//
// ⚠️ CE FICHIER NE MESURE PAS LA BARRIERE : le serveur REFUSE tout seul
// (admin, tests/authz/BLOQUER-le-serveur-refuse.test.js). Ici on vérifie que le
// geste EXISTE, qu'il demande confirmation, et qu'il appelle bien le serveur.

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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
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
 * Appuie sur le bouton qui porte ce titre.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} titre - Le libelle du bouton.
 * @returns {Promise<void>} Rien.
 */
const appuyerSur = async (arbre, titre) => {
  const cible = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props?.title === titre
      && typeof noeud.props?.onPress === 'function',
  );
  if (cible.length === 0) throw new Error(`Aucun bouton « ${titre} » a l'ecran`);
  await act(async () => {
    cible[0].props.onPress();
  });
};

/**
 * La derniere alerte affichee.
 * @returns {any} { titre, message, boutons }.
 */
const derniereAlerte = () => {
  const appels = /** @type {any} */ (Alert.alert).mock.calls;
  const [titre, message, boutons] = appels[appels.length - 1] || [];
  return { boutons: boutons || [], message, titre };
};

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
const joueurConnecte = { documentId: 'moi', role: { name: 'Joueur', type: 'player' } };

const personneRegardee = {
  birthdate: '1995-04-10',
  documentId: 'autre-1',
  firstname: 'Autre',
  lastname: 'Personne',
  role: { name: 'Joueur', type: 'player' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchedUser = personneRegardee;
  mockBlockedRows = [];
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('BLOQUER A1 — la fiche d\'une autre personne porte « Bloquer cette personne »', async () => {
  const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });

  expect(texteVisible(arbre)).toContain('Bloquer cette personne');
});

test('BLOQUER A2 — l\'appui demande confirmation AVANT d\'appeler le serveur', async () => {
  const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });

  await appuyerSur(arbre, 'Bloquer cette personne');

  expect(mockBlockMutate).not.toHaveBeenCalled();
  const { boutons, message } = derniereAlerte();
  expect(message).toContain('ne pourra plus');
  expect(boutons.length).toBeGreaterThanOrEqual(2);
});

test('BLOQUER A3 — confirmer envoie le blocage au serveur, avec la bonne personne', async () => {
  const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });

  await appuyerSur(arbre, 'Bloquer cette personne');
  const confirmation = derniereAlerte().boutons.find(
    (/** @type {any} */ bouton) => bouton?.style === 'destructive',
  );
  await act(async () => {
    confirmation.onPress();
  });

  expect(mockBlockMutate).toHaveBeenCalledWith('autre-1');
});

test('BLOQUER A4 — un JOUEUR aussi peut bloquer : le geste n\'est pas reserve aux encadrants', async () => {
  const arbre = await rendre(joueurConnecte, { userId: 'autre-1' });
  const texte = texteVisible(arbre);

  // Un joueur ne voit pas « Contacter » (canContact) mais DOIT voir « Bloquer ».
  expect(texte).not.toContain('Contacter');
  expect(texte).toContain('Bloquer cette personne');
});

test('BLOQUER A5 — quand la personne est deja bloquee, l\'ecran propose de DEBLOQUER et retire « Contacter »', async () => {
  mockBlockedRows = [{ documentId: 'block-1', user: { documentId: 'autre-1' } }];

  const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
  const texte = texteVisible(arbre);

  expect(texte).toContain('Débloquer cette personne');
  expect(texte).not.toContain('Bloquer cette personne');
  expect(texte).not.toContain('Contacter');
});

test('BLOQUER A6 — debloquer appelle le serveur, sans confirmation destructive', async () => {
  mockBlockedRows = [{ documentId: 'block-1', user: { documentId: 'autre-1' } }];

  const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
  await appuyerSur(arbre, 'Débloquer cette personne');

  expect(mockUnblockMutate).toHaveBeenCalledWith('autre-1');
});

test('BLOQUER A7 — sur MON PROPRE profil, aucun bouton de blocage', async () => {
  mockFetchedUser = { ...personneRegardee, documentId: 'moi' };

  const arbre = await rendre(dirigeantConnecte, { userId: 'moi' });
  const texte = texteVisible(arbre);

  expect(texte).not.toContain('Bloquer cette personne');
  expect(texte).not.toContain('Débloquer cette personne');
});
