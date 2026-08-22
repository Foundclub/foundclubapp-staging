import {
  Alert, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

// D21 (E6) : `EventDetails.js` fait 5 940 lignes et c'est le plus gros ecran du
// depot. Ce fichier caracterise D'ABORD le BAS DE PAGE tel qu'il est livre,
// PUIS verrouille le lot D21 (cotisation rangee dans le menu, panneau devenu
// flottant, point d'entree vers l'affiche).
//
// LA COUTURE, celle qui doit valoir des DEUX cotes : `bottomActionInventory`.
// Elle rend la liste des actions REELLEMENT atteignables en bas d'ecran, quel
// que soit le chemin (bouton de page avant, chip du menu apres). C'est le seul
// garde-fou contre un bouton devenu invisible sous le bouton flottant.
// Les reperes choisis survivent au raccourcissement des libelles : « cotisation »
// attrape « Preparer la campagne de cotisation » comme « Preparer la cotisation ».
//
// Les constats qui basculent volontairement au lot vivent dans les blocs nommes
// « etat LIVRE avant D21 » et « apres D21 », pour que le diff se voie.

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

// eslint-disable-next-line import/first
import { getEventShowcaseTemplate } from '@/domains/visuals/eventShowcaseTemplate';
// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const PANEL_ID = 'event-manage-panel';
const PANEL_ROW_ID = 'event-manage-panel-row';

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

const textOf = (/** @type {any} */ node) => {
  const parts = [];
  const walk = (/** @type {any} */ child) => {
    if (child === null || child === undefined || child === false) return;
    if (typeof child === 'string' || typeof child === 'number') {
      parts.push(String(child));
      return;
    }
    const children = child?.props?.children;
    if (Array.isArray(children)) children.forEach(walk);
    else walk(children);
  };
  walk(node);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

const visibleTexts = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node))
  .filter(Boolean);

const hasText = (/** @type {any} */ root, /** @type {string} */ label) => visibleTexts(root)
  .some((/** @type {string} */ value) => value.includes(label));

const pressableWithText = (/** @type {any} */ root, /** @type {string} */ label) => root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ node) => textOf(node).includes(label));

const press = (/** @type {any} */ root, /** @type {string} */ label) => {
  const node = pressableWithText(root, label);
  if (!node) throw new Error(`Aucun pressable ne porte le libelle « ${label} »`);
  act(() => {
    node.props.onPress();
  });
};


/**
 * LA COUTURE. Toutes les actions du bas d'ecran REELLEMENT atteignables, quel
 * que soit leur chemin : bouton de page (avant D21) ou chip du menu (apres).
 * Deplier le menu fait partie du chemin, des deux cotes.
 * @param {any} root - Racine du rendu.
 * @returns {Array<string>} - Les cles d'action atteignables, triees.
 */
const bottomActionInventory = (/** @type {any} */ root) => {
  ouvrirLaFeuilleDeGestion();
  // 🧨 L4-B A CASSE CE RELEVE, ET IL FALLAIT LE VOIR : depuis que la rangee du
  // menu porte SA DESTINATION sous son libelle, la note vit DANS le pressable.
  // `textOf(pressable)` attrapait donc la note en plus du libelle — et celle de
  // « Faire venir des joueurs » contient « l'affiche » et « ouvrir une séance ».
  // Resultat mesure : un entrainement rendait `poster` ET `campaign-open` alors
  // qu'il n'a NI l'un NI l'autre. Le releve accusait le code d'un defaut qui
  // n'existait que dans la sonde.
  // ⇒ Le repere redevient ce qu'il a toujours voulu etre (commentaire D99
  // ci-dessous) : LE LIBELLE, c'est-a-dire le PREMIER texte du pressable.
  const labels = root
    .findAllByType(TouchableOpacity)
    .map((/** @type {any} */ node) => {
      const [premierTexte] = node.findAllByType(Text);
      return premierTexte ? textOf(premierTexte) : '';
    })
    .filter(Boolean);
  const found = new Set();
  // La comparaison ignore la casse : un repere sensible a la majuscule casse au
  // premier renommage (« …de cotisation » -> « Cotisation »), et un inventaire
  // vide se lit alors comme une action disparue.
  const collect = (/** @type {string} */ needle, /** @type {string} */ key) => {
    const target = needle.toLowerCase();
    if (labels.some((/** @type {string} */ value) => value.toLowerCase().includes(target))) {
      found.add(key);
    }
  };

  // « cotisation » est le repere qui traverse le raccourcissement du libelle :
  // il attrape « Preparer la campagne de cotisation » comme « Cotisation ».
  collect('cotisation', 'campaign');
  collect('Créer une autre campagne', 'campaign-more');
  collect('Ouvrir', 'campaign-open');
  collect('affiche', 'poster');
  // D99 — l'AIGUILLAGE qui remplace l'affiche sur un entrainement. Il porte sa
  // propre cle : « plus d'affiche » et « un chemin vers la detection » sont deux
  // constats distincts, et un seul repere ne saurait pas dire lequel a lache.
  // ⚠️ Le repere est le LIBELLE du bouton, pas sa note : `textOf` ne descend que
  // dans le pressable, et la note est rendue a cote de lui (EventDetails.js).
  collect('Faire venir', 'detection-switch');
  collect('Modifier', 'edit');
  collect('la une', 'featured');
  collect('Annuler', 'cancel');
  collect('Compo', 'lineup');
  collect('Réglages tournoi', 'tournamentSettings');

  return [...found].sort();
};

const lastAlert = () => {
  const { calls } = /** @type {any} */ (Alert.alert).mock;
  return calls.length ? calls[calls.length - 1] : null;
};

const alertOptionLabels = () => {
  const call = lastAlert();
  if (!call || !Array.isArray(call[2])) return [];
  return call[2].map((/** @type {any} */ option) => option.text);
};

const pressAlertOption = (/** @type {string} */ label) => {
  const call = lastAlert();
  const option = (call?.[2] || []).find((/** @type {any} */ item) => item.text === label);
  if (!option) throw new Error(`L'alerte ne propose pas « ${label} »`);
  act(() => {
    option.onPress?.();
  });
};

const byTestId = (/** @type {any} */ root, /** @type {string} */ id) => root
  .findAll((/** @type {any} */ node) => node.props?.testID === id && node.type === View);

const flatStyle = (/** @type {any} */ node) => StyleSheet.flatten(node?.props?.style) || {};

/**
 * `node` descend-il de `ancestor` ? C'est la question qui remplace, depuis D53,
 * la mesure d'une reserve en pixels : deux freres ne se recouvrent jamais.
 * @param {any} node - Le noeud teste.
 * @param {any} ancestor - L'ancetre suppose.
 * @returns {boolean} - Vrai si `node` est un descendant strict de `ancestor`.
 */
const isUnder = (/** @type {any} */ node, /** @type {any} */ ancestor) => {
  let current = node?.parent;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
};

/**
 * Le style de contenu de la liste defilante de l'ecran. C'est lui qui reserve
 * — ou non — la place de ce qui flotte par-dessus.
 * @param {any} root - Racine du rendu.
 * @returns {any} - Le style aplati.
 */
const scrollContentStyle = (/** @type {any} */ root) => {
  const [node] = root.findAll((/** @type {any} */ item) => Boolean(item.props?.refreshControl)
    && Boolean(item.props?.contentContainerStyle));
  if (!node) throw new Error('La liste defilante de l ecran n est pas rendue');
  return StyleSheet.flatten(node.props.contentContainerStyle) || {};
};

/**
 * Le bloc des participants — celui qui portait « Leo Diallo » a moitie cache
 * sur la capture d'Adel. C'est le REPERE contre lequel on mesure, depuis D64,
 * qu'aucun menu ne recouvre quoi que ce soit : on compare des positions dans
 * l'ordre de rendu, pas des pixels.
 * @param {any} root - Racine du rendu.
 * @returns {any} - Le noeud de la doublure des participants.
 */
const participantsBlock = (/** @type {any} */ root) => {
  const node = root
    .findAllByType(Text)
    .find((/** @type {any} */ item) => textOf(item) === 'DOUBLURE_EventParticipants');
  if (!node) throw new Error('La liste des participants n est pas rendue');
  return node;
};

