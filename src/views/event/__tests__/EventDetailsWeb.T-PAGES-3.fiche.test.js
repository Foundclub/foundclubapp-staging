/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// T-PAGES-3 (17/11/2026) — LA FICHE DU TOURNOI SUR LE SITE, redessinée (maquette validée
// design/DESIGN-TOURNOI-PAGES, écrans (a) et (b), ordinateur). Point 0 (E6, R2) : ce que la
// branche tournoi montre, lecteur par lecteur (visiteur, joueur sans équipe, trop jeune,
// capitaine, membre, invité, organisateur). Règle d'Adel (10/11) : la maquette n'efface
// jamais l'existant qu'elle ne dessine pas ; inventaire gardé / déplacé / retiré dans
// .local/bancs/T-PAGES-3-1711/INVENTAIRE.md.
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

const boutonsDe = (/** @type {any} */ noeud) => noeud.findAll((/** @type {any} */ n) => n.type === 'button').map(texte);
const tousLesBoutons = (/** @type {any} */ arbre) => boutonsDe(arbre.root);
const blocParticipants = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.props?.id === 'event.participants').length;
const blocTournoi = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.props?.['data-event-section'] === 'tournament')[0];
// 15 ans le 19/12/2026 ; 18 ans ; le tournoi du samedi 19/12/2026 ouvert dès 16 ans.
const compteNeLe = (/** @type {string | null} */ birthdate) => ({ ...JOUEUR, userData: { ...JOUEUR.userData, birthdate } });
const TOURNOI_19_12 = (/** @type {Record<string, any>} */ sur = {}) => tournoiAutonome({
  date: '2026-12-19T17:15:00.000Z', endDate: '2026-12-19T22:00:00.000Z', tournamentConfig: { minAge: 16 }, ...sur,
});

// --- Les sept lecteurs, sur le tournoi du 19/12 ------------------------------------------------------
const VISITEUR = { ...JOUEUR, userData: null };
const ORGANISATEUR = {
  ...JOUEUR, canEditClub: () => true, canEditEvent: () => true, canManageEvent: () => true,
};
const SEUL_18_ANS = compteNeLe('2008-01-01');
const TROP_JEUNE = compteNeLe('2011-06-01');
const CONFIG = {
  allowCrossClubPlayers: true, entryFeeCents: 2000, maxRosterSize: 8, maxTeams: 24, minAge: 16, minRosterSize: 5, paidMembersToValidate: 5, registrationMode: 'manual',
};
const EQUIPE_OUVERTE = {
  captainUser: { documentId: 'capitaine' }, documentId: 'equipe-ouverte-t-pages-3', isOpenToJoinRequests: true, members: [], membersSummary: { count: 3, list: [] }, name: 'On te trouve une place', sourceType: 'custom_team', status: 'pending',
};
const equipeDuLecteur = (/** @type {any} */ sur) => ({
  captainUser: { documentId: 'capitaine' }, documentId: 'equipe-lecteur', members: [], name: 'Recette Site 333', sourceType: 'custom', status: 'pending', ...sur,
});
const fiche = (/** @type {any[]} */ equipes = [EQUIPE_OUVERTE], /** @type {Record<string, any>} */ sur = {}) => TOURNOI_19_12({
  facility: { name: 'Terrain A' },
  tournamentConfig: CONFIG,
  tournamentTeams: equipes,
  tournamentTeamsSummary: { expectedCount: 24, registeredCount: equipes.length },
  validationMode: 'manual',
  ...sur,
});
const CAPITAINE_EQUIPE = equipeDuLecteur({ captainUser: { documentId: 'joueur-1' }, viewerMembership: { responseStatus: 'present' } });
const MEMBRE_EQUIPE = equipeDuLecteur({ viewerMembership: { responseStatus: 'present' } });
const INVITE_EQUIPE = equipeDuLecteur({ viewerMembership: { responseStatus: 'invited' } });
const LECTEURS = /** @type {[string, any, any][]} */ ([
  ['visiteur', VISITEUR, () => fiche([EQUIPE_OUVERTE], { tournamentTeams: undefined })],
  ['joueur sans équipe', SEUL_18_ANS, () => fiche()],
  ['trop jeune', TROP_JEUNE, () => fiche()],
  ['capitaine', SEUL_18_ANS, () => fiche([EQUIPE_OUVERTE, CAPITAINE_EQUIPE])],
  ['membre', SEUL_18_ANS, () => fiche([EQUIPE_OUVERTE, MEMBRE_EQUIPE])],
  ['invité', SEUL_18_ANS, () => fiche([EQUIPE_OUVERTE, INVITE_EQUIPE])],
  ['organisateur', ORGANISATEUR, () => fiche([EQUIPE_OUVERTE, CAPITAINE_EQUIPE])],
]);
const MOTS = ['Infos rapides', 'Mode tournoi', 'Mix clubs', 'Capacité', 'Joueurs attendus', 'Validation manuelle', 'Équipe validée au 5ᵉ joueur payé', 'Participants', 'Présent·e·s', 'Aucune équipe n', 'équipes attendues', 'inscrites sur', 'Mon statut', 'Rejoindre cet événement', 'Ce tournoi est ouvert à partir de 16 ans', 'Comment ça marche', 'Avant de t’inscrire', 'Mon équipe', 'Rejoindre une équipe'];
/**
 * Ce qu'un lecteur voit : les boutons, les titres, les pastilles, les mots repères.
 * @param {any} arbre
 * @returns {{ boutons: string[], titres: string[], pastilles: string[], mots: string[] }}
 */
