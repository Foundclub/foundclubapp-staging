/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

// ===================================================================});

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
const boutonsDe = (/** @type {any} */ noeud) => noeud.findAll((/** @type {any} */ n) => n.type === 'button').map(texte);
const tousLesBoutons = (/** @type {any} */ arbre) => boutonsDe(arbre.root);
const blocParticipants = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.props?.id === 'event.participants').length;
// 15 ans le 19/12/2026 ; 18 ans ; le tournoi du samedi 19/12/2026 ouvert dès 16 ans.
const compteNeLe = (/** @type {string | null} */ birthdate) => ({ ...JOUEUR, userData: { ...JOUEUR.userData, birthdate } });
const TOURNOI_19_12 = (/** @type {Record<string, any>} */ sur = {}) => tournoiAutonome({
  date: '2026-12-19T17:15:00.000Z', endDate: '2026-12-19T22:00:00.000Z', tournamentConfig: { minAge: 16 }, ...sur,
});

// --- (a) ni « Participer » ni « Participants » sur un tournoi --------------------------------------------

test('🔴 T-F3 (a) — tournoi : « Mon statut » n offre plus « Participer », seulement « Inscrire mon équipe »', () => {
  expect(boutonsMonStatut(monter(tournoiAutonome()))).toEqual([['Inscrire mon équipe', 'plein']]);
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
  expect(JSON.stringify(arbre.toJSON())).toContain('Ce tournoi est ouvert à partir de 16 ans.');
  const boutons = tousLesBoutons(arbre);
  ['Inscrire mon équipe', 'Créer une équipe', 'Inscrire une équipe du club', 'Participer'].forEach((libelle) => {
    expect(boutons).not.toContain(libelle);
  });
});

test('T-F3 (b) caractérisant — âge inconnu, ou 18 ans : « Inscrire mon équipe » reste, sans la phrase', () => {
  [null, '2008-01-01'].forEach((birthdate) => {
    const arbre = monter(TOURNOI_19_12(), compteNeLe(birthdate));
    expect(boutonsMonStatut(arbre)[0]).toEqual(['Inscrire mon équipe', 'plein']);
    expect(JSON.stringify(arbre.toJSON())).not.toContain('Ce tournoi est ouvert à partir de');
    act(() => mounted.unmount());
    mounted = null;
  });
});

// --- (c) l erreur du serveur à l inscription d une équipe ------------------------------------------------

