import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// CONVOC-HORS-LISTE (demande d'Adel du 07/11) — LE SITE SUIT LE TELEPHONE.
//
// `EventDetails.web.js` remplace son jumeau sur le site : le membre de l'equipe que
// la convocation publiee laisse dehors doit y lire, AU-DESSUS de « Présent / Absent »,
// qu'il n'est pas convoque, pas compte, mais qu'il peut se marquer present.
// Vrais libelles de `fr.js` (react-i18next non double). Harnais repris tel quel de
// `EventDetailsWebFINITIONS4.test.js`.
// ==========================================================================

const mockNavigate = jest.fn();
const mockUseAuth = jest.fn();
const mockEventQuery = { data: null };
const mockConvocationQuery = { data: null };
const mockAttendanceQuery = { data: null };
const mockMatchStatsQuery = { data: null };

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
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    options,
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
  }),
}));

// Le theme est monte avec les VRAIS modules : un mock en Proxy rend les echecs
// Jest illisibles (piege paye au lot paywall).
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

// 🧭 `useGetEventAttendance` REJOINT CETTE FABRIQUE : c est la charge qui porte
// la fenetre d appel, l horloge du serveur et le nombre d attendus. Sans elle,
// la carte n aurait aucune raison de savoir quoi dire.
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
  useGetEventTeamComposition: () => emptyQuery(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

// 🧨 CE MODULE N EST JAMAIS CHARGE POUR DE VRAI, et c est deliberé : il tire
// `matchStatsService`, donc le client HTTP, donc un `.env` que git ignore et
// qu aucune copie de travail ne possede. Un seul import reel de service fait
// tomber la SUITE ENTIERE — zero test execute, et le compteur « Tests: »
// n en dit rien.
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => ({
    data: mockMatchStatsQuery.data,
    isFetching: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  // ST-VUES3-ORDI — « Relancer les N » de la carte « Après le match », sur le site.
  useRemindEventMatchResponses: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

// ST-RETOURS2 · point 1 — la fiche du site lit les avis d entrainement : doublure, comme
// les autres services (le client HTTP refuse de se charger sans `.env`).
jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetMyTrainingReview: () => ({ data: undefined }),
  useGetTrainingReviews: () => ({ data: undefined }),
}));

// FINITIONS11 · point 1 — le drapeau « Signaler » du site tire le service de signalement :
// doublure, comme les autres services (le client HTTP refuse de se charger sans `.env`).
jest.mock('@/services/eventReport/eventReportService', () => ({ createEventReport: jest.fn() }));

jest.mock('@/services/event/eventService', () => ({ updateEvent: jest.fn() }));

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

// Une fabrique jest.mock est remontee en tete de fichier : elle ne peut donc pas
// s'appuyer sur un import ESM, evalue trop tard.
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

// ⛔ NI `EventNextActionCard` NI `react-i18next` NE SONT DOUBLES, et c est le
// coeur du temoin : on veut les VRAIS libelles francais de `fr.js`. L instance
// i18n s initialise toute seule ici, par la chaine d imports de l ecran
// (`@/domains/event/eventUseCases` importe `@/theme/strings`).

// eslint-disable-next-line import/first
import EventDetailsWeb from '../EventDetails.web';

// Le premier montage transpile tout le graphe d'imports de l'ecran : au-dela des
// 5 s par defaut de Jest sur un poste froid, sans que rien ne soit casse.
jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const USER_ID = 'user-1';

/** L entraineur qui organise : il est DANS l equipe, donc le gate le laisse passer. */
const COACH = { documentId: USER_ID, firstname: 'Ada', lastname: 'Coach' };

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T17:00:00.000Z',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Entrainement du mardi',
  participations: [],
  startTime: '18:00',
  team: {
    club: { documentId: CLUB_ID },
    documentId: TEAM_ID,
    name: 'U15',
    players: [],
    trainers: [COACH],
  },
  type: { name: 'Entrainement' },
  ...overrides,
});

/** @type {any} */
let mounted = null;

const mountScreen = (
  /** @type {any} */ {
    attendance = null, auth, convocation = null, event, matchStats = null,
  } = {},
) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockConvocationQuery.data = convocation;
  mockAttendanceQuery.data = attendance;
  mockMatchStatsQuery.data = matchStats;
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

beforeEach(() => {
  jest.clearAllMocks();
  mockEventQuery.data = null;
  mockConvocationQuery.data = null;
  mockAttendanceQuery.data = null;
  mockMatchStatsQuery.data = null;
});

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
    mounted = null;
  }
});

