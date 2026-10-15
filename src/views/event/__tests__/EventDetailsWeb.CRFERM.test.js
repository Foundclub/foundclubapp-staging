/* eslint-disable max-len -- les phrases de l écran se lisent en entier. */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// CRFERM (13/10/2026) — COL-010, décision d'Adel « D8 B », planche P8v4-fermee-ordi (B et C) :
// LA FICHE DU SITE n'avait NI bandeau NI gestes quand la Ville ferme l'installation
// (EventDetails.web.js : aucune mention de fermeture ; écart de parité avec l'app,
// EventDetails.js « COLL-C4B »).
//
// Ce que ce fichier exige (ROUGE avant le lot) :
//   B. qui peut modifier la séance : le bandeau (motif, mot de la Ville) et les deux gestes —
//      « Changer l'heure ou le lieu » ouvre la modification, « Annuler l'entraînement » demande
//      confirmation puis annule CETTE séance (jamais la série) ;
//   C. un joueur : le bandeau seul, sans geste ni mot de la Ville, avec ce qui va se passer ;
//   sans fermeture (ou serveur d'avant) : rien.
// ==========================================================================

const mockNavigate = jest.fn();
const mockUseAuth = jest.fn();
const mockEventQuery = { data: null };
const mockCreateEventReport = jest.fn(() => Promise.resolve({ data: { id: 1 } }));
const mockCancelEvent = jest.fn(() => Promise.resolve({ data: {} }));
const mockDecideRelocation = jest.fn(() => Promise.resolve({ documentId: 'prop-1', status: 'accepted' }));

// La mutation APPELLE sa fonction : c'est l'envoi du signalement qu'on veut voir partir.
// 👪 PAR-L11b (13/10) — le bloc « Inscrire mes enfants » charge ses propres services : double ici,
// comme chaque service de l ecran (EventDetails.js:123-128).
// Le consentement de detection est couvert par EventDetailsWebVisiteurAD02.
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => () => null);

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

jest.mock('@/services/event/eventService', () => ({
  cancelEvent: (/** @type {any} */ variables) => mockCancelEvent(variables),
  // COLL-R-DEPLACER (14/10) : « Accepter » la proposition de la Ville.
  decideRelocation: (/** @type {any[]} */ ...args) => mockDecideRelocation(...args),
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

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ root) => root.findAllByType(Text).map((n) => aplatir(n.props.children));
const bandeaux = (/** @type {any} */ root) => root.findAll((/** @type {any} */ n) => n.props?.testID === 'bandeau-fermeture' && typeof n.type !== 'string');
const geste = (/** @type {any} */ root, /** @type {string} */ titre) => root.findAll(
  (/** @type {any} */ n) => typeof n.props?.onPress === 'function' && n.props?.title === titre,
)[0];

const FERMETURE = {
  collectivite: { documentId: 'ville-1', name: 'Ville de Montrivage' },
  documentId: 'f1',
  endDate: '2099-09-05',
  endTime: null,
  facility: { documentId: 'gym-1', name: 'Gymnase des Tilleuls' },
  kind: 'closure',
  label: null,
  message: 'Réfection du sol',
  reason: 'travaux',
  startDate: '2099-09-05',
  startTime: null,
  status: 'active',
};
const touchee = () => buildEvent({
  facility: { documentId: 'gym-1', name: 'Gymnase des Tilleuls', type: 'Gymnase' },
  facilityClosure: FERMETURE,
});
const JOUEUR = {
  canEditClub: () => false,
  canEditEvent: () => false,
  canManageEvent: () => false,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { documentId: 'user-9', firstname: 'Nina', role: { name: 'Joueur' } },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEventQuery.data = null;
  window.confirm = jest.fn(() => true);
});

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
    mounted = null;
  }
});

