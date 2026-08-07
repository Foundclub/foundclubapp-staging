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

const openManagePanel = (/** @type {any} */ root) => {
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
  const collect = (/** @type {string} */ needle, /** @type {string} */ key) => {
    if (labels.some((/** @type {string} */ value) => value.includes(needle))) found.add(key);
  };

  // « cotisation » est le repere qui traverse le raccourcissement du libelle :
  // il attrape « Preparer la campagne de cotisation » comme « Preparer la cotisation ».
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

const byTestId = (/** @type {any} */ root, /** @type {string} */ id) => root
  .findAll((/** @type {any} */ node) => node.props?.testID === id && node.type === View);

const flatStyle = (/** @type {any} */ node) => StyleSheet.flatten(node?.props?.style) || {};

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
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
    mounted = null;
  }
  jest.restoreAllMocks();
});

describe('EventDetails — bas de page : ce qui est atteignable (invariant D21)', () => {
  test('organisateur, campagne suggeree : les 5 actions restent atteignables', () => {
    const root = asOrganiser({ params: { eventCampaignCreationSuggested: true } });

    expect(bottomActionInventory(root)).toEqual([
      'campaign', 'cancel', 'edit', 'featured', 'lineup',
    ]);
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
  test('la cotisation est un bouton DE PAGE, visible sans ouvrir le menu', () => {
    const root = asClubManager({ params: { eventCampaignCreationSuggested: true } });

    expect(pressableWithText(root, 'Préparer la campagne de cotisation')).toBeTruthy();
  });

  test('TEMOIN NEGATIF : sans suggestion et sans campagne, AUCUN geste de cotisation', () => {
    const root = asClubManager();

    expect(bottomActionInventory(root)).toEqual([]);
    expect(hasText(root, 'cotisation')).toBe(false);
  });

  test('« Créer une campagne de cotisation » est INJOIGNABLE : sa condition est morte', () => {
    // Le libelle « Creer une campagne… » n'est choisi que quand
    // `eventCampaignCreationSuggested` est faux ; or la garde du bloc rend deja
    // `null` dans ce cas des qu'aucune campagne n'existe. Les deux seuls etats
    // possibles rendent donc soit « Preparer… », soit la liste des campagnes.
    const suggested = asClubManager({ params: { eventCampaignCreationSuggested: true } });
    expect(hasText(suggested, 'Préparer la campagne de cotisation')).toBe(true);
    expect(hasText(suggested, 'Créer une campagne de cotisation')).toBe(false);

    act(() => {
      mounted.unmount();
    });
    mounted = null;

    const notSuggested = asClubManager();
    expect(hasText(notSuggested, 'Créer une campagne de cotisation')).toBe(false);
  });

  test('le menu « Gérer l evenement » est EN FLUX, il ne flotte pas', () => {
    const root = asOrganiser();

    expect(managePanelPosition(root)).not.toBe('absolute');
  });

  test('replie, le menu tient dans 60 px declares', () => {
    const root = asOrganiser();

    expect(collapsedPanelHeight(root)).toBeLessThanOrEqual(60);
  });

  test('la liste defilante ne reserve que 40 px sous son dernier bloc', () => {
    const root = asOrganiser();

    expect(scrollContentStyle(root).paddingBottom).toBe(40);
  });

  test('TEMOIN NEGATIF : aucun chemin vers l affiche depuis le detail', () => {
    const root = asOrganiser();
    openManagePanel(root);

    expect(pressableWithText(root, 'affiche')).toBeUndefined();
    expect(mockNavigate).not.toHaveBeenCalledWith(
      'EventPublishedShowcase',
      expect.anything(),
    );
  });

  test('TROU CONSTATE : sur un tournoi, la cotisation n est atteignable par AUCUN chemin', () => {
    // `renderActionButtons` sort en `null` des que l'evenement est un tournoi :
    // le bloc cotisation n'est jamais calcule, meme suggere.
    const root = asOrganiser({
      event: buildEvent({ type: { name: 'Tournoi' } }),
      params: { eventCampaignCreationSuggested: true },
    });

    expect(bottomActionInventory(root)).not.toContain('campaign');
  });

  test('TROU CONSTATE : une demande « a la une » a valider efface tout le menu', () => {
    // Le pied d'ecran choisit ENTRE valider/refuser ET `renderActionButtons()` :
    // tant qu'une demande attend, l'organisateur perd modifier, compo, annuler.
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
    expect(bottomActionInventory(root)).toEqual([]);
  });
});
