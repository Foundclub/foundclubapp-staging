/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// FINITIONS11-STATS · point 1 — L'EN-TÊTE DE TOUTES LES PAGES D'ÉVÉNEMENT DU SITE
// (écran 1 des stats, planche « La page du match, entraîneur — ordinateur »).
//
// La planche dit, en haut de la page : le fil d'Ariane « Planning › Match », le titre
// « AS Montrivage — Test-COMPO », la ligne d'infos, et à droite le drapeau « Signaler »
// à côté de « Gérer l'événement ». Le téléphone a déjà son drapeau ; le site n'en avait
// aucun, ni de fil d'Ariane, et le titre d'un match était son nom en base.
//
// ⛔ Ce qui se mesure ici est le CONTENU RENDU et l'ENVOI du signalement, jamais « ça monte ».
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
// EVT-CLUB-ECRANS (14/11) : le tableau « tout le club » (il tire BottomModal / gorhom), double
// comme ses voisins.
jest.mock('@/views/event/components/ClubAudienceResponses', () => () => null);
// CORR-EVENEMENTS 119 et 130 : feuilles « série » et « équipe » = BottomModal native (gorhom).
jest.mock('@/views/event/components/CancelSeriesSheet', () => () => null);
jest.mock('@/views/event/components/TournamentTeamSheet', () => () => null);
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

jest.mock('@/services/event/eventService', () => ({ updateEvent: jest.fn() }));

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
// ACCUEIL-JOUEUR (09/11) — la ligne « Ouvrir dans le GPS » de la fiche du site.
const mockOpenExternalMap = jest.fn();
jest.mock('@/platform/maps/externalMap', () => ({
  openExternalMap: (/** @type {any} */ cible) => mockOpenExternalMap(cible),
}));

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

const fil = (/** @type {any} */ root) => root.findAllByProps({ 'data-testid': 'event-breadcrumb' });
const drapeau = (/** @type {any} */ root) => root.findAll(
  (/** @type {any} */ node) => node.type === 'button' && node.props['aria-label'] === 'Signaler l’événement',
);

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

// ==========================================================================
// FICHE-TOURNOI (19/11/2026, liste de travail d'Adel, écran 6b, site) — sur un TÉLÉPHONE, la fiche
// d'un tournoi n'a plus le fil « Planning › … » et « Signaler » passe dans un menu (« ⋯ ») ;
// « Partager » reste en haut à droite. Sur un ORDINATEUR (6d : « garder le réel »), rien ne change.
// ==========================================================================
const mockLargeur = { width: 375 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 812, scale: 2, width: mockLargeur.width,
  }),
}));

const JOUEUR = {
  canEditClub: () => false,
  canEditEvent: () => false,
  canManageEvent: () => false,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { birthdate: '1990-01-01', documentId: 'joueur-1', role: { name: 'Joueur' } },
};
const TOURNOI = () => buildEvent({
  name: 'FoundClub x AR Soccer',
  team: null,
  tournamentConfig: { competitionState: 'draft', maxTeams: 24 },
  tournamentTeams: [],
  type: { name: 'Tournoi' },
});
const menu = (/** @type {any} */ root) => root.findAllByProps({ 'data-testid': 'event-more-menu-button' })
  .filter((/** @type {any} */ n) => n.type === 'button');

describe('FICHE-TOURNOI · 6b — l en-tête de la fiche d un tournoi, site', () => {
  afterEach(() => { mockLargeur.width = 375; });

  test('🔴 téléphone : plus de fil « Planning › … », plus de drapeau ; « ⋯ » porte « Signaler l’événement »', () => {
    const root = mountScreen({ auth: JOUEUR, event: TOURNOI() });
    expect(fil(root)).toHaveLength(0);
    expect(drapeau(root)).toHaveLength(0);
    const [bouton] = menu(root);
    expect(bouton).toBeTruthy();
    expect(bouton.props['aria-label']).toBe('Plus d’actions');
    act(() => { bouton.props.onClick(); });
    const signaler = root.findAll((/** @type {any} */ n) => n.type === 'button' && n.props.role === 'menuitem' && textOf(n).includes('Signaler l’événement'));
    expect(signaler).toHaveLength(1);
  });

  test('🔴 téléphone : « Partager » reste en haut', () => {
    const root = mountScreen({ auth: JOUEUR, event: TOURNOI() });
    const partager = root.findAll((/** @type {any} */ n) => n.type === 'button' && textOf(n) === 'Partager');
    expect(partager).toHaveLength(1);
  });

  test('ordinateur (6d) : le fil et le drapeau restent', () => {
    mockLargeur.width = 1280;
    const root = mountScreen({ auth: JOUEUR, event: TOURNOI() });
    expect(fil(root)).toHaveLength(1);
    expect(drapeau(root)).toHaveLength(1);
    expect(menu(root)).toHaveLength(0);
  });

  test('un entraînement au téléphone garde son fil et son drapeau', () => {
    const root = mountScreen({ auth: JOUEUR, event: buildEvent() });
    expect(fil(root)).toHaveLength(1);
    expect(drapeau(root)).toHaveLength(1);
  });
});
