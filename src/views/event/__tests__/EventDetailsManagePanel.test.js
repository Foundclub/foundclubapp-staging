import {
  Alert, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

// D4 (E6) : EventDetails.js fait 6 060 lignes et n'avait AUCUN test propre.
// Ce fichier caracterise D'ABORD le panneau organisateur tel qu'il est livre,
// PUIS verrouille la refonte. La couture choisie est le TEXTE VISIBLE et
// l'ACTION ATTEIGNABLE, jamais la forme de l'arbre : c'est ce qui permet au
// meme fichier de tourner avant et apres le passage du panneau bavard aux
// chips directes.
//
// Ce qui ne doit JAMAIS changer et qui est teste ici :
//   - qui voit quelles actions (temoins de permission, dont des temoins NEGATIFS) ;
//   - ou mene chaque action (EventEdit / modale a la une / TacticalBoardV2 / annulation) ;
//   - les confirmations d'annulation, simple et recurrente ;
//   - les reperes de performance emis par l'ecran.
// Ce qui change volontairement (chrome du panneau, nombre de taps) est isole
// dans les blocs « chrome » et « un seul tap », pour que le diff se voie.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
// L4-B : partage, pour pouvoir relire le `headerRight` que l ecran y depose.
const mockSetOptions = jest.fn();
const mockPerfMark = jest.fn();
const mockCancelEventMutate = jest.fn();
const mockEventQuery = { data: null };
const mockTeamCompositionQuery = { data: null };

// `initReactI18next` doit rester le vrai : le graphe d'imports de l'ecran
// initialise i18next au chargement, et un module indefini le fait exploser.
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

// Le theme est monte avec les VRAIS modules : un Proxy rend les echecs Jest
// illisibles (piege paye au lot paywall). Seul Images est stube, pour ne pas
// dependre de la resolution des assets.
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
  // D44 : la charge de composition decide a elle seule si l'ecran propose la
  // creation automatique d'equipes. Elle reste `null` par defaut, donc tous les
  // tests d'avant voient exactement ce qu'ils voyaient.
  useGetEventTeamComposition: () => ({ ...emptyQuery(), data: mockTeamCompositionQuery.data }),
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
  markEventDetailsPerf: (/** @type {any} */ ...args) => mockPerfMark(...args),
}));

