import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// AC08 — LA PORTE. Temoins 1, 2, 5 et 6 du lot.
//
// 🗣️ Adel, trois fois : « pour voir la composition, l'ecran n'est pas bon du
// tout » (7b) · « c'est nul, l'ecran est mauvais » (D-22) · « je dois VRAIMENT
// voir la compo : le terrain avec les joueurs places et le banc » (D-23).
//
// 🧨 CE QUE LA MESURE A TROUVE, et qui explique le constat : l'ecran demande
// EXISTE deja, entier (`PlayerConvocationScreen`, 414 lignes, teste). Mais la
// page d'un evenement n'y menait JAMAIS — seule une notification poussee y
// conduisait, et le bouton « Voir la composition d'equipes » deposait le joueur
// sur le TABLEAU DU COACH desactive (1 974 lignes), sans bouton pour repondre.
// Convoque et non-convoque lisaient exactement le meme bloc.
//
// 🎯 Ce fichier ne verrouille pas un dessin : il verrouille UN CHEMIN.
//   1. 🥇 un joueur convoque atteint le terrain en UN appui ;
//   2. 🔒 un joueur NON convoque n'est PAS envoye la-bas (il y serait repose
//      aussitot : ce serait un aller-retour pour rien) ;
//   5. convoque et non convoque ne lisent PLUS la meme chose ;
//   6. 🔒 NON-REGRESSION : le tableau du COACH n'a pas bouge d'un pouce.
//
// La couture est le TEXTE VISIBLE et la ROUTE EMPRUNTEE, jamais la forme de
// l'arbre — le meme choix que `EventDetailsCompoReminder.test.js`.
// ==========================================================================

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockEventQuery = { data: null };
const mockConvocationQuery = { data: null };

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
  useGetEventAttendance: () => emptyQuery(),
  useGetEventConvocation: () => ({ ...emptyQuery(), data: mockConvocationQuery.data }),
  useGetEventTeamComposition: () => emptyQuery(),
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

// Le premier montage transpile tout le graphe d'imports de l'ecran.
jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const JOUEUR = 'joueur-1';
const REMPLACANT = 'joueur-2';
const SPECTATEUR = 'joueur-9';

// Le pack publie par le coach : un titulaire sur le terrain, un sur le banc.
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

// 🧨 La charge telle que `GET /events/:id/convocation` l'envoie VRAIMENT
// (`getPlayerConvocationView`, forme `branches`) — aucun `published` a la racine.
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

const buildMatch = (/** @type {any} */ overrides = {}) => ({
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
    // 🔑 C'est cette liste qui ouvre `canViewPublishedComposition` a un joueur
    // (`isTeamMember`) : sans elle, la page ne demande meme pas la convocation.
    players: [{ documentId: JOUEUR }, { documentId: REMPLACANT }],
    trainers: [{ documentId: 'coach-1' }],
  },
  type: { name: 'Match' },
  ...overrides,
});

const authPour = (/** @type {string} */ documentId, /** @type {boolean} */ peutGerer = false) => ({
  canEditClub: () => peutGerer,
  canEditEvent: () => peutGerer,
  canManageEvent: () => peutGerer,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { documentId, role: { name: peutGerer ? 'Dirigeant' : 'Joueur' } },
});

/** @type {any} */
let mounted = null;

const monter = (/** @type {any} */ { auth, convocation = CONVOCATION, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildMatch() : event;
  mockConvocationQuery.data = convocation;
  mockUseAuth.mockReturnValue(auth || authPour(JOUEUR));

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

const textesVisibles = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node))
  .filter(Boolean);

const appuyer = (/** @type {any} */ root, /** @type {string} */ libelle) => {
  const bouton = root
    .findAllByProps({ accessibilityRole: 'button' })
    .find((/** @type {any} */ node) => textOf(node).includes(libelle));
  if (!bouton) {
    const vu = textesVisibles(root).join(' | ');
    throw new Error(`Aucun bouton ne porte le libelle « ${libelle} ». Vu : ${vu}`);
  }
  act(() => {
    bouton.props.onPress();
  });
};