const inventaire = (arbre) => {
  const tout = texte(arbre.root);
  return {
    boutons: tousLesBoutons(arbre),
    mots: MOTS.filter((mot) => tout.includes(mot)),
    pastilles: arbre.root.findAll((/** @type {any} */ n) => n.type === 'span' && n.props?.style?.borderRadius === 999).map(texte),
    titres: arbre.root.findAll((/** @type {any} */ n) => ['h1', 'h2', 'h3'].includes(n.type)).map(texte),
  };
};

// Ce que chaque lecteur voyait AVANT T-PAGES-3 (base eea820221 + T-PARCOURS2 + T-REJOINDRE + T-PAGES-A).
// L'organisateur garde ce relevé à l'identique (« il garde ce qu'il a aujourd'hui ») ; les autres
// lecteurs suivent la maquette (relevé APRÈS plus bas).
/** @type {Record<string, any>} */
const AVANT = {
  capitaine: {
    boutons: ['Planning', 'Partager', '', 'Voir mon équipe', 'Voir la compétition', 'Gérer mon équipe', "Conditions d'inscription", 'Ouvrir l’équipe', 'Ouvrir l’équipe'],
    mots: ['Infos rapides', 'Mode tournoi', 'Mix clubs', 'Capacité', 'Joueurs attendus', 'Équipe validée au 5ᵉ joueur payé', 'Mon statut'],
    pastilles: ['Terrain A', 'Équipe validée au 5ᵉ joueur payé'],
    titres: ['Tournoi Montpellier', 'Infos rapides', 'Mode tournoi', 'Équipes invitées'],
  },
  invité: {
    boutons: ['Planning', 'Partager', '', 'Voir la compétition', 'Répondre à mon invitation', "Conditions d'inscription", 'Ouvrir l’équipe', 'Ouvrir l’équipe'],
    mots: ['Infos rapides', 'Mode tournoi', 'Mix clubs', 'Capacité', 'Joueurs attendus', 'Équipe validée au 5ᵉ joueur payé', 'Mon statut'],
    pastilles: ['Terrain A', 'Équipe validée au 5ᵉ joueur payé'],
    titres: ['Tournoi Montpellier', 'Infos rapides', 'Mode tournoi', 'Équipes invitées'],
  },
  'joueur sans équipe': {
    boutons: ['Planning', 'Partager', '', 'Inscrire mon équipe', 'Voir la compétition', 'Créer une équipe', "Conditions d'inscription", 'Ouvrir l’équipe'],
    mots: ['Infos rapides', 'Mode tournoi', 'Mix clubs', 'Capacité', 'Joueurs attendus', 'Équipe validée au 5ᵉ joueur payé', 'Mon statut', 'Rejoindre une équipe'],
    pastilles: ['Terrain A', 'Équipe validée au 5ᵉ joueur payé'],
    titres: ['Tournoi Montpellier', 'Infos rapides', 'Mode tournoi', 'Équipes invitées'],
  },
  membre: {
    boutons: ['Planning', 'Partager', '', 'Voir mon équipe', 'Voir la compétition', 'Voir mon équipe', "Conditions d'inscription", 'Ouvrir l’équipe', 'Ouvrir l’équipe'],
    mots: ['Infos rapides', 'Mode tournoi', 'Mix clubs', 'Capacité', 'Joueurs attendus', 'Équipe validée au 5ᵉ joueur payé', 'Mon statut'],
    pastilles: ['Terrain A', 'Équipe validée au 5ᵉ joueur payé'],
    titres: ['Tournoi Montpellier', 'Infos rapides', 'Mode tournoi', 'Équipes invitées'],
  },
  organisateur: {
    // FICHE-TOURNOI (19/11, 6b, site au téléphone) : plus de fil ni de drapeau ; « Signaler » est
    // le dernier choix de « Gérer l'événement ».
    boutons: ['Partager', "Gérer l'événement", 'Voir mon équipe', 'Piloter la compétition', 'Modifier les paramètres', 'Gérer mon équipe', "Conditions d'inscription", 'Ouvrir l’équipe', 'Valider', 'Refuser', 'Ouvrir l’équipe', 'Valider', 'Refuser'],
    mots: ['Infos rapides', 'Mode tournoi', 'Mix clubs', 'Capacité', 'Joueurs attendus', 'Équipe validée au 5ᵉ joueur payé', 'Mon statut'],
    pastilles: ['Terrain A', 'Équipe validée au 5ᵉ joueur payé'],
    titres: ['Tournoi Montpellier', 'Demandes en attente', 'Infos rapides', 'Mode tournoi', 'Équipes invitées'],
  },
  'trop jeune': {
    boutons: ['Planning', 'Partager', '', 'Voir la compétition', "Conditions d'inscription", 'Ouvrir l’équipe'],
    mots: ['Infos rapides', 'Mode tournoi', 'Mix clubs', 'Capacité', 'Joueurs attendus', 'Équipe validée au 5ᵉ joueur payé', 'Mon statut', 'Ce tournoi est ouvert à partir de 16 ans'],
    pastilles: ['Terrain A', 'Équipe validée au 5ᵉ joueur payé'],
    titres: ['Tournoi Montpellier', 'Infos rapides', 'Mode tournoi', 'Équipes invitées'],
  },
  visiteur: {
    boutons: ['Retour', 'Partager', 'Inscrire mon équipe', 'Voir la compétition', "Conditions d'inscription"],
    mots: ['Infos rapides', 'Mode tournoi', 'Mix clubs', 'Capacité', 'Joueurs attendus', 'Équipe validée au 5ᵉ joueur payé', 'équipes attendues', 'Rejoindre cet événement'],
    pastilles: ['Terrain A', 'Équipe validée au 5ᵉ joueur payé'],
    titres: ['Tournoi Montpellier', 'Infos rapides', 'Mode tournoi', 'Équipes invitées'],
  },
};

