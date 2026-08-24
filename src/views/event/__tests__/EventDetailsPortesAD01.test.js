import { Alert, Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// AD01 — LA PAGE DE L'EVENEMENT OUVRE SES PORTES FERMEES.
//
// Trois portes, et derriere chacune, du travail DEJA FAIT que rien n'atteint :
//
//   1. 🥇 « SUIS-JE CONVOQUE ? » — AC08 a pose la phrase, mais tout au FOND
//      d'une page de 6 496 lignes. Un joueur devait faire defiler la fiche
//      entiere pour apprendre s'il jouait. La phrase ne bouge pas : elle
//      REMONTE. Meme variable (`viewerConvocationLine`), aucune requete de
//      plus. Et le SILENCE d'avant publication devient une phrase : se taire,
//      le lecteur le lit comme « je ne joue pas ».
//   2. 🚪 LE TERRAIN DE DETECTION — `DetectionTeamsBoard` (850 lignes) et
//      `DetectionRotationBoard` (697 lignes) sont ecrits, testes, declares
//      dans les 4 fichiers de routes... et ZERO bouton y entre. Un ecran
//      qu'aucun bouton n'atteint n'existe pas.
//   3. ✍️ LE SCORE — pour ecrire « 3-1 », un coach ouvre aujourd'hui un
//      editeur de statistiques de 1 615 lignes. `saveEventMatchResult` existe,
//      le serveur l'accepte, et il n'a AUCUN appelant.
//
// La couture est le TEXTE VISIBLE, la ROUTE EMPRUNTEE et l'ORDRE DE LECTURE —
// jamais la forme de l'arbre. Meme choix que `EventDetailsPorteConvocationAC08`.
// ==========================================================================

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
// L4-B : partage, pour pouvoir relire le `headerRight` que l ecran y depose.
const mockSetOptions = jest.fn();
const mockSaveEventMatchResult = jest.fn();
const mockEventQuery = { data: null };
const mockConvocationQuery = { data: null };
const mockCompositionQuery = { data: null };
const mockMatchStatsQuery = { data: null };
const mockAttendanceQuery = { data: null };
const mockRefetchMatchStats = jest.fn();

// 🧨 R9 — CE MOCK N EST PAS DECORATIF. `teamMembershipRequestService`
// importe `@/services/client`, qui JETTE AU CHARGEMENT quand `.env` est absent
// — et `.env` est gitignore, donc absent de toute copie de travail. Sans cette
// doublure, la SUITE ENTIERE tombe a 0 test execute des que l ecran importe le
// service (piege documente, deja paye plusieurs fois).
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  inviteToTeam: () => Promise.resolve(null),
  resolveTeamInvitationAvailability: () => ({
    canInvite: false,
    candidateId: '',
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
  useGetEventAttendance: () => ({ ...emptyQuery(), data: mockAttendanceQuery.data }),
  useGetEventConvocation: () => ({ ...emptyQuery(), data: mockConvocationQuery.data }),
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
  useGetEventMatchStats: () => ({
    ...emptyQuery(),
    data: mockMatchStatsQuery.data,
    refetch: mockRefetchMatchStats,
  }),
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
      saveMatchResultMutation: {
        isPending: false,
        mutate: jest.fn(),
        mutateAsync: (/** @type {any} */ charge) => mockSaveEventMatchResult(charge),
      },
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

/**
 * Bascule sur l'onglet demande. Sans effet sur un evenement qui n'a pas
 * d'onglets (tout type autre que le match) : la colonne y est entiere.
 * @param {any} root - Racine du rendu.
 * @param {string} valeur - 'overview' | 'participants' | 'callUp'.
 * @returns {void}
 */
const allerSurLOnglet = (root, valeur) => {
  const [onglet] = root.findAll(
    (/** @type {any} */ node) => node.props?.testID === `onglet-${valeur}`,
    { deep: false },
  );
  if (!onglet) return;
  act(() => {
    onglet.props.onPress();
  });
};

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

// Le premier montage transpile tout le graphe d'imports de l'ecran.
jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const JOUEUR = 'joueur-1';
const REMPLACANT = 'joueur-2';
const SPECTATEUR = 'joueur-9';
const COACH = 'coach-1';

// Le titre du bloc du BAS de page. C est le repere qui prouve la POSITION :
// tout ce qui se lit AVANT lui se lit sans faire defiler la fiche entiere.
const BLOC_DU_BAS = "Composition d'equipes";

const PACK = {
  publishedAt: '2026-08-20T09:00:00.000Z',
  publishedBy: { firstname: 'Coach', lastname: 'Karim' },
  reservePlayerIds: [REMPLACANT],
  reserveSnapshotPlayers: [{ documentId: REMPLACANT, firstname: 'Leo', lastname: 'Diarra' }],
  snapshotPlayers: [{
    documentId: JOUEUR, firstname: 'Karim', lastname: 'Sylla', number: 1,
  }],
  sportContext: 'football',
  teams: [{
    id: 'team_1',
    name: 'U15',
    placements: [{
      playerId: JOUEUR, positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
    }],
  }],
};

const CONVOCATION = {
  branches: [{
    published: PACK,
    responses: { byPlayerId: {}, counts: { absent: 0, pending: 2, present: 0 } },
    team: { documentId: TEAM_ID, name: 'U15' },
    viewer: { inReserve: false, teamEntryIds: [] },
  }],
  event: { date: '2099-01-01T10:00:00.000Z', documentId: 'event-1', name: 'Match' },
  eventKind: 'event',
  schemaVersion: 3,
};

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Match contre Saint-Julien',
  participations: [],
  startTime: '10:00',
  team: {
    club: { documentId: CLUB_ID },
    documentId: TEAM_ID,
    name: 'U15',
    players: [{ documentId: JOUEUR }, { documentId: REMPLACANT }],
    trainers: [{ documentId: COACH }],
  },
  type: { name: 'Match' },
  ...overrides,
});

// L'equipe SANS le lecteur : c'est ce qui fabrique un « non retenu » qui a
// quand meme le droit de lire la composition publiee.
const equipeSans = (/** @type {string} */ documentId) => ({
  club: { documentId: CLUB_ID },
  documentId: TEAM_ID,
  name: 'U15',
  players: [{ documentId: JOUEUR }, { documentId }],
  trainers: [],
});

const authPour = (/** @type {string} */ documentId, /** @type {boolean} */ peutGerer = false) => ({
  canEditClub: () => peutGerer,
  canEditEvent: () => peutGerer,
  canManageEvent: () => peutGerer,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { documentId, role: { name: peutGerer ? 'Dirigeant' : 'Joueur' } },
});

// 🧹 Un test peut monter PLUSIEURS ecrans (trois lecteurs, trois phrases). On
// les garde TOUS pour les demonter : l'horloge serveur d'`EventDetails` pose un
// `setInterval` (`:1107`) qu'un ecran orphelin laisse tourner apres la fin du
// fichier — jest ne rend alors jamais la main.
/** @type {any[]} */
const montes = [];

const monter = (/** @type {any} */ options = {}) => {
  const {
    attendance = null,
    auth,
    composition = null,
    convocation = CONVOCATION,
    event,
    matchStats = null,
  } = options;

  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockConvocationQuery.data = convocation;
  mockCompositionQuery.data = composition;
  mockMatchStatsQuery.data = matchStats;
  mockAttendanceQuery.data = attendance;
  mockUseAuth.mockReturnValue(auth || authPour(JOUEUR));

  /** @type {any} */
  let monte = null;
  act(() => {
    monte = renderer.create(
      <EventDetails
        navigation={{
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: mockNavigate,
          setOptions: mockSetOptions,
        }}
        route={{ params: { eventId: 'event-1' } }}
      />,
    );
  });

  montes.push(monte);
  return monte.root;
};

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

// L'ordre de `findAllByType` EST l'ordre de lecture de l'ecran : c'est ce qui
// permet de prouver « au-dessus » sans dependre de la forme de l'arbre.
const textesVisibles = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node))
  .filter(Boolean);

