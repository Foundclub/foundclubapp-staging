import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { claimClub } from '@/services/club/clubService';
import { createClubMembershipRequest } from '@/services/clubMembershipRequest/clubMembershipRequestService';

import ClubDetails from '../ClubDetails';

/**
 * AB05 — 🔴 « ACCES REFUSE » SANS DIRE POURQUOI.
 *
 * Constat d Adel, 2026-08-20, capture a l appui : sur la fiche d un club non
 * certifie, appuyer sur le bouton « c est mon club » ouvrait une fenetre
 * blanche — « Erreur / Accès refusé. » — et un bouton OK. Rien d autre.
 *
 * ⚠️ CE QUE LA MESURE A TROUVE, ET QUI N ETAIT PAS DANS LE CONSTAT :
 *
 *   DEUX boutons differents portent le libelle EXACT « C'est mon club ! »
 *   (`clubDetails.actions.joinAsMyClub` et `clubDetails.actions.join`), et ils
 *   n appellent pas la meme route :
 *     · ENTRAINEUR  -> `showJoinClubAction`          -> POST /club-membership-requests
 *     · DIRIGEANT   -> `showContactAdminClaimAction` -> POST /clubs/:id/claim
 *   et un TROISIEME, « Je dirige ce club » (`showEmptyClubClaimAction`), mene
 *   aussi vers `claim` — c est celui que voit un compte SANS ROLE.
 *
 *   ⇒ Le seul 403 joignable depuis cette fiche est celui d un compte sans role
 *   sur `claim` : `Authenticated` n a pas `api::club.club.claim` au manifeste,
 *   et 40 comptes sur 118 en production sont dans ce cas.
 *
 * 🎯 CE QUE CE FILET EXIGE : quand le serveur refuse, l ecran DIT LA RAISON,
 * en francais, en une phrase, et JAMAIS un code. Il observe ce que l ecran
 * MONTRE (`Alert.alert`), jamais ce qu il dessine.
 *
 * 🔴 ETAT AVANT LE LOT, mesure :
 *   · « Je dirige ce club »  -> Alert avec `err.message`, soit « Forbidden »
 *                               (le mot anglais du serveur), ou « Accès refusé. »
 *                               par le filet global de `queryClient.js` ;
 *   · « C'est mon club ! »   -> AUCUNE alerte de l ecran : son `onError` ne fait
 *                               que remettre un drapeau a false. Un refus MUET.
 */

/** @type {any} */
let mockUserData;
/** @type {any} */
let mockClubQuery;
/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockRoute;
/** Le role, tel que `useAuth` le traduit en pouvoirs (useAuth.js:626-633). */
let mockCanJoinClub;
let mockCanContactAdmin;

const mockHasClubAccess = jest.fn(() => false);

/**
 * Tout ce que l'ecran a declare a `useMutation`. Le filet global de
 * `queryClient.js` lit `mutation.options.meta` : c'est ici qu'on l'observe.
 * @type {any[]}
 */
const mockOptionsDesMutations = [];

// 🔑 LE VRAI DICTIONNAIRE, jamais une doublure de phrases. `i18next` n'est
// initialise par aucun `setupFiles` sous Jest : sans ce branchement,
// `getApiErrorTranslation` ne trouverait AUCUN code et ce filet validerait des
// phrases qui n'existent pas dans l'app. Ici, ce sont les textes de `fr.js`
// eux-memes qui sont mis a l'epreuve.
jest.mock('i18next', () => {
  const dictionnaire = jest.requireActual('@/theme/strings/translations/fr').default;
  const lire = (/** @type {string} */ chemin) => String(chemin).split('.').reduce(
    (/** @type {any} */ noeud, /** @type {string} */ clef) => (
      noeud && typeof noeud === 'object' ? noeud[clef] : undefined
    ),
    dictionnaire,
  );

  return {
    __esModule: true,
    default: {
      exists: (/** @type {string} */ chemin) => typeof lire(chemin) === 'string',
      t: (/** @type {string} */ chemin) => lire(chemin) ?? chemin,
    },
  };
});

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

