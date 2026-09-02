import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserDetails from '../UserDetails';

// CONVAVERT (C3) — UN REFUS DIT POURQUOI, ET IL EST LU.
//
// 🔴 LE DEFAUT MESURE LE 2026-09-02, avant ce lot : le serveur refusait bien le
// tête-à-tête avec un mineur (lot ENFANTS, `minor-chat-guard.ts`) et renvoyait
// sa raison EN FRANÇAIS — mais l'app ne la montrait jamais.
// `getErrorMessage` (`utils/errors/displayError.js`) ne recopie le message brut
// du serveur QUE sous `__DEV__` ; en production il retombe sur
// `APIerrors.generic`, donc sur « Une erreur est survenue ». Et comme aucune
// clef `APIerrors.MINOR_DIRECT_CHAT_FORBIDDEN` n'existait, il n'y avait rien à
// traduire non plus : le refus arrivait muet chez la personne.
//
// 🎯 CE QUE CE FICHIER FIGE : la phrase du serveur — qui sait QUI demande, donc
// dit « ton club » à l'ado et autre chose à l'adulte — arrive telle quelle à
// l'écran. Et si elle manque, le repli traduit prend le relais : plus jamais
// « Une erreur est survenue » sur ce refus-là.

/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockFetchedUser;
/** @type {any} */
let mockErreurContact;
const mockNavigate = jest.fn();
const mockStartWhisperChat = jest.fn();

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
    startWhisperChat: mockStartWhisperChat,
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
// de se charger sans `.env` -- absent de TOUT worktree.
jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useBlockUser: () => ({ isPending: false, mutate: jest.fn() }),
  useGetMyBlockedUsers: () => ({ data: [], refetch: jest.fn() }),
  useUnblockUser: () => ({ isPending: false, mutate: jest.fn() }),
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
      Images: new Proxy({}, { get: () => 1 }),
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

const PHRASE_SERVEUR_POUR_L_ADULTE = 'Cette personne est mineure : seuls les encadrants de son club peuvent lui écrire en privé.';
const PHRASE_DE_REPLI = 'Discussion privée impossible : un mineur ne peut échanger en privé '
  + "qu'avec son parent ou les encadrants de son club.";

/**
 * Le refus tel que Strapi le renvoie a l app : un 403 avec son code, sa raison
 * et sa phrase.
 * @param {object} options - Les options.
 * @param {string} [options.message] - La phrase du serveur, ou rien.
 * @returns {any} L erreur, telle que le client HTTP la propage.
 */
const refusDuServeur = ({ message } = {}) => ({
  response: {
    data: {
      error: {
        details: { code: 'MINOR_DIRECT_CHAT_FORBIDDEN', protectedUnderAge: 13, reason: 'TEEN_STAFF_ONLY' },
        message,
        status: 403,
      },
    },
    status: 403,
  },
});

/**
 * Appuie sur le bouton qui porte ce titre.
 * @param {any} arbre - L arbre rendu.
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
    await cible[0].props.onPress();
  });
};

/**
 * La derniere alerte affichee.
 * @returns {any} { titre, message }.
 */
const derniereAlerte = () => {
  const appels = /** @type {any} */ (Alert.alert).mock.calls;
  const [titre, message] = appels[appels.length - 1] || [];
  return { message, titre };
};

/**
 * Monte l ecran pour l utilisateur courant donne.
 * @param {any} utilisateurCourant - Celui qui regarde.
 * @param {any} [parametresRoute] - Les parametres de route.
 * @returns {Promise<any>} L arbre rendu.
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

// ⚠️ `age` et non `birthdate` : SECU-EVENT a retire la date de naissance du
// profil public. C est bien 14 ans, donc le chemin serveur (13-17), pas la
// branche « moins de 13 ans » qui, elle, se decide dans l app.
const adoDeQuatorzeAns = {
  age: 14,
  documentId: 'ado-1',
  firstname: 'Lina',
  lastname: 'Mineure',
  role: { name: 'Joueur', type: 'player' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchedUser = adoDeQuatorzeAns;
  mockErreurContact = refusDuServeur({ message: PHRASE_SERVEUR_POUR_L_ADULTE });
  mockStartWhisperChat.mockImplementation(() => Promise.reject(mockErreurContact));
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("C3-1 — le refus du serveur s'affiche EN TOUTES LETTRES, pas « Une erreur est survenue »", async () => {
  const arbre = await rendre(dirigeantConnecte, { userId: 'ado-1' });

  await appuyerSur(arbre, 'Contacter');

  const { message } = derniereAlerte();
  expect(message).toBe(PHRASE_SERVEUR_POUR_L_ADULTE);
  expect(message).not.toMatch(/Une erreur est survenue/i);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("C3-2 — si le serveur n'envoie pas de phrase, le repli traduit prend le relais", async () => {
  mockErreurContact = refusDuServeur({});
  mockStartWhisperChat.mockImplementation(() => Promise.reject(mockErreurContact));

  const arbre = await rendre(dirigeantConnecte, { userId: 'ado-1' });

  await appuyerSur(arbre, 'Contacter');

  const { message } = derniereAlerte();
  expect(message).toBe(PHRASE_DE_REPLI);
  expect(message).not.toMatch(/Une erreur est survenue/i);
});
