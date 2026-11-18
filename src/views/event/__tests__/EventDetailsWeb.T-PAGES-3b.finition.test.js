/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// T-PAGES-3b (18/11/2026, nuit automatique, consigne du chef) — LE LOT DE FINITION de la fiche du
// tournoi sur le SITE (maquette validée design/DESIGN-TOURNOI-PAGES, planches a et b) :
// 1) l'en-tête porte les étiquettes « Inscriptions ouvertes » (ou « Ton équipe est inscrite »),
//    la section du tournoi (« Mixte ») et « À partir de 16 ans » ;
// 2) au téléphone, la carte « Mon équipe » passe AVANT l'essentiel (capitaine, membre, invité) ;
// 3) le visiteur : « Créer mon équipe » ouvre DIRECTEMENT la création du compte, retour gardé ;
// 4) « Lire les conditions d'inscription » passe l'id du tournoi (« Revenir au tournoi »).
// Le banc d'essai est celui de EventDetailsWeb.T-PAGES-3.fiche.test.js.
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
// Point 4 : on garde ce que la fiche passe à `openTournamentTerms` (T-PAGES-6 y ajoute l'id).
const mockConditions = jest.fn();
jest.mock('@/views/event/components/tournamentTerms', () => ({
  ...jest.requireActual('@/views/event/components/tournamentTerms'),
  openTournamentTerms: (/** @type {any[]} */ ...args) => mockConditions(...args),
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
import { RouteNames } from '@/navigation/routeNames';

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

const MIXTE = { tournamentSection: { documentId: 'section-mixte', name: 'Mixte' } };
const etiquettes = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.props?.['data-testid'] === 'event-tournament-tags').map(texte);
/**
 * L'ordre, dans la colonne principale, de l'essentiel et de la carte d'inscription.
 * @param {any} arbre
 * @returns {string[]}
 */
const ordreDeLaColonne = (arbre) => {
  const colonne = arbre.root.findAll((/** @type {any} */ n) => n.props?.['data-testid'] === 'event-main-column')[0];
  return colonne.findAll((/** @type {any} */ n) => n.props?.testID === 'tournament-essentials' || n.props?.['data-testid'] === 'event-tournament-side')
    .map((/** @type {any} */ n) => (n.props?.testID === 'tournament-essentials' ? 'essentiel' : 'carte'))
    .filter((/** @type {string} */ marque, /** @type {number} */ i, /** @type {string[]} */ liste) => liste.indexOf(marque) === i);
};
const cliquer = (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const bouton = arbre.root.findAll((/** @type {any} */ n) => n.type === 'button' && texte(n).includes(libelle))[0];
  act(() => bouton.props.onClick());
};

test('🔴 (1) joueur sans équipe — l en-tête porte « Inscriptions ouvertes », « Mixte », « À partir de 16 ans »', () => {
  const arbre = monter(fiche([EQUIPE_OUVERTE], MIXTE), SEUL_18_ANS);
  expect(etiquettes(arbre)).toEqual(['Inscriptions ouvertesMixteÀ partir de 16 ans']);
});

test('🔴 (1) visiteur — les mêmes étiquettes', () => {
  const arbre = monter(fiche([EQUIPE_OUVERTE], { ...MIXTE, tournamentTeams: undefined }), VISITEUR);
  expect(etiquettes(arbre)).toEqual(['Inscriptions ouvertesMixteÀ partir de 16 ans']);
});

test('🔴 (1) capitaine et membre — « Ton équipe est inscrite » à la place de « Inscriptions ouvertes »', () => {
  [CAPITAINE_EQUIPE, MEMBRE_EQUIPE].forEach((equipe) => {
    const arbre = monter(fiche([EQUIPE_OUVERTE, equipe], MIXTE), SEUL_18_ANS);
    expect(etiquettes(arbre)).toEqual(['Ton équipe est inscriteMixteÀ partir de 16 ans']);
    act(() => arbre.unmount());
    mounted = null;
  });
});

test('🔴 (1) tournoi clôturé ou sans section ni âge — ni « Inscriptions ouvertes », ni étiquette vide', () => {
  const clos = monter(fiche([EQUIPE_OUVERTE], { ...MIXTE, tournamentConfig: { ...CONFIG, closedAt: '2026-12-20T10:00:00.000Z' } }), SEUL_18_ANS);
  expect(etiquettes(clos)).toEqual(['MixteÀ partir de 16 ans']);
  act(() => clos.unmount());
  const nu = monter(fiche([EQUIPE_OUVERTE], { tournamentConfig: { ...CONFIG, closedAt: '2026-12-20T10:00:00.000Z', minAge: 0 } }), SEUL_18_ANS);
  expect(etiquettes(nu)).toEqual([]);
});

test('🔒 (1) organisateur — son en-tête ne change pas : aucune étiquette', () => {
  const arbre = monter(fiche([EQUIPE_OUVERTE, CAPITAINE_EQUIPE], MIXTE), ORGANISATEUR);
  expect(etiquettes(arbre)).toEqual([]);
});

test('🔴 (2) au téléphone — capitaine, membre, invité : la carte « Mon équipe » AVANT l essentiel', () => {
  [CAPITAINE_EQUIPE, MEMBRE_EQUIPE, INVITE_EQUIPE].forEach((equipe) => {
    const arbre = monter(fiche([EQUIPE_OUVERTE, equipe]), SEUL_18_ANS);
    expect(ordreDeLaColonne(arbre)).toEqual(['carte', 'essentiel']);
    act(() => arbre.unmount());
    mounted = null;
  });
});

test('🔒 (2) au téléphone — sans équipe : l essentiel puis la carte « Inscris ton équipe » (inchangé)', () => {
  const arbre = monter(fiche(), SEUL_18_ANS);
  expect(ordreDeLaColonne(arbre)).toEqual(['essentiel', 'carte']);
});

test('🔴 (3) visiteur — « Créer mon équipe » ouvre la CRÉATION du compte, retour au tournoi demandé', () => {
  const arbre = monter(fiche([EQUIPE_OUVERTE], { tournamentTeams: undefined }), VISITEUR);
  cliquer(arbre, 'Créer mon équipe');
  expect(mockNavigate).toHaveBeenCalledWith(RouteNames.PublicAuthStack, {
    params: expect.objectContaining({ retourApresConnexion: true }),
    screen: RouteNames.Register,
  });
});

test('🔒 (3) visiteur — « J ai déjà un compte » mène toujours à la connexion, retour demandé', () => {
  const arbre = monter(fiche([EQUIPE_OUVERTE], { tournamentTeams: undefined }), VISITEUR);
  cliquer(arbre, 'J’ai déjà un compte');
  expect(mockNavigate).toHaveBeenCalledWith(RouteNames.PublicAuthStack, {
    params: expect.objectContaining({ retourApresConnexion: true }),
    screen: RouteNames.Login,
  });
});

test('🔴 (4) « Lire les conditions d inscription » passe l id du tournoi', () => {
  mockConditions.mockClear();
  const arbre = monter(fiche(), SEUL_18_ANS);
  cliquer(arbre, 'Lire les conditions d’inscription');
  expect(mockConditions).toHaveBeenCalledWith('event-1');
});

// Récolte du train 13 (chef « A », 18/11) : « Créer mon équipe » du visiteur retient le tournoi,
// comme la connexion (T-PAGES-6b) ; l'écran du rôle le lit et affiche son bandeau
// (UserRole.TPAGES6b.bandeauTournoi.test.js prouve le rendu à partir de cette lecture).
test('🔴 (3) visiteur — « Créer mon équipe » retient le tournoi pour l écran du rôle', () => {
  // eslint-disable-next-line global-require
  const { lireLInscriptionAuTournoi, oublierLInscriptionAuTournoi } = require('@/domains/tournoi/inscriptionEnCours');
  oublierLInscriptionAuTournoi();
  const arbre = monter(fiche([EQUIPE_OUVERTE], { tournamentTeams: undefined }), VISITEUR);
  cliquer(arbre, 'Créer mon équipe');
  expect(lireLInscriptionAuTournoi()).toEqual(expect.objectContaining({ eventId: 'event-1', nom: 'Tournoi Montpellier' }));
  oublierLInscriptionAuTournoi();
});
