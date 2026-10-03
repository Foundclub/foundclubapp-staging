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

const buildMatch = (/** @type {any} */ overrides = {}) => buildEvent({
  name: 'Match vs Test-COMPO',
  opponentName: 'Test-COMPO',
  type: { name: 'Match' },
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

const titre = (/** @type {any} */ root) => textOf(root.findAllByType('h1')[0]);
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

describe('FINITIONS11 · point 1 — l en-tête des pages d événement du site', () => {
  test('1 · un match : le titre nomme les deux camps, « AS Montrivage — Test-COMPO »', () => {
    const root = mountScreen({ event: buildMatch() });
    expect(titre(root)).toBe('AS Montrivage — Test-COMPO');
  });

  test('2 · un match sans adversaire connu garde son nom (aucun « — » orphelin)', () => {
    const root = mountScreen({ event: buildMatch({ name: 'Match U15', opponentName: '' }) });
    expect(titre(root)).toBe('Match U15');
  });

  test('3 · le fil d Ariane « Planning › Match » ; « Planning » mène au planning', () => {
    const root = mountScreen({ event: buildMatch() });
    const fils = fil(root);
    expect(fils).toHaveLength(1);
    expect(textOf(fils[0])).toBe('Planning › Match');
    const lien = fils[0].findAll((/** @type {any} */ node) => node.type === 'button')[0];
    act(() => {
      lien.props.onClick();
    });
    expect(mockNavigate).toHaveBeenCalledWith('MyEventList');
  });

  test.each([
    ['Entrainement', 'Entrainement du mardi'],
    ['Tournoi', 'Tournoi de printemps'],
    ['Stage', 'Stage de Pâques'],
  ])('4 · %s : le même fil, le nom en titre, le drapeau « Signaler »', (typeName, nom) => {
    const root = mountScreen({ event: buildEvent({ name: nom, type: { name: typeName } }) });
    expect(textOf(fil(root)[0])).toBe(`Planning › ${typeName}`);
    expect(titre(root)).toBe(nom);
    expect(drapeau(root)).toHaveLength(1);
  });

  test('5 · la ligne d infos de la planche vaut pour tous les types : « U15 · sam. 5 sept. · 19:00 – 20:00 · Lyon (69001) »', () => {
    const root = mountScreen({ event: buildEvent() });
    const ligne = root.findAllByProps({ 'data-testid': 'event-info-line' });
    expect(ligne).toHaveLength(1);
    expect(textOf(ligne[0])).toBe('U15 · sam. 5 sept. · 19:00 – 20:00 · Lyon (69001)');
  });

  test('6 · « Signaler » demande la raison, puis l envoie par le service du téléphone', async () => {
    const prompt = jest.fn(() => 'Match fictif');
    const alerte = jest.fn();
    window.prompt = prompt;
    window.alert = alerte;
    const root = mountScreen({ event: buildMatch() });
    const boutons = drapeau(root);
    expect(boutons).toHaveLength(1);
    await act(async () => {
      boutons[0].props.onClick();
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(mockCreateEventReport).toHaveBeenCalledWith({ event: 'event-1', reason: 'Match fictif' });
    expect(alerte).toHaveBeenCalledWith('Merci de ton retour, nous allons traiter ta demande dans les plus brefs délais.');
  });

  test('7 · une raison vide ou annulée n envoie rien', async () => {
    window.prompt = jest.fn().mockReturnValueOnce('   ').mockReturnValueOnce(null);
    const root = mountScreen({ event: buildMatch() });
    await act(async () => {
      drapeau(root)[0].props.onClick();
    });
    await act(async () => {
      drapeau(root)[0].props.onClick();
    });
    expect(mockCreateEventReport).not.toHaveBeenCalled();
  });

  test('8 · un visiteur sans compte : ni fil, ni drapeau ; il garde « Retour »', () => {
    const root = mountScreen({
      auth: { canManageEvent: () => false, userData: null },
      event: buildMatch(),
    });
    expect(fil(root)).toHaveLength(0);
    expect(drapeau(root)).toHaveLength(0);
    const retour = root.findAll(
      (/** @type {any} */ node) => node.type === 'button' && textOf(node) === 'Retour',
    );
    expect(retour).toHaveLength(1);
  });
});