// `mutate` appelle vraiment la `mutationFn` : c'est ce qui fait des services
// doubles le point d'observation reseau de ce filet, et ce qui amene un refus
// serveur jusqu'au `onError` de l'ecran.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => {
    mockOptionsDesMutations.push(options);
    return {
      isPending: false,
      mutate: (/** @type {any} */ variables) => {
        const resultat = options?.mutationFn?.(variables);
        Promise.resolve(resultat)
          .then((donnees) => options?.onSuccess?.(donnees, variables))
          .catch((erreur) => options?.onError?.(erreur, variables));
      },
      options,
    };
  },
  useQuery: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
  // LOT INSTANT (2026-08-27) — l'ecran demande desormais le cache pour
  // rafraichir « Demandes », « Accueil » et « Mes equipes » apres une demande
  // d'adhesion (`joinClub`). Sans cette doublure, le rendu jette.
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      const gabarit = (() => {
        if (typeof repli === 'string') return repli;
        if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
        return cle;
      })();

      if (!repli || typeof repli !== 'object') return gabarit;
      return gabarit.replace(
        /\{\{(\w+)\}\}/g,
        (/** @type {string} */ entier, /** @type {string} */ nom) => (
          repli[nom] === undefined ? entier : String(repli[nom])
        ),
      );
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  markOnboardingComplete: jest.fn(),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    activeClubId: 'club-1',
    canContactAdmin: mockCanContactAdmin,
    canEditClub: (/** @type {string} */ id) => mockHasClubAccess(id),
    canJoinClub: mockCanJoinClub,
    clubs: [],
    getNextOnboardingRoute: () => null,
    getPostOnboardingHomeRoute: () => null,
    hasClubAccess: mockHasClubAccess,
    inviteTrainer: jest.fn(),
    isClubMember: (/** @type {string} */ id) => mockHasClubAccess(id),
    refetchUserData: jest.fn(),
    USER_ROLES: { coach: 'coach', player: 'player', president: 'president' },
    userData: mockUserData,
  }),
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({
    getClubInitials: (/** @type {string} */ nom) => String(nom || '').slice(0, 2),
  }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startClubChat: jest.fn() }),
}));

// Le VRAI theme, jamais un Proxy : un Proxy rend les echecs Jest illisibles.
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
        edit: 1, phone: 2, pin: 3, plus: 4, trash: 5,
      },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/navigation/navigationAvailability', () => ({
  navigateToStackScreenOrScreen: jest.fn(),
}));

jest.mock('@/navigation/public/publicAuthNavigation', () => ({
  openPublicAuthFlow: jest.fn(),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [] }),
}));

// Services doubles ENTIEREMENT : ces modules importent le client HTTP, qui
// refuse de se charger sans `API_URL`.
jest.mock('@/services/auth/authService', () => ({
  contactClubAdmin: jest.fn(),
  deleteManagerFromClub: jest.fn(),
  deleteTrainerFromClub: jest.fn(),
  leaveClub: jest.fn(),
}));

jest.mock('@/services/category/categoryService', () => ({
  getCategorySortKey: () => ({ group: 0, rank: 0 }),
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => mockClubQuery,
}));

jest.mock('@/services/club/clubService', () => ({
  claimClub: jest.fn(),
  updateClub: jest.fn(),
}));

jest.mock('@/services/clubInterestRequest/clubInterestRequestQueries', () => ({
  useGetMyClubInterestRequests: () => ({ data: { data: [] }, refetch: jest.fn() }),
}));

jest.mock('@/services/clubInterestRequest/clubInterestRequestService', () => ({
  createClubInterestRequest: jest.fn(),
}));

jest.mock('@/services/clubMembershipRequest/clubMembershipRequestService', () => ({
  createClubMembershipRequest: jest.fn(),
}));

jest.mock('@/services/clubRequest/clubRequestService', () => ({
  createClubRequest: jest.fn(),
  getPendingClubCreationRequests: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@/services/facility/facilityQueries', () => ({
  useClubFacilityContext: () => ({ data: { allFacilities: [], cmId: null }, isLoading: false }),
}));

