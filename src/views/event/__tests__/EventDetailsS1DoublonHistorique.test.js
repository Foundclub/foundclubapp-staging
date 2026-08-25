import renderer, { act } from 'react-test-renderer';

// LOT S1 (E6) — LE FILET DU MEMO QUI FABRIQUE LES SECTIONS DE PARTICIPANTS.
//
// 📸 LE CONSTAT D ADEL (recette 2.6.27, 25/08, 12h33) : un joueur qui passe de
// « a dit present » a « absent » apparait DEUX FOIS — dans les absents, ET dans
// une section « Historique equipe retiree » qui surgit avec son ancien pointage
// « Arrive ».
//
// 🔬 LE SERVEUR EST SAIN (verifie le 25/08) : `declareMissing` DESACTIVE
// l ancienne reponse puis cree l absence. C est l affichage qui range les deux.
// Le memo qui fabrique `teamParticipationSections` verse TOUTE participation
// inactive dans l historique, sans jamais regarder s il existe une reponse
// ACTIVE a cote. La ligne « present » archivee y tombe donc, pendant que la
// nouvelle ligne « absent » peuple les absents.
//
// 🪢 LA COUTURE TESTEE, et c est la meme que celle du filet AA02 : les PROPS
// reellement remises a `EventParticipants`. C est la liste que l ECRAN a decide
// d afficher — pas ce que le serveur envoie, pas ce que l enfant en fait. Le
// harnais de mocks ci-dessous est celui d `EventDetailsComptesSupprimes.test.js`,
// recopie (motif documente : AD06 recopie celui d AC07).
//
// ⚠️ LE TEMOIN QUI COMPTE EST LE JUMEAU (S1/3) : le VRAI historique — celui de
// quelqu un qui n a AUCUNE reponse active — doit CONTINUER de s afficher.
// Faire disparaitre l historique serait pire que le doublon de depart.

const mockUseAuth = jest.fn();
// Le nom commence par `mock` : c'est la SEULE forme qu'une fabrique `jest.mock`
// (remontee en tete de fichier) a le droit de refermer sur une variable exterieure.
const mockParticipantsProps = { value: null };
const mockNavigate = jest.fn();
const mockEventQuery = { data: null };
const mockCampaignsQuery = { data: { data: [] }, isLoading: false };
const mockMatchStatsQuery = { data: null, isFetching: false };
const mockRouteParams = { params: { eventId: 'event-1' } };

// 🧨 R9 — CE MOCK N EST PAS DECORATIF. `teamMembershipRequestService`
// importe `@/services/client`, qui JETTE AU CHARGEMENT quand `.env` est absent
// — et `.env` est gitignore, donc absent de toute copie de travail. Sans cette
// doublure, la SUITE ENTIERE tombe a 0 test execute des que l ecran importe le
// service (piege documente, deja paye plusieurs fois).
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  inviteToTeam: () => Promise.resolve(null),
  resolveTeamInvitationAvailability: () => ({
    candidateId: '',
    canInvite: false,
    reason: 'missing-team',
  }),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

// Le theme est monte avec les VRAIS modules : un Proxy rend les echecs Jest
// illisibles (piege paye au lot paywall). Seul Images est stube.
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

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
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

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { config: jest.fn(), fs: { dirs: {} } },
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ sendMessage: jest.fn() }),
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
  useGetEventAttendance: () => emptyQuery(),
  useGetEventConvocation: () => emptyQuery(),
  useGetEventTeamComposition: () => emptyQuery(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseCampaigns: () => ({
    ...emptyQuery(),
    data: mockCampaignsQuery.data,
    isLoading: mockCampaignsQuery.isLoading,
  }),
}));

