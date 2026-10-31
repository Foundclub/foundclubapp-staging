import renderer, { act } from 'react-test-renderer';

// 📐 ST-MATCH10-BIS (point 5) — LE HARNAIS, repris tel quel de
// `EventDetailsWebComposition.test.js` ; seuls la route, `replace` et la compo du staff
// changent. Ce fichier ne mesure QUE l'arrivée sur le SITE depuis la feuille de match
// vide, avec `?focusSection=convocation`.

// D48 (E6) : EventDetails.web.js fait 1 754 lignes et n'avait AUCUN test.
//
// Ce que ce fichier verrouille, et pourquoi il existe :
// `web` compile PHYSIQUEMENT les sources de `app` (vite.config.ts pointe
// ../app/src), et un fichier `.web.js` REMPLACE son jumeau sans suffixe.
// Aucune porte de `app` ne compare les deux ⇒ une divergence entre eux vit
// indefiniment, en silence. C'est la 4e fois que ce motif coute un correctif
// (D08, D22, D40, D48).
//
// Le lot D44 a fait lire au board l'etiquette `eventKind` pour qu'un match
// cesse d'afficher les commandes de la detection. Le telephone la transmet
// (EventDetails.js:3197) ; le site ne la calculait meme pas.
//
// La couture choisie est la CHARGE ENVOYEE AU BOARD, pas la forme de l'arbre :
// c'est le seul contrat que le board lit, et il survit a tout redessin du site.
// Les DEUX portes du site sont couvertes — « Gerer la composition d'equipes »
// et « Voir la composition publiee » — parce que ne reparer que celle citee au
// ticket laisserait un appelant frere casse.

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockTeamCompositionQuery = { data: /** @type {any} */ (null) };
/** @type {any} */
let mockRouteParams = { eventId: 'event-1' };
const mockUseAuth = jest.fn();
const mockEventQuery = { data: null };
const mockConvocationQuery = { data: null };

// 👪 PAR-L11b (13/10) — le bloc « Inscrire mes enfants » charge ses propres services : double ici,
// comme chaque service de l ecran (EventDetails.js:123-128).
// Le consentement de detection est couvert par EventDetailsWebVisiteurAD02.
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => () => null);
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

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({
    data: mockEventQuery.data,
    dataUpdatedAt: 1,
    error: null,
    isFetching: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  // 🧭 P9 : la fabrique est FERMEE — ce que l ecran demande et qu elle ne
  // declare pas revient `undefined`, et le montage meurt. `useGetEventAttendance`
  // y entre parce que l Apercu du site porte desormais la carte « Faire l appel ».
  // Ces suites-ci ne s en servent pas : une charge vide suffit, et la carte
  // reste alors dans son etat honnete (`before`).
  useGetEventAttendance: () => emptyQuery(),
  useGetEventConvocation: () => ({ ...emptyQuery(), data: mockConvocationQuery.data }),
  useGetEventTeamComposition: () => ({ ...emptyQuery(), data: mockTeamCompositionQuery.data }),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

// 🧨 P9 : CE MODULE NE DOIT JAMAIS SE CHARGER POUR DE VRAI. L Apercu du site
// porte desormais la carte « APRES LE MATCH », donc il importe
// `matchStatsQueries` — qui tire le service de stats, donc le client HTTP, donc
// un `.env` que git ignore et qu aucune copie de travail ne possede. Sans cette
// doublure la SUITE ENTIERE meurt au chargement : « Tests: 0 total », et le
// compteur de tests ne dit rien de l echec. Ces suites-ci n exercent pas
// l apres-match : une charge vide suffit.
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => emptyQuery(),
  // ST-VUES3-ORDI — « Relancer les N » de la carte « Après le match », sur le site.
  useRemindEventMatchResponses: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

// Récolte du 03/10 : ST-RETOURS2 fait lire les avis d'entraînement par la fiche
// du site. Sans ce double, le vrai client réseau se charge et lit la config locale.
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

// Ici vivait une doublure de `@/utils/imageUrl`, seule facon de monter cet ecran
// tant que le module sans suffixe n'avait pas d'export par defaut. D49 la lui a
// donne (`src/utils/imageUrl.js`), le VRAI module se charge, et la doublure a
// ete retiree : ces 5 tests restent verts sans elle. Si cette suite redevient
// rouge sur « _imageUrl.default is not a function », l'export a ete perdu.

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

// eslint-disable-next-line import/first
import EventDetailsWeb from '../EventDetails.web';

// Le premier montage transpile tout le graphe d'imports de l'ecran : au-dela des
// 5 s par defaut de Jest sur un poste froid, sans que rien ne soit casse.
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

/** @type {any} */
let mounted = null;

const mountScreen = (/** @type {any} */ { auth, convocation = null, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockConvocationQuery.data = convocation;
  mockUseAuth.mockReturnValue(auth || {
    canEditClub: () => true,
    canEditEvent: () => true,
    canManageEvent: () => true,
    freeUsageSummary: null,
    subscriptionAccessLevel: 'FREE',
    userData: { documentId: 'user-1', role: { name: 'Dirigeant' } },
  });

  act(() => {
    mounted = renderer.create(
      <EventDetailsWeb
        navigation={{
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: mockNavigate,
          replace: mockReplace,
          setOptions: jest.fn(),
        }}
        route={{ params: mockRouteParams }}
      />,
    );
  });

  return mounted.root;
};

/**
 * Le nom de la route empruntee au dernier appui.
 * @returns {string | null} - La route, ou null.
 */
const lastRoute = () => {
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

const COMPO_A_FAIRE = {
  bootstrap: { composition: null, source: 'empty' },
  draft: null,
  eligiblePlayers: [{ documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla' }],
  published: null,
  team: { documentId: TEAM_ID, name: 'U15' },
};

describe('ST-MATCH10-BIS · 5 — la feuille de match vide « ouvre la convocation » (site)', () => {
  beforeEach(() => {
    mockRouteParams = { eventId: 'event-1' };
    mockTeamCompositionQuery.data = null;
  });

  test('🥇 par ?focusSection=convocation : adresse nettoyée, puis la convocation s ouvre', () => {
    mockRouteParams = { eventId: 'event-1', focusSection: 'convocation' };
    mockTeamCompositionQuery.data = COMPO_A_FAIRE;
    mountScreen({ event: buildEvent({ type: { name: 'Match' } }) });

    expect(mockReplace).toHaveBeenCalledWith('EventDetails', { eventId: 'event-1' });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(lastRoute()).toBe('MatchCallUpSelection');
    expect(mockReplace.mock.invocationCallOrder[0])
      .toBeLessThan(mockNavigate.mock.invocationCallOrder[0]);
  });

  test('🔒 sans le paramètre, rien ne part', () => {
    mockTeamCompositionQuery.data = COMPO_A_FAIRE;
    mountScreen({ event: buildEvent({ type: { name: 'Match' } }) });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test('🔒 qui ne gère pas l événement reste sur la page', () => {
    mockRouteParams = { eventId: 'event-1', focusSection: 'convocation' };
    mockTeamCompositionQuery.data = COMPO_A_FAIRE;
    mountScreen({
      auth: {
        canEditClub: () => false,
        canEditEvent: () => false,
        canManageEvent: () => false,
        freeUsageSummary: null,
        subscriptionAccessLevel: 'FREE',
        userData: { documentId: 'joueur-1', role: { name: 'Joueur' } },
      },
      event: buildEvent({ type: { name: 'Match' } }),
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