// Avant : « (0) caractérisant — l'organisateur garde la fiche d'avant » (relevé AVANT.organisateur).
// ORGANISATEUR 8 (19/11, Adel Q5 « A » / Q6 « A ») : l'organisateur lit la fiche redessinée ; ses gestes sont dans « Gérer le tournoi » (EventDetailsWeb.ORGANISATEUR8).
test('ORGANISATEUR 8 (0) — l organisateur ne lit plus l ancienne fiche : « Gérer le tournoi », « Mon équipe », plus d Infos rapides', () => {
  const vu = inventaire(monter(fiche([EQUIPE_OUVERTE, CAPITAINE_EQUIPE]), ORGANISATEUR));
  expect(vu).not.toEqual(AVANT.organisateur);
  expect(vu.boutons).toEqual(expect.arrayContaining(['Gérer le tournoi', 'Mon équipe']));
  expect(vu.mots).not.toContain('Infos rapides');
  expect(vu.mots).not.toContain('Mode tournoi');
});

// Ce que chaque lecteur voit APRÈS T-PAGES-3 (maquette (a) et (b)) ; diff gardé / déplacé / retiré :
// .local/bancs/T-PAGES-3-1711/INVENTAIRE.md.
/** @type {Record<string, any>} */
// T-PAGES-3b (18/11) : les étiquettes de l'en-tête (« Inscriptions ouvertes » / « Ton équipe est
// inscrite », « À partir de 16 ans ») sont des pastilles de plus.
// IMPL-1-FICHE (18/11, 6b et 8) : l'en-tête du joueur est le bandeau commun (EventHeader, composants
// RN : titre `role=heading`, pastilles TOURNOI / état / âge, plus de « Terrain A ») et les équipes
// sont les cartes de TournamentTeamsPublic (toute la carte s'ouvre) : ni `h1`, ni `span` arrondi,
// ni bouton « Ouvrir l’équipe » du DOM. Témoins : EventHeader.IMPL-1.bandeau.test.js,
// TournamentTeamsPublic.IMPL-1.test.js, web/tests/components/impl-1-fiche.spec.ts.
// FICHE-TOURNOI (19/11/2026, 6b, site au téléphone) : plus de fil « Planning › … » ; le drapeau
// (« ») devient le menu « ⋯ » qui porte « Signaler ». Témoin : EventDetailsWeb.FICHE-TOURNOI.test.js.
const APRES = {
  capitaine: {
    boutons: ['Partager', '⋯', 'Voir mon équipe', 'Lire les conditions d’inscription', 'Voir la compétition'],
    mots: ['équipes attendues', 'Mon équipe'],
    pastilles: [],
    titres: ['Recette Site 333', 'Avant le match', 'Les équipes'],
  },
  invité: {
    boutons: ['Partager', '⋯', 'Répondre à mon invitation', 'Lire les conditions d’inscription', 'Voir la compétition'],
    mots: ['équipes attendues', 'Mon équipe'],
    pastilles: [],
    titres: ['Recette Site 333', 'Avant le match', 'Les équipes'],
  },
  'joueur sans équipe': {
    boutons: ['Partager', '⋯', 'Créer mon équipe', 'Lire les conditions d’inscription', 'Voir la compétition'],
    mots: ['équipes attendues', 'Comment ça marche', 'Avant de t’inscrire', 'Rejoindre une équipe'],
    pastilles: [],
    titres: ['Inscris ton équipe', 'Comment ça marche', 'Avant de t’inscrire', 'Les équipes'],
  },
  membre: {
    boutons: ['Partager', '⋯', 'Voir mon équipe', 'Lire les conditions d’inscription', 'Voir la compétition'],
    mots: ['équipes attendues', 'Mon équipe'],
    pastilles: [],
    titres: ['Recette Site 333', 'Avant le match', 'Les équipes'],
  },
  'trop jeune': {
    boutons: ['Partager', '⋯', 'Lire les conditions d’inscription', 'Voir la compétition'],
    mots: ['équipes attendues', 'Ce tournoi est ouvert à partir de 16 ans', 'Comment ça marche', 'Avant de t’inscrire'],
    pastilles: [],
    titres: ['Ce tournoi est ouvert à partir de 16 ans', 'Comment ça marche', 'Avant de t’inscrire', 'Les équipes'],
  },
  visiteur: {
    boutons: ['Retour', 'Partager', 'Créer mon équipe', 'J’ai déjà un compte', 'Lire les conditions d’inscription', 'Voir la compétition'],
    // FICHE-TOURNOI (8a) : « Rejoindre une équipe » aussi pour le visiteur (bloc du seuil).
    mots: ['équipes attendues', 'Comment ça marche', 'Avant de t’inscrire', 'Rejoindre une équipe'],
    pastilles: [],
    titres: ['Inscris ton équipe', 'Comment ça marche', 'Avant de t’inscrire', 'Les équipes'],
  },
};

