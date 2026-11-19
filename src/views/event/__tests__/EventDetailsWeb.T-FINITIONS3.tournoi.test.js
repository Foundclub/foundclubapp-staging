/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// T-FINITIONS-3 (16/11, tournoi Montpellier du 19/12) — la fiche du tournoi sur le SITE.
// Règles du chef d'orchestre (16/11) :
// (a) sur un tournoi, ni « Participer » (demande d'événement ordinaire), ni le bloc « Participants »
//     (Présent / Absent / Sans réponse) ; on entre par une équipe ;
// (b) compte plus jeune que `tournamentConfig.minAge` : « Ce tournoi est ouvert à partir de {minAge} ans. »,
//     aucun bouton d'inscription ; âge inconnu : rien ne change (le serveur tranche) ;
// (c) toute erreur du serveur à l'inscription d'une équipe s'affiche, aussi dans le bloc « Mode tournoi ».
// Ajout 1 du chef du tournoi : le joueur seul voit les équipes ouvertes aux demandes et ouvre l'équipe
// (« Demander à rejoindre » est sur la fiche de l'équipe, TournamentTeamDetails, inchangée).
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

// FINITIONS11 · point 1 — le drapeau « Signaler » du site tire le service de signalement :
// doublure, comme les autres services (le client HTTP refuse de se charger sans `.env`).
jest.mock('@/services/eventReport/eventReportService', () => ({ createEventReport: jest.fn() }));

jest.mock('@/services/event/eventService', () => ({ updateEvent: jest.fn() }));

jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: jest.fn(),
  deleteEventParticipation: jest.fn(),
}));

const mockCreerEquipe = jest.fn();
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  createCustomTournamentTeam: (/** @type {any[]} */ ...args) => mockCreerEquipe(...args),
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
  mockCreerEquipe.mockReset();
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

const blocTournoi = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.props?.['data-event-section'] === 'tournament')[0];
// T-PAGES-3 (17/11, maquette (a) et (b)) : sur un tournoi, le joueur ne lit plus « Mon statut » ; ses
// gestes sont dans la colonne des cartes (« Ton inscription » ou « Mon équipe »). Les réglages, la
// pastille de validation et « Infos rapides » restent à l'organisateur (témoin EventDetailsWeb.T-PAGES-3).
const carteDuJoueur = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.['data-testid'] === 'event-tournament-side' && n.type === 'div')[0];
const boutonsDeLaCarte = (/** @type {any} */ arbre) => carteDuJoueur(arbre)
  .findAll((/** @type {any} */ n) => n.type === 'button')
  .map((/** @type {any} */ b) => [texte(b), b.props.style?.background === 'transparent' ? 'contour' : 'plein']);
const L_ORGANISATEUR = {
  ...JOUEUR, canEditClub: () => true, canEditEvent: () => true, canManageEvent: () => true,
};
const boutonsDe = (/** @type {any} */ noeud) => noeud.findAll((/** @type {any} */ n) => n.type === 'button').map(texte);
const tousLesBoutons = (/** @type {any} */ arbre) => boutonsDe(arbre.root);
const blocParticipants = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.props?.id === 'event.participants').length;
// 15 ans le 19/12/2026 ; 18 ans ; le tournoi du samedi 19/12/2026 ouvert dès 16 ans.
const compteNeLe = (/** @type {string | null} */ birthdate) => ({ ...JOUEUR, userData: { ...JOUEUR.userData, birthdate } });
const TOURNOI_19_12 = (/** @type {Record<string, any>} */ sur = {}) => tournoiAutonome({
  date: '2026-12-19T17:15:00.000Z', endDate: '2026-12-19T22:00:00.000Z', tournamentConfig: { minAge: 16 }, ...sur,
});

// --- (a) ni « Participer » ni « Participants » sur un tournoi --------------------------------------------

test('🔴 T-F3 (a) — tournoi : plus de « Participer », seulement « Créer mon équipe » (T-PAGES-3 : carte « Ton inscription »)', () => {
  expect(boutonsDeLaCarte(monter(tournoiAutonome()))).toEqual([['Créer mon équipe', 'plein']]);
});

