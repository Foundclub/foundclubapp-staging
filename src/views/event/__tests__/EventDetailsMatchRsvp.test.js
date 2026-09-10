import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
// L4-B : partage, pour pouvoir relire le `headerRight` que l ecran y depose.
const mockSetOptions = jest.fn();
const mockEventQuery = { data: null };
const mockCampaignsQuery = { data: { data: [] }, isLoading: false };
const mockMatchStatsQuery = { data: null, isFetching: false };
const mockRouteParams = { params: { eventId: 'event-1' } };
// AC10 : l heure du SERVEUR, pilotable temoin par temoin.
const mockAttendanceQuery = { serverNow: /** @type {string | null} */ (null) };

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
    // R5 : depuis le prechargement au toucher de « Modifier », l ecran appelle
    // aussi `prefetchQuery`. La doublure doit suivre la surface du vrai client.
    prefetchQuery: jest.fn(),
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
  // AC10 : depuis que « le match est fini » se decide sur l horloge du SERVEUR
  // et non sur celle du telephone, l ecran a besoin qu on la lui donne. Sans
  // elle il repond « pas fini », par securite. Le defaut est l heure courante :
  // les evenements dates 2020 restent passes, ceux dates 2099 restent a venir,
  // et chaque temoin ecrit avant AC10 garde exactement le sens qu il avait.
  useGetEventAttendance: () => ({
    ...emptyQuery(),
    data: mockAttendanceQuery.serverNow
      ? { data: { serverNow: mockAttendanceQuery.serverNow } }
      : null,
  }),
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
jest.mock(
  '../components/EventParticipants',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventParticipants'),
);
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

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Entrainement du mardi',
  participations: [],
  startTime: '10:00',
  team: { club: { documentId: CLUB_ID }, documentId: TEAM_ID, name: 'U15' },
  type: { name: 'Entrainement' },
  ...overrides,
});

const defaultAuth = (/** @type {any} */ overrides = {}) => ({
  canEditClub: () => false,
  canEditEvent: () => false,
  canManageEvent: () => false,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { documentId: 'user-1', role: { name: 'Joueur' } },
  ...overrides,
});

/** @type {any} */
let mounted = null;

// UN SEUL ARBRE VIVANT A LA FOIS, et ce n'est pas du confort.
// `EventDetails` arme au montage une tache `InteractionManager.runAfterInteractions`
// (EventDetails.js:736) qui rallume les requetes secondaires. L'ecran l'annule
// proprement en se demontant (`return () => task.cancel?.()`, l. 743) — mais un
// arbre ABANDONNE ne se demonte jamais, donc sa tache tire APRES la fin de la
// suite : l'ecran se re-rend sur un environnement Jest deja demoli, les getters
// paresseux de `react-native/index.js` levent « import after teardown », et jest
// sort en 1 alors que les 38 temoins sont verts. Deux temoins montent plusieurs
// arbres (le comparatif avec/sans menu, et la boucle 0/1/50 participants) :
// c'est ici, dans le helper partage, que l'arbre precedent est rendu.
const unmountScreen = () => {
  if (!mounted) return;
  act(() => {
    mounted.unmount();
  });
  mounted = null;
};

// `hasRouteInNavigationTree` remonte l'arbre par `getState().routeNames` : sans
// ces deux methodes, l'ecran conclut a raison que la route n'existe pas, et le
// point d'entree vers l'affiche ne s'affiche pas. La doublure declare donc la
// pile evenement telle qu'elle est enregistree dans `EventStack.js`.
const buildNavigation = (/** @type {Array<string>} */ routeNames) => ({
  addListener: () => () => {},
  getParent: () => undefined,
  getState: () => ({ routeNames }),
  goBack: jest.fn(),
  navigate: mockNavigate,
  setOptions: mockSetOptions,
});

const EVENT_STACK_ROUTES = [
  'EventDetails',
  'EventEdit',
  'EventPublishedShowcase',
  'TournamentSettingsEdit',
  // D99 : la vraie pile enregistre aussi le tunnel de creation
  // (`EventStack.js:169`, `name={RouteNames.EventWizardType}`). Sans lui ici, la
  // doublure etait PLUS PAUVRE que le reel : l'aiguillage vers la detection s'y
  // taisait a raison, et le temoin lisait ce silence comme un bouton manquant.
  'EventWizardType',
];

