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
          setOptions: jest.fn(),
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
 * Deplie le panneau compact s'il est la. Sur la source d'avant D4 ce controle
 * n'existe pas : la fonction ne fait alors rien, et le meme releve vaut des
 * deux cotes.
 * @param {any} root - Racine du rendu.
 * @returns {void}
 */
const openManagePanel = (root) => {
  if (pressableWithText(root, "Gérer l'événement")) press(root, "Gérer l'événement");
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
  openManagePanel(root);
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
  collect('composition', 'lineup');
  collect('Composition', 'lineup');
  collect('Compo', 'lineup');

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

/**
 * Hauteur DECLAREE du panneau replie : rangee + rembourrages + bordures.
 * Ce n'est pas une mesure a l'ecran (il faudrait un appareil) mais la somme des
 * valeurs que le style impose — donc verifiable, et ca suffit a interdire le
 * retour d'un titre et d'un paragraphe.
 * @param {any} root - Racine du rendu.
 * @returns {number} - La hauteur declaree, en points.
 */
const collapsedPanelHeight = (/** @type {any} */ root) => {
  const [panel] = byTestId(root, PANEL_ID);
  const [row] = byTestId(root, PANEL_ROW_ID);
  if (!panel || !row) throw new Error('Le panneau compact n est pas rendu');
  const panelStyle = flatStyle(panel);
  const rowStyle = flatStyle(row);
  const vertical = Number(panelStyle.paddingVertical || 0);
  const top = Number(panelStyle.paddingTop || vertical);
  const bottom = Number(panelStyle.paddingBottom || vertical);
  const border = Number(panelStyle.borderWidth || 0) * 2;
  return Number(rowStyle.height || 0) + top + bottom + border;
};

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
    openManagePanel(root);
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
    openManagePanel(root);
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
    openManagePanel(root);
    const direct = pressableWithText(root, 'Annuler');

    if (direct) press(root, 'Annuler');
    else {
      press(root, 'Actions événement');
      pressAlertOption("Annuler l'événement");
    }

    expect(alertOptionLabels()).toHaveLength(4);
    expect(mockCancelEventMutate).not.toHaveBeenCalled();
  });

  test('Compo ouvre la composition, sans passer par une action sheet', () => {
    const root = asOrganiser();
    openManagePanel(root);
    const lineup = pressableWithText(root, 'Compo')
      || pressableWithText(root, 'composition');
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

  test('replie par defaut : une rangee, aucune chip, aucun paragraphe', () => {
    const root = asOrganiser();

    expect(hasText(root, "Gérer l'événement")).toBe(true);
    expect(pressableWithText(root, 'Modifier')).toBeUndefined();
    expect(hasText(root, 'Actions événement')).toBe(false);
    expect(hasText(root, 'Modifie cet evenement')).toBe(false);
    expect(hasText(root, 'Gère les cotisations rattachées')).toBe(false);
  });

  test('replie, le panneau tient dans 60 px declares', () => {
    const root = asOrganiser();

    expect(collapsedPanelHeight(root)).toBeLessThanOrEqual(60);
  });

  test('deplie : les 4 chips d action sont la, en deux colonnes', () => {
    const root = asOrganiser();
    press(root, "Gérer l'événement");

    expect(chipWidths(root)).toEqual(['48%', '48%', '48%', '48%']);
    ['Modifier', 'À la une', 'Compo', 'Annuler'].forEach((label) => {
      expect(pressableWithText(root, label)).toBeTruthy();
    });
  });

  test('un seul tap : la chip Modifier navigue sans action sheet intermediaire', () => {
    const root = asOrganiser();
    press(root, "Gérer l'événement");
    press(root, 'Modifier');

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
      params: { eventId: 'event-1' },
      screen: 'EventEdit',
    });
  });

  test('plus aucun bouton autonome « Mettre a la une » : la chip ouvre la modale existante', () => {
    const root = asOrganiser();
    press(root, "Gérer l'événement");

    expect(pressableWithText(root, 'Mettre à la une')).toBeUndefined();
    expect(hasText(root, 'Choisis ou tu souhaites mettre cet événement en avant.')).toBe(false);

    press(root, 'À la une');
    expect(hasText(root, 'Choisis ou tu souhaites mettre cet événement en avant.')).toBe(true);
  });

  test('la chip Annuler garde la confirmation, et ne mute rien avant le oui', () => {
    const root = asOrganiser();
    press(root, "Gérer l'événement");
    press(root, 'Annuler');

    expect(alertOptionLabels()).toEqual([
      'eventDetails.modals.actions.cancel',
      'eventDetails.modals.actions.confirm',
    ]);
    expect(mockCancelEventMutate).not.toHaveBeenCalled();
  });

  test('TEMOIN : deux chips seulement tiennent sur une rangee pleine largeur', () => {
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
    press(root, "Gérer l'événement");

    expect(chipWidths(root)).toEqual(['48%', '48%']);
  });

  test('TEMOIN NEGATIF : sans canEdit, ni Modifier ni Annuler dans le panneau', () => {
    const root = mountScreen({
      auth: {
        canEditClub: () => true,
        canManageEvent: () => false,
        userData: { documentId: 'user-1', role: { name: 'Dirigeant' } },
      },
    });

    if (pressableWithText(root, "Gérer l'événement")) press(root, "Gérer l'événement");
    expect(pressableWithText(root, 'Modifier')).toBeUndefined();
    expect(pressableWithText(root, 'Annuler')).toBeUndefined();
  });

  test('TEMOIN NEGATIF : aucune chip visible, donc aucun panneau', () => {
    const root = mountScreen();

    expect(byTestId(root, PANEL_ID)).toHaveLength(0);
    expect(hasText(root, "Gérer l'événement")).toBe(false);
  });

  test('variante tournoi : 5 chips, dont Reglages tournoi en pleine largeur', () => {
    const root = asTournamentOrganiser();
    press(root, "Gérer l'événement");

    expect(chipWidths(root)).toEqual(['48%', '48%', '48%', '48%', '100%']);
    ['Modifier', 'À la une', 'Compo', 'Réglages tournoi', 'Annuler'].forEach((label) => {
      expect(pressableWithText(root, label)).toBeTruthy();
    });
  });

  test('variante tournoi : Reglages tournoi navigue en un seul tap', () => {
    const root = asTournamentOrganiser();
    press(root, "Gérer l'événement");
    press(root, 'Réglages tournoi');

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('TournamentSettingsEdit', { eventId: 'event-1' });
  });

  test('l action sheet intermediaire a disparu des deux panneaux', () => {
    const root = asTournamentOrganiser();
    press(root, "Gérer l'événement");

    expect(pressableWithText(root, 'Actions événement')).toBeUndefined();
    expect(pressableWithText(root, 'Actions tournoi')).toBeUndefined();
  });

  test('reservation : le module de reservation reste rendu AU-DESSUS du panneau', () => {
    const root = mountScreen({
      auth: { canEditEvent: () => true, canManageEvent: () => true },
      event: buildEvent({ type: { name: 'Reservation' } }),
    });

    expect(hasText(root, 'DOUBLURE_EventReservationActions')).toBe(true);
    expect(byTestId(root, PANEL_ID)).toHaveLength(1);
    expect(pressableWithText(root, 'Actions événement')).toBeUndefined();
  });
});