test('🔴 T-F3 (a) — tournoi : le bloc « Participants » (Présent / Absent / Sans réponse) n est pas rendu', () => {
  expect(blocParticipants(monter(tournoiAutonome()))).toBe(0);
});

test('T-F3 (a) caractérisant — un match d équipe garde « Participer » et son bloc « Participants »', () => {
  const arbre = monter(MATCH_EQUIPE);
  expect(boutonsMonStatut(arbre)).toEqual([['Participer', 'plein']]);
  expect(blocParticipants(arbre)).toBeGreaterThan(0);
});

// --- (b) l âge minimum --------------------------------------------------------------------------------

test('🔴 T-F3 (b) — 15 ans au jour du tournoi : la phrase « ouvert à partir de 16 ans », aucun bouton d inscription', () => {
  const arbre = monter(TOURNOI_19_12(), compteNeLe('2011-06-01'));
  // T-PAGES-3 : le message est le titre de la carte (maquette (a), variante « moins de 16 ans »).
  expect(JSON.stringify(arbre.toJSON())).toContain('Ce tournoi est ouvert à partir de 16 ans');
  const boutons = tousLesBoutons(arbre);
  ['Inscrire mon équipe', 'Créer une équipe', 'Créer mon équipe', 'Inscrire une équipe du club', 'Participer'].forEach((libelle) => {
    expect(boutons).not.toContain(libelle);
  });
});

test('T-F3 (b) caractérisant — âge inconnu, ou 18 ans : « Inscrire mon équipe » reste, sans la phrase', () => {
  [null, '2008-01-01'].forEach((birthdate) => {
    const arbre = monter(TOURNOI_19_12(), compteNeLe(birthdate));
    expect(boutonsDeLaCarte(arbre)[0]).toEqual(['Créer mon équipe', 'plein']);
    expect(JSON.stringify(arbre.toJSON())).not.toContain('Ce tournoi est ouvert à partir de');
    act(() => mounted.unmount());
    mounted = null;
  });
});

// --- (c) l erreur du serveur à l inscription d une équipe ------------------------------------------------

test('🔴 T-F3 (c) — « Créer une équipe » refusée par le serveur : sa phrase s affiche dans le bloc « Mode tournoi »', async () => {
  mockCreerEquipe.mockRejectedValue(new Error('Tu participes déjà à une autre équipe de ce tournoi.'));
  const arbre = monter(tournoiAutonome());
  // T-PAGES-3 : le geste et sa phrase d'erreur sont dans la carte « Ton inscription », sous le bouton.
  const creer = carteDuJoueur(arbre).findAll((/** @type {any} */ n) => n.type === 'button' && texte(n) === 'Créer mon équipe')[0];
  act(() => { creer.props.onClick(); });
  await act(async () => { await mockFeuille.props.onCreate('Les Seuls'); });
  expect(mockCreerEquipe).toHaveBeenCalled();
  expect(texte(carteDuJoueur(arbre))).toContain('Tu participes déjà à une autre équipe de ce tournoi.');
  // Une seule fois (la carte ne la répète pas).
  expect(texte(arbre.root).split('Tu participes déjà à une autre équipe de ce tournoi.')).toHaveLength(2);
});

// --- Ajout 1 du chef du tournoi : le parcours « joueur seul » --------------------------------------------

const EQUIPE_OUVERTE = {
  captainUser: { documentId: 'capitaine' },
  documentId: 'equipe-ouverte',
  isOpenToJoinRequests: true,
  members: [{ responseStatus: 'pending', user: { documentId: 'capitaine' } }],
  name: 'On te trouve une place',
  sourceType: 'custom_team',
  status: 'pending',
};
const EQUIPE_FERMEE = {
  ...EQUIPE_OUVERTE,
  documentId: 'equipe-fermee',
  isOpenToJoinRequests: false,
  name: 'Complets',
};
// IMPL-1-FICHE (8b) : le joueur lit les cartes de TournamentTeamsPublic (toute la carte s'ouvre).
const carteEquipe = (/** @type {any} */ arbre, /** @type {string} */ nom) => blocTournoi(arbre).findAll((/** @type {any} */ n) => typeof n.type === 'string'
  && String(n.props?.testID || '').startsWith('tournament-public-team-')
  && texte(n).includes(nom))
  .slice(-1)[0];

