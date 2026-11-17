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
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: (/** @type {any} */ url) => mockOuvrirLien(url) } }));

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
// eslint-disable-next-line no-unused-vars -- servira au critère R11 (point 6).
const blocParticipants = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.props?.id === 'event.participants').length;
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
  captainUser: { documentId: 'capitaine' }, documentId: 'equipe-ouverte', isOpenToJoinRequests: true, members: [], membersSummary: { count: 3, list: [] }, name: 'On te trouve une place', sourceType: 'custom', status: 'pending',
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
    boutons: ['Planning', 'Partager', '', "Gérer l'événement", 'Voir mon équipe', 'Piloter la compétition', 'Modifier les paramètres', 'Gérer mon équipe', "Conditions d'inscription", 'Ouvrir l’équipe', 'Valider', 'Refuser', 'Ouvrir l’équipe', 'Valider', 'Refuser'],
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

test.each(LECTEURS.filter(([nom]) => nom === 'organisateur'))('T-PAGES-3 (0) caractérisant — %s : la fiche reste celle d avant', (nom, compte, ev) => {
  expect(inventaire(monter(ev(), compte))).toEqual(AVANT[nom]);
});

test.each(LECTEURS.filter(([nom]) => nom !== 'organisateur'))('T-PAGES-3 (0) relevé d avant — %s', (nom, compte, ev) => {
  expect(inventaire(monter(ev(), compte))).toEqual(AVANT[nom]);
});