// D71 : pilotable, sur le MEME motif que les campagnes ci-dessus. Sans lui, un
// match n'a jamais de score ni de droit de saisie, et la chip « stats du match »
// ne se verifierait que dans son etat grise.
// 🏆 N7 item 5 (vague P, 23/08) — le fil du tournoi lit `useGetTournamentDashboard`,
// qui tire `@/services/client`. Sans cette doublure MUETTE, la suite entiere
// tombe a 0 test (piege connu : un import de service de plus). `data: undefined`
// = le calcul de repli de la page, identique a ce que ces temoins decrivaient.
jest.mock('@/services/tournamentCompetition/tournamentCompetitionQueries', () => ({
  useGetTournamentDashboard: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => ({
    ...emptyQuery(),
    data: mockMatchStatsQuery.data,
    isFetching: mockMatchStatsQuery.isFetching,
  }),
  useGetEventMyMatchResponse: () => emptyQuery(),
}));

jest.mock('@/services/event/eventService', () => ({
  approveFeatured: jest.fn(),
  exportEventParticipants: jest.fn(),
  rejectFeatured: jest.fn(),
}));

jest.mock('@/services/recruitment/recruitmentService', () => ({
  applyToRecruitmentAd: jest.fn(),
}));

jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  createCustomTournamentTeam: jest.fn(),
  registerClubTeamToTournament: jest.fn(),
  requestJoinTournamentTeam: jest.fn(),
  respondToTournamentTeam: jest.fn(),
  reviewTournamentTeamRegistration: jest.fn(),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

jest.mock('@/platform/share', () => ({
  __esModule: true,
  default: { share: jest.fn() },
}));

jest.mock('@/utils/performance/eventDetailsPerformance', () => ({
  markEventDetailsPerf: jest.fn(),
}));

// La liste est ecrite EN ENTIER, jamais derriere un Proxy : une doublure de
// contexte non figee rend l'identite des mutations differente a chaque rendu et
// fait boucler Jest sans aucun message (piege paye au lot paywall).
jest.mock('../hooks/useEventMutations', () => {
  const idleMutation = () => ({ isPending: false, mutate: jest.fn() });
  return {
    useEventMutations: () => ({
      acceptParticipationMutation: idleMutation(),
      bookFullMutation: idleMutation(),
      cancelEventMutation: idleMutation(),
      coachArrivalMutation: idleMutation(),
      createEventParticipationMutation: idleMutation(),
      declineParticipationMutation: idleMutation(),
      deleteParticipationMutation: idleMutation(),
      joinReservationMutation: idleMutation(),
      missingEventMutation: idleMutation(),
      openForPlayersMutation: idleMutation(),
      remindEventMutation: idleMutation(),
      reportEventMutation: idleMutation(),
      requestFeaturedMutation: idleMutation(),
      resetAttendanceMutation: idleMutation(),
      respondToEventRsvpMutation: idleMutation(),
      selfArrivalMutation: idleMutation(),
      selfLateMutation: idleMutation(),
      sosAlertMutation: idleMutation(),
      updateEventMutation: idleMutation(),
      updateEventNoNavMutation: idleMutation(),
      updateLateMinutesMutation: idleMutation(),
    }),
  };
});

// La doublure de Button rend un VRAI pressable portant son titre : sans ca, un
// bouton de page et une chip du menu ne se pilotent pas de la meme facon, et la
// couture mourrait pile au moment du deplacement.
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityLabel: props.accessibilityLabel,
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled || props.isLoading),
        onPress: props.onPress,
      },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function WithDataWrapperDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BottomModalDouble(/** @type {any} */ props) {
    if (!props.isVisible && !props.visible) return null;
    return react.createElement(rn.View, null, props.children);
  };
});