const mountScreen = (/** @type {any} */ {
  auth, campaigns, event, matchStats, params, routeNames, serverNow,
} = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockAttendanceQuery.serverNow = serverNow === undefined ? new Date().toISOString() : serverNow;
  mockCampaignsQuery.data = { data: campaigns || [] };
  mockCampaignsQuery.isLoading = false;
  mockMatchStatsQuery.data = matchStats || null;
  mockMatchStatsQuery.isFetching = false;
  mockRouteParams.params = { eventId: 'event-1', ...(params || {}) };
  mockUseAuth.mockReturnValue(defaultAuth(auth));

  unmountScreen();

  act(() => {
    mounted = renderer.create(
      <EventDetails
        navigation={buildNavigation(routeNames || EVENT_STACK_ROUTES)}
        route={mockRouteParams}
      />,
    );
  });

  return mounted.root;
};
// AVIS (09/09) - EventDetails lit desormais les avis d entrainement. Sans ce
// double, l import tire `@/services/client`, qui JETTE sans `.env` et fait
// tomber la suite ENTIERE avant le premier temoin.
jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetTrainingReviews: () => ({ data: null }),
}));

// ---------------------------------------------------------------------------
// LOT MATCHRSVP (E6) — L ECRAN ET LES VRAIS BOUTONS, ENSEMBLE.
//
// 🕳️ LE TROU DE MESURE QUE CE FICHIER FERME. Deux bancs existaient, et aucun
// ne voyait ce defaut :
//   · `EventDetailsBottomActions.test.js` monte l ecran mais DOUBLE
//     `EventAnswerButtons` : il sait dire « le composant est monte », jamais
//     « les boutons sont dedans ».
//   · `EventAnswerButtons*.test.js` monte le composant SEUL : il ne recoit
//     jamais les props que l ecran calcule (`participationFlow`,
//     `hasAcceptedRequest`, `hasPendingRequest`).
// ⇒ Ce fichier monte L ECRAN avec le VRAI composant, et compare un MATCH a un
//   ENTRAINEMENT toutes choses egales par ailleurs.
//
// Constat d Adel au banc du 2026-09-05 (defaut n° 16) : « sur un MATCH, les
// boutons Present·e / Absent·e n existent pas ; ils sont la sur l entrainement ».
// Decision d Adel du 2026-09-10 : ce n est PAS voulu.
// ---------------------------------------------------------------------------

const PLAYER_ID = 'user-1';

/**
 * Tous les textes rendus, aplatis. La doublure de `Button` rend son titre dans
 * un `Text` : les libelles des boutons sont donc dedans.
 * @param {any} root La racine de l arbre monte.
 * @returns {string[]} Les textes.
 */
const tousLesTextes = (root) => root
  .findAllByType(Text)
  .flatMap((/** @type {any} */ node) => {
    const children = Array.isArray(node.props.children)
      ? node.props.children
      : [node.props.children];
    return children.filter((/** @type {any} */ child) => typeof child === 'string');
  });

/**
 * La rangee de reponse telle qu un joueur la voit : les DEUX libelles.
 * @param {any} root La racine de l arbre monte.
 * @returns {boolean} Vrai si Present ET Absent sont proposes.
 */
const aLaRangeeDeReponse = (root) => {
  const textes = tousLesTextes(root);
  return textes.includes('eventList.actions.present')
    && textes.includes('eventList.actions.absent');
};

/**
 * L equipe conviee, telle que le serveur la rend sur la fiche.
 * @returns {any} L equipe.
 */
const equipeConviee = () => ({
  club: { documentId: CLUB_ID },
  documentId: TEAM_ID,
  name: 'U15',
  players: [{ documentId: PLAYER_ID }],
  trainers: [{ documentId: 'user-coach' }],
});