const TITULAIRE = { documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla' };
const HORS_LISTE = { documentId: 'joueur-9', firstname: 'Sami', lastname: 'Benali' };
const AVIS = 'Tu n’es pas convoqué pour ce match et tu n’es pas compté dans la convocation. '
  + 'Tu peux quand même te marquer présent : s’il manque des joueurs, '
  + 'le coach pourra faire appel à toi.';

const PACK = {
  reservePlayerIds: [],
  snapshotPlayers: [TITULAIRE],
  sportContext: 'football',
  teams: [{
    id: 'team_1',
    name: 'U15',
    placements: [{ playerId: TITULAIRE.documentId, slotId: 'team_1:slot_1' }],
  }],
  version: 1,
};
const CONVOCATION = {
  branches: [{
    published: PACK,
    responses: { byPlayerId: {}, counts: { absent: 0, pending: 1, present: 0 } },
    team: { documentId: TEAM_ID, name: 'U15' },
    viewer: { inReserve: false, teamEntryIds: [] },
  }],
  event: { date: '2099-01-01T17:00:00.000Z', documentId: 'event-1', name: 'Match' },
};

const match = () => {
  const base = buildEvent();
  return buildEvent({
    name: 'Match contre Saint-Julien',
    team: { ...base.team, players: [TITULAIRE, HORS_LISTE] },
    type: { name: 'Match' },
  });
};

const joueur = (/** @type {any} */ personne) => ({
  canEditClub: () => false,
  canEditEvent: () => false,
  canManageEvent: () => false,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { ...personne, role: { name: 'Joueur' } },
});

/**
 * Tout le texte rendu de la page, dans l ordre de lecture.
 * @returns {string} - Le texte, espaces resserres.
 */
const texteDeLaPage = () => {
  const parts = /** @type {string[]} */ ([]);
  const walk = (/** @type {any} */ node) => {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      parts.push(node);
      return;
    }
    if (Array.isArray(node)) node.forEach(walk);
    else walk(node.children);
  };
  walk(mounted.toJSON());
  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

describe('CONVOC-HORS-LISTE — site : le message vit au-dessus de « Présent / Absent »', () => {
  test('non convoque, convocation publiee : il lit le message, puis les boutons', () => {
    mountScreen({
      auth: joueur(HORS_LISTE), convocation: CONVOCATION, event: match(),
    });
    const page = texteDeLaPage();

    expect(page).toContain(AVIS);
    // CONVOC-HORS-LISTE-2 : son « Présent » se lit desormais « Présent si besoin ».
    expect(page.indexOf(AVIS)).toBeLessThan(page.indexOf('Présent si besoin Absent'));
  });

  test('🔒 convoque : aucun message', () => {
    mountScreen({
      auth: joueur(TITULAIRE), convocation: CONVOCATION, event: match(),
    });
    const page = texteDeLaPage();

    expect(page).toContain('Présent');
    expect(page).not.toContain('Tu n’es pas convoqué pour ce match');
  });

  test('🔒 convocation non publiee : aucun message', () => {
    mountScreen({
      auth: joueur(HORS_LISTE), convocation: null, event: match(),
    });
    const page = texteDeLaPage();

    expect(page).toContain('Présent');
    expect(page).not.toContain('Tu n’es pas convoqué pour ce match');
  });

  test('🔒 le coach : aucun message', () => {
    mountScreen({ convocation: CONVOCATION, event: match() });
    const page = texteDeLaPage();

    expect(page).not.toContain('Tu n’es pas convoqué pour ce match');
  });
});

// CONVOC-HORS-LISTE-2 (decision d Adel du 07/11, « 158 ») — sur la fiche du site aussi, le
// non-convoque repond « Présent si besoin » ; le convoque garde « Présent ».
describe('CONVOC-HORS-LISTE-2 — site : « Présent si besoin » pour le non-convoque', () => {
  test('non convoque : le bouton dit « Présent si besoin »', () => {
    mountScreen({
      auth: joueur(HORS_LISTE), convocation: CONVOCATION, event: match(),
    });

    expect(texteDeLaPage()).toContain('Présent si besoin Absent');
  });

  test('🔒 convoque : « Présent », jamais « si besoin »', () => {
    mountScreen({
      auth: joueur(TITULAIRE), convocation: CONVOCATION, event: match(),
    });

    expect(texteDeLaPage()).toContain('Présent Absent');
    expect(texteDeLaPage()).not.toContain('si besoin');
  });

  test('🔒 convocation non publiee : « Présent »', () => {
    mountScreen({
      auth: joueur(HORS_LISTE), convocation: null, event: match(),
    });

    expect(texteDeLaPage()).not.toContain('si besoin');
  });
});