jest.mock('../hooks/useEventMutations', () => {
  const idleMutation = () => ({ isPending: false, mutate: jest.fn() });
  return {
    useEventMutations: () => ({
      acceptParticipationMutation: idleMutation(),
      bookFullMutation: idleMutation(),
      cancelEventMutation: { isPending: false, mutate: mockCancelEventMutate },
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

// La doublure de Button rend un VRAI pressable portant son titre : sans ca, un
// bouton et une chip TouchableOpacity ne se pilotent pas de la meme facon et le
// test mourrait a la refonte.
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

// Une fabrique jest.mock est remontee en tete de fichier : elle ne peut donc
// pas s'appuyer sur un import ESM, evalue trop tard. Le require local est ici
// la seule facon d'avoir une doublure partagee.
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

// Le premier montage transpile tout le graphe d'imports de l'ecran (6 060 lignes) :
// au-dela des 5 s par defaut de Jest sur un poste froid, sans que rien ne soit casse.
jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';

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

const defaultAuth = (/** @type {any} */ overrides = {}) => ({
  canEditClub: () => false,
  canEditEvent: () => false,
  canManageEvent: () => false,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { documentId: 'user-1', role: { name: 'Joueur' } },
  ...overrides,
});

/** @type {any} */
let mounted = null;

const mountScreen = (/** @type {any} */ { auth, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockUseAuth.mockReturnValue(defaultAuth(auth));

  act(() => {
    mounted = renderer.create(
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

  return mounted.root;
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

/**
 * Tous les libelles de texte rendus a l'ecran.
 * @param {any} root - Racine du rendu.
 * @returns {Array<string>} - Les textes visibles.
 */
const visibleTexts = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node))
  .filter(Boolean);

/**
 * L'ecran affiche-t-il ce libelle ?
 * @param {any} root - Racine du rendu.
 * @param {string} label - Le libelle cherche.
 * @returns {boolean} - Vrai si un texte rendu le contient.
 */
const hasText = (root, label) => visibleTexts(root)
  .some((/** @type {string} */ value) => value.includes(label));

/**
 * Le pressable qui PORTE ce libelle. On remonte au TouchableOpacity composite le
 * plus proche : c'est le seul noeud dont l'onPress est celui de l'auteur (l'hote
 * en expose un second, cf. piege consigne).
 * @param {any} root - Racine du rendu.
 * @param {string} label - Le libelle porte par le pressable.
 * @returns {any} - Le pressable, ou undefined.
 */
const pressableWithText = (/** @type {any} */ root, /** @type {string} */ label) => root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ node) => textOf(node).includes(label));

/**
 * 🎯 N4 (D2) — LE LIBELLE D'UNE RANGEE DU MENU, VISE PAR SA CLEF.
 *
 * 🧨 POURQUOI PAS PAR SON TEXTE : depuis L4 un ONGLET porte « Convocation », et
 * depuis N4 la rangee du menu aussi — sur la MEME page. Un releve par
 * sous-chaine attrape l'onglet en premier et rend la rangee « atteignable »
 * partout, y compris la ou elle n'existe pas.
 * @param {any} root - Racine du rendu.
 * @param {string} cle - La cle de la rangee (`lineup`, `edit`…).
 * @returns {string} - Le libelle exact, ou '' si la rangee n'existe pas.
 */
const libelleDeLaRangee = (/** @type {any} */ root, /** @type {string} */ cle) => {
  const [etiquette] = root.findAll(
    (/** @type {any} */ node) => node.props?.testID === `event-manage-label-${cle}`,
    { deep: false },
  );

  return etiquette ? textOf(etiquette).trim() : '';
};

/**
 * Le pressable d'une rangee du menu, atteint par la CLEF de son libelle puis
 * remonte jusqu'au `TouchableOpacity` qui le porte.
 * @param {any} root - Racine du rendu.
 * @param {string} cle - La cle de la rangee.
 * @returns {any} - Le pressable, ou null.
 */
const rangeeDuMenu = (/** @type {any} */ root, /** @type {string} */ cle) => {
  const [etiquette] = root.findAll(
    (/** @type {any} */ node) => node.props?.testID === `event-manage-label-${cle}`,
    { deep: false },
  );
  let noeud = etiquette ? etiquette.parent : null;
  while (noeud && noeud.type !== TouchableOpacity) noeud = noeud.parent;

  return noeud;
};

const press = (/** @type {any} */ root, /** @type {string} */ label) => {
  const node = pressableWithText(root, label);
  if (!node) throw new Error(`Aucun pressable ne porte le libelle « ${label} »`);
  act(() => {
    node.props.onPress();
  });
};

const lastAlert = () => {
  const { calls } = /** @type {any} */ (Alert.alert).mock;
  return calls.length ? calls[calls.length - 1] : null;
};

const alertOptionLabels = () => {
  const call = lastAlert();
  if (!call || !Array.isArray(call[2])) return [];
  return call[2].map((/** @type {any} */ option) => option.text);
};

const pressAlertOption = (/** @type {string} */ label) => {
  const call = lastAlert();
  const option = (call?.[2] || []).find((/** @type {any} */ item) => item.text === label);
  if (!option) throw new Error(`L'alerte ne propose pas « ${label} »`);
  act(() => {
    option.onPress?.();
  });
};

/**
 * LA COUTURE. Rend la liste des actions d'organisation REELLEMENT atteignables,
 * quel que soit le chemin : chip directe (apres refonte) ou passage par l'action
 * sheet intermediaire (avant refonte). C'est cette liste qui doit rester
 * identique de part et d'autre du lot.
 * @param {any} root - Racine du rendu.
 * @returns {Array<string>} - Les cles d'action atteignables, triees.
 */
const reachableManageActions = (/** @type {any} */ root) => {
  // Depuis D4, les actions vivent dans un panneau replie : le deplier fait
  // partie du chemin. Sur la source d'avant, cette ligne ne trouve rien et ne
  // fait rien — c'est ce qui permet au meme releve de valoir des deux cotes.
  ouvrirLaFeuilleDeGestion();
  const direct = root
    .findAllByType(TouchableOpacity)
    .map((/** @type {any} */ node) => textOf(node))
    .filter(Boolean);
  const found = new Set();

  const collect = (/** @type {string} */ label, /** @type {string} */ key) => {
    if (direct.some((/** @type {string} */ value) => value.includes(label))) found.add(key);
  };

  collect('Modifier', 'edit');
  collect('la une', 'featured');
  collect('Annuler', 'cancel');
  // 🎯 N4 (D2) — LA RANGEE DE CONVOCATION SE RELEVE PAR SA CLEF. Les trois
  // `collect` d'avant ('composition', 'Composition', 'Compo') cherchaient le
  // mot dans le texte des pressables : depuis N4 le mot est « Convocation », et
  // un ONGLET le porte deja. Le releve aurait donc ete vrai partout.
  if (libelleDeLaRangee(root, 'lineup')) found.add('lineup');

  const collectFromSheet = () => {
    alertOptionLabels().forEach((/** @type {string} */ label) => {
      if (label.includes('Modifier')) found.add('edit');
      if (label.includes('la une')) found.add('featured');
      if (label.includes("Annuler l'événement")) found.add('cancel');
    });
  };

  // Avant refonte, un tournoi empile DEUX action sheets : « Actions tournoi »
  // puis « Actions événement ». Le meme releve doit rester possible apres, quand
  // les chips remplacent les deux niveaux.
  if (direct.some((/** @type {string} */ value) => value.includes('Actions tournoi'))) {
    press(root, 'Actions tournoi');
    if (alertOptionLabels().includes('Actions événement')) {
      pressAlertOption('Actions événement');
      collectFromSheet();
    }
  }

  if (direct.some((/** @type {string} */ value) => value.includes('Actions événement'))) {
    press(root, 'Actions événement');
    collectFromSheet();
  }

  return [...found].sort();
};

const PANEL_ID = 'event-manage-panel';
const PANEL_ROW_ID = 'event-manage-panel-row';
const CHIP_ID = 'event-manage-chip';

const byTestId = (/** @type {any} */ root, /** @type {string} */ id) => root
  .findAll((/** @type {any} */ node) => node.props?.testID === id && node.type === View);

const flatStyle = (/** @type {any} */ node) => StyleSheet.flatten(node?.props?.style) || {};

const chipWidths = (/** @type {any} */ root) => byTestId(root, CHIP_ID)
  .map((/** @type {any} */ node) => flatStyle(node).width);

const asTournamentOrganiser = () => mountScreen({
  auth: {
    canEditEvent: () => true,
    canManageEvent: () => true,
    userData: { documentId: 'user-1', role: { name: 'Entraineur' } },
  },
  event: buildEvent({ type: { name: 'Tournoi' } }),
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockTeamCompositionQuery.data = null;
  mounted = null;
});

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
    mounted = null;
  }
  jest.restoreAllMocks();
});

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

describe('EventDetails — panneau organisateur : etats recenses', () => {
  test('etat 1 — organisateur : modifier, a la une, compo et annuler atteignables', () => {
    const root = mountScreen({
      auth: {
        canEditEvent: () => true,
        canManageEvent: () => true,
        userData: { documentId: 'user-1', role: { name: 'Entraineur' } },
      },
    });

    expect(reachableManageActions(root)).toEqual(['cancel', 'edit', 'featured', 'lineup']);
  });

  test('etat 2 — organisateur sans equipe : pas de compo, le reste est atteignable', () => {
    const root = mountScreen({
      auth: { canManageEvent: () => true },
      event: buildEvent({ invitedTeams: [], team: null }),
    });

    expect(reachableManageActions(root)).toEqual(['cancel', 'edit', 'featured']);
  });

  test('etat 3 — TEMOIN NEGATIF : cotisations sans canEdit, ni modifier ni annuler', () => {
    const root = mountScreen({
      auth: {
        canEditClub: () => true,
        canManageEvent: () => false,
        userData: { documentId: 'user-1', role: { name: 'Dirigeant' } },
      },
    });

    const reachable = reachableManageActions(root);
    expect(reachable).not.toContain('edit');
    expect(reachable).not.toContain('cancel');
  });

  test('etat 4 — TEMOIN NEGATIF : un participant ne voit aucune action d organisation', () => {
    const root = mountScreen();

    expect(reachableManageActions(root)).toEqual([]);
    expect(hasText(root, 'DOUBLURE_EventAnswerButtons')).toBe(true);
  });

  test('etat 5 — TEMOIN NEGATIF : « a la une » disparait si la demande est en attente', () => {
    const root = mountScreen({
      auth: { canManageEvent: () => true },
      // Les DEUX portees ouvertes a cet evenement (publique et club) doivent
      // etre prises pour que « a la une » n'ait plus rien a demander.
      event: buildEvent({
        featuredRequestsSummary: {
          PUBLIC: { requestId: 'req-1', status: 'pending' },
          SECTION: { requestId: 'req-2', status: 'pending' },
        },
        invitedTeams: [],
        team: null,
      }),
    });

    expect(reachableManageActions(root)).not.toContain('featured');
  });

  test('etat 6 — reservation : le module de reservation est rendu, distinct du panneau', () => {
    const root = mountScreen({
      auth: { canManageEvent: () => true },
      event: buildEvent({ type: { name: 'Reservation' } }),
    });

    expect(hasText(root, 'DOUBLURE_EventReservationActions')).toBe(true);
  });

  test('etat 7 — tournoi : le panneau tournoi prend la main et propose ses actions', () => {
    const root = mountScreen({
      auth: { canManageEvent: () => true },
      event: buildEvent({ type: { name: 'Tournoi' } }),
    });

    expect(hasText(root, 'Gérer le tournoi')).toBe(true);
    expect(reachableManageActions(root)).toContain('edit');
  });

  test('etat 8 — tournoi vu par un visiteur : il consulte, il ne gere pas', () => {
    const root = mountScreen({
      event: buildEvent({ type: { name: 'Tournoi' } }),
    });

    expect(hasText(root, 'Voir le tournoi')).toBe(true);
    expect(reachableManageActions(root)).toEqual([]);
  });
});

describe('EventDetails — ou menent les actions (inchange par la refonte)', () => {
  const asOrganiser = () => mountScreen({
    auth: {
      canEditEvent: () => true,
      canManageEvent: () => true,
      userData: { documentId: 'user-1', role: { name: 'Entraineur' } },
    },
  });

  test('Modifier ouvre l ecran EventEdit avec l identifiant de l evenement', () => {
    const root = asOrganiser();
    ouvrirLaFeuilleDeGestion();
    const direct = pressableWithText(root, 'Modifier');

    if (direct) press(root, 'Modifier');
    else {
      press(root, 'Actions événement');
      pressAlertOption("Modifier l'événement");
    }

    expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
      params: { eventId: 'event-1' },
      screen: 'EventEdit',
    });
  });

  test('l annulation garde sa confirmation, et ne mute rien tant qu on n a pas confirme', () => {
    const root = asOrganiser();
    ouvrirLaFeuilleDeGestion();
    const direct = pressableWithText(root, 'Annuler');

    if (direct) press(root, 'Annuler');
    else {
      press(root, 'Actions événement');
      pressAlertOption("Annuler l'événement");
    }

    expect(alertOptionLabels()).toEqual([
      'eventDetails.modals.actions.cancel',
      'eventDetails.modals.actions.confirm',
    ]);
    expect(mockCancelEventMutate).not.toHaveBeenCalled();

    pressAlertOption('eventDetails.modals.actions.confirm');
    expect(mockCancelEventMutate).toHaveBeenCalledWith({ documentId: 'event-1' });
  });

  test('un evenement recurrent propose les trois portees d annulation', () => {
    const root = mountScreen({
      auth: { canEditEvent: () => true, canManageEvent: () => true },
      event: buildEvent({ recurrenceGroupId: 'rec-1' }),
    });
    ouvrirLaFeuilleDeGestion();
    const direct = pressableWithText(root, 'Annuler');

    if (direct) press(root, 'Annuler');
    else {
      press(root, 'Actions événement');
      pressAlertOption("Annuler l'événement");
    }

    expect(alertOptionLabels()).toHaveLength(4);
    expect(mockCancelEventMutate).not.toHaveBeenCalled();
  });

  test('« Convocation » ouvre la composition, sans passer par une action sheet', () => {
    const root = asOrganiser();
    ouvrirLaFeuilleDeGestion();
    // N4 (D1/D2) : la rangee s'appelle « Convocation » — egalite STRICTE, et
    // par clef, pour ne pas confondre avec l'onglet homonyme.
    expect(libelleDeLaRangee(root, 'lineup')).toBe('Convocation');
    const lineup = rangeeDuMenu(root, 'lineup');
    expect(lineup).toBeTruthy();

    act(() => {
      lineup.props.onPress();
    });

    // D77 — un evenement qu'on peut modifier et qui n'est pas une detection
    // commence par « Convoquer » (ecran 1 du pack), puis enchaine sur le terrain.
    expect(mockNavigate).toHaveBeenCalledWith(
      'MatchCallUpSelection',
      expect.objectContaining({ eventId: 'event-1' }),
    );
  });

  test('les reperes de performance de l ecran sont toujours emis', async () => {
    asOrganiser();
    // Le repere « premier contenu rendu » passe par requestAnimationFrame :
    // sans ce vidage de file, on mesurerait l'ordonnanceur, pas l'ecran.
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 20); });
    });

    const marks = mockPerfMark.mock.calls.map((/** @type {any} */ call) => call[0]);
    // Ce sont les SEULS evenements instrumentes de l'ecran : `EventDetails.js`
    // n'importe aucun module d'analytique. Les quatre partent au montage ; les
    // deux autres (`secondary_queries_completed`, `focus_refresh_requested`)
    // dependent d'un retour reseau et d'un retour d'ecran.
    expect(marks).toContain('event_detail_open_started');
    expect(marks).toContain('event_detail_primary_query_completed');
    expect(marks).toContain('event_detail_first_content_rendered');
    expect(marks).toContain('event_detail_secondary_queries_enabled');
  });
});

