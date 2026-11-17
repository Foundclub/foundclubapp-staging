/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

// T-FINITIONS (16/11, « 3- A ») — la fiche d'un tournoi PAYANT montre « Conditions d'inscription »,
// qui ouvre la même page publique que la page de paiement (/conditions-tournoi). Un tournoi gratuit
// et un match n'ont pas le lien.

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
jest.mock('@/views/event/components/TournamentTeamSheet', () => (/** @type {any} */ props) => {
  mockFeuilleEquipe(props.mode);
  return null;
});
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
const mockOpenUrl = jest.fn();
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: (/** @type {any} */ u) => mockOpenUrl(u) } }));

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
const CLUB_TOURNOIS = { documentId: 'club-tournois', name: 'FoundClub Tournois' };
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
  type: { name: 'Tournoi' },
  ...sur,
});
const tournoiAutonome = (/** @type {Record<string, any>} */ sur = {}) => evenement({
  club: CLUB_TOURNOIS, team: null, tournamentScopeMode: 'autonomous', tournamentTeams: [], ...sur,
});
const MATCH_EQUIPE = evenement({
  club: null,
  name: 'U13 contre Rivaux',
  team: {
    club: CLUB_TOURNOIS, documentId: 'team-1', name: 'U13', players: [], section: { name: 'Foot à 11' }, trainers: [],
  },
  type: { name: 'Match' },
});

/** @type {any} */
let mounted = null;

const monter = (/** @type {any} */ event, /** @type {any} */ compte = JOUEUR) => {
  mockEventQuery.data = event;
  mockAttendanceQuery.data = { data: { items: [], serverNow: '2099-12-01T10:00:00.000Z', timezone: 'Europe/Paris' } };
  mockUseAuth.mockReturnValue(compte);
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
  return mounted;
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockFeuilleEquipe.mockClear();
});

afterEach(() => {
  if (mounted) act(() => mounted.unmount());
  mounted = null;
});

/**
 * Le texte d'un nœud et de ses enfants, mis bout à bout.
 * @param {any} noeud
 * @returns {string}
 */
const texte = (noeud) => (typeof noeud === 'string'
  ? noeud
  : (noeud.children || []).map(texte).join(''));

// T-PAGES-3 (17/11) : le joueur lit le lien dans « Avant de t'inscrire » (« Lire les conditions
// d'inscription », maquette (a)) ; l'organisateur garde « Conditions d'inscription ».
const lien = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.type === 'button'
  && ["Conditions d'inscription", 'Lire les conditions d’inscription'].includes(texte(n)));
// T-PAGES-3 point 4 : « Infos rapides » et les réglages « Mode tournoi » restent au seul organisateur.
const ORGANISATEUR = {
  ...JOUEUR, canEditClub: () => true, canEditEvent: () => true, canManageEvent: () => true,
};

test('tournoi payant : le lien est là et ouvre /conditions-tournoi', () => {
  const arbre = monter(tournoiAutonome({ tournamentConfig: { entryFeeCents: 2000 } }));
  expect(lien(arbre)).toHaveLength(1);
  act(() => { lien(arbre)[0].props.onClick(); });
  expect(mockOpenUrl).toHaveBeenCalledTimes(1);
  expect(mockOpenUrl.mock.calls[0][0]).toMatch(/\/conditions-tournoi$/);
});

test('tournoi gratuit : pas de lien (caractérisant)', () => {
  expect(lien(monter(tournoiAutonome({ tournamentConfig: { entryFeeCents: 0 } })))).toHaveLength(0);
  if (mounted) act(() => mounted.unmount());
  expect(lien(monter(tournoiAutonome()))).toHaveLength(0);
});

test('match : pas de lien (caractérisant)', () => {
  expect(lien(monter({ ...MATCH_EQUIPE, tournamentConfig: { entryFeeCents: 2000 } }))).toHaveLength(0);
});

const contient = (/** @type {any} */ arbre, /** @type {string} */ bout) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.type === 'string' && texte(n).includes(bout)).length > 0;

// Récolte du train 12, « P7 prix C » (chef, 17/11) : mêmes attentes, au format du téléphone
// (getTournamentEntryFeeLabel, « … € par joueur ») ; vues par l'organisateur, seul à lire
// « Infos rapides » depuis T-PAGES-3.
test('5. tournoi payant : « Prix / personne » lit entryFeeCents (20 € par joueur), pas pricePerPerson', () => {
  const arbre = monter(tournoiAutonome({ pricePerPerson: 0, tournamentConfig: { entryFeeCents: 2000 } }), ORGANISATEUR);
  expect(contient(arbre, '20 € par joueur')).toBe(true);
  expect(contient(arbre, '0 € par joueur') && !contient(arbre, '20 € par joueur')).toBe(false);
});

test('5. tournoi gratuit : pricePerPerson reste affiché (caractérisant)', () => {
  expect(contient(monter(tournoiAutonome({ pricePerPerson: 7 }), ORGANISATEUR), '7 € par joueur')).toBe(true);
});

test('7. tournoi payant en validation manuelle : « Équipe validée au 5ᵉ joueur payé » (seuil lu)', () => {
  const arbre = monter(tournoiAutonome({ tournamentConfig: { entryFeeCents: 2000, registrationMode: 'manual' } }), ORGANISATEUR);
  expect(contient(arbre, 'Équipe validée au 5ᵉ joueur payé')).toBe(true);
  expect(contient(arbre, 'Manuelle')).toBe(false);
  if (mounted) act(() => mounted.unmount());
  const six = monter(tournoiAutonome({ tournamentConfig: { entryFeeCents: 2000, paidMembersToValidate: 6, registrationMode: 'manual' } }), ORGANISATEUR);
  expect(contient(six, 'Équipe validée au 6ᵉ joueur payé')).toBe(true);
});

test('7. tournoi gratuit en validation manuelle : « Manuelle » (caractérisant)', () => {
  expect(contient(monter(tournoiAutonome({ tournamentConfig: { registrationMode: 'manual' } }), ORGANISATEUR), 'Manuelle')).toBe(true);
});