// ============================================================================
// D44 — LE TYPE DE L'EVENEMENT COMMANDE LA COMPOSITION. Temoins ROUGES avant.
//
// Defaut mesure : l'alerte « Creation auto ou a la main » ne dependait que de
// `availablePresets`, une liste qui ne parle QUE du sport (le football en a
// trois : 4-3-3, 4-4-2, 4-2-3-1). Resultat : tout match de football sans
// composition proposait de creer plusieurs equipes automatiquement — un systeme
// qui n'a de sens que pour une detection.
//
// Le predicat retenu est `isDetectionEvent`, celui-la meme qui fabrique
// `eventKind`. Prendre `!isMatchEvent` fabriquerait une incoherence : un
// entrainement n'est ni un match ni une detection, il partirait donc avec
// `eventKind: 'match'` — et l'alerte lui aurait promis une creation automatique
// que le board refuse ensuite d'ouvrir.
// ============================================================================

describe('D44 — l alerte « creation auto » n appartient qu a la detection', () => {
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

  const pressCompo = (/** @type {any} */ root) => {
    openManagePanel(root);
    const lineup = pressableWithText(root, 'Compo') || pressableWithText(root, 'composition');
    if (!lineup) throw new Error('L action de composition n est pas atteignable');
    act(() => {
      lineup.props.onPress();
    });
  };

  // D77 — la composition a maintenant DEUX portes d'entree, et elles portent la
  // meme charge : `MatchCallUpSelection` (ecran « Convoquer », pour un match
  // modifiable) et `TacticalBoardV2` (detection et lecture seule). Ce qui est
  // verifie ici — l'intention et l'etiquette de type — vaut sur les deux.
  const ROUTES_COMPOSITION = ['MatchCallUpSelection', 'TacticalBoardV2'];
  const lastBoardParams = () => {
    const call = [...mockNavigate.mock.calls].reverse()
      .find((/** @type {any} */ entry) => ROUTES_COMPOSITION.includes(entry[0]));
    return call ? call[1] : null;
  };

  test('TEMOIN 1 — sur un MATCH, aucune alerte : la composition s ouvre directement', () => {
    const root = asOrganiserOf('Match');
    pressCompo(root);

    expect(alertOptionLabels()).not.toContain('Création auto');
    expect(lastBoardParams()).toBeTruthy();
    expect(lastBoardParams().compositionIntent).toBe('manual');
  });

  test('TEMOIN 2 — sur une DETECTION, l alerte garde ses deux chemins', () => {
    const root = asOrganiserOf('Detection');
    pressCompo(root);

    expect(alertOptionLabels()).toEqual(['Annuler', 'Création auto', 'Faire à la main']);

    pressAlertOption('Création auto');
    expect(lastBoardParams().compositionIntent).toBe('auto');
    expect(lastBoardParams().eventKind).toBe('detection');
  });

  test('un ENTRAINEMENT n est pas une detection non plus : pas d alerte', () => {
    const root = asOrganiserOf('Entrainement');
    pressCompo(root);

    expect(alertOptionLabels()).not.toContain('Création auto');
    expect(lastBoardParams().compositionIntent).toBe('manual');
  });

  test('l etiquette de type descend jusqu au board, et elle dit la verite', () => {
    const surMatch = asOrganiserOf('Match');
    pressCompo(surMatch);
    expect(lastBoardParams().eventKind).toBe('match');

    act(() => {
      mounted.unmount();
      mounted = null;
    });
    mockNavigate.mockClear();

    // Sur une detection, l'alerte s'interpose : c'est en choisissant un de ses
    // deux chemins qu'on arrive au board. Ici « Faire a la main », pour prouver
    // que l'etiquette est juste sur les DEUX chemins de l'alerte.
    const surDetection = asOrganiserOf('Detection de joueurs');
    pressCompo(surDetection);
    expect(lastBoardParams()).toBeNull();

    pressAlertOption('Faire à la main');
    expect(lastBoardParams().eventKind).toBe('detection');
    expect(lastBoardParams().compositionIntent).toBe('manual');
  });
});