const asOrganiser = (/** @type {any} */ extra = {}) => mountScreen({
  auth: {
    canEditClub: () => true,
    canEditEvent: () => true,
    canManageEvent: () => true,
    userData: { documentId: 'user-1', role: { name: 'Entraineur' } },
  },
  ...extra,
});

const asClubManager = (/** @type {any} */ extra = {}) => mountScreen({
  auth: {
    canEditClub: () => true,
    canManageEvent: () => false,
    userData: { documentId: 'user-1', role: { name: 'Dirigeant' } },
  },
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mounted = null;
});

afterEach(() => {
  unmountScreen();
  jest.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// L4-B — LE MENU D'ORGANISATION A QUITTE LA COLONNE POUR LA BARRE DU HAUT.
//
// L'accordeon « Gérer l'événement » est devenu un ⋯ pose dans l'en-tete de
// navigation, qui ouvre une feuille. Les actions, elles, n'ont pas bouge d'un
// pouce : meme liste, meme ordre, memes conditions.
//
// 🚨 LE PIEGE QUE CES TROIS FONCTIONS DEMINENT, et il est SILENCIEUX :
// `navigation.setOptions` est une DOUBLURE MUETTE ici, donc l'element
// `headerRight` n'entre JAMAIS dans l'arbre monte. Chercher le ⋯ par son
// `testID` dans le rendu trouverait le vide SANS RIEN DIRE — et tous les
// temoins d'actions ci-dessous deviendraient verts en ne testant plus rien.
// ⇒ On va le chercher la ou il est reellement : dans le dernier `headerRight`
// remis a `setOptions`, dont on parcourt l'arbre d'ELEMENTS non montes.
// Motif existant : `EventFilters.criteres.test.js:316-323`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cherche un element dans un arbre NON MONTE, par predicat sur ses props.
 * @param {any} element - Racine de l'arbre d'elements.
 * @param {any} predicat - Le test applique a chaque noeud.
 * @returns {any} - Le premier element qui satisfait le predicat, ou null.
 */
const chercherDansElements = (element, predicat) => {
  if (!element || typeof element !== 'object') return null;
  if (Array.isArray(element)) {
    return element.reduce(
      (/** @type {any} */ trouve, /** @type {any} */ enfant) => (
        trouve || chercherDansElements(enfant, predicat)
      ),
      null,
    );
  }
  if (element.props && predicat(element)) return element;
  return chercherDansElements(element.props?.children, predicat);
};

/**
 * Le ⋯ de la barre du haut, ou null s'il n'y a rien a gerer.
 * @returns {any} - L'element du bouton, ou null.
 */
const boutonDeGestion = () => {
  const appels = mockSetOptions.mock.calls.filter(
    (/** @type {any} */ appel) => appel[0]?.headerRight,
  );
  if (!appels.length) return null;
  return chercherDansElements(
    appels[appels.length - 1][0].headerRight(),
    (/** @type {any} */ noeud) => noeud?.props?.testID === 'event-actions-menu-button',
  );
};

/**
 * Ouvre la feuille d'organisation. Remplace l'appui sur le texte « Gérer
 * l'événement » de l'accordeon d'avant L4-B : meme geste pour la personne qui
 * s'en sert, meme liste d'actions au bout.
 * TOLERANTE A DESSEIN, comme l'ancien helper : la ou il n'y a rien a gerer, il
 * n'y a pas de bouton, et l'inventaire doit pouvoir sortir vide sans jeter.
 * @returns {void}
 */
const ouvrirLaFeuilleDeGestion = () => {
  const bouton = boutonDeGestion();
  if (!bouton) return;
  act(() => {
    bouton.props.onPress();
  });
};

describe('EventDetails — bas de page : ce qui est atteignable (invariant D21)', () => {
  test('organisateur, campagne suggeree : les 5 actions livrees restent atteignables', () => {
    const root = asOrganiser({ params: { eventCampaignCreationSuggested: true } });
    const inventory = bottomActionInventory(root);

    // Les 5 gestes qui existaient avant D21 : aucun n'a disparu.
    ['campaign', 'cancel', 'edit', 'featured', 'lineup'].forEach((key) => {
      expect(inventory).toContain(key);
    });
  });

  test('dirigeant sans droit sur l evenement : la cotisation reste son seul geste', () => {
    const root = asClubManager({ params: { eventCampaignCreationSuggested: true } });

    expect(bottomActionInventory(root)).toEqual(['campaign']);
  });

  test('campagnes deja liees : ouvrir, modifier et en creer une autre restent la', () => {
    const root = asClubManager({
      campaigns: [{
        currency: 'EUR',
        defaultAmountCents: 5000,
        documentId: 'camp-1',
        name: 'Cotisation U15',
        status: 'draft',
        totals: { total: 3 },
      }],
    });

    const inventory = bottomActionInventory(root);
    expect(inventory).toContain('campaign-more');
    expect(inventory).toContain('campaign-open');
    expect(inventory).toContain('edit');
    expect(hasText(root, 'Cotisations liées')).toBe(true);
  });

  test('TEMOIN NEGATIF : un participant n a aucune action d organisation en bas de page', () => {
    const root = mountScreen();

    expect(bottomActionInventory(root)).toEqual([]);
    expect(hasText(root, 'DOUBLURE_EventAnswerButtons')).toBe(true);
  });

  test('tournoi : les reglages tournoi restent atteignables', () => {
    const root = asOrganiser({ event: buildEvent({ type: { name: 'Tournoi' } }) });

    expect(bottomActionInventory(root)).toContain('tournamentSettings');
    expect(hasText(root, 'Gérer le tournoi')).toBe(true);
  });
});

describe('W01 — l encadrant MEMBRE peut repondre depuis la fiche', () => {
  // Le serveur (lot U02, admin `91da36c`) accepte la reponse de qui figure dans
  // `players` OU `trainers` d une equipe conviee — le role n entre nulle part.
  // Sur la fiche, l entraineur de l equipe a `canManageEvent` vrai, et l ecran
  // ne montait alors MEME PAS les boutons de reponse : le bouton d Adel n etait
  // pas gris, il etait absent.
  const eventWithCoach = () => buildEvent({
    team: {
      club: { documentId: CLUB_ID },
      documentId: TEAM_ID,
      name: 'U15',
      players: [{ documentId: 'joueur-1' }],
      trainers: [{ documentId: 'user-1' }],
    },
  });

  test('W01 · temoin 1 — entraineur MEMBRE et organisateur : il garde son menu ET recoit les boutons de reponse', () => {
    const root = asOrganiser({ event: eventWithCoach() });

    expect(hasText(root, 'DOUBLURE_EventAnswerButtons')).toBe(true);
    expect(bottomActionInventory(root)).toContain('edit');
  });

  test('W01 · temoin 3 🔒 — organisateur NON membre : aucun bouton de reponse, comme avant', () => {
    // `buildEvent` ne declare ni joueurs ni encadrants : l organisateur n est
    // membre d aucune equipe conviee, donc le serveur refuserait sa reponse.
    const root = asOrganiser();

    expect(hasText(root, 'DOUBLURE_EventAnswerButtons')).toBe(false);
  });

  test('W01 · temoin 4 🔒 — le participant simple ne change pas : il a toujours ses boutons', () => {
    const root = mountScreen({ event: eventWithCoach() });

    expect(hasText(root, 'DOUBLURE_EventAnswerButtons')).toBe(true);
    expect(bottomActionInventory(root)).toEqual([]);
  });
});

describe('EventDetails — bas de page : etat LIVRE avant D21 (caracterisation)', () => {
  test('TEMOIN NEGATIF : sans suggestion et sans campagne, AUCUN geste de cotisation', () => {
    const root = asClubManager();

    expect(bottomActionInventory(root)).toEqual([]);
    expect(hasText(root, 'cotisation')).toBe(false);
  });

  // L4-B : « le menu replie tient dans 60 px » devient « il ne coute plus RIEN
  // a la colonne ». C'est la meme garantie, poussee au bout : le menu ne mange
  // plus un seul point de la page, il a quitte la colonne pour l'en-tete.
  test('ferme, le menu ne coute plus aucune hauteur a la colonne', () => {
    const root = asOrganiser();

    expect(byTestId(root, PANEL_ID)).toHaveLength(0);
    expect(byTestId(root, PANEL_ROW_ID)).toHaveLength(0);
    expect(byTestId(root, 'event-manage-chip')).toHaveLength(0);
  });

  // ⚠️ INVERSION VOLONTAIRE des 40 px (D53) : la liste reserve desormais 16 px,
  // et surtout LE MEME NOMBRE avec ou sans actions d'organisation. Le menu ne
  // flottant plus au-dessus d'elle, elle n'a plus rien a degager.
  test('sans action d organisation, la liste ne reserve que son terminateur', () => {
    const root = mountScreen();

    expect(scrollContentStyle(root).paddingBottom).toBe(16);
  });

  test('TEMOIN NEGATIF : hors de la pile evenement, aucun chemin vers l affiche', () => {
    // C'etait l'etat de TOUT l'ecran avant D21 : l'affiche n'etait atteignable
    // que juste apres la creation. C'est aujourd'hui l'etat de la seule pile
    // PUBLIQUE, ou la route `EventPublishedShowcase` n'est pas enregistree.
    const root = asOrganiser({ routeNames: ['EventDetails', 'EventEdit'] });
    ouvrirLaFeuilleDeGestion();

    expect(pressableWithText(root, 'affiche')).toBeUndefined();
    expect(mockNavigate).not.toHaveBeenCalledWith(
      'EventPublishedShowcase',
      expect.anything(),
    );
  });
});

describe('D21 ① — la cotisation est rangee dans le menu « Gérer l evenement »', () => {
  // ⚠️ INVERSION VOLONTAIRE de la caracterisation « la cotisation est un bouton
  // DE PAGE » : c'est exactement la demande d'Adel — le geste quitte le bas de
  // page pour le menu depliant, sous un nom plus court.
  test('le geste n est plus sur la page : il faut ouvrir le menu pour l atteindre', () => {
    const root = asClubManager({ params: { eventCampaignCreationSuggested: true } });

    expect(pressableWithText(root, 'Cotisation')).toBeUndefined();
    ouvrirLaFeuilleDeGestion();
    expect(pressableWithText(root, 'Cotisation')).toBeTruthy();
  });

  test('le nom raccourci ouvre le MEME reglage de campagne, en un seul tap', () => {
    const root = asClubManager({ params: { eventCampaignCreationSuggested: true } });
    ouvrirLaFeuilleDeGestion();
    press(root, 'Cotisation');

    expect(mockNavigate).toHaveBeenCalledWith('ClubStack', {
      params: expect.objectContaining({ clubId: CLUB_ID, createNew: true, eventId: 'event-1' }),
      screen: 'ClubLicenseCampaignSettings',
    });
  });

  // ⛔ DECISION D'ADEL du 2026-08-07 : UN SEUL libelle. Le couple
  // « Preparer la campagne de cotisation » / « Creer une campagne de
  // cotisation » a disparu de l'ecran, dans tous ses etats.
  test('UN SEUL libelle : ni « Préparer… » ni « Créer une… » ne subsistent', () => {
    const root = asClubManager({ params: { eventCampaignCreationSuggested: true } });
    ouvrirLaFeuilleDeGestion();

    expect(hasText(root, 'Cotisation')).toBe(true);
    expect(hasText(root, 'Préparer')).toBe(false);
    expect(hasText(root, 'Créer une campagne de cotisation')).toBe(false);
    expect(hasText(root, 'campagne de cotisation')).toBe(false);
  });

  // ⚠️ INVERSION VOLONTAIRE du « TROU CONSTATE » tournoi : la chip vit dans le
  // constructeur PARTAGE, donc la variante tournoi en herite. C'est un AJOUT,
  // aucune action n'a ete retiree.
  test('sur un tournoi aussi, la cotisation devient atteignable', () => {
    const root = asOrganiser({
      event: buildEvent({ type: { name: 'Tournoi' } }),
      params: { eventCampaignCreationSuggested: true },
    });

    expect(bottomActionInventory(root)).toContain('campaign');
  });

  test('TEMOIN NEGATIF : campagnes deja liees, aucune chip — la liste garde la main', () => {
    const root = asClubManager({
      campaigns: [{
        currency: 'EUR',
        defaultAmountCents: 5000,
        documentId: 'camp-1',
        name: 'Cotisation U15',
        status: 'draft',
        totals: { total: 3 },
      }],
    });
    ouvrirLaFeuilleDeGestion();

    expect(pressableWithText(root, 'Préparer la cotisation')).toBeUndefined();
    expect(pressableWithText(root, 'Créer une autre campagne')).toBeTruthy();
  });

  test('TEMOIN NEGATIF : un simple participant ne voit aucun geste de cotisation', () => {
    const root = mountScreen({ params: { eventCampaignCreationSuggested: true } });

    expect(bottomActionInventory(root)).toEqual([]);
  });
});

describe('D21 ① — un seul mot, mais AUCUN comportement fondu', () => {
  const CAMPAIGN = {
    currency: 'EUR',
    defaultAmountCents: 5000,
    documentId: 'camp-1',
    name: 'Cotisation U15',
    status: 'draft',
    totals: { total: 3 },
  };
  const AVERTISSEMENT_DEJA_LIEE = 'Cet événement a déjà une campagne de cotisation. '
    + 'Crée-en une autre seulement si tu veux un paiement distinct.';

  // GARDE-FOU 2 — « Seul le TEXTE du bouton est unifié ». L'action, elle, se
  // comporte toujours differemment selon qu'une campagne existe : les deux
  // chemins sont exerces ici, cote a cote.
  test('SANS campagne existante : l action ouvre directement le reglage', () => {
    const root = asClubManager({ params: { eventCampaignCreationSuggested: true } });
    ouvrirLaFeuilleDeGestion();
    press(root, 'Cotisation');

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('ClubStack', {
      params: expect.objectContaining({ clubId: CLUB_ID, createNew: true, eventId: 'event-1' }),
      screen: 'ClubLicenseCampaignSettings',
    });
  });

  // GARDE-FOU 1 — OU EST PASSEE L'INFORMATION « une campagne existe deja ».
  // Elle n'a pas disparu avec le libelle : elle est portee par L'ACTION, qui
  // previent AVANT de creer, et ne navigue qu'apres un oui explicite.
  test('AVEC campagne existante : l action previent d abord, et ne navigue pas', () => {
    const root = asClubManager({ campaigns: [CAMPAIGN] });
    press(root, 'Créer une autre campagne');

    expect(lastAlert()[0]).toBe('Campagne déjà liée');
    expect(lastAlert()[1]).toBe(AVERTISSEMENT_DEJA_LIEE);
    expect(alertOptionLabels()).toEqual(['Annuler', 'Créer quand même']);
    expect(mockNavigate).not.toHaveBeenCalled();

    pressAlertOption('Créer quand même');
    expect(mockNavigate).toHaveBeenCalledWith('ClubStack', {
      params: expect.objectContaining({ clubId: CLUB_ID, createNew: true, eventId: 'event-1' }),
      screen: 'ClubLicenseCampaignSettings',
    });
  });

  // GARDE-FOU 1, deuxieme endroit ou l'information reste visible : la page
  // elle-meme nomme les campagnes deja rattachees a l'evenement.
  test('AVEC campagne existante : la page le DIT, en toutes lettres', () => {
    const root = asClubManager({ campaigns: [CAMPAIGN] });

    expect(hasText(root, 'Cotisations liées')).toBe(true);
    expect(hasText(root, 'Campagnes de paiement rattachées à cet événement.')).toBe(true);
    expect(hasText(root, 'Cotisation U15')).toBe(true);
  });
});

describe('D21 ② — « Gérer l evenement » devient un bouton flottant', () => {
  // ⚠️ INVERSION VOLONTAIRE de la caracterisation « le menu est EN FLUX » :
  // c'est la demande d'Adel — le menu prenait toute une bande en pied d'ecran
  // « avec la marge autour », il flotte desormais en bas a droite.
  // ⚠️ INVERSION VOLONTAIRE de D21 ② (D53), sur demande d'Adel : sur sa capture,
  // le participant « Leo Diallo » etait a moitie cache sous le bouton. Le calcul
  // de D21 etait pourtant juste — 46 px de pastille + 16 d'ecart = 62, couverts
  // par 80. Ce qu'il ne pouvait pas couvrir, c'est le MILIEU de la liste :
  // ancree au cadre, la pastille occupait ses 62 px du bas en permanence, et la
  // liste des participants est suivie des stats, des avis et des compositions.
  // Une marge en bas de liste ne protege pas le milieu d'une liste.
  // ⚠️ ET LE TITRE DE CE BLOC EST HISTORIQUE, PLUS DESCRIPTIF : il nomme le lot
  // D21 ②, pas l'etat courant. Le menu NE FLOTTE PLUS depuis D53, et depuis D64
  // il n'est meme plus en bas — il ouvre le contenu, sous la carte de
  // l'evenement. Les tests ci-dessous disent l'etat vrai ; le titre dit d'ou il
  // vient.
  test('le menu ne flotte plus : aucune couche par-dessus la liste', () => {
    const root = asOrganiser();
    const couches = root.findAll((/** @type {any} */ node) => (
      flatStyle(node).position === 'absolute' && node.props?.pointerEvents === 'box-none'
    ));

    // ⚠️ On compare des NOMBRES, jamais les noeuds eux-memes : un `toEqual([])`
    // qui echoue fait serialiser tout l'arbre de cet ecran par Jest, et le
    // processus meurt en OOM avant d'afficher la moindre ligne utile (mesure
    // D53 : 4 Go de tas satures, aucun message). Un echec doit rester lisible.
    expect(couches.length).toBe(0);
    // L4-B : la question « le panneau flotte-t-il ? » n'a plus d'objet — il n'y
    // A PLUS DE PANNEAU DANS LA COLONNE. La garantie devient absolue au lieu
    // d'etre mesuree : ce qui n'est pas dans la page ne peut rien y recouvrir.
    expect(byTestId(root, PANEL_ID)).toHaveLength(0);
  });

  test('le menu ne prend AUCUNE place dans la colonne : il vit dans la barre du haut', () => {
    // Le defaut que D21 avait corrige ne peut plus revenir : le menu ne reprend
    // pas une bande en pied d'ecran, et il ne prend meme plus une pastille dans
    // le contenu. Il est passe dans l'en-tete de navigation (L4-B).
    const root = asOrganiser();

    expect(byTestId(root, PANEL_ID)).toHaveLength(0);
    expect(byTestId(root, PANEL_ROW_ID)).toHaveLength(0);

    const bouton = boutonDeGestion();
    expect(bouton).toBeTruthy();
    expect(Number(flatStyle(bouton).height)).toBeGreaterThanOrEqual(44);
  });

  // ⛔ LE GARDE-FOU DU LOT (D53), et il remplace la reserve de 80 px : plus rien
  // ne peut recouvrir un participant. C'est une propriete de structure, pas un
  // nombre a regler — c'est ce qui la rend increvable la ou 80 px echouaient.
  //
  // ⚠️ INVERSION VOLONTAIRE de D53 (D64), sur demande d'Adel du 2026-08-10 : le
  // menu n'est plus le second enfant du cadre, POSE APRES la liste et hors du
  // defilement ; il est le premier bloc DU CONTENU, pose AVANT elle. Motif : en
  // pied de cadre, il restait plaque en bas (une ScrollView porte `flexGrow: 1`
  // et remplit son cadre meme quand le contenu est court) et laissait un grand
  // vide au-dessus de lui.
  // ⇒ CE QUE D53 PROTEGEAIT EST INTACT, seule la preuve change de forme : la
  // propriete qui interdit le recouvrement n'a jamais ete « pose apres », c'est
  // « EN FLUX ». Un frere en flux repousse son voisin, il ne passe jamais
  // dessus — que le menu vienne avant ou apres.
  // ⚠️ INVERSION VOLONTAIRE de D64 (L4-B), maquette planche 04 · 4C : le menu
  // n'est plus DU TOUT dans la colonne — ni avant la liste, ni apres, ni en
  // couche. Il ouvre une FEUILLE modale depuis la barre du haut.
  // ⇒ CE QUE D53 PUIS D64 PROTEGEAIENT EST INTACT, et la preuve se raccourcit :
  // la propriete qui interdisait le recouvrement etait « EN FLUX » ; elle
  // devient « PAS DANS LA COLONNE », qui l'implique.
  test('AUCUN participant ne peut etre recouvert : le menu n est plus dans la colonne', () => {
    const root = asOrganiser();
    const participants = participantsBlock(root);

    // 1. ⛔ RIEN A RECOUVRIR AVEC : le panneau n'existe plus dans la page.
    expect(byTestId(root, PANEL_ID)).toHaveLength(0);
    // 2. La liste est bien la, et elle est intacte.
    expect(participants).toBeTruthy();

    // 3. Menu OUVERT, la liste est toujours montee et n'est pas rangee DANS la
    //    feuille : la feuille se pose par-dessus, elle ne mange pas la colonne.
    ouvrirLaFeuilleDeGestion();
    const feuille = byTestId(root, 'event-manage-sheet')[0];
    expect(feuille).toBeTruthy();
    expect(isUnder(participantsBlock(root), feuille)).toBe(false);
    expect(isUnder(feuille, participantsBlock(root))).toBe(false);
  });

  test('la feuille ouverte ne coupe rien : la liste des participants reste entiere', () => {
    // Le pire cas de l'ancienne couche flottante : depliee, elle couvrait bien
    // plus que les 80 px reserves. Une feuille modale, elle, ne peut rien
    // couvrir de facon permanente — on la referme, et la page est intacte.
    const root = asOrganiser();
    ouvrirLaFeuilleDeGestion();

    expect(byTestId(root, 'event-manage-sheet')[0]).toBeTruthy();
    expect(hasText(root, 'DOUBLURE_EventParticipants')).toBe(true);
    // Et la colonne n'a pas gagne un bloc au passage : toujours aucun panneau.
    expect(byTestId(root, PANEL_ID)).toHaveLength(0);
  });

  test('le pied d ecran garde sa bande a lui, distincte de la liste et du menu', () => {
    // Les cotisations liees, les stats de match et les boutons de reponse vivent
    // dans une bande SOEUR. Elle n'a jamais ete recouverte et ne l'est toujours
    // pas : le menu est ancre dans le cadre de la liste, pas dans le sien.
    const root = asOrganiser({
      campaigns: [{
        currency: 'EUR',
        defaultAmountCents: 5000,
        documentId: 'camp-1',
        name: 'Cotisation U15',
        status: 'draft',
        totals: { total: 3 },
      }],
    });
    const [scroll] = root.findAll((/** @type {any} */ node) => Boolean(node.props?.refreshControl)
      && Boolean(node.props?.contentContainerStyle));
    const panneau = byTestId(root, 'event-manage-panel')[0];
    const openButton = pressableWithText(root, 'Ouvrir');

    const cadre = root.findAll((/** @type {any} */ node) => isUnder(scroll, node)
      && isUnder(panneau, node)).pop();
    expect(isUnder(openButton, cadre)).toBe(false);
  });

  // ⚠️ INVERSION VOLONTAIRE (L4-B), maquette planche 04 · 4C : la GRILLE A DEUX
  // COLONNES devient une LISTE DE RANGEES pleine largeur. La raison est dans le
  // contenu, pas dans le gout : chaque rangee porte desormais SA DESTINATION
  // sous son libelle, et une demi-colonne casse une destination en quatre
  // lignes illisibles — c'est deja pour ca que « Stats du match » (D71) et
  // l'aiguillage detection (D99) prenaient la ligne entiere.
  // ⇒ CE QUE CE TEMOIN PROTEGE EST INTACT : le compte des actions, et « un seul
  // tap » jusqu'a la destination.
  test('ouvert : cinq rangees pleine largeur, et toujours un seul tap', () => {
    const root = asOrganiser();
    ouvrirLaFeuilleDeGestion();

    const widths = byTestId(root, 'event-manage-chip')
      .map((/** @type {any} */ node) => flatStyle(node).width);
    expect(widths).toEqual(['100%', '100%', '100%', '100%', '100%']);

    press(root, 'Modifier');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
      params: { eventId: 'event-1' },
      screen: 'EventEdit',
    });
  });

  test('un seul menu sur un tournoi : les chips vivent dans la feuille', () => {
    const root = asOrganiser({ event: buildEvent({ type: { name: 'Tournoi' } }) });
    ouvrirLaFeuilleDeGestion();

    // Avant D21, un tournoi rendait DEUX panneaux (celui du bloc tournoi et
    // celui du pied d'ecran). Depuis L4-B il n'y a plus qu'une SEULE feuille —
    // meme garantie, meme unicite, sur le contenant d'aujourd'hui.
    expect(byTestId(root, 'event-manage-sheet')).toHaveLength(1);
    expect(hasText(root, 'Gérer le tournoi')).toBe(true);
    ['Modifier', 'À la une', 'Compo', 'Réglages tournoi', 'Annuler'].forEach((label) => {
      expect(pressableWithText(root, label)).toBeTruthy();
    });
  });

  // ⚠️ INVERSION VOLONTAIRE du « TROU CONSTATE » sur la demande a la une : la
  // couche flottante ne depend plus du pied d'ecran, elle survit donc a la
  // bascule valider/refuser. C'est un AJOUT, rien n'a ete retire.
  test('une demande « a la une » a valider n efface plus le menu', () => {
    const root = mountScreen({
      auth: {
        canEditEvent: () => true,
        canManageEvent: () => true,
        userData: { documentId: 'user-1', role: { name: 'SuperAdmin' } },
      },
      event: buildEvent({
        featuredRequestsSummary: { PUBLIC: { requestId: 'req-1', status: 'pending' } },
      }),
    });

    expect(hasText(root, 'Valider')).toBe(true);
    // D99 : l'evenement par defaut de ce fichier est un ENTRAINEMENT, qui n'a
    // plus d'affiche. La preuve la plus utile de ce lot est ici, dans l'echange
    // UN POUR UN : `poster` s'en va, `detection-switch` prend sa place, et les
    // quatre autres actions ne bougent pas. Rien n'a ete perdu en chemin.
    expect(bottomActionInventory(root)).toEqual([
      'cancel', 'detection-switch', 'edit', 'featured', 'lineup',
    ]);
  });

  test('TEMOIN NEGATIF : aucune action, aucune couche flottante', () => {
    const root = mountScreen();

    expect(byTestId(root, PANEL_ID)).toHaveLength(0);
    expect(root.findAll((/** @type {any} */ node) => node.props?.testID === 'event-manage-sheet'))
      .toHaveLength(0);
  });

  // L4-B : « replie » devient « ferme ». La garantie ne bouge pas — au montage,
  // aucune action d'organisation n'est rendue — et elle se renforce : la couche
  // ne coute meme plus la pastille, le ⋯ ayant quitte la page pour l'en-tete.
  test('ferme : aucune chip rendue — la couche ne coute plus rien a la page', () => {
    const root = asOrganiser();

    expect(byTestId(root, 'event-manage-chip')).toHaveLength(0);
    expect(boutonDeGestion()).toBeTruthy();
  });
});

