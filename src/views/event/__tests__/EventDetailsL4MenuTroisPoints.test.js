import {
  StyleSheet, Text, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

// L4-B (E6 deja satisfait : l'ecran porte 8 suites) — L'ACCORDEON « GERER
// L'EVENEMENT » DEVIENT UN MENU ⋯ DANS LA BARRE DU HAUT.
//
// Constat de l'audit du pack de design (`CONSTAT_DETAIL_EVENEMENT.md`, ecart 1) :
// les actions de l'organisateur vivaient derriere un accordeon FERME PAR DEFAUT
// qu'il fallait trouver en defilant, au milieu de 19 blocs empiles. La maquette
// (planche 04 · 4C) les range dans une feuille ouverte par un ⋯ toujours visible
// en haut a droite — le meme dessin que l'ecran EQUIPE, livre au lot AC01.
//
// 🚨 LE PIEGE QUE CE FILET DEMINE, et il est SILENCIEUX : le ⋯ vit dans
// l'EN-TETE DE NAVIGATION. Les 8 suites de cet ecran passent une doublure de
// `navigation` dont `setOptions` est un `jest.fn()` MUET : l'element
// `headerRight` n'entre donc JAMAIS dans l'arbre monte. Un helper qui
// chercherait son `testID` dans le rendu trouverait le vide SANS RIEN DIRE, et
// tous les temoins d'actions deviendraient verts en ne testant plus rien.
// ⇒ On va chercher le bouton la ou il est REELLEMENT : dans le dernier
// `headerRight` remis a `setOptions`, dont on parcourt l'arbre d'ELEMENTS.
// Motif existant : `EventFilters.criteres.test.js:316-323`.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest n'a pas de moteur de mise en page, il
// ne mesure AUCUN pixel. Il lit les CONTRAINTES posees sur l'arbre rendu et la
// PARENTE des noeuds. Le rendu reel se constate a la recette.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockEventQuery = { data: null };
const mockCompositionQuery = { data: null };

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

// Le theme est monte avec les VRAIS modules : un Proxy rend les echecs Jest
// illisibles (piege paye au lot paywall). Seul Images est stube.
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    options,
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
  }),
}));

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { config: jest.fn(), fs: { dirs: {} } },
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ sendMessage: jest.fn() }),
}));

const emptyQuery = () => ({
  data: null,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
});

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({
    data: mockEventQuery.data,
    dataUpdatedAt: 1,
    error: null,
    isFetching: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useGetEventAttendance: () => emptyQuery(),
  useGetEventConvocation: () => emptyQuery(),
  useGetEventTeamComposition: () => ({ ...emptyQuery(), data: mockCompositionQuery.data }),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseCampaigns: () => ({ ...emptyQuery(), data: { data: [] } }),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => emptyQuery(),
  useGetEventMyMatchResponse: () => emptyQuery(),
}));

jest.mock('@/services/event/eventService', () => ({
  approveFeatured: jest.fn(),
  exportEventParticipants: jest.fn(),
  rejectFeatured: jest.fn(),
}));

jest.mock('@/services/recruitment/recruitmentService', () => ({
  applyToRecruitmentAd: jest.fn(),
}));

jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  createCustomTournamentTeam: jest.fn(),
  registerClubTeamToTournament: jest.fn(),
  requestJoinTournamentTeam: jest.fn(),
  respondToTournamentTeam: jest.fn(),
  reviewTournamentTeamRegistration: jest.fn(),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

jest.mock('@/platform/share', () => ({
  __esModule: true,
  default: { share: jest.fn() },
}));

jest.mock('@/utils/performance/eventDetailsPerformance', () => ({
  markEventDetailsPerf: jest.fn(),
}));

// La liste est ecrite EN ENTIER, jamais derriere un Proxy : une doublure de
// contexte non figee change l'identite des mutations a chaque rendu et fait
// boucler Jest sans aucun message (piege paye au lot paywall).
jest.mock('../hooks/useEventMutations', () => {
  const idleMutation = () => ({ isPending: false, mutate: jest.fn() });
  return {
    useEventMutations: () => ({
      acceptParticipationMutation: idleMutation(),
      bookFullMutation: idleMutation(),
      cancelEventMutation: idleMutation(),
      coachArrivalMutation: idleMutation(),
      createEventParticipationMutation: idleMutation(),
      declineParticipationMutation: idleMutation(),
      deleteParticipationMutation: idleMutation(),
      joinReservationMutation: idleMutation(),
      missingEventMutation: idleMutation(),
      openForPlayersMutation: idleMutation(),
      remindEventMutation: idleMutation(),
      reportEventMutation: idleMutation(),
      requestFeaturedMutation: idleMutation(),
      resetAttendanceMutation: idleMutation(),
      respondToEventRsvpMutation: idleMutation(),
      selfArrivalMutation: idleMutation(),
      selfLateMutation: idleMutation(),
      sosAlertMutation: idleMutation(),
      updateEventMutation: idleMutation(),
      updateEventNoNavMutation: idleMutation(),
      updateLateMinutesMutation: idleMutation(),
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityLabel: props.accessibilityLabel,
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled || props.isLoading),
        onPress: props.onPress,
      },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function WithDataWrapperDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

// 🪤 IDENTIQUE aux 8 suites voisines, A DESSEIN : cette doublure JETTE
// `headerComponent`. Aucun temoin d'ici ne se fonde donc sur le TITRE de la
// feuille — ils lisent les RANGEES (`children`) et les `testID`.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BottomModalDouble(/** @type {any} */ props) {
    if (!props.isVisible && !props.visible) return null;
    return react.createElement(rn.View, null, props.children);
  };
});

