/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// T-FICHE-2 (14/11, tournoi Montpellier du 19/12) — « Mon statut » et « Infos rapides » de la
// fiche du SITE. Un capitaine arrivait sur la fiche et voyait d'abord « Participer » (plein,
// inscrit le joueur SEUL) ; « Créer une équipe » était 870 à 1 090 px plus bas.
// Décisions du chef du tournoi (14/11) :
// - tournoi à équipes libres (`allowCustomTeams !== false`) : « Inscrire mon équipe » PLEIN dans
//   « Mon statut », même action que « Créer une équipe » ; « Participer » passe en contour ;
// - compte déjà dans une équipe du tournoi : « Voir mon équipe » ouvre son équipe ;
// - sans équipes libres, ou match d'équipe : rien ne change ;
// - « Infos rapides » sans équipe : la ligne « Section » est masquée.
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

const monter = (/** @type {any} */ event) => {
  mockEventQuery.data = event;
  mockAttendanceQuery.data = { data: { items: [], serverNow: '2099-12-01T10:00:00.000Z', timezone: 'Europe/Paris' } };
  mockUseAuth.mockReturnValue(JOUEUR);
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

/**
 * Le bloc « Mon statut » (le parent de son titre).
 * @param {any} arbre
 * @returns {any}
 */
const blocMonStatut = (arbre) => arbre.root.findAll((/** @type {any} */ n) => n.type === 'div'
  && texte(n) === 'Mon statut')[0].parent;

/**
 * Les boutons de « Mon statut », dans l'ordre : [libellé, 'plein' | 'contour'].
 * @param {any} arbre
 * @returns {string[][]}
 */
const boutonsMonStatut = (arbre) => {
  const rangee = blocMonStatut(arbre).children.find((/** @type {any} */ n) => n.type === 'div'
    && n.props.style?.flexWrap === 'wrap');
  return rangee.findAll((/** @type {any} */ n) => n.type === 'button')
    .map((/** @type {any} */ b) => [texte(b), b.props.style?.background === 'transparent' ? 'contour' : 'plein']);
};

const cliquer = (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const bouton = blocMonStatut(arbre).findAll((/** @type {any} */ n) => n.type === 'button' && texte(n) === libelle)[0];
  act(() => { bouton.props.onClick(); });
};

/**
 * Les libellés des lignes d'« Infos rapides », dans l'ordre.
 * @param {any} arbre
 * @returns {string[]}
 */
const lignesInfosRapides = (arbre) => {
  const titre = arbre.root.findAll((/** @type {any} */ n) => n.type === 'h2'
    && String(n.props.children) === 'Infos rapides')[0];
  const grille = titre.parent.children.find((/** @type {any} */ n) => n.type === 'div');
  return grille.children.map((/** @type {any} */ ligne) => texte(ligne.children[0]));
};

test('tournoi à équipes libres : « Inscrire mon équipe » plein en tête, « Participer » en contour', () => {
  const arbre = monter(tournoiAutonome());
  expect(boutonsMonStatut(arbre)).toEqual([
    ['Inscrire mon équipe', 'plein'],
    ['Participer', 'contour'],
  ]);
});

test('« Inscrire mon équipe » lance la même action que « Créer une équipe » (la feuille du nom)', () => {
  const arbre = monter(tournoiAutonome());
  mockFeuilleEquipe.mockClear();
  cliquer(arbre, 'Inscrire mon équipe');
  expect(mockFeuilleEquipe).toHaveBeenLastCalledWith('name');
  // « Créer une équipe » reste à sa place, dans le bloc « Mode tournoi ».
  const creer = arbre.root.findAll((/** @type {any} */ n) => n.type === 'button' && texte(n) === 'Créer une équipe');
  expect(creer).toHaveLength(1);
});

test('compte déjà capitaine : « Voir mon équipe » ouvre son équipe ; plus de « Inscrire mon équipe »', () => {
  const arbre = monter(tournoiAutonome({
    tournamentTeams: [{
      captainUser: { documentId: 'joueur-1' },
      documentId: 'equipe-hugo',
      members: [{ responseStatus: 'present', user: { documentId: 'joueur-1' } }],
      name: 'Les Hugo',
      status: 'pending',
    }],
  }));
  const boutons = boutonsMonStatut(arbre);
  expect(boutons[0]).toEqual(['Voir mon équipe', 'plein']);
  expect(boutons.map(([libelle]) => libelle)).not.toContain('Inscrire mon équipe');
  cliquer(arbre, 'Voir mon équipe');
  expect(mockNavigate).toHaveBeenCalledWith(expect.any(String), { eventId: 'event-1', teamId: 'equipe-hugo' });
});

test('membre actif (pas capitaine) : « Voir mon équipe » ouvre son équipe', () => {
  const arbre = monter(tournoiAutonome({
    tournamentTeams: [{
      captainUser: { documentId: 'autre' },
      documentId: 'equipe-amis',
      members: [{ responseStatus: 'pending', user: { documentId: 'joueur-1' } }],
      name: 'Les amis',
      status: 'accepted',
    }],
  }));
  expect(boutonsMonStatut(arbre)[0]).toEqual(['Voir mon équipe', 'plein']);
  cliquer(arbre, 'Voir mon équipe');
  expect(mockNavigate).toHaveBeenCalledWith(expect.any(String), { eventId: 'event-1', teamId: 'equipe-amis' });
});

test('tournoi SANS équipes libres : rien ne change, « Participer » seul et plein', () => {
  const arbre = monter(tournoiAutonome({ tournamentConfig: { allowCustomTeams: false } }));
  expect(boutonsMonStatut(arbre)).toEqual([['Participer', 'plein']]);
});

test('match d équipe : rien ne change, « Participer » seul et plein', () => {
  expect(boutonsMonStatut(monter(MATCH_EQUIPE))).toEqual([['Participer', 'plein']]);
});

test('« Infos rapides » sans équipe : plus de ligne « Section » ; « Joueurs attendus » reste', () => {
  expect(lignesInfosRapides(monter(tournoiAutonome()))).toEqual(['Type', 'Organisateur', 'Capacité', 'Joueurs attendus', 'Prix / personne']);
});

test('« Infos rapides » d un match d équipe : la ligne « Section » reste, avec sa valeur', () => {
  const arbre = monter(MATCH_EQUIPE);
  expect(lignesInfosRapides(arbre)).toEqual(['Type', 'Équipe', 'Section', 'Capacité', 'Joueurs attendus', 'Prix / personne']);
  expect(arbre.root.findAll((/** @type {any} */ n) => n.type === 'span' && texte(n) === 'Foot à 11')).toHaveLength(1);
});
