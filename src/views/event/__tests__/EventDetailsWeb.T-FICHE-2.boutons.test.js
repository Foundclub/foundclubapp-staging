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

// T-PAGES-3 (17/11) : la carte « Mon équipe » de la fiche lit l'équipe (une requête de plus).
jest.mock('@/services/tournamentTeam/tournamentTeamQueries', () => ({
  useGetTournamentTeam: () => ({ data: null, isError: false, isLoading: false }),
}));

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

/**
 * Le bloc « Mon statut » (le parent de son titre).
 * @param {any} arbre
 * @returns {any}
 */
const blocMonStatut = (arbre) => arbre.root.findAll((/** @type {any} */ n) => n.type === 'div'
  // Le visiteur lit « Rejoindre cet événement » à la place de « Mon statut » (même bloc).
  && ['Mon statut', 'Rejoindre cet événement'].includes(texte(n)))[0].parent;

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

// T-PAGES-3 (17/11, maquette (a) et (b)) : sur un tournoi, le joueur ne lit plus « Mon statut » ;
// ses gestes sont dans la colonne des cartes (« Ton inscription » ou « Mon équipe »).
const boutonsDeLaCarte = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.['data-testid'] === 'event-tournament-side' && n.type === 'div')[0]
  .findAll((/** @type {any} */ n) => n.type === 'button')
  .map((/** @type {any} */ b) => [texte(b), b.props.style?.background === 'transparent' ? 'contour' : 'plein']);