describe('D4 — le panneau compact « Gerer l evenement »', () => {
  const asOrganiser = () => mountScreen({
    auth: {
      canEditEvent: () => true,
      canManageEvent: () => true,
      userData: { documentId: 'user-1', role: { name: 'Entraineur' } },
    },
  });

  // L4-B : « replie par defaut » devient « la feuille est fermee au montage ».
  // La GARANTIE est la meme mot pour mot — au montage, la page ne montre AUCUNE
  // action d'organisation, et rien ne mange la hauteur de l'ecran. Seul le
  // contenant a change : la rangee-accordeon est devenue un ⋯ en barre du haut.
  test('ferme par defaut : un ⋯ atteignable, aucune chip, aucun paragraphe', () => {
    const root = asOrganiser();

    expect(boutonDeGestion()).toBeTruthy();
    expect(pressableWithText(root, 'Modifier')).toBeUndefined();
    expect(hasText(root, 'Actions événement')).toBe(false);
    expect(hasText(root, 'Modifie cet evenement')).toBe(false);
    expect(hasText(root, 'Gère les cotisations rattachées')).toBe(false);
  });

  // L4-B : « le panneau replie tient dans 60 px » devient « le ⋯ ne coute RIEN
  // a la colonne ». La garantie de fond — le menu ne mange pas la page — est
  // desormais absolue : il n'est plus dans la page du tout. Ce qui reste a
  // verifier, c'est qu'il garde une cible tactile d'au moins 44 pt.
  test('le ⋯ ne coute aucune hauteur a la colonne, et reste une cible de 44 pt', () => {
    const root = asOrganiser();

    expect(byTestId(root, PANEL_ID)).toHaveLength(0);
    expect(byTestId(root, PANEL_ROW_ID)).toHaveLength(0);

    const style = StyleSheet.flatten(boutonDeGestion().props.style) || {};
    expect(Number(style.height)).toBeGreaterThanOrEqual(44);
    expect(Number(style.width)).toBeGreaterThanOrEqual(44);
  });

  // ⚠️ INVERSION VOLONTAIRE (L4-B), maquette planche 04 · 4C : la grille a deux
  // colonnes devient une LISTE DE RANGEES pleine largeur, parce que chaque
  // rangee porte desormais SA DESTINATION sous son libelle — une demi-colonne
  // casserait la destination en quatre lignes illisibles.
  // ⇒ CE QUE CE TEMOIN PROTEGE EST INTACT : les 4 actions, toutes atteignables.
  test('ouvert : les 5 rangees sont la, pleine largeur (dont la bascule d entrainement)', () => {
    const root = asOrganiser();
    ouvrirLaFeuilleDeGestion();

    // N7 item 4 (vague P, 23/08) : sur un ENTRAINEMENT, la bascule « Ouvrir /
    // Fermer l'entraînement » a rejoint la feuille — 4 rangees deviennent 5.
    expect(chipWidths(root)).toEqual(['100%', '100%', '100%', '100%', '100%']);
    ['Modifier', 'À la une', 'Annuler'].forEach((label) => {
      expect(pressableWithText(root, label)).toBeTruthy();
    });
    // N4 (D1) : « Compo » est devenu « Convocation ». Meme rangee, meme porte.
    expect(libelleDeLaRangee(root, 'lineup')).toBe('Convocation');
  });

  test('un seul tap : la chip Modifier navigue sans action sheet intermediaire', () => {
    const root = asOrganiser();
    ouvrirLaFeuilleDeGestion();
    press(root, 'Modifier');

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
      params: { eventId: 'event-1' },
      screen: 'EventEdit',
    });
  });

  test('plus aucun bouton autonome « Mettre a la une » : la chip ouvre la modale existante', () => {
    const root = asOrganiser();
    ouvrirLaFeuilleDeGestion();

    expect(pressableWithText(root, 'Mettre à la une')).toBeUndefined();
    expect(hasText(root, 'Choisis ou tu souhaites mettre cet événement en avant.')).toBe(false);

    press(root, 'À la une');
    expect(hasText(root, 'Choisis ou tu souhaites mettre cet événement en avant.')).toBe(true);
  });

  test('la chip Annuler garde la confirmation, et ne mute rien avant le oui', () => {
    const root = asOrganiser();
    ouvrirLaFeuilleDeGestion();
    press(root, 'Annuler');

    expect(alertOptionLabels()).toEqual([
      'eventDetails.modals.actions.cancel',
      'eventDetails.modals.actions.confirm',
    ]);
    expect(mockCancelEventMutate).not.toHaveBeenCalled();
  });

  test('TEMOIN : trois rangees seulement, chacune pleine largeur', () => {
    const root = mountScreen({
      auth: { canEditEvent: () => true, canManageEvent: () => true },
      // Ni equipe (pas de Compo) ni portee « a la une » disponible : restent
      // Modifier et Annuler.
      event: buildEvent({
        featuredRequestsSummary: {
          PUBLIC: { status: 'approved' },
          SECTION: { status: 'approved' },
        },
        invitedTeams: [],
        team: null,
      }),
    });
    ouvrirLaFeuilleDeGestion();

    // L4-B : deux actions seulement, chacune sur sa rangee. Le COMPTE est ce
    // que ce temoin protege ; la largeur suit la maquette 04 · 4C.
    // N7 item 4 (vague P, 23/08) : + la bascule d'entrainement, qui ne depend
    // ni d'une equipe ni d'une portee « a la une » — 2 rangees deviennent 3.
    expect(chipWidths(root)).toEqual(['100%', '100%', '100%']);
  });

  test('TEMOIN NEGATIF : sans canEdit, ni Modifier ni Annuler dans le panneau', () => {
    const root = mountScreen({
      auth: {
        canEditClub: () => true,
        canManageEvent: () => false,
        userData: { documentId: 'user-1', role: { name: 'Dirigeant' } },
      },
    });

    ouvrirLaFeuilleDeGestion();
    expect(pressableWithText(root, 'Modifier')).toBeUndefined();
    expect(pressableWithText(root, 'Annuler')).toBeUndefined();
  });

  test('TEMOIN NEGATIF : aucune chip visible, donc aucun ⋯', () => {
    const root = mountScreen();

    expect(byTestId(root, PANEL_ID)).toHaveLength(0);
    // L4-B : la garantie « pas d'actions ⇒ pas de bouton muet » se lit
    // maintenant sur l'en-tete, seul endroit ou le menu existe encore.
    expect(boutonDeGestion()).toBeNull();
  });

  test('variante tournoi : 5 actions, dont Reglages tournoi', () => {
    const root = asTournamentOrganiser();
    ouvrirLaFeuilleDeGestion();

    expect(chipWidths(root)).toEqual(['100%', '100%', '100%', '100%', '100%']);
    ['Modifier', 'À la une', 'Réglages tournoi', 'Annuler'].forEach((label) => {
      expect(pressableWithText(root, label)).toBeTruthy();
    });
    // N4 (D1) : « Compo » est devenu « Convocation ». Meme rangee, meme porte.
    expect(libelleDeLaRangee(root, 'lineup')).toBe('Convocation');
  });

  test('variante tournoi : Reglages tournoi navigue en un seul tap', () => {
    const root = asTournamentOrganiser();
    ouvrirLaFeuilleDeGestion();
    press(root, 'Réglages tournoi');

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('TournamentSettingsEdit', { eventId: 'event-1' });
  });

  test('l action sheet intermediaire a disparu des deux panneaux', () => {
    const root = asTournamentOrganiser();
    ouvrirLaFeuilleDeGestion();

    expect(pressableWithText(root, 'Actions événement')).toBeUndefined();
    expect(pressableWithText(root, 'Actions tournoi')).toBeUndefined();
  });

  test('reservation : le module de reservation reste rendu AU-DESSUS du panneau', () => {
    const root = mountScreen({
      auth: { canEditEvent: () => true, canManageEvent: () => true },
      event: buildEvent({ type: { name: 'Reservation' } }),
    });

    expect(hasText(root, 'DOUBLURE_EventReservationActions')).toBe(true);
    // L4-B : le panneau a quitte la colonne. Ce que ce temoin protege — le
    // module de reservation reste rendu, et il n'y a pas d'action sheet
    // intermediaire — se lit maintenant sur le ⋯ et sa feuille.
    expect(byTestId(root, PANEL_ID)).toHaveLength(0);
    expect(boutonDeGestion()).toBeTruthy();
    expect(pressableWithText(root, 'Actions événement')).toBeUndefined();
  });
});