test.each(LECTEURS.filter(([nom]) => nom !== 'organisateur'))('🔴 T-PAGES-3 (1) — %s : la fiche suit la maquette', (nom, compte, ev) => {
  const vu = inventaire(monter(ev(), compte));
  expect(vu).toEqual(APRES[nom]);
  expect(vu).not.toEqual(AVANT[nom]);
});

// --- Les points de la consigne, un témoin chacun ---------------------------------------------------
const parTestId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ n) => (n.props?.['data-testid'] === id || n.props?.testID === id) && typeof n.type === 'string');
const unSeul = (/** @type {any} */ arbre, /** @type {string} */ id) => {
  const trouves = parTestId(arbre, id);
  expect(trouves).toHaveLength(1);
  return trouves[0];
};
const boutonsPleins = (/** @type {any} */ noeud) => noeud.findAll((/** @type {any} */ n) => n.type === 'button'
  && n.props.style?.background !== 'transparent').map(texte);

test('🔴 T-PAGES-3 (1a) sans équipe — l essentiel en 4 cases, « Comment ça marche » en 3 étapes, la carte « Inscris ton équipe » à 20 € par joueur, règle des 5, « Créer mon équipe » seul bouton plein, puis « Rejoindre une équipe »', () => {
  const arbre = monter(fiche([EQUIPE_OUVERTE], { location: 'AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier' }), SEUL_18_ANS);
  expect(parTestId(arbre, 'tournament-essentials').length).toBeGreaterThan(0);
  ['date', 'place', 'price', 'format'].forEach((cle) => expect(parTestId(arbre, `tournament-essentials-${cle}`).length).toBeGreaterThan(0));
  expect(unSeul(arbre, 'tournament-how-it-works').findAll((/** @type {any} */ n) => n.type === 'li')).toHaveLength(3);
  expect(texte(unSeul(arbre, 'tournament-before-sign-up'))).toContain('À partir de 16 ans.');
  const carte = unSeul(arbre, 'tournament-sign-up-card');
  expect(texte(carte)).toContain('Inscris ton équipe');
  expect(texte(carte)).toContain('20 € par joueur');
  expect(texte(carte)).toContain('Ton équipe est validée dès la 5ᵉ place payée.');
  expect(boutonsPleins(carte)).toEqual(['Créer mon équipe']);
  expect(carte.findAll((/** @type {any} */ n) => n.props?.testID === 'tournament-join-team-panel').length).toBeGreaterThan(0);
  act(() => { unSeul(arbre, 'tournament-create-my-team').props.onClick(); });
  expect(mockFeuille.props.mode).toBe('name');
});

