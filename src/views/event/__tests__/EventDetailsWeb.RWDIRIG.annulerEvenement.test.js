/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// RECETTE-WEB-DIRIGEANT (29/10, décision d'Adel « 4- A ») — SUR LE SITE, L'ORGANISATEUR ANNULE
// SON ÉVÉNEMENT, COMME AU TÉLÉPHONE.
//
// Constaté sur la recette (Karim, AS Montrivage) : le téléphone a « Annuler » dans « Gérer
// l'événement » ; le site n'avait ce menu que pour un match, et sans « Annuler ». Un dirigeant
// ne pouvait donc pas annuler un entraînement depuis l'ordinateur.
// Harnais repris du témoin de l'en-tête (EventDetailsWebEnTete.FINITIONS11.test.js).
// ==========================================================================

const mockNavigate = jest.fn();
const mockUseAuth = jest.fn();
const mockEventQuery = { data: null };
const mockCreateEventReport = jest.fn(() => Promise.resolve({ data: { id: 1 } }));

// La mutation APPELLE sa fonction : c'est l'envoi du signalement qu'on veut voir partir.
// 👪 PAR-L11b (13/10) — le bloc « Inscrire mes enfants » charge ses propres services : double ici,
// comme chaque service de l ecran (EventDetails.js:123-128).
// Le consentement de detection est couvert par EventDetailsWebVisiteurAD02.
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => () => null);
jest.mock('@/views/event/components/VillePrevenueDialog', () => () => null);

jest.mock('@/views/event/components/EventChildRegistration', () => ({
  __esModule: true,
  default: () => null,
  EventChildRegistrationsForOrganizer: () => null,
}));
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => {
      Promise.resolve(options?.mutationFn?.(variables)).then(
        (result) => options?.onSuccess?.(result, variables),
        (error) => options?.onError?.(error, variables),
      );
    },
    mutateAsync: jest.fn(),
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
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
  useGetEventTeamComposition: () => emptyQuery(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => emptyQuery(),
  useRemindEventMatchResponses: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetMyTrainingReview: () => ({ data: undefined }),
  useGetTrainingReviews: () => ({ data: undefined }),
}));

const mockCancelEvent = jest.fn(() => Promise.resolve({ data: {} }));
const mockGoBack = jest.fn();
jest.mock('@/services/event/eventService', () => ({
  cancelEvent: (/** @type {any} */ data) => mockCancelEvent(data),
  updateEvent: jest.fn(),
}));

// 🚩 Le signalement part par le MÊME service que le téléphone (`useEventMutations`).
jest.mock('@/services/eventReport/eventReportService', () => ({
  createEventReport: (/** @type {any} */ data) => mockCreateEventReport(data),
}));

jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: jest.fn(),
  deleteEventParticipation: jest.fn(),
}));

jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  createCustomTournamentTeam: jest.fn(),
  registerClubTeamToTournament: jest.fn(),
  reviewTournamentTeamRegistration: jest.fn(),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

jest.mock('@/platform/share', () => ({ share: jest.fn() }));

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

/* eslint-disable global-require */
jest.mock(
  '../components/EventTasksSection',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTasksSection'),
);
jest.mock(
  '../components/EventTeamAudiencesSection',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTeamAudiencesSection'),
);
/* eslint-enable global-require */

// eslint-disable-next-line import/first
import EventDetailsWeb from '../EventDetails.web';

jest.setTimeout(30000);

const CLUB = { documentId: 'club-1', name: 'AS Montrivage' };
const COACH = { documentId: 'user-1', firstname: 'Karim', lastname: 'Benali' };

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: CLUB,
  date: '2099-09-05T17:00:00.000Z',
  documentId: 'event-1',
  endTime: '20:00',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  location: '12 rue de la Paix, 69001 Lyon',
  name: 'Entrainement du mardi',
  participations: [],
  startTime: '19:00',
  team: {
    club: CLUB,
    documentId: 'team-1',
    name: 'U15',
    players: [],
    trainers: [COACH],
  },
  type: { name: 'Entrainement' },
  ...overrides,
});

/** @type {any} */
let mounted = null;

const mountScreen = (/** @type {any} */ { auth = null, event } = {}) => {
  mockEventQuery.data = event;
  mockUseAuth.mockReturnValue(auth || {
    canEditClub: () => true,
    canEditEvent: () => true,
    canManageEvent: () => true,
    freeUsageSummary: null,
    subscriptionAccessLevel: 'FREE',
    userData: { ...COACH, role: { name: 'Dirigeant' } },
  });
  act(() => {
    mounted = renderer.create(
      <EventDetailsWeb
        navigation={{
          addListener: () => () => {},
          goBack: mockGoBack,
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

const ouvrirMenu = (/** @type {any} */ root) => {
  const [gerer] = root.findAll(
    (/** @type {any} */ n) => n.type === 'button' && n.props['aria-haspopup'] === 'menu',
  );
  expect(gerer).toBeDefined();
  act(() => gerer.props.onClick());
  return root.findAll((/** @type {any} */ n) => n.props?.role === 'menuitem');
};
const annuler = (/** @type {any} */ items) => items
  .find((/** @type {any} */ item) => textOf(item) === 'Annuler');

beforeEach(() => {
  jest.clearAllMocks();
  mockEventQuery.data = null;
});

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
    mounted = null;
  }
});

describe('RWDIRIG · annuler un événement depuis le site', () => {
  test.each([['Entrainement'], ['Match']])('🔴 %s : « Gérer l événement » propose « Annuler »', (typeName) => {
    const root = mountScreen({ event: buildEvent({ type: { name: typeName } }) });
    expect(annuler(ouvrirMenu(root))).toBeDefined();
  });

  test('🔴 « Annuler » demande confirmation, annule CETTE séance puis revient en arrière', async () => {
    window.confirm = jest.fn(() => true);
    const root = mountScreen({ event: buildEvent() });
    const bouton = annuler(ouvrirMenu(root));
    await act(async () => {
      bouton.props.onClick();
    });
    expect(window.confirm).toHaveBeenCalledWith(
      'Es-tu sûr·e de vouloir annuler cet événement ?\n\nUne fois annulé, l\'événement ne sera plus visible par les participant·e·s.',
    );
    expect(mockCancelEvent).toHaveBeenCalledWith({ documentId: 'event-1' });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('🔴 refuser la confirmation n annule rien', async () => {
    window.confirm = jest.fn(() => false);
    const root = mountScreen({ event: buildEvent() });
    const bouton = annuler(ouvrirMenu(root));
    await act(async () => {
      bouton.props.onClick();
    });
    expect(mockCancelEvent).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  test('protégé — sans droit de modifier : ni menu, ni « Annuler »', () => {
    const root = mountScreen({
      auth: {
        canEditClub: () => false,
        canEditEvent: () => false,
        canManageEvent: () => false,
        userData: { documentId: 'autre', role: { name: 'Joueur' } },
      },
      event: buildEvent(),
    });
    expect(root.findAll(
      (/** @type {any} */ n) => n.type === 'button' && n.props['aria-haspopup'] === 'menu',
    )).toHaveLength(0);
  });
});