// ============================================================================
// D44 puis C-E — LE TYPE DE L'EVENEMENT COMMANDE LA COMPOSITION.
//
// D44 (histoire, conservee) : l'alerte « Creation auto ou a la main » ne
// dependait que de `availablePresets`, une liste qui ne parle QUE du sport (le
// football en a trois : 4-3-3, 4-4-2, 4-2-3-1). Resultat : tout match de
// football sans composition proposait de creer plusieurs equipes
// automatiquement — un systeme qui n'a de sens que pour une detection. Le
// predicat retenu fut `isDetectionEvent`, celui-la meme qui fabrique `eventKind`.
//
// C-E (🚪 le sujet du lot) : la detection ouvre desormais l'ECRAN 13 du pack
// (`DetectionSquadSetup`), livre par C-D et qu'aucun bouton n'atteignait. Cet
// ecran POSE LUI-MEME la question de D44, avec ses CTA `Manuel` et `Continuer`,
// et il la pose apres avoir montre les inscrits et le pointage. L'alerte est
// donc retiree : deux chemins qui menaient au meme endroit, la premiere fois
// sans rien montrer.
//
// ⚠️ CE QUI NE BOUGE PAS, ET C'EST TESTE CI-DESSOUS : un MATCH va exactement ou
// il allait (`MatchCallUpSelection`), un ENTRAINEMENT aussi, et la LECTURE SEULE
// reste sur l'ancien terrain.
// ============================================================================