/* eslint-disable global-require */
jest.mock(
  '@/components/molecules/eventAnswerButtons/EventAnswerButtons',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventAnswerButtons'),
);
jest.mock(
  '@/components/organisms/joinEventModal/JoinEventModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_JoinEventModal'),
);
jest.mock(
  '@/components/organisms/refuseParticipationModal/RefuseParticipationModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_RefuseParticipationModal'),
);
jest.mock(
  '@/components/organisms/reportEventModal/ReportEventModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_ReportEventModal'),
);
jest.mock(
  '@/components/organisms/shareEventModal/ShareEventModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_ShareEventModal'),
);
jest.mock(
  '../components/EventHeader',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventHeader'),
);
jest.mock('../components/EventParticipants', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function EventParticipantsCapture(/** @type {any} */ props) {
    mockParticipantsProps.value = props;
    return react.createElement(rn.Text, null, 'DOUBLURE_EventParticipants');
  };
});
jest.mock(
  '../components/EventDetectionSlots',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventDetectionSlots'),
);
jest.mock(
  '../components/EventTasksSection',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTasksSection'),
);
jest.mock(
  '../components/EventTeamAudiencesSection',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTeamAudiencesSection'),
);
jest.mock(
  '../components/EventReservationActions',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventReservationActions'),
);
/* eslint-enable global-require */


// 🎛️ L4-A — LA DOUBLURE DES ONGLETS, ET ELLE N'EST PAS FACULTATIVE.
// `SegmentedControl` importe `react-native-gesture-handler`, dont
// `lib/commonjs/specs/NativeRNGestureHandlerModule.ts` n'est PAS couvert par le
// `transformIgnorePatterns` du depot : sans doublure, la SUITE ENTIERE meurt au
// chargement (« Cannot use import statement outside a module ») et AUCUN test
// ne s'execute. C'est pour ca que les 16 autres appelants du composant le
// doublent aussi (motif ClubDetails.deuxPortes.test.js:299).
// La doublure rend un pressable par onglet, portant son libelle : le dessin est
// verifie chez le composant (201 lignes de test), ce qui se verifie ici c'est
// CE QU'ON LUI DONNE et CE QU'IL COMMANDE.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function SegmentedControlDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.View,
      { testID: 'doublure-onglets' },
      (props.options || []).map((/** @type {any} */ option) => react.createElement(
        rn.TouchableOpacity,
        {
          key: option.value,
          onPress: () => props.onChange(option.value),
          testID: `onglet-${option.value}`,
        },
        react.createElement(rn.Text, null, option.label),
      )),
    );
  };
});

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';

/**
 * Un membre de test, dans la forme que le serveur rend.
 * @param {string} id - Identifiant de document.
 * @param {string} firstname - Prenom affiche.
 * @returns {any} L'utilisateur de test.
 */
const membre = (id, firstname) => ({
  blocked: false,
  documentId: id,
  email: `${id}@exemple.fr`,
  firstname,
  id: Number(id.replace(/\D/g, '')) || 1,
  lastname: 'Test',
  username: `${id}_test`,
});

const COACH = membre('user-11', 'Coach');
// 🎯 LE JOUEUR DU SCREENSHOT : il avait dit present, il vient de se declarer
// absent. Le serveur a donc DESACTIVE sa ligne « accepted » et cree l absence.
const BASCULEUR = membre('user-21', 'Alice');
// 🔒 LE JUMEAU : meme vieille ligne archivee, mais AUCUNE reponse active. Son
// historique est un vrai historique, il doit rester affiche.
const HISTORIQUE_PUR = membre('user-22', 'Bruno');
const SILENCIEUX = membre('user-23', 'Chloe');
// Les memes deux cas, mais venus du DEHORS (aucune equipe source).
const EXTERNE_BASCULEUR = membre('user-31', 'Dalia');
const EXTERNE_HISTORIQUE = membre('user-32', 'Enzo');

/**
 * Une ligne de participation ARCHIVEE (`isActive: false`), telle que le serveur
 * la laisse derriere lui apres une bascule ou un retrait d equipe.
 * @param {string} documentId - Identifiant de la ligne.
 * @param {any} user - L'utilisateur porte par la ligne.
 * @param {any} [sourceTeam] - L'equipe source, quand il y en a une.
 * @returns {any} La ligne archivee.
 */
const ligneArchivee = (documentId, user, sourceTeam = null) => ({
  documentId,
  isActive: false,
  participationStatus: 'accepted',
  sourceTeam,
  updatedAt: '2026-08-25T10:00:00.000Z',
  user,
});