test('🔴 T-PAGES-3 (1b) avec une équipe — capitaine, membre, invité : la carte « Mon équipe », un seul bouton plein, jamais « Créer »', () => {
  [
    [CAPITAINE_EQUIPE, 'Mon équipe · Capitaine', 'Voir mon équipe'],
    [MEMBRE_EQUIPE, 'Mon équipe', 'Voir mon équipe'],
    [INVITE_EQUIPE, 'Mon équipe · Invitation', 'Répondre à mon invitation'],
  ].forEach(([equipe, surtitre, geste]) => {
    const arbre = monter(fiche([EQUIPE_OUVERTE, equipe]), SEUL_18_ANS);
    const carte = unSeul(arbre, 'tournament-my-team-card');
    expect(texte(carte)).toContain(surtitre);
    expect(texte(carte)).toContain('Recette Site 333');
    expect(boutonsPleins(carte)).toEqual([geste]);
    expect(parTestId(arbre, 'tournament-sign-up-card')).toHaveLength(0);
    expect(parTestId(arbre, 'tournament-how-it-works')).toHaveLength(0);
    act(() => { unSeul(arbre, 'tournament-my-team-primary').props.onClick(); });
    expect(mockNavigate).toHaveBeenLastCalledWith('TournamentTeamDetails', { eventId: 'event-1', teamId: 'equipe-lecteur' });
    act(() => mounted.unmount());
    mounted = null;
  });
});

test('🔴 T-PAGES-3 (1b) capitaine dont la place est due — « Payer ma place » en plein (le lien de paiement), « Voir mon équipe » dessous, et où en est l équipe', () => {
  mockEquipeLue.data = {
    documentId: 'equipe-lecteur',
    event: { tournamentConfig: CONFIG },
    members: [{ documentId: 'm1', responseStatus: 'present', user: { documentId: 'joueur-1', firstname: 'Hugo' } }],
    name: 'Recette Site 333',
    payment: {
      members: [{
        isSelf: true, memberDocumentId: 'm1', paymentUrl: 'https://pay.example/m1', status: 'due',
      }],
      paidCount: 1,
      paidMembersToValidate: 5,
    },
    status: 'pending',
  };
  try {
    const arbre = monter(fiche([CAPITAINE_EQUIPE]), SEUL_18_ANS);
    const carte = unSeul(arbre, 'tournament-my-team-card');
    expect(boutonsPleins(carte)).toEqual(['Payer ma place']);
    expect(texte(carte)).toContain('Voir mon équipe');
    expect(carte.findAll((/** @type {any} */ n) => n.props?.testID === 'tournament-team-progress').length).toBeGreaterThan(0);
    act(() => { unSeul(arbre, 'tournament-my-team-primary').props.onClick(); });
    expect(mockOuvrirLien).toHaveBeenCalledWith('https://pay.example/m1');
  } finally {
    mockEquipeLue.data = null;
  }
});

