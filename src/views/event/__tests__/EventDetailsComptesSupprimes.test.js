import renderer, { act } from 'react-test-renderer';

// AA02 (E6) — LE FILET DES COMPTES SUPPRIMES.
//
// Le constat d'Adel : « si un utilisateur supprime son compte il doit
// disparaitre de la liste ». Or supprimer son compte ne supprime pas la ligne :
// le serveur RENOMME l'utilisateur en « Utilisateur Supprimé », le bloque et lui
// donne un identifiant tombstone (`deleted_user_<id>_<horodatage>`). La ligne
// reste donc a l'ecran, avec un fantome dedans.
//
// LA COUTURE, celle qui doit valoir des deux cotes : les PROPS reellement
// remises a `EventParticipants`. C'est la liste que l'ECRAN a decide
// d'afficher — pas ce que le serveur a envoye, pas ce que le composant enfant
// sait en faire. La doublure ci-dessous les capture telles quelles.
//
// ⚠️ LE TEMOIN QUI COMPTE EST LE 6 : un joueur BIEN VIVANT n'est jamais masque.
// Masquer un vrai membre serait pire que le defaut de depart.

const mockUseAuth = jest.fn();
// Le nom commence par `mock` : c'est la SEULE forme qu'une fabrique `jest.mock`
// (remontee en tete de fichier) a le droit de refermer sur une variable exterieure.
const mockParticipantsProps = { value: null };
const mockNavigate = jest.fn();
const mockEventQuery = { data: null };
const mockCampaignsQuery = { data: { data: [] }, isLoading: false };
const mockMatchStatsQuery = { data: null, isFetching: false };
const mockRouteParams = { params: { eventId: 'event-1' } };

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

// eslint-disable-next-line import/first
import { isDeletedAccount, withoutDeletedAccounts } from '@/domains/user/deletedAccount';

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';

/**
 * Un vrai membre : ni bloque, ni tombstone.
 * @param {string} id - Identifiant de document.
 * @param {string} firstname - Prenom affiche.
 * @returns {any} L'utilisateur de test.
 */
const vivant = (id, firstname) => ({
  blocked: false,
  documentId: id,
  email: `${id}@exemple.fr`,
  firstname,
  id: Number(id.replace(/\D/g, '')) || 1,
  lastname: 'Vivant',
  username: `${id}_vivant`,
});

/**
 * Un compte supprime, tel que le serveur le laisse VRAIMENT derriere lui
 * (`firebase-auth.ts` : `deleteAccount`) : renomme, bloque, identifiants
 * tombstone. Rien d'invente, la forme est celle des tests serveur
 * `account-deletion-upcoming-events.test.js`.
 * @param {string} id - Identifiant de document.
 * @returns {any} Le compte supprime de test.
 */
const fantome = (id) => ({
  blocked: true,
  documentId: id,
  email: `deleted_user_${id}_1755600000000@deleted.com`,
  firstname: 'Utilisateur',
  id: Number(id.replace(/\D/g, '')) || 90,
  lastname: 'Supprime',
  username: `deleted_user_${id}_1755600000000`,
});

const COACH = vivant('user-11', 'Coach');
const PRESENT = vivant('user-21', 'Alice');
const ABSENT = vivant('user-22', 'Bruno');
const SILENCIEUX = vivant('user-23', 'Chloe');
const EN_ATTENTE = vivant('user-24', 'Dalia');

const FANTOME_PRESENT = fantome('user-91');
const FANTOME_ABSENT = fantome('user-92');
const FANTOME_ATTENTE = fantome('user-93');
const FANTOME_EQUIPE = fantome('user-94');

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  missings: [ABSENT, FANTOME_ABSENT],
  name: 'Entrainement du mardi',
  participationRequests: [
    {
      documentId: 'part-1', isActive: true, participationStatus: 'pending', user: EN_ATTENTE,
    },
    {
      documentId: 'part-2', isActive: true, participationStatus: 'pending', user: FANTOME_ATTENTE,
    },
  ],
  participations: [PRESENT, FANTOME_PRESENT],
  startTime: '10:00',
  team: {
    club: { documentId: CLUB_ID },
    documentId: TEAM_ID,
    name: 'U15',
    players: [PRESENT, ABSENT, SILENCIEUX, EN_ATTENTE, FANTOME_EQUIPE],
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

/**
 * Tous les identifiants d'utilisateur que l'ecran a decide de remettre a
 * l'affichage, ou qu'ils soient caches dans les props.
 * @param {any} value - La valeur a parcourir.
 * @param {Set<string>} [found] - L'accumulateur.
 * @returns {Set<string>} Les `username` rencontres.
 */
const collectUsernames = (value, found = new Set()) => {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectUsernames(entry, found));
    return found;
  }
  if (typeof value.username === 'string') found.add(value.username);
  Object.keys(value).forEach((key) => {
    if (key === 'username') return;
    collectUsernames(value[key], found);
  });
  return found;
};

