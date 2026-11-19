/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

// ORGA-MINIS (19/11/2026) : harnais repris tel quel de EventDetailsWeb.ORGANISATEUR8 (en-têtes
// d'origine gardés) ; le témoin propre à ORGA-MINIS est en fin de fichier.
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
// 15 ans le 19/12/2026 ; 18 ans ; le tournoi du samedi 19/12/2026 ouvert dès 16 ans.
const compteNeLe = (/** @type {string | null} */ birthdate) => ({ ...JOUEUR, userData: { ...JOUEUR.userData, birthdate } });
const TOURNOI_19_12 = (/** @type {Record<string, any>} */ sur = {}) => tournoiAutonome({
  date: '2026-12-19T17:15:00.000Z', endDate: '2026-12-19T22:00:00.000Z', tournamentConfig: { minAge: 16 }, ...sur,
});

// --- Les sept lecteurs, sur le tournoi du 19/12 ------------------------------------------------------
const ORGANISATEUR = {
  ...JOUEUR, canEditClub: () => true, canEditEvent: () => true, canManageEvent: () => true,
};
const SEUL_18_ANS = compteNeLe('2008-01-01');
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

// ==========================================================================
// ORGANISATEUR 8 (19/11/2026, cartes 11a et 11d ; réponses d'Adel Q5 « A » et Q6 « A », relayées par le
// chef) — SUR LE SITE, L'ORGANISATEUR D'UN TOURNOI LIT LA FICHE DE L'APPLICATION : le bandeau, l'essentiel,
// « Gérer le tournoi » et « Mon équipe » côte à côte, la carte de son équipe. Rien ne disparaît sans être
// déplacé : « Piloter la compétition » devient « Gérer le tournoi » ; « Modifier les paramètres » est la ligne
// « Réglages » de Gérer le tournoi ; « Valider » / « Refuser » sont dans son menu ⋯ ; « Annuler » l'événement
// passe dans Gérer le tournoi (Q5) ; le menu « Gérer l'événement » reste sans ce qui y est déjà (Q6).
// Le harnais est celui de EventDetailsWeb.T-PAGES-3.fiche (mêmes lecteurs, même tournoi du 19/12).
// ==========================================================================

const parTestId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.['data-testid'] === id || n.props?.testID === id,
);
const cliquer = (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const [bouton] = arbre.root.findAll((/** @type {any} */ n) => n.type === 'button' && texte(n) === libelle);
  act(() => { bouton.props.onClick(); });
};

// ==========================================================================
// ORGA-MINIS (19/11/2026) — TÉMOIN CARACTÉRISANT DU BLOC « Les équipes » (blocDuTournoi) SUR LE SITE.
// Depuis ORGANISATEUR 8 (4d5cafa2e), `vueJoueurDuTournoi = isTournamentEvent` : dans ce bloc, toute
// branche `!vueJoueurDuTournoi` (et `canEdit && !organisateurDuTournoi`) est fausse par construction.
// Ce témoin dit ce que le bloc rend, lecteur par lecteur, avec des données qui allumeraient chaque
// ancienne branche si elle était atteignable (équipe en attente, tournoi payant, zéro équipe, capitaine,
// invité, tournoi clôturé). Vert avant ET après le retrait du code mort.
// Contre-épreuve : avec `vueJoueurDuTournoi = isTournamentEvent && !canEdit`, il passe au rouge
// (sortie dans .local/bancs/ORGANISATEUR-1911/ORGA-MINIS/).
// ==========================================================================

const VISITEUR = { ...JOUEUR, userData: null };
const REGLEMENT = 'Règlement : 5 contre 5, matchs de 12 minutes.';
const INVITE = equipeDuLecteur({
  documentId: 'equipe-invite',
  members: [{ documentId: 'm-inv', responseStatus: 'invited', user: { documentId: 'joueur-1' } }],
  viewerMembership: { responseStatus: 'invited' },
});
const CLOS = { ...CONFIG, closedAt: '2026-12-20T10:00:00.000Z' };
const ficheReglee = (/** @type {any[]} */ equipes, /** @type {Record<string, any>} */ sur = {}) => fiche(equipes, {
  tournamentConfig: { ...CONFIG, rulesText: REGLEMENT }, ...sur,
});

/** Libellés exacts (fr.js) des anciennes branches `!vueJoueurDuTournoi` du bloc. */
const MOTS_MORTS = [
  'Mode tournoi', 'Validation des équipes :', 'Max équipes :', 'Effectif :', 'Équipes éphémères :', 'Mix clubs :',
  'effectifs à revoir', 'effectif à revoir', 'Aucune équipe n’est encore inscrite.',
];
const BOUTONS_MORTS = [
  'Piloter la compétition', 'Modifier les paramètres', 'Gérer mon équipe', 'Voir mon équipe',
  'Répondre à mon invitation', 'Suivre ma demande', 'Inscrire une équipe du club', 'Créer une équipe',
  'Conditions d\'inscription', 'Valider', 'Refuser',
];

