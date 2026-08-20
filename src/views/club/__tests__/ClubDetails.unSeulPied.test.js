import { Alert, ScrollView, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import ClubDetails from '../ClubDetails';

// Z01 - « et la en plus ils sont superposes » (Adel, 2026-08-20, capture a
// l'appui : deux libelles imprimes l'un SUR l'autre dans une seule boite).
//
// LA CAUSE N'EST PAS UNE MARGE, c'est qu'il y avait DEUX pieds de page.
// L'un vivait dans le flux normal juste apres `</ScrollView>` ; l'autre est
// pose en `Alignments.absolute`. Un element absolu ne prend AUCUNE place dans
// le flux : il se dessine donc PAR-DESSUS le premier. Aucune marge ne repare
// ca - elle deplacerait la collision, et le neuvieme bouton la ramenerait.
//
// Ce filet ne regarde pas des pixels, il regarde la STRUCTURE :
//   . temoin 5 - il n'existe qu'UN pied d'actions, et aucun bouton colle en
//     bas de l'ecran ne vit en dehors de lui ;
//   . temoin 6 - la place reservee en bas du defilement compte TOUS les
//     boutons affiches hors du defilement, pas seulement ceux qu'un compteur
//     ecrit a la main avait pense a lister.
//
// Le joueur est monte ici lui aussi : Adel a valide ses DEUX portes le
// 2026-08-18, elles doivent rester, et rester au meme endroit.

/** @type {boolean} */
let mockCanJoinClub;
/** @type {boolean} */
let mockCanContactAdmin;
/** @type {any} */
let mockUserData;
/** @type {any} */
let mockClubQuery;
/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockRoute;

const mockHasClubAccess = jest.fn(() => false);

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

// `mutate` appelle vraiment la `mutationFn` : c'est ce qui fait des services
// doubles le point d'observation reseau de ce filet.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => {
      const resultat = options?.mutationFn?.(variables);
      Promise.resolve(resultat)
        .then((donnees) => options?.onSuccess?.(donnees, variables))
        .catch((erreur) => options?.onError?.(erreur, variables));
    },
  }),
  useQuery: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
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

// La doublure RETIENT les proprietes recues : l'ouverture d'une feuille est une
// question de PROPRIETE (`isVisible`), pas de texte affiche.
/** @type {any[]} */
const mockFeuillesRendues = [];

jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock(/** @type {any} */ props) {
    mockFeuillesRendues.push(props);
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

/** Le club du cas NORMAL : il existe, et personne n'y a cree d'equipe. */
const CLUB_SANS_EQUIPE = {
  activites: [],
  clubMembersPublicVisibility: true,
  documentId: 'club-1',
  members: [],
  name: 'BASKET CLUB DE LETOILE',
  sponsor: [],
  teams: [],
  trainers: [],
};

/** Le meme club, mais avec une equipe ET un dirigeant : le club « installe ». */
const CLUB_AVEC_EQUIPE = {
  ...CLUB_SANS_EQUIPE,
  members: [{ documentId: 'u-9', role: { name: 'president' } }],
  teams: [{
    category: 'Sénior',
    documentId: 't-1',
    level: 'National',
    name: 'Seniors A',
    section: 'Masculine',
  }],
};

const PIED_ACTIONS = 'club-details-actions-footer';

/** Le repli de `floatingClubActionsBottomInset` : les encoches sont a 0 ici. */
const RESERVE_BASSE = 12;
/** La hauteur reservee au premier bouton, puis a chacun des suivants. */
const RESERVE_PREMIER_BOUTON = 128;
const RESERVE_BOUTON_SUIVANT = 72;
/** Ce qui est reserve quand aucun bouton d'action ne sort. */
const RESERVE_SANS_BOUTON = 40;

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
 * Compte les noeuds REELLEMENT rendus qui portent ce testID.
 * `toJSON` ne rend que les elements natifs : un composant et l'element qu'il
 * produit ne peuvent donc pas etre comptes deux fois.
 * @param {any} noeud - Un noeud de l'arbre rendu en JSON.
 * @param {string} identifiant - Le testID cherche.
 * @returns {number} Le nombre de noeuds trouves.
 */
const compterNoeuds = (noeud, identifiant) => {
  if (!noeud || typeof noeud !== 'object') return 0;
  if (Array.isArray(noeud)) {
    return noeud.reduce((total, enfant) => total + compterNoeuds(enfant, identifiant), 0);
  }
  const soi = noeud.props?.testID === identifiant ? 1 : 0;
  return soi + compterNoeuds(noeud.children, identifiant);
};

/**
 * Vrai si l'un des ancetres du noeud satisfait le predicat.
 * @param {any} noeud - Le noeud observe.
 * @param {(ancetre: any) => boolean} predicat - Le test applique aux ancetres.
 * @returns {boolean} Vrai si un ancetre correspond.
 */
const aPourAncetre = (noeud, predicat) => {
  let courant = noeud.parent;
  while (courant) {
    if (predicat(courant)) return true;
    courant = courant.parent;
  }
  return false;
};

/**
 * Tous les boutons rendus par la fiche.
 * @param {any} arbre - L'arbre monte.
 * @returns {any[]} Les instances de bouton.
 */
const tousLesBoutons = (arbre) => arbre.root.findAllByType(Button);

/**
 * Les boutons qui ne defilent PAS : ceux qui restent colles en bas de l'ecran.
 * @param {any} arbre - L'arbre monte.
 * @returns {any[]} Les boutons hors du defilement.
 */
const boutonsHorsDefilement = (arbre) => tousLesBoutons(arbre).filter(
  (bouton) => !aPourAncetre(bouton, (ancetre) => ancetre.type === ScrollView),
);

/**
 * La place reservee en bas du contenu qui defile.
 * @param {any} arbre - L'arbre monte.
 * @returns {number} La reserve, en points.
 */
const reserveBasseDuDefilement = (arbre) => {
  const styles = arbre.root.findAllByType(ScrollView)[0].props.contentContainerStyle;
  const trouve = [styles].flat(Infinity).reverse().find(
    (/** @type {any} */ style) => style && typeof style.paddingBottom === 'number',
  );
  return trouve.paddingBottom;
};

/**
 * Le texte visible sous un noeud.
 * @param {any} noeud - Le noeud observe.
 * @returns {string} Son texte.
 */
const texteDe = (noeud) => {
  const aplatir = (/** @type {any} */ enfants) => {
    if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
    if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
    if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
    return String(enfants);
  };
  return noeud.findAllByType(Text)
    .map((/** @type {any} */ texte) => aplatir(texte.props.children))
    .join(' ');
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFeuillesRendues.length = 0;
  mockHasClubAccess.mockReturnValue(false);
  mockCanContactAdmin = false;
  mockCanJoinClub = false;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  mockUserData = {
    documentId: 'u-1',
    firstname: 'Ada',
    myTeams: [],
    role: { name: 'player' },
    trainedTeams: [],
  };
  mockClubQuery = {
    data: CLUB_SANS_EQUIPE,
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

/** Se faire passer pour un entraineur : `canJoinClub` vaut `coach`. */
const devenirEntraineur = () => {
  mockCanJoinClub = true;
  mockUserData = { ...mockUserData, role: { name: 'coach' } };
};

/** Se faire passer pour un dirigeant : `canContactAdmin` vaut `president`. */
const devenirDirigeant = () => {
  mockCanContactAdmin = true;
  mockUserData = { ...mockUserData, role: { name: 'president' } };
};

// TEMOIN 5 - deux boutons ne peuvent JAMAIS occuper la meme place.
//
// Rendu executable par sa CAUSE : deux boutons ne peuvent se superposer que
// s'ils vivent dans DEUX pieds de page independants. Un seul pied, et la
// collision devient impossible par construction - pas par reglage.
describe('Z01 · temoin 5 — il n’y a qu’UN pied de page', () => {
  it('LE CAS D’ADEL : l’entraineur ne voit qu’un pied, et son bouton est dedans', () => {
    devenirEntraineur();
    const arbre = monter();

    expect(compterNoeuds(arbre.toJSON(), PIED_ACTIONS)).toBe(1);
    const horsDefilement = boutonsHorsDefilement(arbre);
    expect(horsDefilement.length).toBeGreaterThan(0);
    horsDefilement.forEach((bouton) => {
      expect(aPourAncetre(bouton, (ancetre) => ancetre.props?.testID === PIED_ACTIONS)).toBe(true);
    });
  });

  // C'est CE cas qui faisait se chevaucher les libelles : la porte primaire
  // vivait dans le flux, la porte d'interet se posait par-dessus, en absolu.
  it('l’entraineur d’un club AVEC equipes : DEUX boutons, UN SEUL pied', () => {
    devenirEntraineur();
    mockClubQuery.data = CLUB_AVEC_EQUIPE;
    const arbre = monter();

    expect(compterNoeuds(arbre.toJSON(), PIED_ACTIONS)).toBe(1);
    const horsDefilement = boutonsHorsDefilement(arbre);
    expect(horsDefilement).toHaveLength(2);
    horsDefilement.forEach((bouton) => {
      expect(aPourAncetre(bouton, (ancetre) => ancetre.props?.testID === PIED_ACTIONS)).toBe(true);
    });
    // ⚠️ Le libelle depend du club, pas du role : « C'est mon club ! » ne sort
    // que si le club n'a AUCUN dirigeant visible. Celui-ci en a un, donc la
    // porte primaire demande a rejoindre au lieu de revendiquer.
    expect(horsDefilement.map(texteDe)).toEqual([
      'Demander à rejoindre ce club',
      'Intéressé par le club',
    ]);
  });

  it('le dirigeant d’un club AVEC equipes : DEUX boutons, UN SEUL pied', () => {
    devenirDirigeant();
    mockClubQuery.data = CLUB_AVEC_EQUIPE;
    const arbre = monter();

    expect(compterNoeuds(arbre.toJSON(), PIED_ACTIONS)).toBe(1);
    const horsDefilement = boutonsHorsDefilement(arbre);
    expect(horsDefilement).toHaveLength(2);
    horsDefilement.forEach((bouton) => {
      expect(aPourAncetre(bouton, (ancetre) => ancetre.props?.testID === PIED_ACTIONS)).toBe(true);
    });
  });

  // NON-REGRESSION - le joueur garde ses deux portes, au meme endroit.
  it('le joueur garde ses DEUX portes, dans ce meme pied unique', () => {
    const arbre = monter();

    expect(compterNoeuds(arbre.toJSON(), PIED_ACTIONS)).toBe(1);
    const horsDefilement = boutonsHorsDefilement(arbre);
    expect(horsDefilement).toHaveLength(2);
    expect(horsDefilement.map(texteDe)).toEqual([
      'C’est mon club',
      'Prévenez-moi quand ce club arrive',
    ]);
  });

  // NON-REGRESSION - le visiteur deconnecte non plus ne bouge pas.
  it('le visiteur deconnecte garde ses deux portes de connexion', () => {
    mockUserData = null;
    const arbre = monter();

    expect(compterNoeuds(arbre.toJSON(), PIED_ACTIONS)).toBe(1);
    expect(boutonsHorsDefilement(arbre).map(texteDe)).toEqual([
      'Je joue dans ce club',
      'Je dirige ce club',
    ]);
  });
});

// TEMOIN 6 - la place reservee compte TOUS les boutons affiches.
//
// Le defaut d'origine : `floatingClubActionsCount` listait HUIT drapeaux a la
// main, et le bouton du pied du flux n'y etait pas. La reserve etait donc
// calculee pour un bouton de moins que ce que l'ecran montrait.
describe('Z01 · temoin 6 — la reserve basse compte tous les boutons', () => {
  /**
   * Ce que la reserve DOIT valoir pour ce nombre de boutons.
   * @param {number} nombre - Le nombre de boutons colles en bas.
   * @returns {number} La reserve attendue.
   */
  const reserveAttendue = (nombre) => (nombre === 0
    ? RESERVE_SANS_BOUTON
    : RESERVE_BASSE + RESERVE_PREMIER_BOUTON + ((nombre - 1) * RESERVE_BOUTON_SUIVANT));

  it('l’entraineur d’un club AVEC equipes : la reserve couvre ses 2 boutons', () => {
    devenirEntraineur();
    mockClubQuery.data = CLUB_AVEC_EQUIPE;
    const arbre = monter();

    expect(reserveBasseDuDefilement(arbre))
      .toBe(reserveAttendue(boutonsHorsDefilement(arbre).length));
  });

  it('le dirigeant d’un club AVEC equipes : la reserve couvre ses 2 boutons', () => {
    devenirDirigeant();
    mockClubQuery.data = CLUB_AVEC_EQUIPE;
    const arbre = monter();

    expect(reserveBasseDuDefilement(arbre))
      .toBe(reserveAttendue(boutonsHorsDefilement(arbre).length));
  });

  // NON-REGRESSION - le joueur avait deja la bonne reserve, il la garde.
  it('le joueur : la reserve couvre ses 2 portes', () => {
    const arbre = monter();

    expect(reserveBasseDuDefilement(arbre))
      .toBe(reserveAttendue(boutonsHorsDefilement(arbre).length));
  });

  it('le dirigeant de SON PROPRE club : aucun bouton colle, reserve minimale', () => {
    devenirDirigeant();
    mockHasClubAccess.mockReturnValue(true);
    mockClubQuery.data = CLUB_AVEC_EQUIPE;
    const arbre = monter();

    expect(boutonsHorsDefilement(arbre)).toHaveLength(0);
    expect(reserveBasseDuDefilement(arbre)).toBe(RESERVE_SANS_BOUTON);
  });
});