/**
 * Le joueur convie : il est dans `players` de l equipe, et son profil porte
 * l equipe (le repli des listes).
 * @returns {any} L auth du joueur.
 */
const joueurConvie = () => ({
  userData: {
    documentId: PLAYER_ID,
    myTeams: [{ documentId: TEAM_ID }],
    role: { name: 'Joueur' },
  },
});

/**
 * L ENTRAINEMENT tel que l app le cree : seance privee (`closed`).
 * @param {any} [overrides] Surcharges.
 * @returns {any} L evenement.
 */
const entrainement = (overrides = {}) => buildEvent({
  name: 'Entrainement du mardi',
  sessionStatus: 'closed',
  team: equipeConviee(),
  type: { name: 'Entrainement' },
  ...overrides,
});

/**
 * LE MATCH tel que la base le stocke : `sessionStatus` vaut `open`, le DEFAUT
 * DU SCHEMA (`admin/.../event/schema.json`, `"default": "open"`, `required`).
 * Le tunnel de creation d un match ne propose jamais de le fermer : ce champ ne
 * concerne que les seances.
 * @param {any} [overrides] Surcharges.
 * @returns {any} L evenement.
 */
const matchDeChampionnat = (overrides = {}) => buildEvent({
  name: 'U15 contre Plantaurel',
  sessionStatus: 'open',
  team: equipeConviee(),
  type: { name: 'Match' },
  ...overrides,
});

describe('MATCHRSVP — un joueur convie repond Present / Absent sur un MATCH', () => {
  test('MATCHRSVP/E1 (controle) — ENTRAINEMENT : la rangee de reponse est la', () => {
    const root = mountScreen({ auth: joueurConvie(), event: entrainement() });

    expect(aLaRangeeDeReponse(root)).toBe(true);
  });

  test('MATCHRSVP/E2 — MATCH : le meme joueur, la meme equipe, la meme rangee', () => {
    const root = mountScreen({ auth: joueurConvie(), event: matchDeChampionnat() });

    expect(aLaRangeeDeReponse(root)).toBe(true);
  });

  test('MATCHRSVP/E3 — MATCH AMICAL : la rangee de reponse est la aussi', () => {
    const root = mountScreen({
      auth: joueurConvie(),
      event: matchDeChampionnat({ type: { name: 'Match amical' } }),
    });

    expect(aLaRangeeDeReponse(root)).toBe(true);
  });

  test('MATCHRSVP/E4 — MATCH : jamais un bouton MUET a la place de la rangee', () => {
    const root = mountScreen({ auth: joueurConvie(), event: matchDeChampionnat() });
    const textes = tousLesTextes(root);

    // Le « Participer » solitaire est la signature du defaut : c est la branche
    // de repli, celle des gens EXTERIEURS a l evenement.
    expect(textes).not.toContain('eventList.actions.join');
    expect(textes).not.toContain('Accès réservé');
  });
});

// ---------------------------------------------------------------------------
// LE SEUL ENDROIT DE L APP OU LES BOUTONS N EXISTENT PAS — nomme, et fige.
//
// `EventDetails.js:7625` rend `{canAnswerWhileManaging ? eventAnswerButtonsNode : null}`,
// avec `canAnswerWhileManaging = !canEdit || isConvenedTeamMember` (l.7619).
// ⇒ Un ORGANISATEUR (`canEdit`) qui n est membre d AUCUNE equipe conviee ne
// recoit pas le composant du tout : pas un bouton eteint, pas une phrase, RIEN.
//
// C est la seule configuration du depot qui produit litteralement « les boutons
// n existent pas », et elle est VOULUE : le commentaire de l ecran (l.7616-7618)
// la justifie — sans equipe source, le serveur refuserait sa reponse
// (`event-audience.ts:809`, mesure `MATCHRSVP/S4`). Le temoin W01 n° 3
// (`EventDetailsBottomActions.test.js:863`) la fige deja sur un entrainement.
//
// 🎯 CE QUE CES DEUX TEMOINS AJOUTENT : ils prouvent que le MATCH et
// l ENTRAINEMENT se comportent IDENTIQUEMENT dans cette configuration. Le type
// d evenement n y entre pour rien — ce qui decide, c est l appartenance.
// ---------------------------------------------------------------------------