const sectionDuTournoi = (/** @type {any} */ arbre) => {
  const sections = arbre.root.findAll((/** @type {any} */ n) => n.type === 'div' && n.props?.['data-event-section'] === 'tournament');
  expect(sections).toHaveLength(1);
  return sections[0];
};

const LECTEURS = [
  ['organisateur qui joue (capitaine), équipe en attente', ORGANISATEUR, () => ficheReglee([EQUIPE_OUVERTE, CAPITAINE_EQUIPE])],
  ['organisateur sans équipe, tournoi payant, équipe en attente', ORGANISATEUR, () => ficheReglee([EQUIPE_OUVERTE])],
  ['organisateur, aucune équipe inscrite', ORGANISATEUR, () => ficheReglee([])],
  ['organisateur, tournoi clôturé', ORGANISATEUR, () => ficheReglee([EQUIPE_OUVERTE, CAPITAINE_EQUIPE], { tournamentConfig: { ...CLOS, rulesText: REGLEMENT } })],
  ['joueur sans équipe', SEUL_18_ANS, () => ficheReglee([EQUIPE_OUVERTE])],
  ['joueur capitaine', JOUEUR, () => ficheReglee([EQUIPE_OUVERTE, CAPITAINE_EQUIPE])],
  ['joueur invité', JOUEUR, () => ficheReglee([EQUIPE_OUVERTE, INVITE])],
  ['visiteur', VISITEUR, () => ficheReglee([EQUIPE_OUVERTE], { tournamentTeams: undefined })],
];

describe('ORGA-MINIS — le bloc « Les équipes » ne rend aucune ancienne branche organisateur', () => {
  test.each(LECTEURS)('%s : ni réglages, ni compteurs, ni gestes d équipe, ni liste à l ancienne', (_nom, compte, construire) => {
    const arbre = monter(/** @type {any} */ (construire)(), compte);
    const section = sectionDuTournoi(arbre);
    const tout = texte(section);
    MOTS_MORTS.forEach((mot) => expect(tout).not.toContain(mot));
    const boutons = boutonsDe(section);
    BOUTONS_MORTS.forEach((libelle) => expect(boutons).not.toContain(libelle));
    // Le lien des conditions vit aussi dans « Avant de t’inscrire » (TournamentBeforeSignUp) : hors du bloc.
    expect(section.findAll((/** @type {any} */ n) => n.props?.['data-testid'] === 'event-tournament-terms-link')).toHaveLength(0);
    expect(section.findAll((/** @type {any} */ n) => n.props?.role === 'alert')).toHaveLength(0);
  });

  test.each(LECTEURS)('%s : le titre « Les équipes » et le règlement restent', (_nom, compte, construire) => {
    const section = sectionDuTournoi(monter(/** @type {any} */ (construire)(), compte));
    expect(section.findAll((/** @type {any} */ n) => n.type === 'h2').map(texte)).toEqual(['Les équipes']);
    expect(texte(section)).toContain(REGLEMENT);
  });

  test.each(LECTEURS.filter(([, compte]) => compte !== ORGANISATEUR))('%s : « Voir la compétition » reste dans le bloc', (_nom, compte, construire) => {
    const arbre = monter(/** @type {any} */ (construire)(), compte);
    expect(boutonsDe(sectionDuTournoi(arbre)).filter((b) => b === 'Voir la compétition')).toHaveLength(1);
    cliquer(arbre, 'Voir la compétition');
    expect(mockNavigate).toHaveBeenCalledWith('TournamentManagement', { eventId: 'event-1' });
  });

  test.each(LECTEURS.filter(([, compte]) => compte === ORGANISATEUR))('%s : pas de « Voir la compétition » (« Gérer le tournoi » est dans la carte)', (_nom, compte, construire) => {
    expect(boutonsDe(sectionDuTournoi(monter(/** @type {any} */ (construire)(), compte)))).not.toContain('Voir la compétition');
  });

  test('visiteur : la ligne des équipes (seuil des 30 %) reste rendue dans le bloc', () => {
    const arbre = monter(ficheReglee([EQUIPE_OUVERTE], { tournamentTeams: undefined }), VISITEUR);
    const section = sectionDuTournoi(arbre);
    expect(section.findAll((/** @type {any} */ n) => n.props?.['data-testid'] === 'event-tournament-visitor-teams').length)
      .toBe(parTestId(arbre, 'event-tournament-visitor-teams').length);
  });
});