const rangDe = (/** @type {string[]} */ textes, /** @type {string} */ fragment) => textes
  .findIndex((texte) => texte.includes(fragment));

// Ce que le lecteur trouve AVANT d'avoir a faire defiler jusqu'au bloc du bas.
const hautDePage = (/** @type {any} */ root) => {
  const textes = textesVisibles(root);
  const bas = rangDe(textes, BLOC_DU_BAS);
  return (bas < 0 ? textes : textes.slice(0, bas)).join(' | ');
};

const boutonPortant = (/** @type {any} */ root, /** @type {string} */ libelle) => root
  .findAllByProps({ accessibilityRole: 'button' })
  .find((/** @type {any} */ node) => textOf(node).includes(libelle));

const appuyer = (/** @type {any} */ root, /** @type {string} */ libelle) => {
  const bouton = boutonPortant(root, libelle);
  if (!bouton) {
    const vu = textesVisibles(root).join(' | ');
    throw new Error(`Aucun bouton ne porte le libelle « ${libelle} ». Vu : ${vu}`);
  }
  act(() => {
    bouton.props.onPress();
  });
};

const saisir = (
  /** @type {any} */ root,
  /** @type {number} */ rang,
  /** @type {string} */ valeur,
) => {
  const champs = root.findAllByType(TextInput);
  if (champs.length <= rang) {
    throw new Error(`La feuille ne porte que ${champs.length} champ(s), rang ${rang} demande.`);
  }
  act(() => {
    champs[rang].props.onChangeText(valeur);
  });
};