jest.mock('@/services/facility/facilityService', () => ({
  getFacilitySections: () => [],
}));

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  createTeamMembershipRequest: jest.fn(),
}));

jest.mock('@/utils/shareLinks', () => ({
  buildPublicWebUrl: () => 'https://foundclub.app/clubs/club-1',
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => function WithDataWrapperMock({ children }) {
    return children;
  },
);

jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});

// Le bouton est un VRAI pressable portant son libelle : c'est ce qui permet
// d'appuyer « sur le texte ».
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      {
        accessibilityLabel: props.accessibilityLabel,
        disabled: props.disabled || props.isLoading,
        onPress: props.onPress,
      },
      reactActuel.createElement(TexteRN, null, props.title || props.icon || ''),
    );
  };
});

jest.mock('@/components/atoms/checkable/Checkable', () => function CheckableMock() {
  return null;
});

jest.mock(
  '@/components/atoms/sponsorLogoTile/SponsorLogoTile',
  () => function SponsorLogoTileMock() {
    return null;
  },
);

jest.mock('@/components/atoms/teamShield/TeamShield', () => function TeamShieldMock() {
  return null;
});

jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock() {
    return null;
  },
);

jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() {
    return null;
  },
);

jest.mock('@/components/molecules/clubSelector/ClubSelector', () => function ClubSelectorMock() {
  return null;
});

jest.mock('@/components/molecules/header/ClubScopeToggle', () => function ClubScopeToggleMock() {
  return null;
});

jest.mock('@/components/molecules/input/Input', () => function InputMock() {
  return null;
});

jest.mock(
  '@/components/molecules/profileAvatar/ProfileAvatar',
  () => function ProfileAvatarMock() {
    return null;
  },
);

jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function SegmentedControlMock() {
    return null;
  },
);

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() {
    return null;
  },
);

jest.mock('../ClubPlanningScreen', () => function ClubPlanningMock() {
  return null;
});

/** Le club de la capture : il existe, personne n y est dirigeant, non certifie. */
const CLUB_SANS_DIRIGEANT = {
  activites: [],
  clubMembersPublicVisibility: true,
  documentId: 'club-1',
  members: [],
  name: 'BASKET CLUB DE LETOILE',
  sponsor: [],
  teams: [],
  trainers: [],
};

const LIBELLE_JE_DIRIGE = 'Je dirige ce club';
const LIBELLE_MON_CLUB = "C'est mon club !";

/** Le refus tel que l intercepteur le rejette : `response.data.error` deballe. */
const REFUS_403 = {
  details: {},
  message: 'Forbidden',
  name: 'ForbiddenError',
  status: 403,
};

/**
 * Aplatit les enfants d'un noeud en une chaine.
 * @param {any} enfants - Les enfants du noeud.
 * @returns {string} Le texte aplati.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Texte visible sous un noeud de l'arbre rendu.
 * @param {any} noeud - Le noeud observe.
 * @returns {string} Le texte visible.
 */
const texteDe = (noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children))
  .join(' ');

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte la fiche club.
 * @returns {any} L'arbre monte.
 */
const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ClubDetails
        navigation={/** @type {any} */ (mockNavigation)}
        route={/** @type {any} */ (mockRoute)}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};

/**
 * Trouve le pressable le plus profond qui porte ce libelle, ou undefined.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} libelle - Le libelle visible.
 * @returns {any} Le noeud, ou undefined.
 */
const pressableAvecTexte = (arbre, libelle) => {
  const candidats = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
    .filter((/** @type {any} */ noeud) => texteDe(noeud).includes(libelle));

  if (candidats.length === 0) return undefined;

  return candidats.find((/** @type {any} */ noeud) => texteDe(noeud).trim() === libelle)
    || candidats[candidats.length - 1];
};

/**
 * Appuie sur un bouton, laisse la promesse du reseau se resoudre, et rend les
 * fenetres affichees.
 * @param {any} arbre - L'arbre monte.
 * @param {string} libelle - Le libelle du bouton.
 * @returns {Promise<{ message: string, titre: string }[]>} Les fenetres.
 */