test('🔴 T-F3 joueur seul — une équipe ouverte aux demandes le dit sur sa carte ; une équipe fermée non', () => {
  // T-PAGES-3 (précision du chef, 17/11) : sous le seuil des 30 %, la liste ne montre que les équipes
  // qui cherchent un joueur ; la carte fermée se lit à partir du seuil (8 inscrites sur 24).
  const arbre = monter(TOURNOI_19_12({
    tournamentConfig: { maxTeams: 24, minAge: 16 },
    tournamentTeams: [EQUIPE_FERMEE, EQUIPE_OUVERTE],
    tournamentTeamsSummary: { expectedCount: 24, registeredCount: 8 },
  }), compteNeLe('2008-01-01'));
  // IMPL-1-FICHE (8b) : une équipe ouverte le dit par « Cherche N joueurs » (sous 5) ou « Ouverte aux
  // demandes » (5 et plus), avec « Demander à rejoindre » ; une équipe fermée, rien de tout cela.
  expect(texte(carteEquipe(arbre, 'On te trouve une place'))).toMatch(/Cherche \d joueurs?|Ouverte aux demandes/);
  expect(texte(carteEquipe(arbre, 'On te trouve une place'))).toContain('Demander à rejoindre');
  expect(texte(carteEquipe(arbre, 'Complets'))).not.toMatch(/Cherche|Ouverte aux demandes|Demander à rejoindre/);
});

// T-SUITES-TOURNOI (18/11, point 3) : une équipe ouverte mais PLEINE disait « Équipe complète ».
// RETOURNÉ par T-SANS-PLAFOND (18/11, décision d'Adel D239 « pas de limite de joueurs ») : à 5 et à 7 sur un
// plafond 5 en base, une équipe ouverte reste « Ouverte aux demandes ».
test('🔴 T-SUITES (3) / D239 — une équipe ouverte à 5 ou 7 sur un plafond 5 dit « Ouverte aux demandes », jamais « Équipe complète »', () => {
  const pleine = {
    ...EQUIPE_OUVERTE, documentId: 'equipe-pleine', membersSummary: { count: 5, list: [] }, name: 'Pleine à craquer',
  };
  const presque = {
    ...EQUIPE_OUVERTE, documentId: 'equipe-presque', membersSummary: { count: 7, list: [] }, name: 'Avec deux remplaçants',
  };
  const arbre = monter(TOURNOI_19_12({
    tournamentConfig: { maxRosterSize: 5, maxTeams: 24, minAge: 16 },
    tournamentTeams: [pleine, presque],
    tournamentTeamsSummary: { expectedCount: 24, registeredCount: 8 },
  }), compteNeLe('2008-01-01'));
  expect(texte(carteEquipe(arbre, 'Pleine à craquer'))).not.toContain('Équipe complète');
  expect(texte(carteEquipe(arbre, 'Pleine à craquer'))).toContain('Ouverte aux demandes');
  expect(texte(carteEquipe(arbre, 'Avec deux remplaçants'))).toContain('Ouverte aux demandes');
  expect(texte(carteEquipe(arbre, 'Avec deux remplaçants'))).not.toContain('Équipe complète');
});

