import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { invalidateAfterAction } from '@/domains/refresh/afterAction';

import { claimClub } from '@/services/club/clubService';
import {
  createClubMembershipRequest,
} from '@/services/clubMembershipRequest/clubMembershipRequestService';

import ClubDetails from '../ClubDetails';

/**
 * AFFIL (E6) — REJOINDRE UN CLUB DEPUIS L ONBOARDING.
 *
 * Recette d Adel, le 2026-08-28 : « J ai fait un onboarding dirigeant, j ai
 * trouve un club sans membres, j ai appuye sur "Je dirige ce club". Je n ai
 * meme pas eu de pop-up de felicitation, ca m a juste passe a l etape suivante,
 * et sur mon profil je ne suis toujours pas affilie. »
 *
 * ---------------------------------------------------------------------------
 * 🎯 CE QUE LA CARTE DU 28/08 A MESURE, ET QUE CES TEMOINS FIGENT
 * ---------------------------------------------------------------------------
 * La regle d Adel — « un club sans dirigeant affilie rend son demandeur
 * dirigeant tout de suite » — EXISTE DEJA cote serveur, et elle reconnait
 * explicitement le dirigeant depuis U03/D4 (`canClaimClubWithoutManager`).
 * Elle etait simplement INATTEIGNABLE, pour deux raisons qui s ajoutent :
 *
 *   ① `useAuth.js:626` — `canJoinClub` ne vaut vrai que pour un ENTRAINEUR.
 *      Un dirigeant ne voit donc jamais le bouton qui envoie une ADHESION ; la
 *      matrice lui allume `showEmptyClubClaimAction`, qui envoie une
 *      REVENDICATION (`POST /clubs/:id/claim`).
 *   ② `club-membership-request.ts:665` — l affiliation d office exige
 *      `requestType === 'join'`. Une revendication est exclue des la premiere
 *      ligne : elle dort en `pending` jusqu a ce qu un SUPERADMIN la traite.
 *
 * ⇒ Le bouton que voyait Adel etait le seul qui ne pouvait PAS l affilier.
 *
 * ⛔ CE QUE CES TEMOINS N ELARGISSENT PAS : un compte SANS ROLE (40 comptes sur
 *    118 en production au 2026-08-13) voit le MEME bouton sur le MEME club. Le
 *    serveur refuserait son adhesion (`resolveOrphanClubJoinRefusal`), et il
 *    perdrait le seul chemin qu il avait. Le temoin 2 est la pour ca.
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

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

// `mutate` appelle vraiment la `mutationFn` : c est ce qui fait des services
// doubles le point d observation reseau de ce filet.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => {
      const resultat = options?.mutationFn?.(variables);
      Promise.resolve(resultat)
        .then((donnees) => options?.onSuccess?.(donnees, variables))
        .catch((erreur) => options?.onError?.(erreur, variables));
    },
    options,
  }),
  useQuery: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

// 🔑 LE POINT D OBSERVATION DU DECLENCHEMENT (A5). C est le SEUL mecanisme de
// rafraichissement du projet : un second serait un defaut, pas une reparation.
jest.mock('@/domains/refresh/afterAction', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve()),
  invalidateAfterAction: jest.fn(() => Promise.resolve()),
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
    getNextOnboardingRoute: () => 'UserAvatar',
    getPostOnboardingHomeRoute: () => 'Home',
    hasClubAccess: mockHasClubAccess,
    inviteTrainer: jest.fn(),
    isClubMember: (/** @type {string} */ id) => mockHasClubAccess(id),
    refetchUserData: jest.fn(() => Promise.resolve({ data: mockUserData })),
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
// refuse de se charger sans `API_URL` — absent de tout worktree.
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

// Le bouton est un VRAI pressable portant son libelle : c est ce qui permet
// d appuyer « sur le texte ».
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

/** Le club de la recette : il existe, PERSONNE n y est dirigeant, non certifie. */
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

/** Le meme club, mais quelqu un le dirige deja : la demande doit etre validee. */
const CLUB_AVEC_DIRIGEANT = {
  ...CLUB_SANS_DIRIGEANT,
  members: [{ documentId: 'u-chef', firstname: 'Zoe', role: { name: 'president' } }],
};

const LIBELLE_JE_DIRIGE = 'Je dirige ce club';
const LIBELLE_DEMANDER_A_REJOINDRE = 'Demander à rejoindre ce club';

/** La reponse du serveur quand il a affilie d office (U03/D3, `meta.affiliation`). */
const REPONSE_AFFILIE_DOFFICE = {
  data: { documentId: 'req-1', state: 'processed' },
  meta: {
    affiliation: {
      clubDocumentId: 'club-1',
      clubName: 'BASKET CLUB DE LETOILE',
      message: 'Tu es maintenant dirigeant de BASKET CLUB DE LETOILE.',
      outcome: 'auto_affiliated',
    },
  },
};