const EQUIPE_SOURCE = { documentId: TEAM_ID, name: 'U15' };

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  // La reponse ACTIVE du basculeur : il est absent, et lui seul.
  missings: [BASCULEUR, EXTERNE_BASCULEUR],
  name: 'Entrainement du mardi',
  participationRequests: [
    ligneArchivee('archive-basculeur', BASCULEUR, EQUIPE_SOURCE),
    ligneArchivee('archive-historique', HISTORIQUE_PUR, EQUIPE_SOURCE),
    ligneArchivee('archive-externe-basculeur', EXTERNE_BASCULEUR),
    ligneArchivee('archive-externe-historique', EXTERNE_HISTORIQUE),
  ],
  participations: [],
  startTime: '10:00',
  team: {
    club: { documentId: CLUB_ID },
    documentId: TEAM_ID,
    name: 'U15',
    players: [BASCULEUR, HISTORIQUE_PUR, SILENCIEUX],
    trainers: [COACH],
  },
  type: { name: 'Entrainement' },
  ...overrides,
});

const defaultAuth = (/** @type {any} */ overrides = {}) => ({
  canEditClub: () => false,
  canEditEvent: () => true,
  canManageEvent: () => true,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { documentId: COACH.documentId, id: COACH.id, role: { name: 'Entraineur' } },
  ...overrides,
});

/** @type {any} */
let mounted = null;

// UN SEUL ARBRE VIVANT A LA FOIS : `EventDetails` arme au montage une tache
// `InteractionManager.runAfterInteractions` qu'il n'annule qu'en se demontant.
// Un arbre abandonne tire APRES la fin de la suite et fait sortir jest en 1
// alors que tous les temoins sont verts (piege paye au lot D21).
const unmountScreen = () => {
  if (!mounted) return;
  act(() => {
    mounted.unmount();
  });
  mounted = null;
};

const EVENT_STACK_ROUTES = [
  'EventDetails',
  'EventEdit',
  'EventPublishedShowcase',
  'TournamentSettingsEdit',
  'EventWizardType',
];

const buildNavigation = () => ({
  addListener: () => () => {},
  getParent: () => undefined,
  getState: () => ({ routeNames: EVENT_STACK_ROUTES }),
  goBack: jest.fn(),
  navigate: mockNavigate,
  setOptions: jest.fn(),
});