// IMPL-1-FICHE (8b, 8e) : la carte d'une équipe ouverte porte « Demander à rejoindre » ; la toucher
// ouvre l'aperçu (feuille d'équipe, doublée ici), plus la page d'équipe.
test('T-F3 joueur seul — sans équipe, la carte de l équipe ouverte porte « Demander à rejoindre »', () => {
  const arbre = monter(TOURNOI_19_12({
    tournamentConfig: { maxTeams: 24, minAge: 16 },
    tournamentTeams: [EQUIPE_OUVERTE],
    tournamentTeamsSummary: { expectedCount: 24, registeredCount: 8 },
  }), compteNeLe('2008-01-01'));
  expect(texte(carteEquipe(arbre, 'On te trouve une place'))).toContain('Demander à rejoindre');
});

// --- Ajout du chef (17/11, recette 41) : le haut de la fiche dit la vraie règle de validation -----------
// Serveur (admin 0eb46167, lu par le chef du tournoi) : tournoi payant, équipe « pending » validée quand les
// places payées atteignent `paidMembersToValidate` (5 par défaut), quel que soit le mode ; « auto » valide à la
// création.
const ligneValidation = (/** @type {any} */ arbre) => texte(blocTournoi(arbre).findAll((/** @type {any} */ n) => n.type === 'span'
  && texte(n).startsWith('Validation des'))[0]);
const tournoiRegle = (/** @type {any} */ tournamentConfig) => tournoiAutonome({ tournamentConfig });
// T-PAGES-3 point 4 : la ligne « Validation des équipes » est un réglage, lu par l'organisateur.
const monterRegle = (/** @type {any} */ tournamentConfig) => monter(tournoiRegle(tournamentConfig), L_ORGANISATEUR);

test('🔴 T-F3 validation — payant en « manual » : « Équipe validée au 5ᵉ joueur payé » (seuil lu, sinon 5)', () => {
  expect(ligneValidation(monterRegle({ entryFeeCents: 2000, registrationMode: 'manual' })))
    .toContain('Équipe validée au 5ᵉ joueur payé');
  act(() => mounted.unmount());
  mounted = null;
  expect(ligneValidation(monterRegle({ entryFeeCents: 2000, paidMembersToValidate: 6, registrationMode: 'manual' })))
    .toContain('Équipe validée au 6ᵉ joueur payé');
});

test('T-F3 validation caractérisant — gratuit en « manual » : « Manuelle » ; « auto », même payant : « Automatique »', () => {
  expect(ligneValidation(monterRegle({ registrationMode: 'manual' }))).toContain('Manuelle');
  act(() => mounted.unmount());
  mounted = null;
  expect(ligneValidation(monterRegle({ entryFeeCents: 2000, registrationMode: 'auto' }))).toContain('Automatique');
});

// ==========================================================================
// T-PARCOURS-2 (17/11, recette 42) — restes de T-FINITIONS-3 sur la fiche du SITE.
// ==========================================================================
const pastilles = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => n.type === 'span' && n.props?.style?.borderRadius === 999)
  .map(texte);
const PAYANT = { entryFeeCents: 2000, registrationMode: 'manual' };

test('🔴 T-PARCOURS2 (9) — tournoi payant : la pastille dit la règle du 5ᵉ joueur payé', () => {
  // T-PAGES-3 point 4 (M1316) : sur un tournoi, la pastille reste à l'organisateur.
  const arbre = monter(tournoiAutonome({ tournamentConfig: PAYANT, validationMode: 'manual' }), L_ORGANISATEUR);
  expect(pastilles(arbre)).toContain('Équipe validée au 5ᵉ joueur payé');
  expect(pastilles(arbre)).not.toContain('Validation manuelle');
});

test('T-PARCOURS2 (9) caractérisant — tournoi gratuit, ou match : « Validation manuelle »', () => {
  const gratuit = monter(tournoiAutonome({
    tournamentConfig: { registrationMode: 'manual' }, validationMode: 'manual',
  }), L_ORGANISATEUR);
  expect(pastilles(gratuit)).toContain('Validation manuelle');
  act(() => mounted.unmount());
  mounted = null;
  const match = monter({ ...MATCH_EQUIPE, validationMode: 'manual' });
  expect(pastilles(match)).toContain('Validation manuelle');
});