/* eslint-disable global-require */
jest.mock(
  '@/components/molecules/eventAnswerButtons/EventAnswerButtons',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventAnswerButtons'),
);
jest.mock(
  '@/components/organisms/joinEventModal/JoinEventModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_JoinEventModal'),
);
jest.mock(
  '@/components/organisms/refuseParticipationModal/RefuseParticipationModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_RefuseParticipationModal'),
);
jest.mock(
  '@/components/organisms/reportEventModal/ReportEventModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_ReportEventModal'),
);
jest.mock(
  '@/components/organisms/shareEventModal/ShareEventModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_ShareEventModal'),
);
jest.mock(
  '../components/EventHeader',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventHeader'),
);
jest.mock(
  '../components/EventParticipants',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventParticipants'),
);
jest.mock(
  '../components/EventDetectionSlots',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventDetectionSlots'),
);
jest.mock(
  '../components/EventTasksSection',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTasksSection'),
);
jest.mock(
  '../components/EventTeamAudiencesSection',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTeamAudiencesSection'),
);
jest.mock(
  '../components/EventReservationActions',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventReservationActions'),
);
/* eslint-enable global-require */

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

// Le premier montage transpile tout le graphe d'imports de l'ecran (6 800 lignes).
jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';

// `hasRouteInNavigationTree` remonte l'arbre par `getState().routeNames` : sans
// lui, l'ecran conclut a raison que la route n'existe pas et l'aiguillage vers
// la detection se tait. La doublure declare la pile telle qu'`EventStack.js`
// l'enregistre.
const ROUTES_PILE_EVENEMENT = [
  'EventDetails',
  'EventEdit',
  'EventPublishedShowcase',
  'TournamentSettingsEdit',
  'EventWizardType',
];

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Entrainement du mardi',
  participations: [],
  startTime: '10:00',
  team: { club: { documentId: CLUB_ID }, documentId: TEAM_ID, name: 'U15' },
  type: { name: 'Entrainement' },
  ...overrides,
});

const authOrganisateur = (/** @type {boolean} */ peutGerer = true) => ({
  canEditClub: () => peutGerer,
  canEditEvent: () => peutGerer,
  canManageEvent: () => peutGerer,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: {
    documentId: 'user-1',
    role: { name: peutGerer ? 'Dirigeant' : 'Joueur' },
  },
});

/** @type {any} */
let mounted = null;

const demonter = () => {
  if (!mounted) return;
  act(() => {
    mounted.unmount();
  });
  mounted = null;
};

const monter = (/** @type {any} */ { auth, composition = null, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockCompositionQuery.data = composition;
  mockUseAuth.mockReturnValue(auth || authOrganisateur());

  demonter();
  mockSetOptions.mockClear();

  act(() => {
    mounted = renderer.create(
      <EventDetails
        navigation={{
          addListener: () => () => {},
          getParent: () => undefined,
          getState: () => ({ routeNames: ROUTES_PILE_EVENEMENT }),
          goBack: jest.fn(),
          navigate: mockNavigate,
          setOptions: mockSetOptions,
        }}
        route={{ params: { eventId: 'event-1' } }}
      />,
    );
  });

  return mounted.root;
};

afterEach(() => {
  demonter();
});

const textOf = (/** @type {any} */ node) => {
  const parts = [];
  const walk = (/** @type {any} */ child) => {
    if (child === null || child === undefined || child === false) return;
    if (typeof child === 'string' || typeof child === 'number') {
      parts.push(String(child));
      return;
    }
    const children = child?.props?.children;
    if (Array.isArray(children)) children.forEach(walk);
    else walk(children);
  };
  walk(node);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

const textesVisibles = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node))
  .filter(Boolean);

