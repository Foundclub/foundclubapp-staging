/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

import {
  resetGuidanceRuntimeForTests,
  subscribeToGuidanceSignals,
} from '@/domains/guidance/guidanceRuntime';

// ==========================================================================
// GUIDES-SITE-CORR-2 S29 (tournée des guides sur le site, 09/11, E 1360 rang 042, E 390 rang 035)
// Bonus 1 du guide Entraîneur, équipe SANS joueur : la bulle disait « Personne n'a encore
// répondu : relance-les en un clic » ; sur le site, la section « Participants » montrait 0 / 0 / 0
// et « Tout le monde a répondu. », AUCUN bouton « Relancer », et la bulle restait figée.
// Au téléphone (EventParticipants), la fiche signale l'équipe vide au guide
// (`event.participants.empty` → b1-vide : trois faux profils répondent) et porte l'ancre
// `event.participants`. La fiche du SITE (`EventDetails.web.js`) n'avait ni l'un ni l'autre.
// ==========================================================================

const mockTour = { currentStep: { id: 'b1-relance' }, isGuide: true, isTourActive: true };
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
const CLUB_ID = 'club-1';
const COACH = { documentId: 'coach-1', firstname: 'Karim', lastname: 'Coach' };
const JOUEUR = { documentId: 'joueur-1', firstname: 'Hugo', lastname: 'Lemaire' };

const seanceAVenir = (/** @type {any[]} */ joueurs) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T17:00:00.000Z',
  documentId: 'event-1',
  endDate: '2099-01-01T18:30:00.000Z',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Entraînement · U13',
  participations: [],
  startTime: '18:00',
  team: {
    club: { documentId: CLUB_ID },
    documentId: 'team-1',
    name: 'U13',
    players: joueurs,
    trainers: [COACH],
  },
  type: { name: 'Entrainement' },
});
/** L'horloge du SERVEUR avant la séance. */
const AVANT = { data: { items: [], serverNow: '2098-12-30T10:00:00.000Z', timezone: 'Europe/Paris' } };
const ENCADRANT = {
  canEditClub: () => true,
  canEditEvent: () => true,
  canManageEvent: () => true,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { ...COACH, role: { name: 'Entraineur' } },
};

/** @type {any} */
let mounted = null;
/** @type {string[]} */
let signaux = [];
/** @type {any} */
let desabonner = null;

const monter = (/** @type {any[]} */ joueurs, /** @type {any[]} */ items = []) => {
  mockEventQuery.data = seanceAVenir(joueurs);
  mockAttendanceQuery.data = { data: { ...AVANT.data, items } };
  mockUseAuth.mockReturnValue(ENCADRANT);
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
  resetGuidanceRuntimeForTests();
  signaux = [];
  desabonner = subscribeToGuidanceSignals(
    (/** @type {any} */ signal) => signaux.push(`${signal.kind}:${signal.key}`),
  );
  mockTour.currentStep = { id: 'b1-relance' };
});
afterEach(() => {
  desabonner?.();
  if (mounted) act(() => mounted.unmount());
  mounted = null;
});

const ancres = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ noeud) => typeof noeud.props?.id === 'string'
    && noeud.props.id.startsWith('event.'))
  .map((/** @type {any} */ noeud) => noeud.props.id);

test('S29 — équipe sans joueur, étape « relance » : la fiche du site le signale au guide', () => {
  monter([]);
  expect(signaux).toContain('action:event.participants.empty');
});

test('S29 — la section « Participants » du site porte l’ancre du guide (b1-vide l’encadre)', () => {
  monter([]);
  expect(ancres(mounted)).toContain('event.participants');
});

test('une équipe AVEC un joueur sans réponse : rien n’est signalé comme vide', () => {
  monter([JOUEUR], [{ player: JOUEUR, status: 'not_answered' }]);
  expect(signaux).not.toContain('action:event.participants.empty');
});