test('🔴 T-F3 (c) — « Créer une équipe » refusée par le serveur : sa phrase s affiche dans le bloc « Mode tournoi »', async () => {
  mockCreerEquipe.mockRejectedValue(new Error('Tu participes déjà à une autre équipe de ce tournoi.'));
  const arbre = monter(tournoiAutonome());
  const creer = blocTournoi(arbre).findAll((/** @type {any} */ n) => n.type === 'button' && texte(n) === 'Créer une équipe')[0];
  act(() => { creer.props.onClick(); });
  await act(async () => { await mockFeuille.props.onCreate('Les Seuls'); });
  expect(mockCreerEquipe).toHaveBeenCalled();
  expect(texte(blocTournoi(arbre))).toContain('Tu participes déjà à une autre équipe de ce tournoi.');
  // Caractérisant : « Mon statut » la montre aussi, comme avant.
  expect(texte(blocMonStatut(arbre))).toContain('Tu participes déjà à une autre équipe de ce tournoi.');
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
const carteEquipe = (/** @type {any} */ arbre, /** @type {string} */ nom) => blocTournoi(arbre).findAll((/** @type {any} */ n) => n.type === 'div'
  && texte(n).includes(nom)
  && n.findAll((/** @type {any} */ b) => b.type === 'button' && texte(b) === 'Ouvrir l’équipe').length === 1)
  .slice(-1)[0];

test('🔴 T-F3 joueur seul — une équipe ouverte aux demandes le dit sur sa carte ; une équipe fermée non', () => {
  const arbre = monter(TOURNOI_19_12({ tournamentTeams: [EQUIPE_FERMEE, EQUIPE_OUVERTE] }), compteNeLe('2008-01-01'));
  expect(texte(carteEquipe(arbre, 'On te trouve une place'))).toContain('Ouverte aux demandes');
  expect(texte(carteEquipe(arbre, 'Complets'))).not.toContain('Ouverte aux demandes');
});

test('T-F3 joueur seul caractérisant — sans équipe, il ouvre l équipe ouverte (là où il demande à la rejoindre)', () => {
  const arbre = monter(TOURNOI_19_12({ tournamentTeams: [EQUIPE_OUVERTE] }), compteNeLe('2008-01-01'));
  const ouvrir = carteEquipe(arbre, 'On te trouve une place')
    .findAll((/** @type {any} */ n) => n.type === 'button' && texte(n) === 'Ouvrir l’équipe')[0];
  act(() => { ouvrir.props.onClick(); });
  expect(mockNavigate).toHaveBeenCalledWith('TournamentTeamDetails', { eventId: 'event-1', teamId: 'equipe-ouverte' });
});

// --- Ajout du chef (17/11, recette 41) : le haut de la fiche dit la vraie règle de validation -----------
// Serveur (admin 0eb46167, lu par le chef du tournoi) : tournoi payant, équipe « pending » validée quand les
// places payées atteignent `paidMembersToValidate` (5 par défaut), quel que soit le mode ; « auto » valide à la
// création.
const ligneValidation = (/** @type {any} */ arbre) => texte(blocTournoi(arbre).findAll((/** @type {any} */ n) => n.type === 'span'
  && texte(n).startsWith('Validation des'))[0]);
const tournoiRegle = (/** @type {any} */ tournamentConfig) => tournoiAutonome({ tournamentConfig });

test('🔴 T-F3 validation — payant en « manual » : « Équipe validée au 5ᵉ joueur payé » (seuil lu, sinon 5)', () => {
  expect(ligneValidation(monter(tournoiRegle({ entryFeeCents: 2000, registrationMode: 'manual' }))))
    .toContain('Équipe validée au 5ᵉ joueur payé');
  act(() => mounted.unmount());
  mounted = null;
  expect(ligneValidation(monter(tournoiRegle({ entryFeeCents: 2000, paidMembersToValidate: 6, registrationMode: 'manual' }))))
    .toContain('Équipe validée au 6ᵉ joueur payé');
});

test('T-F3 validation caractérisant — gratuit en « manual » : « Manuelle » ; « auto », même payant : « Automatique »', () => {
  expect(ligneValidation(monter(tournoiRegle({ registrationMode: 'manual' })))).toContain('Manuelle');
  act(() => mounted.unmount());
  mounted = null;
  expect(ligneValidation(monter(tournoiRegle({ entryFeeCents: 2000, registrationMode: 'auto' })))).toContain('Automatique');
});

// ==========================================================================
// T-PARCOURS-2 (17/11, recette 42) — restes de T-FINITIONS-3 sur la fiche du SITE.
// ==========================================================================
const pastilles = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => n.type === 'span' && n.props?.style?.borderRadius === 999)
  .map(texte);
const PAYANT = { entryFeeCents: 2000, registrationMode: 'manual' };

test('🔴 T-PARCOURS2 (9) — tournoi payant : la pastille dit la règle du 5ᵉ joueur payé', () => {
  const arbre = monter(tournoiAutonome({ tournamentConfig: PAYANT, validationMode: 'manual' }));
  expect(pastilles(arbre)).toContain('Équipe validée au 5ᵉ joueur payé');
  expect(pastilles(arbre)).not.toContain('Validation manuelle');
});

test('T-PARCOURS2 (9) caractérisant — tournoi gratuit, ou match : « Validation manuelle »', () => {
  const gratuit = monter(tournoiAutonome({
    tournamentConfig: { registrationMode: 'manual' }, validationMode: 'manual',
  }));
  expect(pastilles(gratuit)).toContain('Validation manuelle');
  act(() => mounted.unmount());
  mounted = null;
  const match = monter({ ...MATCH_EQUIPE, validationMode: 'manual' });
  expect(pastilles(match)).toContain('Validation manuelle');
});

// T-PARCOURS-2 (point 7) — « Prix / personne » d'un TOURNOI : le montant encaissé
// (tournamentConfig.entryFeeCents, la règle du téléphone), jamais event.pricePerPerson.
test('🔴 T-PARCOURS2 (7) — tournoi payant : « 20 € par joueur », pas le prix saisi', () => {
  const arbre = monter(tournoiAutonome({ pricePerPerson: 35, tournamentConfig: PAYANT }));
  expect(texte(arbre.root)).toContain('20 € par joueur');
  expect(texte(arbre.root)).not.toContain('35 EUR');
});

test('🔴 T-PARCOURS2 (7) — tournoi sans prix encaissé : « Gratuit ou non défini »', () => {
  const arbre = monter(tournoiAutonome({
    pricePerPerson: 35, tournamentConfig: { registrationMode: 'manual' },
  }));
  expect(texte(arbre.root)).toContain('Gratuit ou non défini');
  expect(texte(arbre.root)).not.toContain('35 EUR');
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

test('🔴 T-PARCOURS2 (10) — joueur sur un tournoi : la colonne vide n est pas affichée', () => {
  const colonne = colonnePrincipale(monter(tournoiAutonome()).toJSON());
  expect(colonne.children).toBeNull();
  expect(colonne.props.style.display).toBe('none');
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
  expect(boutons).toContain('Inscrire mon équipe');
  expect(boutons).not.toContain('Voir mon équipe');
=======
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
  const compteurs = blocTournoi(arbre).findAll((/** @type {any} */ n) => n.type === 'div'
    && n.props.style?.flexWrap === 'wrap' && texte(n).includes('en attente'))[0];
  expect(compteurs.props.style.display).toBe('none');
});

test('🔴 T-REJ visiteur — 8 inscrites sur 24 (30 %, arrondi au supérieur) : « 8 équipes inscrites sur 24 » ; sans capacité : aucune ligne', () => {
  expect(ligneVisiteur(monter(tournoiPublic({ expectedCount: 24, registeredCount: 8 }), VISITEUR)))
    .toEqual(['8 équipes inscrites sur 24']);
  act(() => mounted.unmount());
  mounted = null;
  const sansCapacite = monter(TOURNOI_19_12({ tournamentTeams: undefined, tournamentTeamsSummary: { expectedCount: null, registeredCount: 5 } }), VISITEUR);
  expect(ligneVisiteur(sansCapacite)).toEqual([]);
  expect(texte(blocTournoi(sansCapacite))).not.toContain('encore inscrite');
});

test('T-REJ visiteur caractérisant — un compte connecté garde ses compteurs et « Aucune équipe n est encore inscrite »', () => {
  const arbre = monter(TOURNOI_19_12({ tournamentTeamsSummary: { expectedCount: 24, registeredCount: 0 } }), compteNeLe('2008-01-01'));
  expect(ligneVisiteur(arbre)).toEqual([]);
  expect(texte(blocTournoi(arbre))).toContain('encore inscrite');
});

test('🔴 T-REJ joueur seul — « Rejoindre une équipe » pour un compte de 18 ans sans équipe ; ni pour le visiteur, ni pour le compte de 15 ans', () => {
  const arbre = monter(TOURNOI_19_12({ tournamentTeams: [EQUIPE_OUVERTE] }), compteNeLe('2008-01-01'));
  expect(panneauRejoindre(arbre)).toBe(1);
  expect(texte(blocMonStatut(arbre))).toContain('Rejoindre une équipe');
  act(() => mounted.unmount());
  mounted = null;
  expect(panneauRejoindre(monter(TOURNOI_19_12({ tournamentTeams: [EQUIPE_OUVERTE] }), VISITEUR))).toBe(0);
  act(() => mounted.unmount());
  mounted = null;
  expect(panneauRejoindre(monter(TOURNOI_19_12({ tournamentTeams: [EQUIPE_OUVERTE] }), compteNeLe('2011-06-01')))).toBe(0);
});
