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
const mockEventQuery = { data: null };
const mockCampaignsQuery = { data: { data: [] }, isLoading: false };
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

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => emptyQuery(),
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
  setOptions: jest.fn(),
});

const EVENT_STACK_ROUTES = [
  'EventDetails',
  'EventEdit',
  'EventPublishedShowcase',
  'TournamentSettingsEdit',
];

const mountScreen = (/** @type {any} */ {
  auth, campaigns, event, params, routeNames,
} = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockCampaignsQuery.data = { data: campaigns || [] };
  mockCampaignsQuery.isLoading = false;
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

// Idempotent A DESSEIN : le toggle du menu bascule dans les deux sens, donc un
// helper naif REFERME le menu au deuxieme appel et rend une liste vide qui se
// lit comme une regression. On ne presse que si les chips ne sont pas deja la.
const openManagePanel = (/** @type {any} */ root) => {
  const alreadyOpen = root
    .findAll((/** @type {any} */ node) => node.props?.testID === 'event-manage-chip')
    .length > 0;
  if (alreadyOpen) return;
  if (pressableWithText(root, "Gérer l'événement")) press(root, "Gérer l'événement");
};

/**
 * LA COUTURE. Toutes les actions du bas d'ecran REELLEMENT atteignables, quel
 * que soit leur chemin : bouton de page (avant D21) ou chip du menu (apres).
 * Deplier le menu fait partie du chemin, des deux cotes.
 * @param {any} root - Racine du rendu.
 * @returns {Array<string>} - Les cles d'action atteignables, triees.
 */
const bottomActionInventory = (/** @type {any} */ root) => {
  openManagePanel(root);
  const labels = root
    .findAllByType(TouchableOpacity)
    .map((/** @type {any} */ node) => textOf(node))
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
 * Le noeud qui PORTE la position du panneau : le panneau lui-meme avant D21,
 * la couche flottante qui l'enveloppe apres. On remonte donc la chaine des
 * ancetres jusqu'a trouver une position declaree.
 * @param {any} root - Racine du rendu.
 * @returns {string} - 'absolute', 'relative' ou 'aucune'.
 */
const managePanelPosition = (/** @type {any} */ root) => {
  let node = byTestId(root, PANEL_ID)[0];
  if (!node) throw new Error('Le panneau « Gerer l evenement » n est pas rendu');
  while (node) {
    const { position } = flatStyle(node);
    if (position) return String(position);
    node = node.parent;
  }
  return 'aucune';
};

/**
 * Hauteur DECLAREE du panneau replie (rangee + rembourrages + bordures). Ce
 * n'est pas une mesure a l'ecran, mais la somme que le style impose — donc
 * verifiable par commande.
 * @param {any} root - Racine du rendu.
 * @returns {number} - La hauteur declaree, en points.
 */
const collapsedPanelHeight = (/** @type {any} */ root) => {
  const [panel] = byTestId(root, PANEL_ID);
  const [row] = byTestId(root, PANEL_ROW_ID);
  if (!panel || !row) throw new Error('Le panneau compact n est pas rendu');
  const panelStyle = flatStyle(panel);
  const rowStyle = flatStyle(row);
  const vertical = Number(panelStyle.paddingVertical || 0);
  const top = Number(panelStyle.paddingTop || vertical);
  const bottom = Number(panelStyle.paddingBottom || vertical);
  const border = Number(panelStyle.borderWidth || 0) * 2;
  return Number(rowStyle.height || 0) + top + bottom + border;
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

describe('EventDetails — bas de page : etat LIVRE avant D21 (caracterisation)', () => {
  test('TEMOIN NEGATIF : sans suggestion et sans campagne, AUCUN geste de cotisation', () => {
    const root = asClubManager();

    expect(bottomActionInventory(root)).toEqual([]);
    expect(hasText(root, 'cotisation')).toBe(false);
  });

  test('replie, le menu tient dans 60 px declares', () => {
    const root = asOrganiser();

    expect(collapsedPanelHeight(root)).toBeLessThanOrEqual(60);
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
    openManagePanel(root);

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
    press(root, "Gérer l'événement");
    expect(pressableWithText(root, 'Cotisation')).toBeTruthy();
  });

  test('le nom raccourci ouvre le MEME reglage de campagne, en un seul tap', () => {
    const root = asClubManager({ params: { eventCampaignCreationSuggested: true } });
    press(root, "Gérer l'événement");
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
    press(root, "Gérer l'événement");

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
    openManagePanel(root);

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
    press(root, "Gérer l'événement");
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
    expect(managePanelPosition(root)).not.toBe('absolute');
  });

  test('le menu reste aligne a droite : c est une pastille, pas la bande d avant D21', () => {
    // Le defaut que D21 avait corrige ne doit pas revenir : le menu ne reprend
    // PAS toute une bande en pied d'ecran, il reste compact et cale a droite.
    const root = asOrganiser();
    const [enveloppe] = root.findAll(
      (/** @type {any} */ node) => flatStyle(node).alignItems === 'flex-end'
        && flatStyle(node).marginTop === 12,
    );

    expect(enveloppe).toBeTruthy();
    expect(isUnder(byTestId(root, 'event-manage-panel')[0], enveloppe)).toBe(true);
    expect(collapsedPanelHeight(root)).toBeLessThanOrEqual(60);
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
  test('AUCUN participant ne peut etre recouvert : le menu est en flux, et il precede la liste', () => {
    const root = asOrganiser();
    const panneau = byTestId(root, 'event-manage-panel')[0];
    const participants = participantsBlock(root);

    // 1. ⛔ EN FLUX. Sans cette ligne, le test reste VERT alors que le menu
    //    surplombe la liste : deux blocs se recouvrent tres bien quand l'un est
    //    en absolu. C'est le seul controle qui distingue « pose a cote » de
    //    « pose par-dessus ». (Verifie en retablissant la couche de D21 : les
    //    points 2 et 3 restaient verts, celui-ci tombe.)
    expect(managePanelPosition(root)).not.toBe('absolute');
    // 2. Les deux blocs sont distincts : la liste n'est pas rangee DANS le
    //    menu, ni le menu dans la liste.
    expect(isUnder(participants, panneau)).toBe(false);
    expect(isUnder(panneau, participants)).toBe(false);
    // 3. Et le menu vient AVANT la liste : en flux, donc il la repousse vers le
    //    bas au lieu de la masquer.
    // `findAll` parcourt en profondeur d'abord : l'ordre du tableau EST l'ordre
    // de rendu, donc l'ordre d'empilement d'un conteneur en colonne.
    const ordreDeRendu = root.findAll(() => true);
    expect(ordreDeRendu.indexOf(panneau)).toBeLessThan(ordreDeRendu.indexOf(participants));
  });

  test('deplie, la grille de chips repousse la liste au lieu de la masquer', () => {
    // Le pire cas de l'ancienne couche flottante : depliee, elle couvrait bien
    // plus que les 80 px reserves. En flux, elle ne peut plus rien couvrir.
    const root = asOrganiser();
    press(root, "Gérer l'événement");
    const grille = byTestId(root, 'event-manage-sheet')[0];
    const participants = participantsBlock(root);

    expect(grille).toBeTruthy();
    expect(flatStyle(grille).position).toBeUndefined();
    const ordreDeRendu = root.findAll(() => true);
    expect(ordreDeRendu.indexOf(grille)).toBeLessThan(ordreDeRendu.indexOf(participants));
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

  test('deplie : la grille de chips ne change pas — memes colonnes, un seul tap', () => {
    const root = asOrganiser();
    press(root, "Gérer l'événement");

    const widths = byTestId(root, 'event-manage-chip')
      .map((/** @type {any} */ node) => flatStyle(node).width);
    // Une chip orpheline en fin de grille prend toute la largeur : regle
    // inchangee, seul le nombre de chips a bouge (D21 ③ ajoute « Voir l'affiche »).
    expect(widths).toEqual(['48%', '48%', '48%', '48%', '100%']);

    press(root, 'Modifier');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
      params: { eventId: 'event-1' },
      screen: 'EventEdit',
    });
  });

  test('un seul menu sur un tournoi : les chips vivent dans la couche flottante', () => {
    const root = asOrganiser({ event: buildEvent({ type: { name: 'Tournoi' } }) });
    press(root, "Gérer l'événement");

    // Avant D21, un tournoi rendait DEUX panneaux (celui du bloc tournoi et
    // celui du pied d'ecran). Il n'y en a plus qu'un.
    expect(byTestId(root, PANEL_ID)).toHaveLength(1);
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
    expect(bottomActionInventory(root)).toEqual([
      'cancel', 'edit', 'featured', 'lineup', 'poster',
    ]);
  });

  test('TEMOIN NEGATIF : aucune action, aucune couche flottante', () => {
    const root = mountScreen();

    expect(byTestId(root, PANEL_ID)).toHaveLength(0);
    expect(root.findAll((/** @type {any} */ node) => node.props?.testID === 'event-manage-sheet'))
      .toHaveLength(0);
  });

  test('replie : aucune chip rendue — la couche ne coute que la pastille', () => {
    const root = asOrganiser();

    expect(byTestId(root, 'event-manage-chip')).toHaveLength(0);
    expect(hasText(root, "Gérer l'événement")).toBe(true);
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
  test('l affiche redevient atteignable, avec son eventId ET son gabarit', () => {
    const root = asOrganiser();
    press(root, "Gérer l'événement");
    press(root, "Voir l'affiche");

    expect(mockNavigate).toHaveBeenCalledWith('EventPublishedShowcase', {
      eventId: 'event-1',
      template: getEventShowcaseTemplate('Entrainement'),
    });
  });

  // D28 — le gabarit suit le TYPE de l'evenement ouvert, pas une constante.
  test('le gabarit passe est celui que le type de l evenement decide', () => {
    const root = asOrganiser({ event: buildEvent({ type: { name: "Détection / Séance d'essai" } }) });
    press(root, "Gérer l'événement");
    press(root, "Voir l'affiche");

    const [, params] = mockNavigate.mock.calls
      .find((/** @type {any} */ call) => call[0] === 'EventPublishedShowcase');
    expect(params.template).toBe(getEventShowcaseTemplate("Détection / Séance d'essai"));
  });

  test('aucune celebration rejouee : on consulte, on ne re-publie pas', () => {
    const root = asOrganiser();
    press(root, "Gérer l'événement");
    press(root, "Voir l'affiche");

    const [, params] = mockNavigate.mock.calls
      .find((/** @type {any} */ call) => call[0] === 'EventPublishedShowcase');
    expect(params).not.toHaveProperty('creationCelebration');
  });

  test('TEMOIN NEGATIF : un participant n a pas d entree vers l affiche', () => {
    const root = mountScreen();

    expect(bottomActionInventory(root)).not.toContain('poster');
  });

  test('TEMOIN NEGATIF : un dirigeant sans droit sur l evenement non plus', () => {
    const root = asClubManager({ params: { eventCampaignCreationSuggested: true } });

    expect(bottomActionInventory(root)).toEqual(['campaign']);
  });

  test('TEMOIN NEGATIF : la ou la route n existe pas, aucune chip muette', () => {
    // Le meme organisateur, mais dans un arbre de navigation ou
    // `EventPublishedShowcase` n'est pas enregistree (pile publique).
    const root = asOrganiser({ routeNames: ['EventDetails', 'EventEdit'] });
    const inventory = bottomActionInventory(root);

    expect(inventory).not.toContain('poster');
    expect(inventory).toContain('edit');
  });
});

// ── D64 — LE FILET, pose AVANT de deplacer le menu ──────────────────────────
// Ces deux temoins ne disent RIEN de l'endroit ou le menu est pose : ils sont
// verts avec le menu en pied de cadre (D53) comme en tete de contenu (D64).
// C'est exactement ce qu'on demande a un filet — survivre au deplacement qu'il
// protege, et ne tomber que si le deplacement casse quelque chose.
describe('D64 — le filet : deux invariants qui ne dependent pas de l endroit', () => {
  test('le panneau « Gerer l evenement » est atteignable, ou qu il soit pose', () => {
    const root = asOrganiser();

    expect(byTestId(root, PANEL_ID)[0]).toBeTruthy();

    // Atteignable au DOIGT et au LECTEUR D'ECRAN : un role annonce, un libelle
    // non vide, et une cible d'au moins 44 pt (le minimum tactile).
    const bascule = pressableWithText(root, "Gérer l'événement");
    expect(bascule).toBeTruthy();
    expect(bascule.props.accessibilityRole).toBe('button');
    expect(String(bascule.props.accessibilityLabel || '').length).toBeGreaterThan(0);
    expect(Number(flatStyle(byTestId(root, PANEL_ROW_ID)[0]).height)).toBeGreaterThanOrEqual(44);

    // Et il OUVRE : un seul appui suffit a faire apparaitre les chips.
    press(root, "Gérer l'événement");
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

    // 1. RIEN NE SURPLOMBE. Le menu est en flux, replie comme deplie : un frere
    //    en flux repousse son voisin, il ne peut pas passer par-dessus.
    expect(managePanelPosition(organisateur)).not.toBe('absolute');
    press(organisateur, "Gérer l'événement");
    expect(byTestId(organisateur, 'event-manage-sheet')[0]).toBeTruthy();
    expect(managePanelPosition(organisateur)).not.toBe('absolute');

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
    // ecran, il s'eloignait du contenu a mesure que la page etait courte. Pose
    // dans le flux, il suit le contenu — donc plus rien a caler.
    // ⚠️ Un arbre a la fois : on finit tout sur celui-ci avant de monter le
    // suivant (mocks partages, cf. le temoin precedent).
    [0, 1, 50].forEach((nombre) => {
      const participations = Array.from({ length: nombre }, (_, index) => ({
        documentId: `part-${index}`,
        status: 'accepted',
        user: { documentId: `joueur-${index}` },
      }));
      const root = asOrganiser({ event: buildEvent({ participations }) });
      const panneau = byTestId(root, PANEL_ID)[0];
      const ordreDeRendu = root.findAll(() => true);

      expect(panneau).toBeTruthy();
      expect(managePanelPosition(root)).not.toBe('absolute');
      expect(ordreDeRendu.indexOf(panneau))
        .toBeLessThan(ordreDeRendu.indexOf(participantsBlock(root)));
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
});