const appuyerPuisLireLesFenetres = async (arbre, libelle) => {
  const bouton = pressableAvecTexte(arbre, libelle);
  expect(bouton).toBeDefined();

  await act(async () => {
    bouton.props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  return /** @type {any} */ (Alert.alert).mock.calls.map((/** @type {any[]} */ appel) => ({
    message: String(appel[1] || ''),
    titre: String(appel[0] || ''),
  }));
};

/**
 * Confirme la fenetre « Tu diriges ce club ? » que `handleClaimClub` ouvre
 * AVANT d'envoyer quoi que ce soit.
 * @returns {Promise<void>} Rien.
 */
const confirmerLaFenetreDeConfirmation = async () => {
  const appelConfirmation = /** @type {any} */ (Alert.alert).mock.calls.at(-1);
  const confirmer = (appelConfirmation?.[2] || [])
    .find((/** @type {any} */ bouton) => bouton?.text === 'Confirmer');
  expect(confirmer).toBeDefined();

  await act(async () => {
    confirmer.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOptionsDesMutations.length = 0;
  mockHasClubAccess.mockReturnValue(false);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  // Le cas de la capture : un compte SANS ROLE, donc ni joueur, ni entraineur,
  // ni dirigeant. `useAuth` ne lui donne aucun des deux pouvoirs de la fiche.
  mockCanJoinClub = false;
  mockCanContactAdmin = false;
  mockUserData = {
    documentId: 'u-1',
    firstname: 'Ada',
    myTeams: [],
    role: { name: 'Authenticated' },
    trainedTeams: [],
  };
  mockClubQuery = {
    data: CLUB_SANS_DIRIGEANT,
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  };
  mockNavigation = {
    addListener: jest.fn(() => jest.fn()),
    getParent: jest.fn(() => null),
    getState: jest.fn(() => ({ routeNames: [] })),
    goBack: jest.fn(),
    navigate: jest.fn(),
    push: jest.fn(),
    setOptions: jest.fn(),
  };
  mockRoute = { params: { clubId: 'club-1' } };
});

afterEach(() => {
  arbresMontes.forEach((arbre) => act(() => arbre.unmount()));
  arbresMontes.length = 0;
  /** @type {any} */ (Alert.alert).mockRestore?.();
});

// ===========================================================================
// TEMOIN 4 — 🎯 UN REFUS AFFICHE UNE PHRASE QUI DIT POURQUOI
// ===========================================================================

describe('AB05 — quand le serveur refuse, l ecran dit POURQUOI', () => {
  it('LE TEMOIN : « Je dirige ce club » refuse -> une phrase, jamais « Accès refusé »', async () => {
    /** @type {any} */ (claimClub).mockRejectedValue(REFUS_403);
    const arbre = monter();

    await appuyerPuisLireLesFenetres(arbre, LIBELLE_JE_DIRIGE);
    await confirmerLaFenetreDeConfirmation();

    const fenetres = /** @type {any} */ (Alert.alert).mock.calls
      .map((/** @type {any[]} */ appel) => String(appel[1] || ''));
    const refus = fenetres.at(-1);

    // 🎯 Elle dit la RAISON : le compte n a pas encore de role.
    expect(refus).toContain('rôle');
    // 🎯 Et la SORTIE : ce qu il faut faire pour que ca marche.
    expect(refus).toContain('inscription');
    // ⛔ Ni le mur generique, ni le mot anglais du serveur, ni un code.
    expect(refus).not.toContain('Accès refusé');
    expect(refus).not.toContain('Forbidden');
    expect(refus).not.toMatch(/[A-Z_]{6,}/);
  });

  it("« C'est mon club ! » d un ENTRAINEUR refuse -> une phrase, jamais le silence", async () => {
    // Un entraineur : c est LUI qui voit ce bouton-la (canJoinClub === coach).
    mockCanJoinClub = true;
    mockUserData.role = { name: 'coach' };
    /** @type {any} */ (createClubMembershipRequest).mockRejectedValue(REFUS_403);
    const arbre = monter();

    const fenetres = await appuyerPuisLireLesFenetres(arbre, LIBELLE_MON_CLUB);

    // 🔴 AVANT le lot : ce tableau etait VIDE. Le `onError` de cette mutation ne
    //    faisait que remettre un drapeau a false — un refus parfaitement MUET
    //    cote ecran, et une phrase creuse cote filet global.
    expect(fenetres.length).toBeGreaterThan(0);
    const refus = fenetres.at(-1).message;
    expect(refus).toContain('rôle');
    expect(refus).not.toContain('Accès refusé');
    expect(refus).not.toContain('Forbidden');
    expect(refus).not.toMatch(/[A-Z_]{6,}/);
  });

  it('le motif du serveur BAT le statut : « demande deja en attente » garde sa phrase', async () => {
    mockCanJoinClub = true;
    mockUserData.role = { name: 'coach' };
    // Le refus que pose la policy `had-pending-membership-request` : un 403 QUI
    // PORTE UN CODE. Ce code est plus precis que tout ce que l ecran peut
    // deviner d un statut — il doit gagner.
    /** @type {any} */ (createClubMembershipRequest).mockRejectedValue({
      details: { code: 'HAD_PENDING_MEMBERSHIP_REQUEST_POLICY_ERROR' },
      message: 'Forbidden',
      name: 'PolicyError',
      status: 403,
    });
    const arbre = monter();

    const fenetres = await appuyerPuisLireLesFenetres(arbre, LIBELLE_MON_CLUB);

    expect(fenetres.length).toBeGreaterThan(0);
    const refus = fenetres.at(-1).message;
    expect(refus).toContain('déjà');
    // ⛔ Surtout PAS la phrase du compte sans role : ce compte-la EN A un.
    expect(refus).not.toContain('inscription');
  });

  it('🔒 un seul message par geste : le filet global est mis en sourdine', () => {
    monter();

    // `shouldSkipMutationErrorAlert` lit `mutation.options.meta.preventToastError`
    // (app/src/app/queryClient.js). Sans ce drapeau, DEUX fenetres se
    // superposent pour un seul appui : celle de l ecran, qui dit POURQUOI, et
    // celle du filet, qui dit « Accès refusé. » — c'est la seconde qu'Adel a
    // prise en photo.
    // Les deux gestes de la fiche qui menent a « c'est mon club ».
    [claimClub, createClubMembershipRequest].forEach((service) => {
      const mutation = mockOptionsDesMutations
        .find((/** @type {any} */ options) => options?.mutationFn === service);

      expect(mutation).toBeDefined();
      expect(mutation.meta?.preventToastError).toBe(true);
      // ⛔ Et elle doit dire quelque chose elle-meme : se taire des deux cotes
      // serait pire que le mur generique.
      expect(typeof mutation.onError).toBe('function');
    });
  });
});

// ===========================================================================
// 🔒 LA NON-REGRESSION — le succes ne bouge pas d un mot
// ===========================================================================

describe('AB05 — 🔒 ce que le lot ne devait PAS changer', () => {
  it('une revendication qui REUSSIT garde exactement sa fenetre « Demande envoyée »', async () => {
    /** @type {any} */ (claimClub).mockResolvedValue({ message: 'Claim request sent successfully' });
    const arbre = monter();

    await appuyerPuisLireLesFenetres(arbre, LIBELLE_JE_DIRIGE);
    await confirmerLaFenetreDeConfirmation();

    const fenetres = /** @type {any} */ (Alert.alert).mock.calls
      .map((/** @type {any[]} */ appel) => String(appel[0] || ''));
    expect(fenetres).toContain('Demande envoyée');
  });

  it('une adhesion qui REUSSIT garde sa fenetre, et n emprunte pas la phrase d un refus', async () => {
    mockCanJoinClub = true;
    mockUserData.role = { name: 'coach' };
    /** @type {any} */ (createClubMembershipRequest).mockResolvedValue({ documentId: 'r-1' });
    const arbre = monter();

    const fenetres = await appuyerPuisLireLesFenetres(arbre, LIBELLE_MON_CLUB);

    expect(fenetres.length).toBeGreaterThan(0);
    expect(fenetres.at(-1).message).not.toContain('rôle');
  });
});