// L'envoi du score est asynchrone : la feuille ne se referme qu'au tour
// suivant. Sans ce vidage, React se plaint d'une mise a jour hors `act`.
const viderLaFile = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const routesEmpruntees = () => mockNavigate.mock.calls.map((/** @type {any} */ call) => call[0]);

const appelVers = (/** @type {string} */ route) => [...mockNavigate.mock.calls]
  .reverse()
  .find((/** @type {any} */ call) => call[0] === route);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockEventQuery.data = null;
  mockConvocationQuery.data = null;
  mockCompositionQuery.data = null;
  mockMatchStatsQuery.data = null;
  mockAttendanceQuery.data = null;
  mockSaveEventMatchResult.mockResolvedValue({ scoreAgainst: 1, scoreFor: 3 });
});

afterEach(() => {
  act(() => {
    montes.forEach((monte) => monte.unmount());
  });
  montes.length = 0;
  jest.restoreAllMocks();
});

// ==========================================================================
// SUJET 1 — LA LIGNE D'ETAT REMONTE EN HAUT DE LA PAGE
// ==========================================================================

// ─────────────────────────────────────────────────────────────────────────────
// L4-B — LE MENU D'ORGANISATION A QUITTE LA COLONNE POUR LA BARRE DU HAUT.
//
// L'accordeon « Gérer l'événement » est devenu un ⋯ pose dans l'en-tete de
// navigation, qui ouvre une feuille. Les actions, elles, n'ont pas bouge d'un
// pouce : meme liste, meme ordre, memes conditions.
//
// 🚨 LE PIEGE QUE CES TROIS FONCTIONS DEMINENT, et il est SILENCIEUX :
// `navigation.setOptions` est une DOUBLURE MUETTE ici, donc l'element
// `headerRight` n'entre JAMAIS dans l'arbre monte. Chercher le ⋯ par son
// `testID` dans le rendu trouverait le vide SANS RIEN DIRE — et tous les
// temoins d'actions ci-dessous deviendraient verts en ne testant plus rien.
// ⇒ On va le chercher la ou il est reellement : dans le dernier `headerRight`
// remis a `setOptions`, dont on parcourt l'arbre d'ELEMENTS non montes.
// Motif existant : `EventFilters.criteres.test.js:316-323`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cherche un element dans un arbre NON MONTE, par predicat sur ses props.
 * @param {any} element - Racine de l'arbre d'elements.
 * @param {any} predicat - Le test applique a chaque noeud.
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

/**
 * Le ⋯ de la barre du haut, ou null s'il n'y a rien a gerer.
 * @returns {any} - L'element du bouton, ou null.
 */
const boutonDeGestion = () => {
  const appels = mockSetOptions.mock.calls.filter(
    (/** @type {any} */ appel) => appel[0]?.headerRight,
  );
  if (!appels.length) return null;
  return chercherDansElements(
    appels[appels.length - 1][0].headerRight(),
    (/** @type {any} */ noeud) => noeud?.props?.testID === 'event-actions-menu-button',
  );
};

/**
 * Ouvre la feuille d'organisation. Remplace l'appui sur le texte « Gérer
 * l'événement » de l'accordeon d'avant L4-B : meme geste pour la personne qui
 * s'en sert, meme liste d'actions au bout.
 * TOLERANTE A DESSEIN, comme l'ancien helper : la ou il n'y a rien a gerer, il
 * n'y a pas de bouton, et l'inventaire doit pouvoir sortir vide sans jeter.
 * @returns {void}
 */
const ouvrirLaFeuilleDeGestion = () => {
  const bouton = boutonDeGestion();
  if (!bouton) return;
  act(() => {
    bouton.props.onPress();
  });
};