// IMPL-1C (19/11/2026, recette 48, écart 3 ; planche 9d « la phrase de remplacement vaut pour ces
// endroits-là aussi ») — la carte « Mon équipe » de la fiche dit la phrase de la page d'équipe
// (getUnpaidSentence, IMPL-2), plus jamais « Il manque 4 joueurs et 4 paiements ».
test('🔴 IMPL-1C (écart 3) — la carte « Mon équipe » dit la phrase de la page d équipe', () => {
  mockEquipeLue.data = {
    documentId: 'equipe-lecteur',
    event: { tournamentConfig: { ...CONFIG, entryFeeCents: 2000, paidMembersToValidate: 5 } },
    members: [{ documentId: 'm1', responseStatus: 'present', user: { documentId: 'joueur-1', firstname: 'Hugo' } }],
    name: 'Recette Site 333',
    payment: {
      entryFeeCents: 2000,
      members: [{
        isSelf: true, memberDocumentId: 'm1', paymentUrl: 'https://pay.example/m1', status: 'due',
      }],
      paidCount: 0,
      paidMembersToValidate: 5,
    },
    status: 'pending',
  };
  try {
    const carte = unSeul(monter(fiche([CAPITAINE_EQUIPE]), SEUL_18_ANS), 'tournament-my-team-card');
    expect(texte(carte)).toContain('1 joueur n’a pas encore payé sa place : toi. 4 places sont encore libres.');
    expect(texte(carte)).not.toMatch(/Il manque|paiements/);
  } finally {
    mockEquipeLue.data = null;
  }
});

test('🔴 T-PAGES-3 (1c) compte trop jeune — « Ce tournoi est ouvert à partir de 16 ans », aucun bouton dans la carte', () => {
  const carte = unSeul(monter(fiche(), TROP_JEUNE), 'tournament-sign-up-card');
  expect(texte(carte)).toContain('Ce tournoi est ouvert à partir de 16 ans');
  expect(carte.findAll((/** @type {any} */ n) => n.type === 'button')).toHaveLength(0);
});

test('🔴 T-PAGES-3 (2) visiteur — un seul bouton plein « Créer mon équipe », vers la connexion avec retour au tournoi ; « J ai déjà un compte » dessous', () => {
  const arbre = monter(fiche([EQUIPE_OUVERTE], { tournamentTeams: undefined }), VISITEUR);
  const carte = unSeul(arbre, 'tournament-sign-up-card');
  expect(boutonsPleins(carte)).toEqual(['Créer mon équipe']);
  expect(boutonsDe(carte)).toEqual(['Créer mon équipe', 'J’ai déjà un compte']);
  expect(tousLesBoutons(arbre)).not.toContain('Se connecter pour participer');
  expect(tousLesBoutons(arbre)).not.toContain('Inscrire mon équipe');
  act(() => { unSeul(arbre, 'tournament-create-my-team').props.onClick(); });
  expect(mockNavigate).toHaveBeenLastCalledWith('PublicAuthStack', expect.objectContaining({
    params: expect.objectContaining({ retourApresConnexion: true }),
  }));
});