// 🪤 `{ deep: false }` N'EST PAS UN DETAIL : `TouchableOpacity` propage son
// `testID` a tous ses noeuds internes, et un `findAll` naif rend CINQ noeuds
// par rangee. Un temoin qui compterait ces noeuds lirait « 25 actions » la ou
// il y en a 5. `deep: false` ne garde que le noeud le plus EXTERIEUR de chaque
// emboitement — motif existant : `EventFilters.criteres.test.js:303-306`.
const parTestID = (/** @type {any} */ root, /** @type {string} */ id) => root
  .findAll((/** @type {any} */ node) => node.props?.testID === id, { deep: false });

// ─────────────────────────────────────────────────────────────────────────────
// LA COUTURE DE CE LOT — on lit l'en-tete de navigation, pas l'arbre monte.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le dernier `headerRight` remis a `setOptions`, DEJA APPELE : c'est un arbre
 * d'elements React NON MONTES, pas un rendu.
 * @returns {any} - L'element rendu par `headerRight`, ou null.
 */
const elementDEntete = () => {
  const appels = mockSetOptions.mock.calls.filter(
    (/** @type {any} */ appel) => appel[0]?.headerRight,
  );
  if (!appels.length) return null;
  return appels[appels.length - 1][0].headerRight();
};

/**
 * Cherche un element dans un arbre NON MONTE, par predicat sur ses props.
 * @param {any} element - Racine de l'arbre d'elements.
 * @param {(noeud: any) => boolean} predicat - Le test applique a chaque noeud.
 * @returns {any} - Le premier element qui satisfait le predicat, ou null.
 */
const chercherDansElements = (element, predicat) => {
  if (!element || typeof element !== 'object') return null;
  if (Array.isArray(element)) {
    return element.reduce(
      (/** @type {any} */ trouve, /** @type {any} */ enfant) => (
        trouve || chercherDansElements(enfant, predicat)
      ),
      null,
    );
  }
  if (element.props && predicat(element)) return element;
  return chercherDansElements(element.props?.children, predicat);
};

const boutonDuMenu = () => chercherDansElements(
  elementDEntete(),
  (/** @type {any} */ noeud) => noeud?.props?.testID === 'event-actions-menu-button',
);

const boutonSignaler = () => chercherDansElements(
  elementDEntete(),
  (/** @type {any} */ noeud) => noeud?.props?.icon === 'flag',
);

const ouvrirLeMenu = () => {
  const bouton = boutonDuMenu();
  if (!bouton) throw new Error('Aucun bouton trois-points dans l en-tete de navigation');
  act(() => {
    bouton.props.onPress();
  });
};

/**
 * Les rangees de la feuille, dans l'ordre d'affichage.
 * @param {any} root - Racine du rendu.
 * @returns {Array<any>} - Les noeuds `event-manage-chip`.
 */
const rangeesDeLaFeuille = (/** @type {any} */ root) => parTestID(root, 'event-manage-chip');

describe('L4 · temoin 1 — le trois-points ouvre la feuille', () => {
  test('l organisateur a un trois-points dans la barre du haut, a cote de signaler', () => {
    monter();

    expect(boutonSignaler()).toBeTruthy();
    expect(boutonDuMenu()).toBeTruthy();
  });

  test('un simple joueur n a AUCUN trois-points : rien a gerer, pas de bouton muet', () => {
    monter({ auth: authOrganisateur(false) });

    expect(boutonDuMenu()).toBeNull();
  });

  test('la feuille est FERMEE au montage — c est un appui qui l ouvre', () => {
    const root = monter();

    expect(parTestID(root, 'event-manage-sheet')).toHaveLength(0);
    expect(rangeesDeLaFeuille(root)).toHaveLength(0);

    ouvrirLeMenu();

    expect(parTestID(root, 'event-manage-sheet')).toHaveLength(1);
    expect(rangeesDeLaFeuille(root).length).toBeGreaterThan(0);
  });

  test('les 5 actions de l entrainement sont la, et Annuler ferme la marche', () => {
    const root = monter();
    ouvrirLeMenu();

    const libelles = rangeesDeLaFeuille(root).map((/** @type {any} */ n) => textOf(n));

    // Le releve EXACT, chip par chip, MESURE sur cette fixture (dirigeant du
    // club, entrainement d'equipe) : `edit`, `feature`, `lineup`,
    // `detectionSwitch`, `cancel`. Aucune n'a ete ajoutee ni retiree par L4 :
    // la feuille rend `buildManageChips` tel quel.
    expect(libelles.some((/** @type {string} */ v) => v.includes('Modifier'))).toBe(true);
    expect(libelles.some((/** @type {string} */ v) => v.includes('À la une'))).toBe(true);
    expect(libelles.some((/** @type {string} */ v) => v.includes('Compo'))).toBe(true);
    expect(
      libelles.some((/** @type {string} */ v) => v.includes('Faire venir des joueurs')),
    ).toBe(true);
    expect(libelles).toHaveLength(5);
    expect(libelles[libelles.length - 1]).toContain('Annuler');
  });

  test('Annuler est ROUGE — la seule rangee destructive de la feuille', () => {
    const root = monter();
    ouvrirLeMenu();

    // eslint-disable-next-line global-require
    const { Colors } = require('@/theme/themeContext').default();

    const rangees = rangeesDeLaFeuille(root);
    const derniere = rangees[rangees.length - 1];
    const couleurs = derniere
      .findAllByType(Text)
      .map((/** @type {any} */ n) => StyleSheet.flatten(n.props.style)?.color);

    expect(couleurs).toContain(Colors.error500);
  });

  test('chaque rangee est PRESSABLE — une porte fermee n est pas une porte absente', () => {
    const root = monter();
    ouvrirLeMenu();

    rangeesDeLaFeuille(root).forEach((/** @type {any} */ rangee) => {
      const pressable = rangee.findAllByType(TouchableOpacity)[0];
      expect(typeof pressable.props.onPress).toBe('function');
    });
  });
});