const affiches = (/** @type {any} */ props) => Array.from(collectUsernames({
  externalParticipationSection: props?.externalParticipationSection,
  participationsByStatus: props?.participationsByStatus,
  pendingParticipations: props?.pendingParticipations,
  teamParticipationSections: props?.teamParticipationSections,
}));

const keysOf = (/** @type {any[]} */ users = []) => (users || []).map((user) => user?.documentId);

afterEach(() => {
  unmountScreen();
});

// ---------------------------------------------------------------------------
// TEMOIN 1 — le principal.
// ---------------------------------------------------------------------------

test('AA02 temoin 1 — une ligne sans personne n apparait dans AUCUNE liste', () => {
  const props = mountScreen();
  const rendus = affiches(props);

  expect(rendus.filter((username) => username.startsWith('deleted_user_'))).toEqual([]);
});

test('AA02 temoin 1 bis — une relation VIDE (user null) ne cree pas de ligne fantome', () => {
  // Le second trou : la ligne a survecu a son utilisateur et pointe vers rien.
  const props = mountScreen({
    event: buildEvent({
      participationRequests: [
        {
          documentId: 'part-vide', isActive: true, participationStatus: 'pending', user: null,
        },
        {
          documentId: 'part-1', isActive: true, participationStatus: 'pending', user: EN_ATTENTE,
        },
      ],
      participations: [PRESENT, null],
    }),
  });

  expect(keysOf(props?.participationsByStatus?.participating)).toEqual([PRESENT.documentId]);
  expect((props?.pendingParticipations || []).map((/** @type {any} */ entry) => entry?.documentId))
    .toEqual(['part-1']);
});

// ---------------------------------------------------------------------------
// TEMOIN 2 — le piege deja paye TROIS fois (lots S01, R02, T05).
// ---------------------------------------------------------------------------

test('AA02 temoin 2 — une ligne sans personne ne fait plus tomber la section entiere', () => {
  const props = mountScreen();

  // La section existe, elle est peuplee, et les vivants y sont tous.
  expect(props?.participationsByStatus).toBeTruthy();
  expect(keysOf(props?.participationsByStatus?.participating)).toContain(PRESENT.documentId);
  expect(keysOf(props?.participationsByStatus?.missing)).toContain(ABSENT.documentId);
  expect((props?.teamParticipationSections || []).length).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// TEMOIN 3 — les compteurs.
// ---------------------------------------------------------------------------

test('AA02 temoin 3 — les compteurs ne comptent plus les disparus', () => {
  const props = mountScreen();

  expect(keysOf(props?.participationsByStatus?.participating)).toEqual([PRESENT.documentId]);
  expect(keysOf(props?.participationsByStatus?.missing)).toEqual([ABSENT.documentId]);
  // « sans reponse » se calcule depuis les joueurs de l equipe : le fantome
  // d equipe ne doit pas y creer une ligne de plus.
  expect(keysOf(props?.participationsByStatus?.notAnswered)).toEqual([SILENCIEUX.documentId]);
  expect(props?.participantsSummary?.participatingCount).toBe(1);
});

// ---------------------------------------------------------------------------
// TEMOIN 6 — LA NON-REGRESSION QUI COMPTE.
// ---------------------------------------------------------------------------

test('AA02 temoin 6 — une personne bien vivante n est JAMAIS masquee par erreur', () => {
  const props = mountScreen();
  const rendus = affiches(props);

  [PRESENT, ABSENT, SILENCIEUX, EN_ATTENTE].forEach((membre) => {
    expect(rendus).toContain(membre.username);
  });
});

test('AA02 temoin 6 bis — le marqueur exige les DEUX signaux, jamais un seul', () => {
  // Un compte BLOQUE par moderation garde un vrai identifiant : ce n est pas
  // une suppression, il reste visible.
  expect(isDeletedAccount({ blocked: true, email: 'jean@exemple.fr', username: 'jean' })).toBe(false);
  // Un identifiant tombstone SANS blocage : on refuse de masquer sur ce seul indice.
  expect(isDeletedAccount({ blocked: false, email: 'x@deleted.com', username: 'deleted_user_1_2' })).toBe(false);
  // Un homonyme litteral qui est un VRAI compte reste affiche : le NOM n est
  // jamais le marqueur.
  expect(isDeletedAccount({
    blocked: false,
    email: 'u.supprime@exemple.fr',
    firstname: 'Utilisateur',
    lastname: 'Supprime',
    username: 'usupprime',
  })).toBe(false);

  expect(isDeletedAccount(FANTOME_PRESENT)).toBe(true);
  expect(withoutDeletedAccounts([PRESENT, FANTOME_PRESENT, null, ABSENT]))
    .toEqual([PRESENT, ABSENT]);
});