describe('D21 ③ — un point d entree vers l affiche de l evenement', () => {
  // ⚠️ INVERSION VOLONTAIRE du « TEMOIN NEGATIF : aucun chemin vers l affiche » :
  // c'est la demande d'Adel. L'affiche existait deja, elle n'etait atteignable
  // que juste apres la creation (`navigation.reset` du recap du tunnel).
  // ⚠️ MIS A JOUR le 2026-08-07 (D28), et le filet a fait exactement son travail :
  // il est devenu ROUGE au moment ou l'ecran s'est mis a passer le gabarit.
  // AVANT : `{ eventId }` seul — l'ecran d'affiche retombait alors sur son repli
  // `params.template || 'affiche-detection'`, si bien que CET evenement (un
  // « Entrainement », cf. buildEvent) recevait l'affiche de detection par
  // ACCIDENT. Il la recoit toujours — c'est le repli assume tant qu'aucun
  // gabarit d'entrainement n'existe — mais la valeur est desormais DECIDEE et
  // elle voyage. Le resolveur est importe et non recopie : les deux ne peuvent
  // pas diverger.
  // ⚠️ MIS A JOUR le 2026-08-13 (D94/C2) — le filet a REJOUE son role : il est
  // redevenu ROUGE quand l'ecran s'est mis a passer AUSSI le type. Le gabarit ne
  // suffisait pas : c'est le TYPE qui decide le TEXTE du partage, et sans lui un
  // match repartait avec « viens participer a notre detection ».
  // ⚠️ MIS A JOUR le 2026-08-13 (D99) — et le filet a rejoue son role une
  // TROISIEME fois. L'evenement par defaut de ce fichier est un « Entrainement »
  // (cf. buildEvent), qui n'a plus d'affiche du tout : ce temoin aurait vire au
  // rouge en affirmant l'inverse de la decision. Il porte desormais sur un
  // MATCH — un type qui garde son affiche — et ce qu'il verifie n'a pas bouge :
  // l'identifiant, le gabarit et le type voyagent ensemble.
  test('l affiche redevient atteignable, avec son eventId, son gabarit ET son type', () => {
    const root = asOrganiser({ event: buildEvent({ type: { name: 'Match' } }) });
    ouvrirLaFeuilleDeGestion();
    press(root, "Voir l'affiche");

    expect(mockNavigate).toHaveBeenCalledWith('EventPublishedShowcase', {
      eventId: 'event-1',
      eventTypeName: 'Match',
      template: getEventShowcaseTemplate('Match'),
    });
  });

  // D28 — le gabarit suit le TYPE de l'evenement ouvert, pas une constante.
  test('le gabarit passe est celui que le type de l evenement decide', () => {
    const root = asOrganiser({ event: buildEvent({ type: { name: "Détection / Séance d'essai" } }) });
    ouvrirLaFeuilleDeGestion();
    press(root, "Voir l'affiche");

    const [, params] = mockNavigate.mock.calls
      .find((/** @type {any} */ call) => call[0] === 'EventPublishedShowcase');
    expect(params.template).toBe(getEventShowcaseTemplate("Détection / Séance d'essai"));
  });

  // D99 : sur un MATCH desormais — l'entrainement par defaut n'ouvre plus cet
  // ecran. Ce que le temoin mesure est inchange.
  test('aucune celebration rejouee : on consulte, on ne re-publie pas', () => {
    const root = asOrganiser({ event: buildEvent({ type: { name: 'Match' } }) });
    ouvrirLaFeuilleDeGestion();
    press(root, "Voir l'affiche");

    const [, params] = mockNavigate.mock.calls
      .find((/** @type {any} */ call) => call[0] === 'EventPublishedShowcase');
    expect(params).not.toHaveProperty('creationCelebration');
  });

  // D99 : sur un MATCH. Sur l'entrainement par defaut, ce temoin serait devenu
  // TAUTOLOGIQUE — vert parce que plus personne n'a d'affiche, et non parce
  // qu'un participant n'y a pas droit. Il ne mesurerait plus le droit.
  test('TEMOIN NEGATIF : un participant n a pas d entree vers l affiche', () => {
    const root = mountScreen({ event: buildEvent({ type: { name: 'Match' } }) });

    expect(bottomActionInventory(root)).not.toContain('poster');
  });

  test('TEMOIN NEGATIF : un dirigeant sans droit sur l evenement non plus', () => {
    const root = asClubManager({ params: { eventCampaignCreationSuggested: true } });

    expect(bottomActionInventory(root)).toEqual(['campaign']);
  });

  test('TEMOIN NEGATIF : la ou la route n existe pas, aucune chip muette', () => {
    // Le meme organisateur, mais dans un arbre de navigation ou
    // `EventPublishedShowcase` n'est pas enregistree (pile publique).
    // D99 : sur un MATCH, sinon le vert viendrait de la fermeture D99 et non de
    // l'absence de route — le temoin ne mesurerait plus son sujet.
    const root = asOrganiser({
      event: buildEvent({ type: { name: 'Match' } }),
      routeNames: ['EventDetails', 'EventEdit'],
    });
    const inventory = bottomActionInventory(root);

    expect(inventory).not.toContain('poster');
    expect(inventory).toContain('edit');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D99 — L'ENTRAINEMENT PERD SON AFFICHE, ET REPART AVEC UN CHEMIN.
// Decision d'Adel du 2026-08-13, reponse « C » : on la retire ET on redirige.
//
// 🧨 CE QUE MESURAIT D88 : l'affiche d'un entrainement est celle d'une detection,
// elle est partageable publiquement, et elle porte l'heure et le lieu RECURRENTS
// d'un groupe — souvent des mineurs. Les concernes recoivent deja une
// notification et un rappel a H-24 : elle ne prevenait personne, elle publiait
// une habitude.
//
// 🧭 ET POURQUOI PAS « RETIRER » TOUT COURT : un club qui affichait ses creneaux
// pour recruter perdrait son chemin. « Detection / seance d'essai » est
// exactement le mot pour ca, et son affiche existe deja. On ne retire pas une
// possibilite, on la remet au bon endroit — une porte fermee sans panneau est le
// defaut que ce projet paie en boucle.
// ─────────────────────────────────────────────────────────────────────────────
describe('D99 — un entrainement ne propose plus d affiche, il propose une detection', () => {
  const entrainement = () => asOrganiser({ event: buildEvent({ type: { name: 'Entrainement' } }) });

  test('① plus aucune entree vers l affiche sur un entrainement', () => {
    const root = entrainement();

    expect(bottomActionInventory(root)).not.toContain('poster');
    // Et le libelle lui-meme a disparu : l'inventaire pourrait rater une chip
    // renommee, un pressable absent ne ment pas.
    expect(pressableWithText(root, "Voir l'affiche")).toBeUndefined();
  });

  test('③ l entrainement propose de creer une detection a la place', () => {
    const root = entrainement();

    expect(bottomActionInventory(root)).toContain('detection-switch');
  });

  // ⛔ LE CŒUR DU LOT : le bouton doit MENER quelque part. Un aiguillage qui
  // n'ouvre rien est pire que pas d'aiguillage — c'est l'impasse polie.
  // La cible est la 1re etape du tunnel de creation, atteinte par le motif deja
  // employe par 5 appelants (HomeHub, TeamDetails, ParticipantEventList,
  // MultisportClubDetails, CMDashboard) : la pile evenement, puis l'etape.
  test('③ bis — et l aiguillage ouvre REELLEMENT le choix du type', () => {
    const root = entrainement();
    ouvrirLaFeuilleDeGestion();
    press(root, 'Faire venir');

    expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
      screen: 'EventWizardType',
    });
  });

  // L'organisateur doit comprendre POURQUOI sans avoir a appuyer. Le mot
  // « detection » est le seul terme du produit qui compte ici : c'est celui
  // qu'il retrouvera dans la liste des types, a l'ecran suivant.
  test('③ ter — la raison est ecrite a cote du bouton, pas cachee derriere', () => {
    const root = entrainement();
    ouvrirLaFeuilleDeGestion();

    expect(hasText(root, 'de l’extérieur')).toBe(true);
    expect(hasText(root, 'détection')).toBe(true);
  });

  // 🔒 LE TEMOIN QUI COMPTE — LA NON-REGRESSION. Les quatre autres types gardent
  // leur affiche, et n'heritent PAS de l'aiguillage : une detection a qui on
  // proposerait de creer une detection serait absurde.
  test.each([
    ['Match'],
    ["Détection / Séance d'essai"],
    ['Tournoi'],
    ['Stage'],
  ])('🔒 « %s » propose TOUJOURS son affiche, et aucun aiguillage', (typeName) => {
    const root = asOrganiser({ event: buildEvent({ type: { name: typeName } }) });
    const inventory = bottomActionInventory(root);

    expect(inventory).toContain('poster');
    expect(inventory).not.toContain('detection-switch');
  });

  // Meme regle que la chip d'affiche (l. ~3690) : la ou le tunnel n'est pas
  // enregistre — la pile publique — l'aiguillage serait un bouton muet.
  test('TEMOIN NEGATIF : sans le tunnel dans l arbre, aucun aiguillage muet', () => {
    const root = asOrganiser({
      event: buildEvent({ type: { name: 'Entrainement' } }),
      routeNames: ['EventDetails', 'EventEdit'],
    });
    const inventory = bottomActionInventory(root);

    expect(inventory).not.toContain('detection-switch');
    expect(inventory).not.toContain('poster');
    expect(inventory).toContain('edit');
  });

  test('TEMOIN NEGATIF : un participant n a pas non plus l aiguillage', () => {
    const root = mountScreen({ event: buildEvent({ type: { name: 'Entrainement' } }) });

    expect(bottomActionInventory(root)).not.toContain('detection-switch');
  });
});

// ── D64 — LE FILET, pose AVANT de deplacer le menu ──────────────────────────
// Ces deux temoins ne disent RIEN de l'endroit ou le menu est pose : ils sont
// verts avec le menu en pied de cadre (D53) comme en tete de contenu (D64).
// C'est exactement ce qu'on demande a un filet — survivre au deplacement qu'il
// protege, et ne tomber que si le deplacement casse quelque chose.
describe('D64 — le filet : deux invariants qui ne dependent pas de l endroit', () => {
  // L4-B a fait exactement ce que ce filet annonce : il a DEPLACE le menu, une
  // fois de plus. Le temoin tient sa promesse — il ne nomme toujours pas
  // l'endroit, il verifie qu'ON Y ARRIVE et qu'un seul appui l'ouvre.
  test('le menu d organisation est atteignable, ou qu il soit pose', () => {
    const root = asOrganiser();

    // Atteignable au DOIGT et au LECTEUR D'ECRAN : un role annonce, un libelle
    // non vide, et une cible d'au moins 44 pt (le minimum tactile).
    const bascule = boutonDeGestion();
    expect(bascule).toBeTruthy();
    expect(bascule.props.accessibilityRole).toBe('button');
    expect(String(bascule.props.accessibilityLabel || '').length).toBeGreaterThan(0);
    expect(Number(flatStyle(bascule).height)).toBeGreaterThanOrEqual(44);

    // Et il OUVRE : un seul appui suffit a faire apparaitre les chips.
    ouvrirLaFeuilleDeGestion();
    expect(byTestId(root, 'event-manage-chip').length).toBeGreaterThan(0);
  });

  // 🧨 DEUX ECRANS NE PEUVENT PAS COEXISTER DANS UN TEST DE CE FICHIER, et ca ne
  // se voit pas : `mountScreen` ECRIT dans des mocks partages (`mockUseAuth`,
  // `mockEventQuery`) et dans la variable `mounted`, unique. Monter un second
  // ecran change donc l'identite lue par le PREMIER des qu'il se re-rend — un
  // `press` sur l'organisateur le faisait relire l'auth du simple participant,
  // le menu disparaissait, et l'echec accusait le code au lieu du montage.
  // ⇒ On finit tout ce qu'on a a faire sur un arbre AVANT d'en monter un autre.
  test('le dernier participant de la liste n est recouvert par rien', () => {
    const organisateur = asOrganiser();

    // 1. RIEN NE SURPLOMBE. Depuis L4-B, la preuve est plus courte que
    //    « en flux » : le menu n'est PAS DANS LA COLONNE, ni ferme ni ouvert.
    //    Ce qui n'est pas dans la page ne peut rien y recouvrir.
    expect(byTestId(organisateur, PANEL_ID)).toHaveLength(0);
    ouvrirLaFeuilleDeGestion();
    expect(byTestId(organisateur, 'event-manage-sheet')[0]).toBeTruthy();
    expect(byTestId(organisateur, PANEL_ID)).toHaveLength(0);

    // 2. La liste des participants est bien rendue, et elle n'est pas rangee
    //    DANS le menu : on ne l'a pas fait disparaitre en la deplacant.
    expect(hasText(organisateur, 'DOUBLURE_EventParticipants')).toBe(true);

    // 3. ET LA LISTE NE RESERVE RIEN POUR LE MENU : le meme terminateur, avec
    //    ou sans actions d'organisation. C'est la disparition de la reserve
    //    dite en COMPORTEMENT, pas en nom de constante — donc increvable a un
    //    renommage. (Une reserve, par definition, ne s'applique que quand le
    //    bouton existe : deux nombres egaux prouvent qu'il n'y en a plus.)
    const avecMenu = scrollContentStyle(organisateur).paddingBottom;
    const sansMenu = scrollContentStyle(mountScreen()).paddingBottom;

    expect(avecMenu).toBe(sansMenu);
  });

  test('0, 1 ou 50 participants : le menu garde exactement la meme place', () => {
    // C'EST LA PROPRIETE QUI FAIT DISPARAITRE LE VIDE. Avant D64, la place du
    // menu dependait de la longueur de la page : plaque au bas d'un cadre plein
    // ecran, il s'eloignait du contenu a mesure que la page etait courte.
    // ⚠️ INVERSION VOLONTAIRE (L4-B) : la place ne depend plus du contenu parce
    // qu'elle ne depend plus DE LA PAGE — le ⋯ est ancre dans la barre du haut,
    // toujours au meme endroit, quelle que soit la longueur de la liste.
    // ⚠️ Un arbre a la fois : on finit tout sur celui-ci avant de monter le
    // suivant (mocks partages, cf. le temoin precedent).
    [0, 1, 50].forEach((nombre) => {
      const participations = Array.from({ length: nombre }, (_, index) => ({
        documentId: `part-${index}`,
        status: 'accepted',
        user: { documentId: `joueur-${index}` },
      }));
      const root = asOrganiser({ event: buildEvent({ participations }) });

      expect(boutonDeGestion()).toBeTruthy();
      expect(byTestId(root, PANEL_ID)).toHaveLength(0);
      expect(participantsBlock(root)).toBeTruthy();
    });
  });

  test('rien ne finit sous la barre systeme : le plancher du conteneur est intact', () => {
    const root = asOrganiser();
    const [conteneur] = root.findAll(
      (/** @type {any} */ node) => node.type?.name === 'ScreenContainerDouble',
    );

    // Retirer la reserve du bouton n'est PAS mettre la marge basse a zero.
    // `ScreenContainer` applique toujours `insets.bottom` (son mode par defaut,
    // `none`, vaut « plancher systeme seul ») ; `edge-to-edge` est le SEUL mode
    // qui y renonce, pour les ecrans qui gerent eux-memes leur retrait bas.
    // Cet ecran ne le demande pas : c'est ce qui garantit que son dernier
    // element ne passe pas sous la barre gestuelle, page vide comme page
    // longue, et sans dependre d'une marge ecrite ici.
    expect(conteneur).toBeTruthy();
    expect(conteneur.props.bottomInsetMode).not.toBe('edge-to-edge');
  });

  test('T02 — le vide sous les boutons disparait, SANS toucher au plancher', () => {
    const root = asOrganiser();
    const [conteneur] = root.findAll(
      (/** @type {any} */ node) => node.type?.name === 'ScreenContainerDouble',
    );

    // Adel, le 2026-08-17 : « supprimer le padding en bas des pages détails
    // événement ». 🔬 CE QUE LA MESURE A MONTRE : cette marge s'EMPILAIT sur le
    // plancher systeme, elle ne le remplacait pas. `ScreenContainer` pose
    // `insets.bottom` sur son cadre EXTERIEUR, tandis que `contentContainerStyle`
    // habille un cadre INTERIEUR (`ScreenContainer.js` : `containerSpaces` d'un
    // cote, `safeContentContainerStyle` de l'autre) — les deux s'additionnaient
    // sous les boutons de reponse.
    // ⇒ La couche du dessus part ; le plancher, lui, reste, et c'est le temoin
    //   juste au-dessus qui le garde.
    expect(StyleSheet.flatten(conteneur.props.contentContainerStyle)?.paddingBottom)
      .toBeUndefined();
  });
});

// D71 : la regle qu'Adel enonce le 2026-08-11 — « le bas de la page d'un
// evenement n'est plus un endroit ou l'on pose une action d'organisation ; il
// n'y en a qu'un seul, et c'est le menu ». Les statistiques du match etaient le
// DERNIER geste d'organisation qui y restait pour un organisateur.
//
// ⚠️ Ce qui NE bouge PAS, et ces temoins sont la pour l'empecher :
//   - les gestes de PARTICIPATION restent immediatement visibles (les enfouir
//     ferait chuter les reponses, et le menu n'est meme pas offert a un simple
//     participant) ;
//   - la carte « Stats du match » du CORPS reste ou elle est : elle s'affiche
//     des `canView || isTeamMember`, donc a des gens qui n'ont PAS le menu.
describe('D71 — les stats du match quittent le pied de page pour le menu', () => {
  const MATCH = { endDate: '2099-01-01T12:00:00.000Z', type: { name: 'Match' } };
  const MATCH_FINI = { endDate: '2020-01-01T12:00:00.000Z', type: { name: 'Match' } };

  const asMatchOrganiser = (/** @type {any} */ extra = {}) => asOrganiser({
    event: buildEvent(MATCH),
    ...extra,
  });

  // ⚠️ `textOf` descend par `props.children`, or le libelle d'une chip vit dans
  // `props.title` du bouton et n'existe qu'une fois RENDU. On cherche donc le
  // texte parmi les `Text` produits, pas dans les enfants declares.
  const chipWithLabel = (/** @type {any} */ root, /** @type {string} */ label) => byTestId(root, 'event-manage-chip')
    .find((/** @type {any} */ node) => node
      .findAllByType(Text)
      .some((/** @type {any} */ item) => textOf(item).includes(label)));

  test('le geste n est plus en pied de page : il faut ouvrir le menu pour l atteindre', () => {
    const root = asMatchOrganiser();

    // Menu REPLIE : plus aucun chemin vers les stats sur la page.
    expect(pressableWithText(root, 'Stats du match')).toBeUndefined();

    ouvrirLaFeuilleDeGestion();
    expect(pressableWithText(root, 'Stats du match')).toBeTruthy();
  });

  test('l inventaire du bas de page gagne les stats, et ne perd rien', () => {
    const root = asMatchOrganiser();
    ouvrirLaFeuilleDeGestion();

    expect(chipWithLabel(root, 'Stats du match')).toBeTruthy();
    // Les gestes livres avant D71 sont tous encore la.
    ['Modifier', 'À la une', 'Compo', 'Annuler'].forEach((label) => {
      expect(pressableWithText(root, label)).toBeTruthy();
    });
  });

  test('AUCUNE INFORMATION PERDUE : le sous-titre devient la note de la chip', () => {
    const root = asMatchOrganiser();
    ouvrirLaFeuilleDeGestion();

    // Le texte exact que le bouton du pied portait sous lui avant D71 — et il
    // vit DESORMAIS dans la chip, pas ailleurs sur la page. Sans ce second
    // controle, le temoin resterait vert avec le sous-titre reste en bas.
    // ⚠️ L4-B : la rangee finit par un chevron « › », donc le DERNIER texte
    // n'est plus la note. On lit la LISTE des textes de la rangee et on y
    // cherche la phrase exacte — increvable a l'ajout d'un ornement.
    const chip = chipWithLabel(root, 'Stats du match');
    const textesDeLaRangee = chip.findAllByType(Text).map((/** @type {any} */ n) => textOf(n));
    expect(textesDeLaRangee).toContain('Les stats seront disponibles à la fin du match.');
  });

  test('avant la fin du match, la chip est grisee — comme le bouton l etait', () => {
    const root = asMatchOrganiser();
    ouvrirLaFeuilleDeGestion();

    const [bouton] = chipWithLabel(root, 'Stats du match').findAllByType(TouchableOpacity);
    expect(bouton.props.disabled).toBe(true);
  });

  test('la chip porte la pleine largeur : sa note est une phrase, pas une etiquette', () => {
    const root = asMatchOrganiser();
    ouvrirLaFeuilleDeGestion();

    expect(flatStyle(chipWithLabel(root, 'Stats du match')).width).toBe('100%');
  });

  test('match fini : la chip devient active et ouvre le MEME editeur, en un tap', () => {
    const root = asOrganiser({
      event: buildEvent(MATCH_FINI),
      matchStats: {
        permissions: { canManage: true, canView: true },
        score: { available: true },
      },
    });
    ouvrirLaFeuilleDeGestion();

    press(root, 'Saisir les stats du match');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('MatchStatsEditor', expect.objectContaining({
      eventId: 'event-1',
      sourceType: 'event',
      teamId: TEAM_ID,
    }));
  });

  test('TEMOIN NEGATIF : un participant n a toujours aucune action d organisation', () => {
    const root = mountScreen({ event: buildEvent(MATCH) });

    expect(bottomActionInventory(root)).toEqual([]);
    expect(pressableWithText(root, 'Stats du match')).toBeUndefined();
    // Son geste de participation, lui, reste immediatement visible.
    expect(hasText(root, 'DOUBLURE_EventAnswerButtons')).toBe(true);
  });

  test('TEMOIN NEGATIF : sur un evenement qui n est pas un match, aucune chip stats', () => {
    const root = asOrganiser();
    ouvrirLaFeuilleDeGestion();

    expect(pressableWithText(root, 'Stats du match')).toBeUndefined();
    expect(hasText(root, 'Les stats seront disponibles')).toBe(false);
  });

  // ⚠️ INVERSION VOLONTAIRE (L4-B) : le menu n'est plus un enfant de la liste
  // defilante — c'est une FEUILLE, et c'est elle qui defile toute seule.
  // ⇒ La garantie de fond ne bouge pas : une 6e action ne peut pas sortir du
  // cadre. Elle est meme mieux tenue — la feuille se dimensionne sur son
  // contenu (`BottomModal`, `enableDynamicSizing`), la ou le panneau dependait
  // de la place restante dans la page.
  test('le menu allonge reste atteignable : la feuille grandit avec ses rangees', () => {
    const root = asMatchOrganiser();
    ouvrirLaFeuilleDeGestion();

    const [scroll] = root.findAll((/** @type {any} */ node) => Boolean(node.props?.refreshControl)
      && Boolean(node.props?.contentContainerStyle));
    const feuille = byTestId(root, 'event-manage-sheet')[0];

    expect(feuille).toBeTruthy();
    // La feuille N'EST PAS dans la liste defilante : elle se pose par-dessus.
    expect(isUnder(feuille, scroll)).toBe(false);
    // Et le match, qui porte une action de plus que l'entrainement, les rend
    // TOUTES : rien ne tombe hors du cadre.
    expect(byTestId(root, 'event-manage-chip').length).toBeGreaterThanOrEqual(5);
  });
});

// AC10 — VAGUE 0 : « reparer ce qui ment ».
//
// L'ecran decidait qu'un match etait fini en lisant l'horloge du TELEPHONE
// (`EventDetails.js:1083` avant le lot). Un telephone en avance — ou simplement
// dans un autre fuseau — ouvrait les statistiques d'apres-match AVANT le coup
// d'envoi ; un telephone en retard les cachait a quelqu'un dont le match etait
// fini depuis une heure. La seule horloge qui fait foi est celle du SERVEUR.
//
// La chip « Stats du match » est le temoin visible de cette decision : grisee
// tant que le match n'est pas fini, active des qu'il l'est. Les temoins ci-
// dessous PILOTENT les deux horloges separement, ce qui est la seule facon de
// montrer laquelle des deux est ecoutee.
describe('AC10 — le match est fini quand le SERVEUR le dit, pas le telephone', () => {
  const FIN_DU_MATCH = '2026-08-20T20:00:00.000Z';
  const FIN_DU_MATCH_MS = Date.parse(FIN_DU_MATCH);
  const TROIS_HEURES = 3 * 60 * 60 * 1000;

  const MATCH = { endDate: FIN_DU_MATCH, type: { name: 'Match' } };

  /** @type {any} */
  let telephone = null;

  const reglerLeTelephoneSur = (/** @type {number} */ instant) => {
    telephone = jest.spyOn(Date, 'now').mockReturnValue(instant);
  };

  afterEach(() => {
    if (telephone) telephone.mockRestore();
    telephone = null;
  });

  const chipStats = (/** @type {any} */ root) => byTestId(root, 'event-manage-chip')
    .find((/** @type {any} */ node) => node
      .findAllByType(Text)
      .some((/** @type {any} */ item) => /stats du match/i.test(textOf(item))));

  const chipStatsEstGrisee = (/** @type {any} */ root) => {
    const chip = chipStats(root);
    if (!chip) throw new Error('La chip « Stats du match » n est pas dans le menu');
    const [bouton] = chip.findAllByType(TouchableOpacity);
    return Boolean(bouton.props.disabled);
  };

  const monterLeMatch = (/** @type {string | null} */ serverNow) => {
    const root = mountScreen({
      auth: {
        canEditClub: () => true,
        canEditEvent: () => true,
        canManageEvent: () => true,
        userData: { documentId: 'user-1', role: { name: 'Entraineur' } },
      },
      event: buildEvent(MATCH),
      matchStats: {
        permissions: { canManage: true, canView: true },
        score: { available: true },
      },
      serverNow,
    });
    ouvrirLaFeuilleDeGestion();
    return root;
  };

  // 🥇 LE TEMOIN DE L'AUDIT.
  test('un telephone en AVANCE de 3 h n ouvre pas les statistiques', () => {
    // Le telephone se croit 3 h APRES la fin du match...
    reglerLeTelephoneSur(FIN_DU_MATCH_MS + TROIS_HEURES);
    // ...alors que le serveur dit qu il reste 1 h a jouer.
    const root = monterLeMatch(new Date(FIN_DU_MATCH_MS - (60 * 60 * 1000)).toISOString());

    expect(chipStatsEstGrisee(root)).toBe(true);
    expect(hasText(root, 'Les stats seront disponibles à la fin du match.')).toBe(true);
  });

  test('un telephone en RETARD de 3 h les ouvre si le serveur dit fini', () => {
    // Le telephone se croit encore 3 h AVANT la fin...
    reglerLeTelephoneSur(FIN_DU_MATCH_MS - TROIS_HEURES);
    // ...alors que le serveur dit que c est fini depuis une minute.
    const root = monterLeMatch(new Date(FIN_DU_MATCH_MS + 60000).toISOString());

    expect(chipStatsEstGrisee(root)).toBe(false);
    press(root, 'Saisir les stats du match');
    expect(mockNavigate).toHaveBeenCalledWith('MatchStatsEditor', expect.objectContaining({
      eventId: 'event-1',
      sourceType: 'event',
    }));
  });

  // 🔒 LE REPLI SUR. Ouvrir des statistiques d apres-match trop tot est pire que
  // les ouvrir trop tard : trop tot, on demande son ressenti a quelqu un dont le
  // match n a pas commence.
  test('sans horloge serveur, le match est considere comme NON fini', () => {
    // Le telephone jure que le match est fini depuis 3 h. On ne le croit pas.
    reglerLeTelephoneSur(FIN_DU_MATCH_MS + TROIS_HEURES);
    const root = monterLeMatch(null);

    expect(chipStatsEstGrisee(root)).toBe(true);
  });

  // 🚨 NON-REGRESSION : les temps RELATIFS restent sur l horloge locale.
  // C est la deuxieme famille de l audit, et elle ne doit PAS bouger : ce compte
  // a rebours raconte le temps du LECTEUR, pas celui du serveur, et il doit
  // continuer de s afficher meme quand le serveur n a rien dit.
  test('le compte a rebours d arrivee continue de lire l horloge locale', () => {
    const debut = new Date(FIN_DU_MATCH_MS + (30 * 60 * 1000)).toISOString();
    reglerLeTelephoneSur(FIN_DU_MATCH_MS);

    const root = mountScreen({
      auth: {
        userData: { documentId: 'user-1', role: { name: 'Joueur' } },
      },
      event: buildEvent({
        date: debut,
        participations: [{ documentId: 'user-1' }],
        type: { name: 'Match' },
      }),
      serverNow: null,
    });

    expect(hasText(root, 'pour signaler ton arrivée ou ton retard.')).toBe(true);
  });
});