/** La reponse du serveur quand un dirigeant doit valider. */
const REPONSE_EN_ATTENTE_DU_DIRIGEANT = {
  data: { documentId: 'req-2', state: 'pending' },
  meta: {
    affiliation: {
      clubDocumentId: 'club-1',
      clubName: 'BASKET CLUB DE LETOILE',
      message: 'Ta demande est partie. Un dirigeant de BASKET CLUB DE LETOILE doit la valider.',
      outcome: 'pending_manager_review',
    },
  },
};

/**
 * Aplatit les enfants d un noeud en une chaine.
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
 * Texte visible sous un noeud de l arbre rendu.
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
 * @returns {any} L arbre monte.
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
 * @param {any} arbre - L arbre rendu.
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
 * Appuie sur un bouton et laisse les promesses du reseau se resoudre.
 * @param {any} arbre - L arbre monte.
 * @param {string} libelle - Le libelle du bouton.
 * @returns {Promise<void>} Rien.
 */
const appuyerSur = async (arbre, libelle) => {
  const bouton = pressableAvecTexte(arbre, libelle);
  expect(bouton).toBeDefined();

  await act(async () => {
    bouton.props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
};

/**
 * Confirme la fenetre que `handleClaimClub` ouvre AVANT d envoyer quoi que ce soit.
 * @returns {Promise<void>} Rien.
 */
const confirmerLaFenetre = async () => {
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

/**
 * Les fenetres ouvertes jusqu ici, titre et message.
 * @returns {{ message: string, titre: string }[]} Les fenetres.
 */
const fenetresOuvertes = () => /** @type {any} */ (Alert.alert).mock.calls
  .map((/** @type {any[]} */ appel) => ({
    message: String(appel[1] || ''),
    titre: String(appel[0] || ''),
  }));

beforeEach(() => {
  jest.clearAllMocks();
  mockHasClubAccess.mockReturnValue(false);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  /** @type {any} */ (createClubMembershipRequest).mockResolvedValue(REPONSE_AFFILIE_DOFFICE);
  /** @type {any} */ (claimClub).mockResolvedValue({ message: 'Claim request sent successfully' });

  // Le cas de la recette : un DIRIGEANT qui vient de finir son inscription et
  // n appartient encore a aucun club.
  mockCanJoinClub = false;
  mockCanContactAdmin = true;
  mockUserData = {
    documentId: 'u-1',
    firstname: 'Adel',
    myTeams: [],
    role: { name: 'president' },
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
    reset: jest.fn(),
    setOptions: jest.fn(),
  };
  mockRoute = { params: { clubId: 'club-1', fromOnboardingAffiliation: true } };
});

afterEach(() => {
  arbresMontes.forEach((arbre) => act(() => arbre.unmount()));
  arbresMontes.length = 0;
  /** @type {any} */ (Alert.alert).mockRestore?.();
});

// ===========================================================================
// TEMOIN 1 — 🔴 A1 : UN CLUB SANS DIRIGEANT AFFILIE SON DEMANDEUR
// ===========================================================================
describe('AFFIL · A1 — un club SANS dirigeant rend son demandeur dirigeant', () => {
  it('LE TEMOIN : le dirigeant envoie une ADHESION, jamais une revendication', async () => {
    const arbre = monter();

    await appuyerSur(arbre, LIBELLE_JE_DIRIGE);
    await confirmerLaFenetre();

    // 🔴 AVANT le lot : c etait EXACTEMENT l inverse. `claimClub` partait, le
    //    serveur ecrivait `type: 'claim'`, et `isAutoAffiliationCandidate`
    //    (club-membership-request.ts:665) l excluait des sa premiere ligne.
    expect(createClubMembershipRequest).toHaveBeenCalledWith({ club: 'club-1' });
    expect(claimClub).not.toHaveBeenCalled();
  });

  it('la fenetre de confirmation annonce l affiliation, PAS une verification', async () => {
    const arbre = monter();

    await appuyerSur(arbre, LIBELLE_JE_DIRIGE);

    const confirmation = fenetresOuvertes().at(-1);
    // 🎯 Devenir dirigeant et faire CERTIFIER son club sont deux gestes
    //    differents (demande d Adel du 28/08). Cette fenetre-ci ne parle que du
    //    premier : promettre une verification serait promettre autre chose.
    expect(confirmation.message).not.toContain('vérification');
    expect(confirmation.message).toContain('dirigeant');
  });
});

// ===========================================================================
// TEMOIN 2 — ⛔ A1 NE S ELARGIT PAS : le compte SANS ROLE garde sa revendication
// ===========================================================================
describe('AFFIL · A1 — la regle ne deborde pas sur les comptes sans role', () => {
  it('un compte SANS ROLE, sur le meme club, envoie toujours une REVENDICATION', async () => {
    // 40 comptes sur 118 en production (mesure du 2026-08-13) : ni joueur, ni
    // entraineur, ni dirigeant. Le serveur REFUSERAIT son adhesion
    // (`resolveOrphanClubJoinRefusal`) ; lui retirer le claim, c est lui retirer
    // son seul chemin.
    mockCanContactAdmin = false;
    mockUserData.role = { name: 'Authenticated' };

    const arbre = monter();

    await appuyerSur(arbre, LIBELLE_JE_DIRIGE);
    await confirmerLaFenetre();

    expect(claimClub).toHaveBeenCalledWith('club-1');
    expect(createClubMembershipRequest).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// TEMOIN 3 — 🔴 A2 : ON LE DIT A L ECRAN, MEME DEPUIS L ONBOARDING
// ===========================================================================
describe('AFFIL · A2 — depuis l onboarding, l ecran DIT ce qui vient de se passer', () => {
  it('LE TEMOIN : une fenetre annonce l affiliation, avec la phrase du serveur', async () => {
    const arbre = monter();

    await appuyerSur(arbre, LIBELLE_JE_DIRIGE);
    await confirmerLaFenetre();

    // 🔴 AVANT le lot : `ClubDetails.js:442` et `:619` faisaient
    //    `if (fromOnboardingAffiliation) { ...; return; }` — un `return` AVANT
    //    l alerte. Adel passait a l etape suivante sans un mot. Ce tableau ne
    //    contenait que la fenetre de confirmation, jamais de resultat.
    const resultat = fenetresOuvertes().at(-1);
    expect(resultat.message).toContain('dirigeant de BASKET CLUB DE LETOILE');
    expect(resultat.titre).not.toBe('');
  });

  it('l etape suivante n arrive qu APRES la fenetre, jamais avant', async () => {
    const arbre = monter();

    await appuyerSur(arbre, LIBELLE_JE_DIRIGE);
    await confirmerLaFenetre();

    // Tant que la personne n a pas lu, on ne bouge pas.
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith('UserAvatar');

    const resultat = /** @type {any} */ (Alert.alert).mock.calls.at(-1);
    const boutonOk = (resultat?.[2] || [])[0];
    expect(boutonOk).toBeDefined();
    await act(async () => {
      boutonOk.onPress();
      await Promise.resolve();
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith('UserAvatar');
  });
});

// ===========================================================================
// TEMOIN 4 — 🔴 A3 : QUAND CE N EST PAS AUTOMATIQUE, ON LE DIT AUSSI
// ===========================================================================
describe('AFFIL · A3 — un club QUI A un dirigeant : la demande part, et on le dit', () => {
  it('LE TEMOIN : l entraineur lit « un dirigeant doit la valider »', async () => {
    mockCanJoinClub = true;
    mockCanContactAdmin = false;
    mockUserData.role = { name: 'coach' };
    mockClubQuery.data = CLUB_AVEC_DIRIGEANT;
    /** @type {any} */ (createClubMembershipRequest)
      .mockResolvedValue(REPONSE_EN_ATTENTE_DU_DIRIGEANT);

    const arbre = monter();

    await appuyerSur(arbre, LIBELLE_DEMANDER_A_REJOINDRE);

    // 🔴 AVANT le lot : ce tableau etait VIDE depuis l onboarding.
    const fenetres = fenetresOuvertes();
    expect(fenetres.length).toBeGreaterThan(0);
    expect(fenetres.at(-1).message).toContain('doit la valider');
  });
});

// ===========================================================================
// TEMOIN 5 — 🔴 A5 : LE DECLENCHEMENT, SUR LE CHEMIN QUI N EN AVAIT AUCUN
// ===========================================================================
describe('AFFIL · A5 — la revendication rafraichit ce que la personne va regarder', () => {
  it('LE TEMOIN : `claim` branche `invalidateAfterAction`, comme `join`', async () => {
    mockCanContactAdmin = false;
    mockUserData.role = { name: 'Authenticated' };

    const arbre = monter();

    await appuyerSur(arbre, LIBELLE_JE_DIRIGE);
    await confirmerLaFenetre();

    // 🔴 AVANT le lot : ZERO appel. Le lot INSTANT (27/08) a branche la recette
    //    `joinClub` sur la mutation d ADHESION (`ClubDetails.js:432`) et sur elle
    //    seule ; la revendication, quinze lignes plus bas, n avait AUCUNE
    //    recette — elle n apparaissait donc dans aucun recensement de « recettes
    //    qui dorment ». Sans elle, « Demandes », « Accueil » et « Mes equipes »
    //    ignorent la demande jusqu au prochain demarrage de l app.
    expect(invalidateAfterAction).toHaveBeenCalledWith(expect.anything(), 'joinClub');
  });
});