describe('C-E — le type de l evenement decide de la porte de composition', () => {
  const PRESETS_FOOTBALL = [
    { key: '4-3-3', label: '4-3-3', slots: [] },
    { key: '4-4-2', label: '4-4-2', slots: [] },
    { key: '4-2-3-1', label: '4-2-3-1', slots: [] },
  ];

  const asOrganiserOf = (/** @type {string} */ typeName) => {
    // Le sport a des schemas connus, et rien n'est encore compose : c'est
    // exactement l'etat qui declenchait l'alerte sur tout match de football.
    mockTeamCompositionQuery.data = {
      availablePresets: PRESETS_FOOTBALL,
      bootstrap: { composition: null, source: 'empty' },
      draft: null,
      eligiblePlayers: [],
      published: null,
    };

    return mountScreen({
      auth: {
        canEditEvent: () => true,
        canManageEvent: () => true,
        userData: { documentId: 'user-1', role: { name: 'Entraineur' } },
      },
      event: buildEvent({ type: { name: typeName } }),
    });
  };

  // N4 (D2) : la rangee se presse par sa CLEF. Son libelle depend desormais du
  // type d'evenement (« Convocation » / « Répartition ») — un helper qui vise
  // le mot ne saurait plus lequel chercher, et attraperait l'onglet homonyme.
  const pressCompo = (/** @type {any} */ root) => {
    ouvrirLaFeuilleDeGestion();
    const lineup = rangeeDuMenu(root, 'lineup');
    if (!lineup) throw new Error('L action de composition n est pas atteignable');
    act(() => {
      lineup.props.onPress();
    });
  };

  // La composition a maintenant TROIS portes d'entree, et elles portent la meme
  // charge : `MatchCallUpSelection` (ecran 1, match modifiable),
  // `DetectionSquadSetup` (ecran 13, detection modifiable) et `TacticalBoardV2`
  // (lecture seule). Ce qui est verifie ici — l'intention et l'etiquette de
  // type — vaut sur les trois.
  const ROUTES_COMPOSITION = ['MatchCallUpSelection', 'DetectionSquadSetup', 'TacticalBoardV2'];
  const lastBoardParams = () => {
    const call = [...mockNavigate.mock.calls].reverse()
      .find((/** @type {any} */ entry) => ROUTES_COMPOSITION.includes(entry[0]));
    return call ? call[1] : null;
  };
  const lastRoute = () => {
    const call = [...mockNavigate.mock.calls].reverse()
      .find((/** @type {any} */ entry) => ROUTES_COMPOSITION.includes(entry[0]));
    return call ? call[0] : null;
  };

  // 🔒 LE TEMOIN DE NON-REGRESSION DU LOT C-E : un MATCH doit continuer d'aller
  // exactement ou il allait. C'est la seule chose que la porte neuve pouvait
  // casser, et c'est donc la premiere qu'on verrouille.
  test('🔒 NON-REGRESSION — un MATCH va toujours a l ecran « Convoquer »', () => {
    const root = asOrganiserOf('Match');
    pressCompo(root);

    expect(lastRoute()).toBe('MatchCallUpSelection');
    expect(alertOptionLabels()).not.toContain('Création auto');
    expect(lastBoardParams().compositionIntent).toBe('manual');
    expect(lastBoardParams().eventKind).toBe('match');
  });

  test('🚪 une DETECTION ouvre l ecran 13, plus l ancien terrain', () => {
    const root = asOrganiserOf('Detection');
    pressCompo(root);

    expect(lastRoute()).toBe('DetectionSquadSetup');
    expect(lastBoardParams().eventKind).toBe('detection');
  });

  test('🚪 l ecran 13 recoit de quoi travailler : evenement, equipe, sport, effectif', () => {
    const root = asOrganiserOf('Detection de joueurs');
    pressCompo(root);

    expect(lastBoardParams()).toEqual(expect.objectContaining({
      canEdit: true,
      eventId: 'event-1',
      teamId: 'team-1',
    }));
    expect(Array.isArray(lastBoardParams().players)).toBe(true);
    expect(lastBoardParams().sport).toBeTruthy();
  });

  test('plus aucune alerte ne s interpose : l ecran 13 pose lui-meme la question', () => {
    const root = asOrganiserOf('Detection');
    pressCompo(root);

    expect(alertOptionLabels()).not.toContain('Création auto');
    expect(alertOptionLabels()).not.toContain('Faire à la main');
  });

  test('🔒 NON-REGRESSION — un ENTRAINEMENT reste un match, et n a pas d alerte', () => {
    const root = asOrganiserOf('Entrainement');
    pressCompo(root);

    expect(lastRoute()).toBe('MatchCallUpSelection');
    expect(alertOptionLabels()).not.toContain('Création auto');
    expect(lastBoardParams().compositionIntent).toBe('manual');
    expect(lastBoardParams().eventKind).toBe('match');
  });
});