/**
 * Presse une rangee du menu par sa CLEF.
 *
 * 🧨 N4 (D6) L'IMPOSE : la rangee des stats affichait l'un des SEPT titres de
 * `matchStatsPrimaryAction` et n'en affiche plus qu'UN, « Stats du match ».
 * Presser par le libelle revenait a suivre un mot qui bouge.
 * @param {any} root - Racine du rendu.
 * @param {string} cle - La cle de la rangee.
 * @returns {void}
 */
const presserLaRangee = (/** @type {any} */ root, /** @type {string} */ cle) => {
  const [etiquette] = root.findAll(
    (/** @type {any} */ node) => node.props?.testID === `event-manage-label-${cle}`,
    { deep: false },
  );
  if (!etiquette) throw new Error(`Aucune rangee de menu ne porte la cle « ${cle} »`);
  // On remonte jusqu'au premier ancetre PRESSABLE. Reperer le type exact
  // (`TouchableOpacity`) obligerait ce fichier a l'importer pour un seul
  // helper ; la presence d'un `onPress` dit la meme chose et ne depend de rien.
  let noeud = etiquette.parent;
  while (noeud && typeof noeud.props?.onPress !== 'function') noeud = noeud.parent;
  act(() => {
    noeud.props.onPress();
  });
};

describe('AD01 · TEMOIN 1 — 🥇 le convoque le sait SANS faire defiler', () => {
  // L4-A : « avant le bloc du bas » devient « AU MONTAGE, sans un seul appui ».
  // La garantie de fond ne bouge pas d'un pouce — elle se renforce meme : la
  // ligne vit maintenant dans la ZONE FIXE, au-dessus des onglets, donc elle
  // n'est plus seulement AVANT le bloc « Composition d'equipes », elle est
  // TOUJOURS LA, quel que soit l'onglet ouvert. Le bloc du bas, lui, a migre
  // dans l'onglet Convocation : il n'est plus dans le meme releve, et
  // comparer deux rangs dont l'un n'existe pas ne prouverait plus rien.
  test('« Tu es convoque · Titulaire » se lit AU MONTAGE, sans aucun appui', () => {
    const textes = textesVisibles(monter());

    expect(rangDe(textes, 'Tu es convoqué · Titulaire')).toBeGreaterThanOrEqual(0);
    // Et le bloc du bas n'est PAS dans la meme vue : c'est ce qui prouve que la
    // ligne n'a pas simplement suivi le bloc dans son onglet.
    expect(rangDe(textes, BLOC_DU_BAS)).toBe(-1);
  });

  test('et elle precede toujours le bloc du bas, une fois l onglet ouvert', () => {
    const root = monter();
    allerSurLOnglet(root, 'callUp');
    const textes = textesVisibles(root);

    const ligne = rangDe(textes, 'Tu es convoqué · Titulaire');
    const bas = rangDe(textes, BLOC_DU_BAS);

    expect(ligne).toBeGreaterThanOrEqual(0);
    expect(bas).toBeGreaterThanOrEqual(0);
    expect(ligne).toBeLessThan(bas);
  });
});

describe('AD01 · TEMOIN 2 — trois lecteurs, trois phrases, et JAMAIS le silence', () => {
  const hautPour = (/** @type {any} */ options) => hautDePage(monter(options));

  test('le titulaire lit sa place des le haut', () => {
    expect(hautPour({})).toContain('Tu es convoqué · Titulaire');
  });

  test('le remplacant lit la sienne, differente', () => {
    expect(hautPour({ auth: authPour(REMPLACANT) })).toContain('Tu es convoqué · Remplaçant');
  });

  test('celui qui n y est pas le lit AUSSI, en haut et en clair', () => {
    const haut = hautPour({
      auth: authPour(SPECTATEUR),
      event: buildEvent({ team: equipeSans(SPECTATEUR) }),
    });

    expect(haut).toContain('Tu n’es pas dans la composition publiée.');
    expect(haut).not.toContain('Tu es convoqué');
  });

  test('les trois phrases sont bien DIFFERENTES — jamais deux identiques', () => {
    const titulaire = hautPour({});
    const remplacant = hautPour({ auth: authPour(REMPLACANT) });
    const nonRetenu = hautPour({
      auth: authPour(SPECTATEUR),
      event: buildEvent({ team: equipeSans(SPECTATEUR) }),
    });

    expect(new Set([nonRetenu, remplacant, titulaire]).size).toBe(3);
  });

  test('sans composition publiee, la page le DIT — le silence se lit « je ne joue pas »', () => {
    const haut = hautPour({ convocation: null });

    expect(haut).toContain('La composition n’est pas encore publiée.');
  });
});