const mountScreen = (/** @type {any} */ { auth, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockCampaignsQuery.data = { data: [] };
  mockCampaignsQuery.isLoading = false;
  mockMatchStatsQuery.data = null;
  mockMatchStatsQuery.isFetching = false;
  mockRouteParams.params = { eventId: 'event-1' };
  mockUseAuth.mockReturnValue(defaultAuth(auth));

  unmountScreen();
  mockParticipantsProps.value = null;

  act(() => {
    mounted = renderer.create(
      <EventDetails navigation={buildNavigation()} route={mockRouteParams} />,
    );
  });

  return mockParticipantsProps.value;
};

const keysOf = (/** @type {any[]} */ users = []) => (users || []).map((user) => user?.documentId);

/**
 * Toutes les sections que l'ecran remet a l'affichage, equipes ET externes.
 * @param {any} props - Les props capturees.
 * @returns {any[]} Les sections.
 */
const toutesLesSections = (props) => [
  ...(props?.teamParticipationSections || []),
  ...(props?.externalParticipationSection ? [props.externalParticipationSection] : []),
];

/**
 * Combien de fois une personne apparait, TOUTES listes confondues.
 *
 * 🎯 C'est l'invariant du lot : `uniqueUsers` dedoublonne DANS une liste, jamais
 * ENTRE deux. Un compteur global est le seul temoin qui voit le doublon.
 * @param {any} props - Les props capturees.
 * @param {string} documentId - La personne cherchee.
 * @returns {number} Le nombre d'apparitions.
 */
const compterApparitions = (props, documentId) => toutesLesSections(props).reduce(
  (total, section) => {
    const historique = section?.historical || {};
    const listes = [
      section?.participating,
      section?.missing,
      section?.notAnswered,
      historique.participating,
      historique.missing,
    ];
    const dansLesListes = listes.reduce(
      (compte, liste) => compte + keysOf(liste).filter((key) => key === documentId).length,
      0,
    );
    const dansLesDemandes = [...(section?.pending || []), ...(historique.pending || [])]
      .filter((participation) => participation?.user?.documentId === documentId)
      .length;
    return total + dansLesListes + dansLesDemandes;
  },
  0,
);

const sectionEquipe = (/** @type {any} */ props) => (props?.teamParticipationSections || [])
  .find((/** @type {any} */ section) => section?.key === TEAM_ID);

afterEach(() => {
  unmountScreen();
});

// ---------------------------------------------------------------------------
// S1/1 et S1/2 — LE DOUBLON DU SCREENSHOT.
// ---------------------------------------------------------------------------

test('S1/1 — une reponse ACTIVE efface la vieille ligne archivee de l historique', () => {
  const props = mountScreen();
  const equipe = sectionEquipe(props);

  // Il est absent : c'est sa reponse d'aujourd'hui, et elle reste.
  expect(keysOf(equipe?.missing)).toContain(BASCULEUR.documentId);
  // ⛔ Et il n'est PLUS dans l'historique : sa ligne « present » archivee n'est
  // pas une histoire, c'est la trace de la reponse qu'il vient de changer.
  expect(keysOf(equipe?.historical?.participating)).not.toContain(BASCULEUR.documentId);
});

test('S1/2 — 🎯 L INVARIANT : personne n apparait dans DEUX listes a la fois', () => {
  const props = mountScreen();

  // `uniqueUsers` dedoublonne DANS une liste, jamais ENTRE deux : ce compteur
  // global est le seul qui voie le defaut d Adel.
  expect(compterApparitions(props, BASCULEUR.documentId)).toBe(1);
  expect(compterApparitions(props, EXTERNE_BASCULEUR.documentId)).toBe(1);
  expect(compterApparitions(props, HISTORIQUE_PUR.documentId)).toBe(2);
});

// ---------------------------------------------------------------------------
// S1/3 et S1/4 — LES JUMEAUX VERTS : le VRAI historique ne bouge pas.
// ---------------------------------------------------------------------------

test('S1/3 — 🔒 JUMEAU : sans reponse active, l historique s affiche TOUJOURS', () => {
  const props = mountScreen();
  const equipe = sectionEquipe(props);

  expect(keysOf(equipe?.historical?.participating)).toEqual([HISTORIQUE_PUR.documentId]);
});

test('S1/4 — 🔒 JUMEAU : meme partage du cote des participants EXTERNES', () => {
  const props = mountScreen();
  const externes = props?.externalParticipationSection;

  expect(keysOf(externes?.missing)).toContain(EXTERNE_BASCULEUR.documentId);
  expect(keysOf(externes?.historical?.participating)).toEqual([EXTERNE_HISTORIQUE.documentId]);
});

// ---------------------------------------------------------------------------
// S1/5 et S1/6 — CE QUI NE DOIT PAS BOUGER.
// ---------------------------------------------------------------------------

test('S1/5 — 🔒 ACQUIS : les lignes archivees arrivent toujours jusqu a l ecran', () => {
  // C'est le filtre qui manquait, PAS la donnee : `includeInactive: true` reste.
  // Si un lot futur coupait la donnee a la source, ce temoin tomberait avec.
  const props = mountScreen();

  expect(toutesLesSections(props).some(
    (/** @type {any} */ section) => (section?.historical?.participating || []).length > 0,
  )).toBe(true);
});

test('S1/6 — 🔒 ACQUIS : un membre qui n a jamais repondu reste « sans reponse »', () => {
  const props = mountScreen();
  const equipe = sectionEquipe(props);

  expect(keysOf(equipe?.notAnswered)).toContain(SILENCIEUX.documentId);
  expect(compterApparitions(props, SILENCIEUX.documentId)).toBe(1);
});
