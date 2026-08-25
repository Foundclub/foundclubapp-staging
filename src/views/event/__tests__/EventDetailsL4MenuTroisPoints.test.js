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

// 🧨 R9 — CE MOCK N EST PAS DECORATIF. `teamMembershipRequestService`
// importe `@/services/client`, qui JETTE AU CHARGEMENT quand `.env` est absent
// — et `.env` est gitignore, donc absent de toute copie de travail. Sans cette
// doublure, la SUITE ENTIERE tombe a 0 test execute des que l ecran importe le
// service (piege documente, deja paye plusieurs fois).
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  inviteToTeam: () => Promise.resolve(null),
  resolveTeamInvitationAvailability: () => ({
    candidateId: '',
    canInvite: false,
    reason: 'missing-team',
  }),
}));

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

// 🏆 N7 item 5 (vague P, 23/08) — le fil du tournoi lit `useGetTournamentDashboard`,
// qui tire `@/services/client`. Sans cette doublure MUETTE, la suite entiere
// tombe a 0 test (piege connu : un import de service de plus). `data: undefined`
// = le calcul de repli de la page, identique a ce que ces temoins decrivaient.
jest.mock('@/services/tournamentCompetition/tournamentCompetitionQueries', () => ({
  useGetTournamentDashboard: () => ({ data: undefined, isLoading: false }),
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

// 🎛️ L4-A — LA DOUBLURE DES ONGLETS, ET ELLE N'EST PAS FACULTATIVE.
// `SegmentedControl` importe `react-native-gesture-handler`, dont
// `lib/commonjs/specs/NativeRNGestureHandlerModule.ts` n'est PAS couvert par le
// `transformIgnorePatterns` du depot : sans doublure, la SUITE ENTIERE meurt au
// chargement (« Cannot use import statement outside a module ») et AUCUN test
// ne s'execute. C'est pour ca que les 16 autres appelants du composant le
// doublent aussi (motif ClubDetails.deuxPortes.test.js:299).
// La doublure rend un pressable par onglet, portant son libelle : le dessin est
// verifie chez le composant (201 lignes de test), ce qui se verifie ici c'est
// CE QU'ON LUI DONNE et CE QU'IL COMMANDE.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function SegmentedControlDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.View,
      { testID: 'doublure-onglets' },
      (props.options || []).map((/** @type {any} */ option) => react.createElement(
        rn.TouchableOpacity,
        {
          key: option.value,
          onPress: () => props.onChange(option.value),
          testID: `onglet-${option.value}`,
        },
        react.createElement(rn.Text, null, option.label),
      )),
    );
  };
});

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

  test('les 6 actions de l entrainement sont la, et Annuler ferme la marche', () => {
    const root = monter();
    ouvrirLeMenu();

    const libelles = rangeesDeLaFeuille(root).map((/** @type {any} */ n) => textOf(n));

    // Le releve EXACT, chip par chip, MESURE sur cette fixture (dirigeant du
    // club, entrainement d'equipe) : `edit`, `feature`, `lineup`,
    // `detectionSwitch`, `trainingVisibility`, `cancel`.
    // ♻️ REECRIT PAR N7 item 4 (vague P, 23/08) : la bascule « Ouvrir / Fermer
    // l'entraînement » a quitte sa carte de l'Apercu pour cette feuille —
    // 5 rangees deviennent 6, et Annuler reste la derniere.
    expect(libelles.some((/** @type {string} */ v) => v.includes('Modifier'))).toBe(true);
    expect(libelles.some((/** @type {string} */ v) => v.includes('À la une'))).toBe(true);
    // 🎯 N4 (D1/D2) — « Compo » est devenu « Convocation ». Le releve vise la
    // CLEF de la rangee et compare STRICTEMENT : `libelles` porte le libelle ET
    // son sous-titre, et un onglet homonyme existe depuis L4.
    const [etiquetteConvocation] = root.findAll(
      (/** @type {any} */ node) => node.props?.testID === 'event-manage-label-lineup',
      { deep: false },
    );
    expect(textOf(etiquetteConvocation).trim()).toBe('Convocation');
    expect(
      libelles.some((/** @type {string} */ v) => v.includes('Faire venir des joueurs')),
    ).toBe(true);
    expect(
      libelles.some((/** @type {string} */ v) => v.includes("Fermer l'entraînement")),
    ).toBe(true);
    expect(libelles).toHaveLength(6);
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
  test('les 6 rangees de l entrainement ont un sous-titre, pas seulement un mot', () => {
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

describe('N7 item 4 (vague P, 23/08) — la bascule d entrainement vit dans la feuille', () => {
  // 🏋️ La carte « Entraînement ouvert / privé » de l'Apercu portait trois
  // choses : un ETAT, la ligne de quota, et le BOUTON de bascule. Le bouton est
  // une action d'organisation — il n'y a qu'un endroit pour ca, et c'est cette
  // feuille (meme motif que « Stats du match », D71). La ligne de quota devient
  // la NOTE de la rangee. L'ETAT, lui, n'est PAS reconstruit ici : c'est la
  // carte d'ouverture enrichie du lot P8, qui vient apres.
  const rangeeBascule = (/** @type {any} */ root, /** @type {string} */ libelle) => (
    rangeesDeLaFeuille(root).find((/** @type {any} */ n) => textOf(n).includes(libelle))
  );

  test('entrainement OUVERT : rangee « Fermer l entrainement », note = le quota', () => {
    const root = monter({
      event: buildEvent({ externalParticipantLimit: 4, externalParticipantValidationMode: 'auto' }),
    });
    ouvrirLeMenu();

    const rangee = rangeeBascule(root, "Fermer l'entraînement");
    expect(rangee).toBeTruthy();
    // S11 (25/08) — la validation des externes est TOUJOURS manuelle : le
    // « auto » pose dans la donnee ci-dessus est desormais ignore a la lecture.
    // Le sujet du temoin ne change pas : la note porte bien le quota.
    expect(textOf(rangee)).toContain('4 place(s) externes - validation manuelle');
    expect(typeof rangee.findAllByType(TouchableOpacity)[0].props.onPress).toBe('function');
  });

  test('entrainement FERME : « Ouvrir l entrainement », dernier reglage en note', () => {
    const root = monter({
      event: buildEvent({ externalParticipantLimit: 3, sessionStatus: 'closed' }),
    });
    ouvrirLeMenu();

    const rangee = rangeeBascule(root, "Ouvrir l'entraînement");
    expect(rangee).toBeTruthy();
    expect(textOf(rangee)).toContain('3 place(s) externes - validation manuelle');
  });

  // ♻️ ADAPTE PAR P8 (vague P, 23/08) — ce temoin figeait un etat de TRANSIT.
  // Entre N7 item 4 et P8, l'Apercu n'avait plus AUCUNE carte d'entrainement ;
  // P8 y pose la carte d'ETAT que le commentaire ci-dessus annonce (« qui vient
  // apres »). Ce que N7 garantit, lui, ne bouge pas d'un pouce, et c'est cela
  // qui reste teste : l'ACTION de bascule ne revient PAS dans la colonne, et
  // l'ancienne carte — reconnaissable a son « prive » sans accent — a disparu.
  test('la BASCULE a quitte l Apercu : seule la carte d ETAT de P8 y revient', () => {
    const root = monter();

    const textes = textesVisibles(root).join(' | ');
    expect(textes).not.toContain("Fermer l'entraînement");
    expect(textes).not.toContain("Ouvrir l'entraînement");
    expect(textes).not.toContain('Entraînement prive');
    // ✅ Ce qui la remplace : la carte de P8, qui AFFICHE l'etat sans jamais le
    // commander — aucun bouton de bascule dedans, la preuve est deux lignes
    // plus haut.
    expect(parTestID(root, 'p8-carte-ouverture-entrainement')[0]).toBeTruthy();
  });

  test('TEMOIN NEGATIF : sur un MATCH, aucune rangee de bascule', () => {
    const root = monter({ event: buildEvent({ name: 'U15 vs Voisins', type: { name: 'Match' } }) });
    ouvrirLeMenu();

    expect(rangeeBascule(root, "l'entraînement")).toBeUndefined();
  });
});