describe('L4 · temoin 2 — chaque rangee porte sa destination ou son motif', () => {
  test('les 5 rangees de l entrainement ont un sous-titre, pas seulement un mot', () => {
    const root = monter();
    ouvrirLeMenu();

    rangeesDeLaFeuille(root).forEach((/** @type {any} */ rangee) => {
      const textes = rangee
        .findAllByType(Text)
        .map((/** @type {any} */ n) => textOf(n))
        .filter(Boolean);
      // Un libelle ET un sous-titre : la maquette 04 · 4C demande que chaque
      // rangee dise OU elle mene, ou POURQUOI elle est fermee.
      expect(textes.length).toBeGreaterThanOrEqual(2);
      expect(textes[1].length).toBeGreaterThan(3);
    });
  });

  test('Faire venir des joueurs garde sa phrase entiere, sur plusieurs lignes', () => {
    const root = monter();
    ouvrirLeMenu();

    const rangee = rangeesDeLaFeuille(root)
      .find((/** @type {any} */ n) => textOf(n).includes('Faire venir des joueurs'));
    const sousTitre = rangee.findAllByType(Text)[1];

    expect(textOf(sousTitre)).toContain('détection');
    // ⛔ Jamais `numberOfLines={1}` : la note fait trois lignes, la couper
    // rendrait la porte fermee incomprehensible.
    expect(sousTitre.props.numberOfLines).toBeUndefined();
  });

  test('sur une DETECTION sans repartition, Placer les equipes est GRISEE et dit pourquoi', () => {
    const root = monter({
      event: buildEvent({ name: 'Détection U15', type: { name: 'Détection' } }),
    });
    ouvrirLeMenu();

    const rangee = rangeesDeLaFeuille(root)
      .find((/** @type {any} */ n) => textOf(n).includes('Placer les équipes'));

    expect(rangee).toBeTruthy();
    expect(textOf(rangee)).toContain('Répartis d’abord les équipes');
    expect(rangee.findAllByType(TouchableOpacity)[0].props.disabled).toBe(true);
  });
});

describe('L4 · temoin 3 — l accordeon n existe plus', () => {
  test('plus aucun event-manage-panel dans l arbre, menu ouvert ou ferme', () => {
    const root = monter();

    expect(parTestID(root, 'event-manage-panel')).toHaveLength(0);
    expect(parTestID(root, 'event-manage-panel-row')).toHaveLength(0);

    ouvrirLeMenu();

    expect(parTestID(root, 'event-manage-panel')).toHaveLength(0);
    expect(parTestID(root, 'event-manage-panel-row')).toHaveLength(0);
  });

  test('la page ne porte plus le titre Gerer l evenement — il est passe en en-tete', () => {
    const root = monter();

    expect(textesVisibles(root).join(' | ')).not.toContain("Gérer l'événement");
  });

  test('D64 re-exprime : chaque rangee de la feuille fait au moins 52 px', () => {
    const root = monter();
    ouvrirLeMenu();

    rangeesDeLaFeuille(root).forEach((/** @type {any} */ rangee) => {
      const pressable = rangee.findAllByType(TouchableOpacity)[0];
      const style = StyleSheet.flatten(pressable.props.style) || {};
      expect(style.minHeight || style.height).toBeGreaterThanOrEqual(52);
    });
  });

  test('la liste des participants n est JAMAIS recouverte : la feuille est modale', () => {
    const root = monter();
    ouvrirLeMenu();

    // La liste reste montee — la feuille se pose par-dessus, elle ne remplace
    // pas la page et ne s'intercale pas dans la colonne.
    expect(textesVisibles(root).join(' | ')).toContain('DOUBLURE_EventParticipants');
    // ⛔ Et plus rien du menu ne vit dans la colonne : l'ancien panneau y tenait
    // une surface flottante qui mangeait le bas de la liste (D64).
    expect(parTestID(root, 'event-manage-sheet')[0]).toBeTruthy();
  });
});