const derniereRoute = () => {
  const call = [...mockNavigate.mock.calls].pop();
  return call ? call[0] : null;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEventQuery.data = null;
  mockConvocationQuery.data = null;
});

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
    mounted = null;
  }
});

describe('AC08 · TEMOIN 1 — 🥇 le convoque atteint le terrain en UN appui', () => {
  test('un titulaire part sur SON ecran, avec l evenement et l equipe', () => {
    const root = monter();

    appuyer(root, 'Voir ma convocation');

    expect(mockNavigate).toHaveBeenCalledWith(
      'PlayerConvocation',
      { eventId: 'event-1', teamId: TEAM_ID },
    );
  });

  test('un remplacant aussi — le banc est une convocation, pas un lot de consolation', () => {
    const root = monter({ auth: authPour(REMPLACANT) });

    appuyer(root, 'Voir ma convocation');

    expect(derniereRoute()).toBe('PlayerConvocation');
  });
});

describe('AC08 · TEMOIN 2 — 🔒 le non-convoque ne tombe pas dans un cul-de-sac', () => {
  test('il n est PAS envoye sur l ecran du convoque, qui le reposerait aussitot', () => {
    const root = monter({
      auth: authPour(SPECTATEUR),
      event: buildMatch({
        team: {
          club: { documentId: CLUB_ID },
          documentId: TEAM_ID,
          name: 'U15',
          players: [{ documentId: JOUEUR }, { documentId: SPECTATEUR }],
          trainers: [],
        },
      }),
    });

    appuyer(root, "Voir la composition d'équipes");

    expect(derniereRoute()).not.toBe('PlayerConvocation');
  });
});

describe('AC08 · TEMOIN 5 — convoque et non convoque ne lisent PLUS la meme page', () => {
  test('le convoque lit « Tu es convoque · Titulaire »', () => {
    const textes = textesVisibles(monter()).join(' | ');

    expect(textes).toContain('Tu es convoqué · Titulaire');
  });

  test('le remplacant lit « Tu es convoque · Remplacant »', () => {
    const textes = textesVisibles(monter({ auth: authPour(REMPLACANT) })).join(' | ');

    expect(textes).toContain('Tu es convoqué · Remplaçant');
  });

  test('celui qui n y est pas le lit AUSSI, en clair — le silence etait le defaut', () => {
    const textes = textesVisibles(monter({
      auth: authPour(SPECTATEUR),
      event: buildMatch({
        team: {
          club: { documentId: CLUB_ID },
          documentId: TEAM_ID,
          name: 'U15',
          players: [{ documentId: JOUEUR }, { documentId: SPECTATEUR }],
          trainers: [],
        },
      }),
    })).join(' | ');

    expect(textes).toContain('Tu n’es pas dans la composition publiée.');
    expect(textes).not.toContain('Tu es convoqué');
  });
});

describe('AC08 · TEMOIN 6 — 🔒 le tableau du COACH n a pas bouge', () => {
  test('l entraineur part toujours sur « Convocation publiee », jamais ailleurs', () => {
    const root = monter({ auth: authPour('coach-1', true) });

    appuyer(root, 'matchConvocation.published.openCta');

    expect(derniereRoute()).toBe('MatchConvocationPublished');
    expect(mockNavigate).not.toHaveBeenCalledWith('PlayerConvocation', expect.anything());
  });

  test('et il ne lit AUCUNE ligne « Tu es convoque » — ce n est pas son ecran', () => {
    const textes = textesVisibles(monter({ auth: authPour('coach-1', true) })).join(' | ');

    expect(textes).not.toContain('Tu es convoqué');
    expect(textes).not.toContain('Tu n’es pas dans la composition publiée.');
  });
});