const cliquerCarte = (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const bouton = arbre.root.findAll((/** @type {any} */ n) => n.props?.['data-testid'] === 'event-tournament-side' && n.type === 'div')[0]
    .findAll((/** @type {any} */ n) => n.type === 'button' && texte(n) === libelle)[0];
  act(() => { bouton.props.onClick(); });
};
const ORGANISATEUR = {
  ...JOUEUR, canEditClub: () => true, canEditEvent: () => true, canManageEvent: () => true,
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

// T-FINITIONS-3 (16/11, règle (a) du chef d'orchestre) remplace « Participer en contour » (14/11) : sur un tournoi,
// plus de demande de participation d'événement (le serveur la refuse). Voir EventDetailsWeb.T-FINITIONS3.tournoi.
test('tournoi à équipes libres : « Créer mon équipe » plein, seul, et plus de « Participer » (T-FINITIONS-3 ; T-PAGES-3 : carte « Ton inscription »)', () => {
  const arbre = monter(tournoiAutonome());
  expect(boutonsDeLaCarte(arbre)).toEqual([
    ['Créer mon équipe', 'plein'],
  ]);
});

test('« Créer mon équipe » lance la même action que « Créer une équipe » (la feuille du nom)', () => {
  const arbre = monter(tournoiAutonome());
  mockFeuilleEquipe.mockClear();
  cliquerCarte(arbre, 'Créer mon équipe');
  expect(mockFeuilleEquipe).toHaveBeenLastCalledWith('name');
  // T-PAGES-3 : les deux boutons du même geste n'en font plus qu'un (un seul bouton principal) ;
  // « Créer une équipe » du bloc « Mode tournoi » reste à l'organisateur.
  const creer = arbre.root.findAll((/** @type {any} */ n) => n.type === 'button' && texte(n) === 'Créer une équipe');
  expect(creer).toHaveLength(0);
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
  const boutons = boutonsDeLaCarte(arbre);
  expect(boutons[0]).toEqual(['Voir mon équipe', 'plein']);
  expect(boutons.map(([libelle]) => libelle)).not.toContain('Créer mon équipe');
  cliquerCarte(arbre, 'Voir mon équipe');
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
  expect(boutonsDeLaCarte(arbre)[0]).toEqual(['Voir mon équipe', 'plein']);
  cliquerCarte(arbre, 'Voir mon équipe');
  expect(mockNavigate).toHaveBeenCalledWith(expect.any(String), { eventId: 'event-1', teamId: 'equipe-amis' });
});

test('tournoi SANS équipes libres : aucun bouton dans « Mon statut » (plus de « Participer », T-FINITIONS-3)', () => {
  const arbre = monter(tournoiAutonome({ tournamentConfig: { allowCustomTeams: false } }));
  expect(boutonsDeLaCarte(arbre)).toEqual([]);
});

test('match d équipe : rien ne change, « Participer » seul et plein', () => {
  expect(boutonsMonStatut(monter(MATCH_EQUIPE))).toEqual([['Participer', 'plein']]);
});

test('« Infos rapides » sans équipe : plus de ligne « Section » ; « Joueurs attendus » reste', () => {
  // T-PAGES-3 point 4 : sur un tournoi, « Infos rapides » reste à l'organisateur.
  expect(lignesInfosRapides(monter(tournoiAutonome(), ORGANISATEUR))).toEqual(['Type', 'Organisateur', 'Capacité', 'Joueurs attendus', 'Prix / personne']);
});

test('« Infos rapides » d un match d équipe : la ligne « Section » reste, avec sa valeur', () => {
  const arbre = monter(MATCH_EQUIPE);
  expect(lignesInfosRapides(arbre)).toEqual(['Type', 'Équipe', 'Section', 'Capacité', 'Joueurs attendus', 'Prix / personne']);
  expect(arbre.root.findAll((/** @type {any} */ n) => n.type === 'span' && texte(n) === 'Foot à 11')).toHaveLength(1);
});

// ==========================================================================
// T-FICHE-2, suite (14/11, chef du tournoi « B » à Q1 et Q2) :
// - le VISITEUR non connecté voit aussi « Inscrire mon équipe » plein en tête ; le bouton ouvre la
//   connexion par le tunnel de « Participer » et demande le retour sur la fiche
//   (`retourApresConnexion`) ; « Se connecter pour participer » reste, en contour ;
// - dans « Mode tournoi », le bouton qui inscrit l'équipe du CLUB dit « Inscrire une équipe du
//   club » (clé existante `registerAClubTeam`, celle du téléphone) ; son action ne change pas.
// ==========================================================================
const VISITEUR_ANONYME = { ...JOUEUR, userData: null };

test('visiteur, tournoi à équipes libres : « Créer mon équipe » plein, seul, « J ai déjà un compte » dessous (T-FINITIONS-3 ; T-PAGES-3, R7)', () => {
  expect(boutonsDeLaCarte(monter(tournoiAutonome(), VISITEUR_ANONYME))).toEqual([
    ['Créer mon équipe', 'plein'],
    ['J’ai déjà un compte', 'contour'],
  ]);
});

// T-PAGES-3b (18/11, point 3, R7) : « Créer mon équipe » ouvre la CRÉATION du compte (avant : la
// connexion) ; le retour sur la fiche reste demandé. « J'ai déjà un compte » garde la connexion.
test('visiteur : « Créer mon équipe » ouvre l inscription (tunnel public) et demande le retour sur la fiche', () => {
  const arbre = monter(tournoiAutonome(), VISITEUR_ANONYME);
  cliquerCarte(arbre, 'Créer mon équipe');
  expect(mockNavigate).toHaveBeenCalledWith('PublicAuthStack', {
    params: expect.objectContaining({ origin: 'EventDetails', retourApresConnexion: true }),
    screen: 'Register',
  });
  // Aucune équipe créée sans compte.
  expect(mockFeuilleEquipe).not.toHaveBeenCalledWith('name');
});

test('visiteur, tournoi SANS équipes libres : aucun bouton (plus de « Se connecter pour participer », T-FINITIONS-3)', () => {
  const arbre = monter(tournoiAutonome({ tournamentConfig: { allowCustomTeams: false } }), VISITEUR_ANONYME);
  // T-PAGES-3 (R7) : la connexion reste offerte ; aucun bouton d'inscription.
  expect(boutonsDeLaCarte(arbre)).toEqual([['J’ai déjà un compte', 'contour']]);
});

test('visiteur, match d équipe : rien ne change', () => {
  expect(boutonsMonStatut(monter(MATCH_EQUIPE, VISITEUR_ANONYME))).toEqual([['Se connecter pour participer', 'plein']]);
});

test('« Mode tournoi » : l équipe du club s inscrit par « Inscrire une équipe du club », même action', () => {
  const entraineur = {
    ...JOUEUR,
    userData: { ...JOUEUR.userData, trainedTeams: [{ documentId: 'team-u13', name: 'U13' }] },
  };
  const arbre = monter(tournoiAutonome(), entraineur);
  // T-PAGES-3 : le bouton est dans la carte « Ton inscription », en contour sous « Créer mon équipe ».
  const blocTournoi = arbre.root.findAll((/** @type {any} */ n) => n.props?.['data-testid'] === 'event-tournament-side' && n.type === 'div')[0];
  const libelles = blocTournoi.findAll((/** @type {any} */ n) => n.type === 'button').map(texte);
  expect(libelles).toContain('Inscrire une équipe du club');
  expect(libelles).not.toContain('Inscrire mon équipe');
  expect(boutonsDeLaCarte(arbre)).toEqual([['Créer mon équipe', 'plein'], ['Inscrire une équipe du club', 'contour']]);
  const bouton = blocTournoi.findAll((/** @type {any} */ n) => n.type === 'button' && texte(n) === 'Inscrire une équipe du club')[0];
  act(() => { bouton.props.onClick(); });
  expect(mockFeuilleEquipe).toHaveBeenLastCalledWith('choose');
});

// T-FICHE-2, suite 2 (chef d'orchestre, Q2 « B », 14/11) : « Se connecter pour participer » demande
// lui aussi le retour sur la fiche ; son texte, sa place et son tunnel ne changent pas.
// T-FINITIONS-3 : le bouton n'existe plus sur un tournoi ; son tunnel se prouve sur un match d'équipe (même action).
test('visiteur : « Se connecter pour participer » ouvre la connexion et demande le retour sur la fiche', () => {
  const arbre = monter(MATCH_EQUIPE, VISITEUR_ANONYME);
  cliquer(arbre, 'Se connecter pour participer');
  expect(mockNavigate).toHaveBeenCalledWith('PublicAuthStack', {
    params: expect.objectContaining({
      origin: 'EventDetails', retourApresConnexion: true, source: 'event-details-login',
    }),
    screen: 'Login',
  });
});

// T-FINITIONS2 (16/11, chef « go b ») — même règle que le serveur (`registerClubTeam`) : l'entraîneur
// d'un autre club ne voit pas « Inscrire une équipe du club » sur un tournoi public.
const entraineurDe = (/** @type {any} */ club) => ({
  ...JOUEUR,
  userData: { ...JOUEUR.userData, role: { name: 'Entraineur' }, trainedTeams: [{ club, documentId: 'equipe-u13', name: 'U13' }] },
});
const inscrireEquipeDuClub = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.type === 'button'
  && texte(n) === 'Inscrire une équipe du club').length;