// T-PARCOURS-2 (point 7) — « Prix / personne » d'un TOURNOI : le montant encaissé
// (tournamentConfig.entryFeeCents, la règle du téléphone) ; à défaut le prix saisi (« P7 prix C »).
test('🔴 T-PARCOURS2 (7) — tournoi payant : « 20 € par joueur », pas le prix saisi', () => {
  // T-PAGES-3 point 4 : « Infos rapides » reste à l'organisateur sur un tournoi.
  const arbre = monter(tournoiAutonome({ pricePerPerson: 35, tournamentConfig: PAYANT }), L_ORGANISATEUR);
  expect(texte(arbre.root)).toContain('20 € par joueur');
  expect(texte(arbre.root)).not.toContain('35 EUR');
  expect(texte(arbre.root)).not.toContain('35 € par joueur');
});

// Récolte du train 12, « P7 prix C » (chef, 17/11) : témoin retourné ; sans montant encaissé, le
// prix saisi par l organisateur, au même format, jamais « Gratuit » sur un prix saisi.
test('🔴 T-PARCOURS2 (7) — tournoi sans prix encaissé : le prix saisi, « 35 € par joueur »', () => {
  const arbre = monter(tournoiAutonome({
    pricePerPerson: 35, tournamentConfig: { registrationMode: 'manual' },
  }), L_ORGANISATEUR);
  expect(texte(arbre.root)).toContain('35 € par joueur');
  expect(texte(arbre.root)).not.toContain('Gratuit ou non défini');
});

test('T-PARCOURS2 (7) caractérisant — un événement ordinaire garde son prix par personne', () => {
  expect(texte(monter({ ...MATCH_EQUIPE, pricePerPerson: 12 }).root)).toContain('12 EUR');
});

// T-PARCOURS-2 (point 10) — la colonne principale de la fiche : depuis que la liste des
// participants n'est plus rendue sur un tournoi (T-FINITIONS-3), un joueur y voyait une carte
// VIDE sous l'en-tête.
/**
 * La colonne principale dans l'arbre rendu (JSON) : ses enfants réellement rendus.
 * @param {any} noeud
 * @returns {any}
 */
const colonnePrincipale = (noeud) => {
  if (!noeud || typeof noeud !== 'object') return null;
  if (Array.isArray(noeud)) return noeud.map(colonnePrincipale).find(Boolean) || null;
  if (noeud.props?.['data-testid'] === 'event-main-column') return noeud;
  return colonnePrincipale(noeud.children);
};
const ORGANISATEUR = {
  ...JOUEUR, canEditClub: () => true, canEditEvent: () => true, canManageEvent: () => true,
};

// T-PAGES-3 (17/11) : la colonne n'est plus jamais vide pour le joueur : elle porte l'essentiel du
// tournoi, « Comment ça marche » et « Avant de t'inscrire » (maquette (a)). Elle s'affiche donc.
test('🔴 T-PARCOURS2 (10) — joueur sur un tournoi : plus de carte vide, la colonne porte l essentiel (T-PAGES-3)', () => {
  const colonne = colonnePrincipale(monter(tournoiAutonome()).toJSON());
  expect(colonne.children).not.toBeNull();
  expect(colonne.props.style.display).toBe('grid');
});

test('T-PARCOURS2 (10) caractérisant — un bloc rendu : la colonne reste affichée', () => {
  [
    () => monter(tournoiAutonome(), ORGANISATEUR),
    () => monter(MATCH_EQUIPE),
    () => monter(tournoiAutonome({
      eventTasks: [{ documentId: 'tache-1', name: 'Apporter les chasubles' }],
    })),
  ].forEach((cas) => {
    const colonne = colonnePrincipale(cas().toJSON());
    // Cachée ⇒ aucun enfant rendu : jamais un bloc masqué par erreur.
    if (colonne.props.style.display === 'none') expect(colonne.children).toBeNull();
    else expect(colonne.props.style.display).toBe('grid');
    act(() => mounted.unmount());
    mounted = null;
  });
  const organisateur = colonnePrincipale(monter(tournoiAutonome(), ORGANISATEUR).toJSON());
  expect(organisateur.props.style.display).toBe('grid');
  expect(organisateur.children).not.toBeNull();
});

