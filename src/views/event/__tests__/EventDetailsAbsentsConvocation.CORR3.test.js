import renderer, { act } from 'react-test-renderer';

// CORR-EVENEMENTS-3 (point 121, fiche du TÉLÉPHONE) — le fil de l'équipe disait
// « Absents · 1 Lina » (réponse donnée par son parent dans la convocation) et la fiche
// « Absent·e·s · 0 » : la fiche ne lisait que les participations de l'événement.
// La couture vérifiée : les sections remises à `EventParticipants`, captées telles quelles.
// Doublures reprises d'EventDetailsComptesSupprimes.test.js ; seule la convocation change.

const mockUseAuth = jest.fn();
// Le nom commence par `mock` : c'est la SEULE forme qu'une fabrique `jest.mock`
// (remontee en tete de fichier) a le droit de refermer sur une variable exterieure.
const mockParticipantsProps = { value: null };
const mockNavigate = jest.fn();
const mockEventQuery = { data: null };
const mockCampaignsQuery = { data: { data: [] }, isLoading: false };
const mockConvocationQuery = { data: /** @type {any} */ (null) };
const mockMatchStatsQuery = { data: null, isFetching: false };
const mockRouteParams = { params: { eventId: 'event-1' } };

// 🧨 R9 — CE MOCK N EST PAS DECORATIF. `teamMembershipRequestService`
// importe `@/services/client`, qui JETTE AU CHARGEMENT quand `.env` est absent
// — et `.env` est gitignore, donc absent de toute copie de travail. Sans cette
// doublure, la SUITE ENTIERE tombe a 0 test execute des que l ecran importe le
// service (piege documente, deja paye plusieurs fois).
// 👪 PAR-L11b (13/10) — le bloc « Inscrire mes enfants » charge ses propres services : double ici,
// comme chaque service de l ecran (EventDetails.js:123-128).
jest.mock('@/views/event/components/EventChildRegistration', () => ({
  __esModule: true,
  default: () => null,
  EventChildRegistrationsForOrganizer: () => null,
}));
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
  useGetEventConvocation: () => ({ ...emptyQuery(), data: mockConvocationQuery.data }),
  useGetEventTeamComposition: () => emptyQuery(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseCampaigns: () => ({
    ...emptyQuery(),
    data: mockCampaignsQuery.data,
    isLoading: mockCampaignsQuery.isLoading,
  }),
}));

// D71 : pilotable, sur le MEME motif que les campagnes ci-dessus. Sans lui, un
// match n'a jamais de score ni de droit de saisie, et la chip « stats du match »
// ne se verifierait que dans son etat grise.
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
    isFetching: mockMatchStatsQuery.isFetching,
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

// La liste est ecrite EN ENTIER, jamais derriere un Proxy : une doublure de
// contexte non figee rend l'identite des mutations differente a chaque rendu et
// fait boucler Jest sans aucun message (piege paye au lot paywall).
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

// La doublure de Button rend un VRAI pressable portant son titre : sans ca, un
// bouton de page et une chip du menu ne se pilotent pas de la meme facon, et la
// couture mourrait pile au moment du deplacement.
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
jest.mock('../components/EventParticipants', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function EventParticipantsCapture(/** @type {any} */ props) {
    mockParticipantsProps.value = props;
    return react.createElement(rn.Text, null, 'DOUBLURE_EventParticipants');
  };
});
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

jest.setTimeout(30000);

jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetTrainingReviews: () => ({ data: null }),
}));

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const COACH = {
  documentId: 'user-11', firstname: 'Coach', id: 11, lastname: 'Recette',
};
const LINA = {
  documentId: 'lina', firstname: 'Lina', id: 31, lastname: 'Recette',
};

const CONVOCATION_DE_LINA = {
  branches: [{
    published: {
      reservePlayerIds: ['lina'],
      schemaVersion: 3,
      snapshotPlayers: [LINA],
      teams: [{ placements: [] }],
    },
    responses: { byPlayerId: { lina: 'absent' } },
    team: { documentId: TEAM_ID, name: 'U15' },
  }],
  schemaVersion: 3,
};

const matchDeLina = (/** @type {any[]} */ players) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  missings: [],
  name: 'Match du samedi',
  participationRequests: [],
  participations: [],
  startTime: '10:00',
  team: {
    club: { documentId: CLUB_ID },
    documentId: TEAM_ID,
    name: 'U15',
    players,
    trainers: [COACH],
  },
  type: { name: 'Match' },
});

const buildNavigation = () => ({
  addListener: () => () => {},
  getParent: () => undefined,
  getState: () => ({ routeNames: ['EventDetails', 'EventEdit'] }),
  goBack: jest.fn(),
  navigate: mockNavigate,
  setOptions: jest.fn(),
});

/** @type {any} */
let mounted = null;

// Un seul arbre vivant : l'écran arme une tâche qu'il n'annule qu'en se démontant.
const unmountScreen = () => {
  if (!mounted) return;
  act(() => {
    mounted.unmount();
  });
  mounted = null;
};

const mountScreen = (/** @type {any} */ { convocation, event }) => {
  mockEventQuery.data = event;
  mockConvocationQuery.data = convocation;
  mockCampaignsQuery.data = { data: [] };
  mockRouteParams.params = { eventId: 'event-1' };
  mockUseAuth.mockReturnValue({
    canEditClub: () => false,
    canEditEvent: () => true,
    canManageEvent: () => true,
    freeUsageSummary: null,
    subscriptionAccessLevel: 'FREE',
    userData: { documentId: COACH.documentId, id: COACH.id, role: { name: 'Entraineur' } },
  });
  unmountScreen();
  mockParticipantsProps.value = null;
  act(() => {
    mounted = renderer.create(
      <EventDetails navigation={buildNavigation()} route={mockRouteParams} />,
    );
  });
  // Un match ouvre sur l'aperçu : la liste des participants est dans son onglet.
  const onglet = mounted.root.findAll((n) => n.props?.testID === 'onglet-participants')[0];
  if (onglet) act(() => onglet.props.onPress());
  return /** @type {any} */ (mockParticipantsProps.value);
};

const nomsDe = (/** @type {any[]} */ liste = []) => liste.map((p) => p?.documentId);
const sectionDeLEquipe = (/** @type {any} */ props) => (props?.teamParticipationSections || [])
  .find((/** @type {any} */ section) => section.key === TEAM_ID);

afterEach(() => {
  unmountScreen();
});

describe('CORR-EVENEMENTS-3 121 — la fiche du téléphone compte les absents comme le fil', () => {
  test('🐞 membre de l équipe, absente à la convocation : elle est dans les absents', () => {
    const section = sectionDeLEquipe(mountScreen({
      convocation: CONVOCATION_DE_LINA,
      event: matchDeLina([LINA]),
    }));

    expect(nomsDe(section?.missing)).toEqual(['lina']);
    expect(nomsDe(section?.notAnswered)).not.toContain('lina');
  });

  test('🐞 hors des membres (enfant déclaré) : elle compte quand même dans les absents', () => {
    const section = sectionDeLEquipe(mountScreen({
      convocation: CONVOCATION_DE_LINA,
      event: matchDeLina([]),
    }));

    expect(nomsDe(section?.missing)).toEqual(['lina']);
  });

  test('sans convocation publiée, rien ne change : Lina reste sans réponse', () => {
    const section = sectionDeLEquipe(mountScreen({
      convocation: null,
      event: matchDeLina([LINA]),
    }));

    expect(nomsDe(section?.missing)).toEqual([]);
    expect(nomsDe(section?.notAnswered)).toEqual(['lina']);
  });
});