describe('AD01 · TEMOIN 3 — 🔒 le coach ne lit PAS « Tu es convoque »', () => {
  test('l organisateur ne trouve aucune de ces phrases, nulle part sur la page', () => {
    const textes = textesVisibles(monter({ auth: authPour(COACH, true) })).join(' | ');

    expect(textes).not.toContain('Tu es convoqué');
    expect(textes).not.toContain('Tu n’es pas dans la composition publiée.');
    expect(textes).not.toContain('La composition n’est pas encore publiée.');
  });
});

// ==========================================================================
// SUJET 2 — LA PORTE VERS LE TERRAIN DE DETECTION
// ==========================================================================

const DETECTION_SPLIT = {
  memberMode: 'SPREAD',
  teamCount: 2,
  teams: [
    { bibColor: 'red', index: 0, playerIds: [JOUEUR] },
    { bibColor: 'blue', index: 1, playerIds: [REMPLACANT] },
  ],
  unassignedIds: [],
};

const detectionMontee = (/** @type {any} */ composition) => monter({
  auth: authPour(COACH, true),
  composition,
  event: buildEvent({ type: { name: 'Détection' } }),
});

describe('AD01 · TEMOIN 4 — 🚪 les 1 547 lignes du terrain cessent d etre inatteignables', () => {
  test('detection + repartition rangee : un appui ouvre le terrain', () => {
    const root = detectionMontee({
      availablePresets: [],
      detectionSplit: DETECTION_SPLIT,
      draft: null,
      eligiblePlayers: [],
      published: null,
    });

    ouvrirLaFeuilleDeGestion();
    appuyer(root, 'Placer les équipes sur les terrains');

    const appel = appelVers('DetectionTeamsBoard');
    expect(appel).toBeDefined();
    expect(appel[1]).toEqual(expect.objectContaining({
      eventId: 'event-1',
      teamId: TEAM_ID,
    }));
  });

  test('sans repartition, la porte reste VISIBLE mais grisee — elle ne disparait pas', () => {
    const root = detectionMontee({
      availablePresets: [],
      detectionSplit: null,
      draft: null,
      eligiblePlayers: [],
      published: null,
    });

    ouvrirLaFeuilleDeGestion();
    const porte = boutonPortant(root, 'Placer les équipes sur les terrains');

    expect(porte).toBeDefined();
    expect(porte.props.disabled).toBe(true);
    expect(textesVisibles(root).join(' | ')).toContain('Répartis d’abord les équipes');
  });
});

describe('AD01 · TEMOIN 5 — 🔒 un MATCH ne part PAS sur le terrain de detection', () => {
  test('la porte n existe meme pas sur un match, et aucune route n y mene', () => {
    const root = monter({
      auth: authPour(COACH, true),
      composition: {
        availablePresets: [],
        detectionSplit: DETECTION_SPLIT,
        draft: null,
        eligiblePlayers: [],
        published: null,
      },
    });

    ouvrirLaFeuilleDeGestion();

    expect(boutonPortant(root, 'Placer les équipes sur les terrains')).toBeUndefined();
    expect(routesEmpruntees()).not.toContain('DetectionTeamsBoard');
  });
});

// ==========================================================================
// SUJET 3 — LE SCORE EN DEUX CHAMPS
// ==========================================================================

// Un match FINI : c'est l'horloge du SERVEUR qui le decide (AC10), jamais
// celle du telephone — sans `serverNow`, la reponse est toujours « non ».
const MATCH_FINI = buildEvent({
  date: '2020-01-01T10:00:00.000Z',
  endDate: '2020-01-01T12:00:00.000Z',
});

const HORLOGE = { data: { serverNow: '2020-01-01T14:00:00.000Z' } };

const statsSansScore = (/** @type {any} */ score = {}) => ({
  permissions: { canManage: true, canView: true },
  report: null,
  score: {
    available: false,
    isFinal: false,
    locked: false,
    scoreAgainst: null,
    scoreFor: null,
    source: null,
    teamDocumentId: TEAM_ID,
    waitingOfficial: false,
    ...score,
  },
  sport: 'football',
  team: { documentId: TEAM_ID, name: 'U15' },
});

const coachDevantUnMatchFini = (/** @type {any} */ matchStats) => monter({
  attendance: HORLOGE,
  auth: authPour(COACH, true),
  event: MATCH_FINI,
  matchStats,
});