// T-PARCOURS-2 (point 3) — le site lit la même ligne du lecteur que le téléphone
// (`viewerMembership`, règle partagée getTournamentViewerMember) : le serveur ne rend plus
// `members` sur la fiche.
const equipeDuLecteur = (/** @type {any} */ viewerMembership) => tournoiAutonome({
  tournamentTeams: [{
    documentId: 'equipe-a',
    name: 'Les Aigles',
    sourceType: 'custom',
    status: 'accepted',
    viewerMembership,
  }],
});

test('T-PARCOURS2 (3) site — déjà membre : « Voir mon équipe »', () => {
  const boutons = tousLesBoutons(monter(equipeDuLecteur({ responseStatus: 'pending' })));
  expect(boutons).toContain('Voir mon équipe');
  expect(boutons).not.toContain('Inscrire mon équipe');
});

test('T-PARCOURS2 (3) site caractérisant — sans ligne du lecteur : « Inscrire mon équipe »', () => {
  const boutons = tousLesBoutons(monter(equipeDuLecteur(null)));
  // T-PAGES-3 : « Inscrire mon équipe » devient « Créer mon équipe » (carte « Ton inscription »).
  expect(boutons).toContain('Créer mon équipe');
  expect(boutons).not.toContain('Voir mon équipe');
});

// --- T-REJOINDRE (17/11, décisions de Clément, registre D210) -------------------------------------------
// D49 : le visiteur sans compte ne reçoit pas les équipes ; il lit le résumé public
// (`tournamentTeamsSummary`), avec le seuil des 30 %. D50 : « Rejoindre une équipe » pour le joueur seul.
const VISITEUR = { ...JOUEUR, userData: null };
const ligneVisiteur = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.['data-testid'] === 'event-tournament-visitor-teams').map(texte);
const tournoiPublic = (/** @type {any} */ tournamentTeamsSummary) => TOURNOI_19_12({
  tournamentConfig: { maxTeams: 24, minAge: 16 }, tournamentTeams: undefined, tournamentTeamsSummary,
});
const panneauRejoindre = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === 'tournament-join-team-panel' && typeof n.type === 'string').length;

test('🔴 T-REJ visiteur — 5 inscrites sur 24 (sous 30 %) : « 24 équipes attendues », plus de « 0 équipe » ni de « Aucune équipe n est encore inscrite »', () => {
  const arbre = monter(tournoiPublic({ expectedCount: 24, registeredCount: 5 }), VISITEUR);
  expect(ligneVisiteur(arbre)).toEqual(['24 équipes attendues']);
  expect(texte(blocTournoi(arbre))).not.toContain('encore inscrite');
  // T-PAGES-3 point 3 : les compteurs ne sont plus cachés par le style, ils ne sont plus rendus.
  const compteurs = blocTournoi(arbre).findAll((/** @type {any} */ n) => n.type === 'div'
    && n.props.style?.flexWrap === 'wrap' && texte(n).includes('en attente'));
  expect(compteurs).toHaveLength(0);
});

test('🔴 T-REJ visiteur — 8 inscrites sur 24 (30 %, arrondi au supérieur) : « 8 équipes inscrites sur 24 » ; sans capacité : aucune ligne', () => {
  expect(ligneVisiteur(monter(tournoiPublic({ expectedCount: 24, registeredCount: 8 }), VISITEUR)))
    // FICHE-TOURNOI (8b) : au seuil, la ligne dit aussi les places libres.
    .toEqual(['8 équipes inscrites · 16 places libres']);
  act(() => mounted.unmount());
  mounted = null;
  const sansCapacite = monter(TOURNOI_19_12({ tournamentTeams: undefined, tournamentTeamsSummary: { expectedCount: null, registeredCount: 5 } }), VISITEUR);
  expect(ligneVisiteur(sansCapacite)).toEqual([]);
  expect(texte(blocTournoi(sansCapacite))).not.toContain('encore inscrite');
});