test('🔴 T-FINITIONS2 — entraîneur d un autre club : pas de « Inscrire une équipe du club »', () => {
  expect(inscrireEquipeDuClub(monter(tournoiAutonome(), entraineurDe({ documentId: 'club-autre' })))).toBe(0);
});

test('T-FINITIONS2 caractérisant — entraîneur du club organisateur : le bouton reste', () => {
  expect(inscrireEquipeDuClub(monter(tournoiAutonome(), entraineurDe(CLUB_TOURNOIS)))).toBe(1);
});

// T-FINITIONS2 (16/11, M1294 / M1295) — fiche du tournoi sur le site.
const textesH1 = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.type === 'h1').map(texte);
const ligneInfo = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAll((/** @type {any} */ n) => n.type === 'div'
  && n.children.length >= 2 && texte(n.children[0]) === libelle).length;

test('🔴 T-FINITIONS2 — le grand titre porte le nom donné (T-NOM)', () => {
  const arbre = monter(tournoiAutonome({ customName: 'TEST — FoundClub x AR Soccer', name: 'Tournoi - 05/12/2026' }));
  expect(textesH1(arbre)).toContain('TEST — FoundClub x AR Soccer');
});

test('🔴 T-FINITIONS2 — « Mix clubs » : « Autorisé », avec son accent', () => {
  // T-PAGES-3 point 4 : « Mix clubs » est un réglage de l'organisateur, retiré de la vue joueur.
  const arbre = monter(tournoiAutonome({ tournamentConfig: { allowCrossClubPlayers: true } }), ORGANISATEUR);
  expect(JSON.stringify(arbre.toJSON())).toContain('Autorisé');
});

test('🔴 T-FINITIONS2 — tournoi sans valeur : ni « Capacité » ni « Joueurs attendus »', () => {
  const arbre = monter(tournoiAutonome({ capacity: 0, totalPlayers: 0 }));
  expect(ligneInfo(arbre, 'Capacité')).toBe(0);
  expect(ligneInfo(arbre, 'Joueurs attendus')).toBe(0);
});

test('T-FINITIONS2 caractérisant — un match garde « Capacité »', () => {
  expect(ligneInfo(monter(MATCH_EQUIPE), 'Capacité')).toBe(1);
});