describe('AD01 · TEMOIN 6 — ✍️ deux champs suffisent a ecrire 3-1', () => {
  test('saisir 3 et 1 puis valider envoie le score — sans ouvrir les 1 615 lignes', async () => {
    const root = coachDevantUnMatchFini(statsSansScore());

    ouvrirLaFeuilleDeGestion();
    // N4 (D6) : par la CLEF de la rangee. Sans cela, `appuyer` attraperait le
    // bouton de l'etape 1 de la carte-parcours, qui porte le meme libelle et
    // ouvre la meme feuille — vrai, mais ce n'est pas le chemin teste ici.
    presserLaRangee(root, 'matchStats');

    saisir(root, 0, '3');
    saisir(root, 1, '1');
    appuyer(root, 'Valider le score');
    await viderLaFile();

    expect(mockSaveEventMatchResult).toHaveBeenCalledWith({
      eventId: 'event-1',
      scoreAgainst: 1,
      scoreFor: 3,
      teamId: TEAM_ID,
    });
    expect(routesEmpruntees()).not.toContain('MatchStatsEditor');
    // ⛔ Pas de silence apres coup : la feuille se referme, la page relit le
    // score, et l'ecran le DIT.
    expect(root.findAllByType(TextInput)).toHaveLength(0);
    expect(mockRefetchMatchStats).toHaveBeenCalled();
    expect(jest.mocked(Alert.alert).mock.calls.map((appel) => appel[0]))
      .toContain('Score enregistré');
  });

  test('un seul champ rempli : le bouton reste ferme, et il DIT pourquoi', () => {
    const root = coachDevantUnMatchFini(statsSansScore());

    ouvrirLaFeuilleDeGestion();
    // N4 (D6) : par la CLEF de la rangee. Sans cela, `appuyer` attraperait le
    // bouton de l'etape 1 de la carte-parcours, qui porte le meme libelle et
    // ouvre la meme feuille — vrai, mais ce n'est pas le chemin teste ici.
    presserLaRangee(root, 'matchStats');
    saisir(root, 0, '3');

    expect(boutonPortant(root, 'Valider le score').props.disabled).toBe(true);
    expect(textesVisibles(root).join(' | ')).toContain('Les deux scores sont obligatoires.');
    expect(mockSaveEventMatchResult).not.toHaveBeenCalled();
  });

  test('quand un score existe deja, la chip ouvre TOUJOURS l editeur complet', () => {
    const root = coachDevantUnMatchFini(statsSansScore({
      available: true,
      scoreAgainst: 0,
      scoreFor: 2,
    }));

    ouvrirLaFeuilleDeGestion();
    // N4 (D6) : par la CLEF. Le libelle de la rangee ne depend plus de l'etat.
    presserLaRangee(root, 'matchStats');

    expect(routesEmpruntees()).toContain('MatchStatsEditor');
  });
});

describe('AD01 · TEMOIN 7 — 🔒 un score verrouille ne se reecrit pas', () => {
  test('feuille en lecture seule, bouton ferme, et le motif est a l ecran', () => {
    const root = coachDevantUnMatchFini(statsSansScore({ locked: true, source: 'external_sync' }));

    ouvrirLaFeuilleDeGestion();
    // N4 (D6) : par la CLEF de la rangee. Sans cela, `appuyer` attraperait le
    // bouton de l'etape 1 de la carte-parcours, qui porte le meme libelle et
    // ouvre la meme feuille — vrai, mais ce n'est pas le chemin teste ici.
    presserLaRangee(root, 'matchStats');

    expect(boutonPortant(root, 'Valider le score').props.disabled).toBe(true);
    expect(textesVisibles(root).join(' | '))
      .toContain('Ce score vient de la source officielle : il ne se modifie pas ici.');
  });

  test('et meme en forcant la saisie, rien ne part au serveur', () => {
    const root = coachDevantUnMatchFini(statsSansScore({ locked: true, source: 'league' }));

    ouvrirLaFeuilleDeGestion();
    // N4 (D6) : par la CLEF de la rangee. Sans cela, `appuyer` attraperait le
    // bouton de l'etape 1 de la carte-parcours, qui porte le meme libelle et
    // ouvre la meme feuille — vrai, mais ce n'est pas le chemin teste ici.
    presserLaRangee(root, 'matchStats');
    const champs = root.findAllByType(TextInput);

    expect(champs.every((/** @type {any} */ champ) => champ.props.editable === false)).toBe(true);
    expect(mockSaveEventMatchResult).not.toHaveBeenCalled();
  });
});
