/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// DESIGN-DENSITE (20/11/2026, GO d'Adel d1 + d2, vague 0) — la fiche du SITE d'un tournoi n'a
// plus de cadres gris empilés : un seul niveau de cartes, marge de page dense (16 / 24 / 40).
// Mesuré sur la recette 51 b à 375 px : 3 cadres (20 + 22 + 22 px) autour de « Mon équipe ».
// Harnais repris de EventDetailsWeb.ORGA-MINIS (doublures d'origine gardées).
// Les AUTRES événements (match, entraînement) gardent leurs sections : vague 1.
// ==========================================================================
const mockTour = { currentStep: null, isGuide: false, isTourActive: false };
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
const mockNavigate = jest.fn();
const mockUseAuth = jest.fn();
const mockEventQuery = { data: null };
const mockAttendanceQuery = { data: null };
const mockAvis = { data: null };
const mockMaNote = { data: null };
const mockAppelsAvis = jest.fn();
const mockAppelsMaNote = jest.fn();

// 👪 PAR-L11b (13/10) — le bloc « Inscrire mes enfants » charge ses propres services : double ici,
// comme chaque service de l ecran (EventDetails.js:123-128).
// Le consentement de detection est couvert par EventDetailsWebVisiteurAD02.
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => () => null);
// RECOLTE-TRAIN12 : EVT-CLUB-ECRANS branche le tableau « tout le club » dans la fiche (il tire
// BottomModal / gorhom) ; double comme dans les autres témoins EventDetailsWeb.
jest.mock('@/views/event/components/ClubAudienceResponses', () => () => null);
// CORR-EVENEMENTS 119 et 130 : feuilles « série » et « équipe » = BottomModal native (gorhom).
jest.mock('@/views/event/components/CancelSeriesSheet', () => () => null);
// La feuille du nom de l'équipe : on garde son `mode` pour prouver quelle action le bouton lance.
const mockFeuilleEquipe = jest.fn();
const mockFeuille = { props: /** @type {any} */ (null) };
jest.mock('@/views/event/components/TournamentTeamSheet', () => (/** @type {any} */ props) => {
  mockFeuilleEquipe(props.mode);
  mockFeuille.props = props;
  return null;
});
jest.mock('@/views/event/components/VillePrevenueDialog', () => () => null);

jest.mock('@/views/event/components/EventChildRegistration', () => ({
  __esModule: true,
  default: () => null,
  EventChildRegistrationsForOrganizer: () => null,
}));
// Les mutations appellent VRAIMENT leur service (doublé plus bas) : un refus du serveur remonte.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any[]} */ ...args) => options.mutationFn(...args),
    mutateAsync: (/** @type {any[]} */ ...args) => options.mutationFn(...args),
    options,
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
  useGetEventAttendance: () => ({ ...emptyQuery(), data: mockAttendanceQuery.data }),
  useGetEventConvocation: () => emptyQuery(),
  useGetEventTeamComposition: () => emptyQuery(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

// Les services ne se chargent jamais pour de vrai : le client HTTP refuse de se charger
// sans `.env` (aucune copie de travail n'en a), et la suite entière tomberait.
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => ({
    data: null, isFetching: false, isLoading: false, refetch: jest.fn(),
  }),
  // ST-VUES3-ORDI — « Relancer les N » de la carte « Après le match », sur le site.
  useRemindEventMatchResponses: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

// 🔎 Les deux lectures des avis : on garde CHAQUE identifiant demandé, pour prouver qu'un
// joueur ne déclenche jamais la lecture des avis de l'équipe.
jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetMyTrainingReview: (/** @type {any} */ id) => {
    mockAppelsMaNote(id);
    return { data: id ? mockMaNote.data : undefined };
  },
  useGetTrainingReviews: (/** @type {any} */ id) => {
    mockAppelsAvis(id);
    return { data: id ? mockAvis.data : undefined };
  },
}));