// T-PAGES-3 point 3 (décision d'Adel « 4- A », 17/11) : le seuil des 30 % vaut aussi pour le compte
// connecté ; seul l'organisateur garde le vrai nombre (et « Aucune équipe n'est encore inscrite »).
test('🔴 T-PAGES-3 (3) — un compte connecté lit lui aussi « 24 équipes attendues », sans compteurs ; l organisateur garde les siens', () => {
  const arbre = monter(TOURNOI_19_12({ tournamentConfig: { maxTeams: 24, minAge: 16 }, tournamentTeamsSummary: { expectedCount: 24, registeredCount: 0 } }), compteNeLe('2008-01-01'));
  expect(ligneVisiteur(arbre)).toEqual(['24 équipes attendues']);
  expect(texte(blocTournoi(arbre))).not.toContain('encore inscrite');
  act(() => mounted.unmount());
  mounted = null;
  const organisateur = monter(TOURNOI_19_12({ tournamentTeamsSummary: { expectedCount: 24, registeredCount: 0 } }), L_ORGANISATEUR);
  expect(ligneVisiteur(organisateur)).toEqual([]);
  expect(texte(blocTournoi(organisateur))).toContain('encore inscrite');
});

test('🔴 T-REJ joueur seul — « Rejoindre une équipe » pour un compte de 18 ans sans équipe ; ni pour le visiteur, ni pour le compte de 15 ans', () => {
  const arbre = monter(TOURNOI_19_12({ tournamentTeams: [EQUIPE_OUVERTE] }), compteNeLe('2008-01-01'));
  expect(panneauRejoindre(arbre)).toBe(1);
  // T-PAGES-3 : le panneau est posé dans la carte « Ton inscription ».
  expect(texte(carteDuJoueur(arbre))).toContain('Rejoindre une équipe');
  act(() => mounted.unmount());
  mounted = null;
  expect(panneauRejoindre(monter(TOURNOI_19_12({ tournamentTeams: [EQUIPE_OUVERTE] }), VISITEUR))).toBe(0);
  act(() => mounted.unmount());
  mounted = null;
  expect(panneauRejoindre(monter(TOURNOI_19_12({ tournamentTeams: [EQUIPE_OUVERTE] }), compteNeLe('2011-06-01')))).toBe(0);
});

// T-SUITES-TOURNOI (18/11, point 11) : la ligne de l'organisateur disait « 7 équipes » à côté de
// « 5 en attente · 1 validée » : elle comptait l'équipe refusée. Règle du pilotage
// (getTournamentRegisteredTeamsCount) : en attente + validées, sans les refusées ni les archivées.
test('🔴 T-SUITES (11) — organisateur : 1 validée, 5 en attente, 1 refusée, 1 archivée => « 6 équipes »', () => {
  const equipe = (/** @type {number} */ n, /** @type {string} */ status, extra = {}) => ({
    ...EQUIPE_OUVERTE, documentId: `eq-${n}`, name: `Équipe ${n}`, status, ...extra,
  });
  const arbre = monter(TOURNOI_19_12({
    tournamentTeams: [
      equipe(1, 'accepted'), equipe(2, 'pending'), equipe(3, 'pending'), equipe(4, 'pending'),
      equipe(5, 'pending'), equipe(6, 'pending'), equipe(7, 'declined'),
      equipe(8, 'pending', { archivedAt: '2026-11-10T10:00:00.000Z' }),
    ],
  }), L_ORGANISATEUR);
  const [compteurs] = blocTournoi(arbre).findAll((/** @type {any} */ n) => n.type === 'div'
    && n.props.style?.flexWrap === 'wrap' && texte(n).includes('en attente'));
  expect(texte(compteurs)).toMatch(/^6 équipes/);
  // Chef « 2- A » : l'équipe archivée n'est plus « en attente » non plus.
  expect(texte(compteurs)).toContain('5 en attente');
});