const organisateurNonMembre = () => ({
  canEditClub: () => true,
  canEditEvent: () => true,
  canManageEvent: () => true,
  userData: { documentId: 'user-organisateur', role: { name: 'Entraineur' } },
});

/**
 * Une equipe conviee dont l organisateur ne fait PAS partie.
 * @returns {any} L equipe.
 */
const equipeSansLOrganisateur = () => ({
  club: { documentId: CLUB_ID },
  documentId: TEAM_ID,
  name: 'U15',
  players: [{ documentId: PLAYER_ID }],
  trainers: [{ documentId: 'user-coach' }],
});

describe('MATCHRSVP — l organisateur NON MEMBRE : rien, et pareil des deux cotes', () => {
  test('MATCHRSVP/E5 — MATCH : aucun bouton de reponse, et aucune phrase non plus', () => {
    const root = mountScreen({
      auth: organisateurNonMembre(),
      event: matchDeChampionnat({ team: equipeSansLOrganisateur() }),
    });

    expect(aLaRangeeDeReponse(root)).toBe(false);
    expect(tousLesTextes(root)).not.toContain('eventList.info.staffDoesNotRsvp');
  });

  test('MATCHRSVP/E6 — ENTRAINEMENT : le meme ecran, le type n y entre pour rien', () => {
    const root = mountScreen({
      auth: organisateurNonMembre(),
      event: entrainement({ team: equipeSansLOrganisateur() }),
    });

    expect(aLaRangeeDeReponse(root)).toBe(false);
    expect(tousLesTextes(root)).not.toContain('eventList.info.staffDoesNotRsvp');
  });
});

// ---------------------------------------------------------------------------
// E7 & E8 🎯 — LA CAUSE, VUE DEPUIS LA FICHE (le chemin d Adel).
//
// Le correctif vit dans `participationFlow.js` (`getTeamBuckets` lit desormais
// `teamAudiences`, comme le serveur). Ces deux temoins verifient la CHAINE
// ENTIERE de la fiche, que le temoin de composant ne traverse pas : c est
// `EventDetails` qui calcule `isConvenedTeamMember` (l.2115) et le
// `participationFlow` (l.2104) qu il passe au composant. Un correctif qui
// marcherait au composant et pas ici ne servirait a rien.
// ---------------------------------------------------------------------------

/**
 * LE MATCH QUI CONVIE PAR LE SEUL NOUVEAU REGISTRE : `event.team` est l equipe
 * d en face, celle du joueur n arrive que par `teamAudiences`.
 * @returns {any} L evenement.
 */
const matchConvieParAudienceSeule = () => matchDeChampionnat({
  invitedTeams: [],
  team: { club: { documentId: CLUB_ID }, documentId: 'team-adverse', name: 'US Adverse' },
  teamAudiences: [{
    audienceKind: 'home_team',
    documentId: 'audience-1',
    selectionMode: 'ALL_MEMBERS',
    status: 'ACCEPTED',
    team: equipeConviee(),
  }],
  viewerCanRespond: true,
});

describe('MATCHRSVP — la fiche d un match convie par `teamAudiences`', () => {
  test('MATCHRSVP/E7 🎯 — le joueur convie y retrouve Present et Absent', () => {
    const root = mountScreen({ auth: joueurConvie(), event: matchConvieParAudienceSeule() });

    expect(aLaRangeeDeReponse(root)).toBe(true);
  });

  test('MATCHRSVP/E8 🔒 — et jamais « Participer », le chemin des exterieurs', () => {
    const root = mountScreen({ auth: joueurConvie(), event: matchConvieParAudienceSeule() });

    // ⚠️ Le libelle du repli est une CHAINE EN DUR cote `participationFlow`
    // (`actionLabel: 'Participer'`), pas une clef : chercher la clef ne mord
    // sur rien. C est le mot affiche qu il faut interdire.
    expect(tousLesTextes(root)).not.toContain('Participer');
  });
});