test.each([
  ['visiteur', VISITEUR],
  ['joueur connecté', SEUL_18_ANS],
])('🔴 T-PAGES-3 (3) %s — sous 30 % : « 24 équipes attendues », jamais le compte ni « au plus » ; à 8 sur 24 : « 8 équipes inscrites sur 24 »', (_nom, compte) => {
  const cinq = fiche([EQUIPE_OUVERTE], { tournamentTeamsSummary: { expectedCount: 24, registeredCount: 5 } });
  let arbre = monter(compte === VISITEUR ? { ...cinq, tournamentTeams: undefined } : cinq, compte);
  expect(parTestId(arbre, 'event-tournament-visitor-teams').map(texte)).toEqual(['24 équipes attendues']);
  expect(texte(unSeul(arbre, 'tournament-essentials-format'))).toContain('24 équipes attendues');
  expect(texte(arbre.root)).not.toContain('au plus');
  // Les compteurs de l organisateur (« N en attente · N validées · N effectifs à revoir ») ne sont pas rendus.
  expect(texte(arbre.root)).not.toMatch(/[0-9] effectifs? à revoir/);
  act(() => mounted.unmount());
  arbre = monter(fiche([EQUIPE_OUVERTE], { tournamentTeamsSummary: { expectedCount: 24, registeredCount: 8 } }), compte);
  // FICHE-TOURNOI (8b) : au seuil, la ligne dit aussi les places libres.
  expect(parTestId(arbre, 'event-tournament-visitor-teams').map(texte)).toEqual(['8 équipes inscrites · 16 places libres']);
});

// Avant : l'organisateur lisait ses compteurs (« N en attente · N validées · N effectifs à revoir ») dans « Mode
// tournoi ». ORGANISATEUR 8 : ces chiffres sont dans « Gérer le tournoi » (inscrites, validées, filtres) ; la
// fiche ne lui montre toujours pas la ligne des 30 %.
test('T-PAGES-3 (3) caractérisant — l organisateur n a jamais la ligne des 30 % ; ses compteurs sont dans Gérer le tournoi', () => {
  const arbre = monter(fiche([EQUIPE_OUVERTE], { tournamentTeamsSummary: { expectedCount: 24, registeredCount: 5 } }), ORGANISATEUR);
  expect(parTestId(arbre, 'event-tournament-visitor-teams')).toHaveLength(0);
  expect(texte(arbre.root)).not.toMatch(/[0-9] effectifs? à revoir/);
  expect(tousLesBoutons(arbre)).toContain('Gérer le tournoi');
});

test('🔴 T-PAGES-3 (4) non-organisateur — ni Infos rapides, ni réglages Mode tournoi, ni pastille de validation, ni « Participer »', () => {
  LECTEURS.filter(([nom]) => nom !== 'organisateur').forEach(([, compte, ev]) => {
    const arbre = monter(ev(), compte);
    const tout = texte(arbre.root);
    // Recette 44 (testeur, via le chef) : ni « Mon statut » ni « Aucune réponse » sur un tournoi.
    ['Infos rapides', 'Mode tournoi', 'Mix clubs', 'Capacité', 'Joueurs attendus', 'Validation des', 'Aucun participant confirm', 'Mon statut', 'Aucune réponse'].forEach((mot) => expect(tout).not.toContain(mot));
    // T-PAGES-3b : les étiquettes de l'en-tête mises à part, seule « Terrain A » reste.
    const ETIQUETTES = ['Inscriptions ouvertes', 'Ton équipe est inscrite', 'À partir de 16 ans'];
    // IMPL-1-FICHE (6b) : « Terrain A » n'est plus montré au joueur.
    expect(inventaire(arbre).pastilles.filter((/** @type {string} */ p) => !ETIQUETTES.includes(p))).toEqual([]);
    expect(tousLesBoutons(arbre)).not.toContain('Participer');
    act(() => mounted.unmount());
    mounted = null;
  });
});

test('🔴 T-PAGES-3 (5) organisateur de CE tournoi — « Rejoindre une équipe » n est pas rendu', () => {
  const arbre = monter(fiche([EQUIPE_OUVERTE]), ORGANISATEUR);
  expect(parTestId(arbre, 'tournament-join-team-panel')).toHaveLength(0);
});