describe('CRFERM · la fiche du site dit la fermeture', () => {
  test('CRFERM-5/7 B — qui peut modifier : le bandeau, le mot de la Ville et les deux gestes', async () => {
    const root = mountScreen({ event: touchee() });
    expect(bandeaux(root)).toHaveLength(1);
    expect(textes(root)).toContain('Le gymnase est fermé ce jour-là');
    expect(textes(root)).toContain('Travaux. Mot de la Ville : « Réfection du sol ».');
    act(() => { geste(root, 'Changer l’heure ou le lieu').props.onPress(); });
    // COLL-R-DEPLACER (14/10, COL-013) : « Déplacer la séance » (EventEdit en mode « deplacer »).
    expect(mockNavigate).toHaveBeenCalledWith('EventEdit', { eventId: 'event-1', mode: 'deplacer' });
    await act(async () => { geste(root, 'Annuler l’entraînement').props.onPress(); });
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(mockCancelEvent).toHaveBeenCalledWith({ documentId: 'event-1' });
  });

  test('CRFERM-5/8 B — une confirmation refusée n annule rien', async () => {
    window.confirm = jest.fn(() => false);
    const root = mountScreen({ event: touchee() });
    await act(async () => { geste(root, 'Annuler l’entraînement').props.onPress(); });
    expect(mockCancelEvent).not.toHaveBeenCalled();
  });

  test('CRFERM-5/9 C — un joueur : le bandeau seul, sans geste ni mot de la Ville', () => {
    const root = mountScreen({ auth: JOUEUR, event: touchee() });
    expect(bandeaux(root)).toHaveLength(1);
    expect(textes(root)).toContain('Travaux. Ton club peut déplacer ou annuler la séance : tu seras prévenu·e.');
    expect(textes(root).join('|')).not.toContain('Réfection du sol');
    expect(geste(root, 'Changer l’heure ou le lieu')).toBeUndefined();
    expect(geste(root, 'Annuler l’entraînement')).toBeUndefined();
  });

  // COLL-R-DEPLACER (14/10, « D9 = b », planche P5v4-deplacer-ordi état D) : la proposition de la Ville
  // dans la fiche du site, au-dessus du bandeau, avec ses deux gestes.
  test('CRDEP — la proposition de la Ville : « Accepter » répond, « Choisir une autre place » ouvre le tunnel', async () => {
    const proposition = {
      collectivite: { name: 'Ville de Montrivage' },
      date: '2099-09-05',
      documentId: 'prop-1',
      endTime: '19:30',
      facility: { documentId: 'stade-1', name: 'Stade municipal' },
      fromFacility: { documentId: 'gym-1', name: 'Gymnase des Tilleuls' },
      startTime: '18:00',
      status: 'pending',
    };
    const root = mountScreen({ event: { ...touchee(), relocationProposal: proposition } });
    const ordre = root.findAll((/** @type {any} */ n) => (
      ['bandeau-fermeture', 'proposition-de-la-ville'].includes(n.props?.testID)
    )).map((/** @type {any} */ n) => n.props.testID);
    expect(ordre[0]).toBe('proposition-de-la-ville');
    expect(ordre).toContain('bandeau-fermeture');
    expect(textes(root)).toContain('Proposition de la Ville de Montrivage');
    act(() => { geste(root, 'Choisir une autre place').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('EventEdit', { eventId: 'event-1', mode: 'deplacer', proposalId: 'prop-1' });
    await act(async () => { geste(root, 'Accepter').props.onPress(); });
    expect(mockDecideRelocation).toHaveBeenCalledWith('prop-1', 'accept');
  });

  test('CRDEP — un joueur ne voit pas la proposition', () => {
    const root = mountScreen({ auth: JOUEUR, event: { ...touchee(), relocationProposal: { documentId: 'prop-1', status: 'pending' } } });
    expect(root.findAll((/** @type {any} */ n) => n.props?.testID === 'proposition-de-la-ville')).toHaveLength(0);
  });

  test('CRFERM-5/10 sans fermeture (ou serveur d avant) : aucun bandeau', () => {
    const root = mountScreen({ event: buildEvent() });
    expect(bandeaux(root)).toHaveLength(0);
  });
});