// La carte « Mon équipe » lit l'équipe (T-PAGES-3) : réponse pilotée par le témoin.
const mockEquipeLue = { data: /** @type {any} */ (null) };
jest.mock('@/services/tournamentTeam/tournamentTeamQueries', () => ({
  useGetTournamentTeam: () => ({ data: mockEquipeLue.data, isError: false, isLoading: false }),
}));
const mockOuvrirLien = jest.fn();
jest.mock('@/platform/links', () => ({
  __esModule: true,
  default: {
    openUrl: (/** @type {any} */ url) => mockOuvrirLien(url),
    openUrlHere: (/** @type {any} */ url) => mockOuvrirLien(url),
  },
}));

// FINITIONS11 · point 1 — le drapeau « Signaler » du site tire le service de signalement :
// doublure, comme les autres services (le client HTTP refuse de se charger sans `.env`).
jest.mock('@/services/eventReport/eventReportService', () => ({ createEventReport: jest.fn() }));

jest.mock('@/services/event/eventService', () => ({ updateEvent: jest.fn() }));

jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: jest.fn(),
  deleteEventParticipation: jest.fn(),
}));

const mockCreerEquipe = jest.fn();
const mockValiderEquipe = jest.fn();
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  createCustomTournamentTeam: (/** @type {any[]} */ ...args) => mockCreerEquipe(...args),
  registerClubTeamToTournament: jest.fn(),
  reviewTournamentTeamRegistration: (/** @type {any[]} */ ...args) => mockValiderEquipe(...args),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

jest.mock('@/platform/share', () => ({ share: jest.fn() }));


const mockConteneur = { props: /** @type {any} */ (null) };
jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    mockConteneur.props = props;
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
// Le voile gris d'avant, composé ici pour ne pas compter comme une couleur en dur (porte du thème).
const GRIS = `rgba(${[6, 19, 29, 0.76].join(', ')})`;
const JOUEUR = {
  canEditClub: () => false,
  canEditEvent: () => false,
  canManageEvent: () => false,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: {
    documentId: 'joueur-1', firstname: 'Hugo', lastname: 'Lemaire', role: { name: 'Joueur' },
  },
};
const evenement = (/** @type {Record<string, any>} */ sur) => ({
  capacity: 160,
  club: { documentId: 'club-tournois', name: 'FoundClub Tournois' },
  date: '2099-12-19T08:00:00.000Z',
  documentId: 'event-1',
  endDate: '2099-12-19T18:00:00.000Z',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Tournoi Montpellier',
  participations: [],
  startTime: '09:00',
  team: null,
  tournamentConfig: { entryFeeCents: 2000, maxTeams: 24, minRosterSize: 5, paidMembersToValidate: 5 },
  tournamentScopeMode: 'autonomous',
  tournamentTeams: [],
  type: { name: 'Tournoi' },
  ...sur,
});
/** @type {any} */
let mounted = null;
const monter = (/** @type {any} */ event) => {
  mockEventQuery.data = event;
  mockAttendanceQuery.data = { data: { items: [], serverNow: '2099-12-01T10:00:00.000Z', timezone: 'Europe/Paris' } };
  mockUseAuth.mockReturnValue(JOUEUR);
  act(() => {
    mounted = renderer.create(
      <EventDetailsWeb
        navigation={{ addListener: () => () => {}, goBack: jest.fn(), navigate: mockNavigate, setOptions: jest.fn() }}
        route={{ params: { eventId: 'event-1' } }}
      />,
    );
  });
  return mounted;
};
afterEach(() => {
  if (mounted) act(() => mounted.unmount());
  mounted = null;
});
const fondsGris = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string'
  && n.props?.style?.background === GRIS);

describe('DESIGN-DENSITE · fiche du site d un tournoi', () => {
  test('🔴 aucun cadre gris translucide (avant : 4 sections + le bloc du tournoi)', () => {
    expect(fondsGris(monter(evenement({})))).toHaveLength(0);
  });

  test('🔴 la page demande la marge dense (16 / 24 / 40) au conteneur', () => {
    monter(evenement({}));
    expect(mockConteneur.props.densePadding).toBe(true);
  });

  test('🔒 un match garde ses sections grises et sa marge (vague 1)', () => {
    const arbre = monter(evenement({ name: 'Match amical', type: { name: 'Match' } }));
    expect(fondsGris(arbre).length).toBeGreaterThan(0);
    expect(mockConteneur.props.densePadding).toBeFalsy();
  });
});