test('T-PAGES-3 (6) R11 — « Créer » jamais à qui a une équipe ; Présent·e·s / Absent·e·s jamais sur un tournoi ; les boutons des cartes tiennent dans leur carte (pleine largeur, retour à la ligne)', () => {
  LECTEURS.forEach(([nom, compte, ev]) => {
    const arbre = monter(ev(), compte);
    const tout = texte(arbre.root);
    expect(tout).not.toContain('Présent·e·s');
    expect(tout).not.toContain('Absent·e·s');
    expect(blocParticipants(arbre)).toBe(0);
    if (['capitaine', 'invité', 'membre'].includes(nom)) {
      ['Créer une équipe', 'Créer mon équipe', 'Inscrire mon équipe'].forEach((libelle) => expect(tousLesBoutons(arbre)).not.toContain(libelle));
    }
    ['tournament-sign-up-card', 'tournament-my-team-card'].forEach((id) => parTestId(arbre, id).forEach((carte) => {
      carte.findAll((/** @type {any} */ n) => n.type === 'button').forEach((/** @type {any} */ b) => {
        expect(b.props.style).toEqual(expect.objectContaining({ boxSizing: 'border-box', whiteSpace: 'normal', width: '100%' }));
        expect(b.props.style.minHeight).toBeGreaterThanOrEqual(44);
      });
    }));
    act(() => mounted.unmount());
    mounted = null;
  });
});

// --- M1310 (chef, 17/11) : « Valider » refusé par le serveur (effectif minimum), rien à l'écran -----
// Le message partait dans « Mon statut », en haut de la fiche, loin du bouton (bas de la colonne).

// --- Précision du chef (17/11) : sous le seuil des 30 %, le nombre d'équipes ne se lit NULLE PART ----
// La liste ne montre que l'équipe du lecteur et celles qui cherchent un joueur ; un compteur de
// personnes à 0 disparaît ; à partir du seuil, la liste complète revient ; l'organisateur voit tout.
const EQUIPE_COMPLETE = {
  captainUser: { documentId: 'capitaine-2' }, documentId: 'equipe-complete', isOpenToJoinRequests: false, members: [], membersSummary: { count: 0, list: [] }, name: 'Les Complets', sourceType: 'custom', status: 'pending',
};
// IMPL-1-FICHE (8) : le joueur lit les cartes de TournamentTeamsPublic (`tournament-public-team-<id>`) ;
// l'organisateur garde ses lignes du DOM.
const NOMS = ['Les Complets', 'On te trouve une place', 'Recette Site 333'];
const nomsListes = (/** @type {any} */ arbre) => {
  const cartes = blocTournoi(arbre).findAll((/** @type {any} */ n) => typeof n.type === 'string'
    && String(n.props?.testID || n.props?.['data-testid'] || '').startsWith('tournament-public-team-'));
  if (cartes.length) {
    return cartes.map((/** @type {any} */ carte) => NOMS.find((nom) => texte(carte).includes(nom))).filter(Boolean);
  }
  return blocTournoi(arbre)
    .findAll((/** @type {any} */ n) => n.type === 'span' && n.props?.style?.fontSize === 14 && NOMS.includes(texte(n)))
    .map(texte);
};

// IMPL-1-FICHE (8a) : sous le seuil, les équipes qui cherchent paraissent après « Rejoindre une
// équipe » (carte du seuil) ; la sienne reste visible.
test('🔴 T-PAGES-3 (3) seuil — sous 30 % : le joueur ne voit que sa propre équipe, les autres après « Rejoindre une équipe », sans compteur à 0', () => {
  let arbre = monter(fiche([EQUIPE_OUVERTE, EQUIPE_COMPLETE]), SEUL_18_ANS);
  expect(nomsListes(arbre)).toEqual([]);
  expect(texte(blocTournoi(arbre))).not.toMatch(/(^|\D)0 (joueur|payé|en attente|présent)/);
  act(() => mounted.unmount());
  arbre = monter(fiche([EQUIPE_OUVERTE, EQUIPE_COMPLETE, CAPITAINE_EQUIPE]), SEUL_18_ANS);
  expect(nomsListes(arbre)).toEqual(['Recette Site 333']);
});

test('T-PAGES-3 (3) seuil caractérisant — à partir de 30 %, la liste complète ; l organisateur voit toujours tout', () => {
  const huit = fiche([EQUIPE_OUVERTE, EQUIPE_COMPLETE], { tournamentTeamsSummary: { expectedCount: 24, registeredCount: 8 } });
  expect(nomsListes(monter(huit, SEUL_18_ANS)).sort()).toEqual(['Les Complets', 'On te trouve une place']);
  act(() => mounted.unmount());
  expect(nomsListes(monter(fiche([EQUIPE_OUVERTE, EQUIPE_COMPLETE]), ORGANISATEUR)).sort()).toEqual(['Les Complets', 'On te trouve une place']);
});
