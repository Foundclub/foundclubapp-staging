import { Alert, InteractionManager, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// EVEDIT-2 / D5 — LE FILET AVANT LE CORRECTIF.
//
// 🧱 LE DEFAUT, TEL QU'ADEL LE VIT (recette du 2026-08-27, 2.6.30) :
//   G1 — « J'appuie sur actions evenement -> Modifier : LA POP RESTE OUVERTE,
//         et quand je clique sur un champ il ne s'ouvre pas instantanement.
//         Mais si je clique DEUX FOIS ca marche. »
//   G6 — « Si je fais une action, pour qu'elle soit prise en compte je dois
//         faire une AUTRE action. »
//
// 🔑 CE N'EST PAS DE LA LENTEUR, C'EST UN APPUI MANGE. La feuille « Gerer
// l'evenement » n'etait JAMAIS fermee avant de naviguer : elle restait montee
// PAR-DESSUS l'ecran suivant, et sa couche transparente interceptait le premier
// contact. Le deuxieme appui passait parce qu'entre-temps la couche avait fini
// de disparaitre. Un seul defaut, deux symptomes.
//
// 🎯 CE QUE CE TEMOIN EPINGLE, ET C'EST LE POINT DE SORTIE COMMUN (D2) :
// les SIX actions de la feuille sortent par la meme porte — `renderManageRow`.
// Le temoin ne vise donc pas « Modifier », il vise TOUTES les rangees rendues,
// en boucle. Une rustine posee sur un seul bouton le laisserait rouge.
//
// 🪤 LA DOUBLURE DE FEUILLE EST FIDELE, ET C'EST TOUT L'INTERET. Les huit
// autres temoins de cet ecran emploient une doublure qui retire le contenu DES
// QUE `isVisible` tombe : elle n'a donc pas de « pendant la fermeture », et ne
// pourrait pas voir le defaut. Celle-ci garde le contenu monte apres la
// demande de fermeture — exactement comme la vraie feuille pendant son
// animation (`BottomModal.js` : `setShouldRender(false)` n'arrive qu'a la FIN,
// dans `handleDismiss`) — et ne le retire que lorsque le test dit
// « l'animation est finie ».
//
// ⛔ CE TEMOIN INTERDIT AUSSI LE FAUX REMEDE : un `setTimeout` en dur pour
// « laisser le temps » a l'animation. Le troisieme test exige que l'action
// parte AU MOMENT ou la feuille quitte l'arbre — pas quelques millisecondes
// plus tard. Un pari sur la vitesse du telephone le rendrait rouge.
//
// Le montage est celui, eprouve, de `EventDetailsEvedit1BoutonModifier.test.js`.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockPerfMark = jest.fn();
const mockCancelEventMutate = jest.fn();
const mockPrefetch = jest.fn();
/** @type {any[]} */
const mockFeuilles = [];
const mockEventQuery = { data: null };
const mockTeamCompositionQuery = { data: null };

// 🧨 CE MOCK N EST PAS DECORATIF. `teamMembershipRequestService` importe
// `@/services/client`, qui JETTE AU CHARGEMENT quand `.env` est absent — et
// `.env` est gitignore, donc absent de toute copie de travail. Sans cette
// doublure, la SUITE ENTIERE tombe a 0 test execute.
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

// ⛔ Jamais un Proxy pour le theme : il rend les echecs Jest illisibles.
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
    prefetchQuery: mockPrefetch,
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
  useGetEventTeamComposition: () => ({ ...emptyQuery(), data: mockTeamCompositionQuery.data }),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseCampaigns: () => ({ ...emptyQuery(), data: { data: [] } }),
}));

jest.mock('@/services/tournamentCompetition/tournamentCompetitionQueries', () => ({
  useGetTournamentDashboard: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => emptyQuery(),
  useGetEventMyMatchResponse: () => emptyQuery(),
}));

jest.mock('@/services/event/eventService', () => ({
  approveFeatured: jest.fn(),
  exportEventParticipants: jest.fn(),
  getEventByIdForEdit: jest.fn(() => Promise.resolve({ documentId: 'event-1' })),
  getEventTypes: jest.fn(() => Promise.resolve([])),
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
  markEventDetailsPerf: (/** @type {any} */ ...args) => mockPerfMark(...args),
}));

jest.mock('../hooks/useEventMutations', () => {
  const idleMutation = () => ({ isPending: false, mutate: jest.fn() });
  return {
    useEventMutations: () => ({
      acceptParticipationMutation: idleMutation(),
      bookFullMutation: idleMutation(),
      cancelEventMutation: { isPending: false, mutate: mockCancelEventMutate },
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

// 🪤 LA DOUBLURE FIDELE — celle qui a un « PENDANT LA FERMETURE ».
//
// La vraie feuille (`BottomModal.js`) ne retire son contenu de l'arbre qu'a la
// FIN de l'animation de sortie : `setShouldRender(false)` vit dans
// `handleDismiss`, qui est branche sur le `onDismiss` de la bibliotheque. Entre
// l'appui et cet instant, la couche est TOUJOURS LA et avale les contacts.
//
// Cette doublure reproduit exactement ca : `isVisible` peut tomber a faux, le
// contenu reste monte jusqu'a ce que le test appelle `terminerFermeture()`.
// C'est la seule facon de distinguer « on navigue pendant que la feuille est
// encore la » (le defaut) de « on navigue une fois qu'elle est partie » (le
// remede).
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BottomModalDouble(/** @type {any} */ props) {
    const [monte, setMonte] = react.useState(Boolean(props.isVisible));
    const poignee = react.useRef(/** @type {any} */ ({})).current;

    react.useEffect(() => {
      if (props.isVisible) setMonte(true);
    }, [props.isVisible]);

    react.useEffect(() => {
      mockFeuilles.push(poignee);
      return () => {
        const index = mockFeuilles.indexOf(poignee);
        if (index >= 0) mockFeuilles.splice(index, 1);
      };
    }, [poignee]);

    poignee.props = props;
    poignee.monte = monte;
    // Ce que la bibliotheque fait a la fin de l'animation, dans cet ordre :
    // elle retire le contenu de l'arbre, puis elle previent l'appelant.
    poignee.terminerFermeture = () => {
      setMonte(false);
      props.onDismissed?.();
    };

    if (!monte) return null;
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

// 🎛️ `SegmentedControl` importe `react-native-gesture-handler`, dont un fichier
// n'est PAS couvert par le `transformIgnorePatterns` du depot : sans doublure,
// la SUITE ENTIERE meurt au chargement et AUCUN test ne s'execute.
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

// Le premier montage transpile tout le graphe d'imports de l'ecran :
// au-dela des 5 s par defaut de Jest sur un poste froid, sans que rien ne soit casse.
jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';

// Les routes que la pile connait : sans elles, `hasRouteInNavigationTree`
// retire « Voir l'affiche » et « Faire venir des joueurs » du menu, et le
// balayage de D2 porterait sur moins de rangees qu'en vrai.
const ROUTES_CONNUES = [
  'EventDetails',
  'EventEdit',
  'EventPublishedShowcase',
  'EventWizardType',
  'MatchCallUpSelection',
  'DetectionSquadSetup',
  'MatchStatsEditor',
  'TournamentSettingsEdit',
  'TournamentManagement',
];

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

const mountScreen = (/** @type {any} */ { auth, event, params } = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockUseAuth.mockReturnValue(defaultAuth(auth));

  act(() => {
    mounted = renderer.create(
      <EventDetails
        navigation={{
          addListener: () => () => {},
          getState: () => ({ routeNames: ROUTES_CONNUES }),
          goBack: jest.fn(),
          navigate: mockNavigate,
          setOptions: mockSetOptions,
        }}
        route={{ params: params || { eventId: 'event-1' } }}
      />,
    );
  });

  return mounted.root;
};

/**
 * Le pressable d'une rangee du menu, atteint par la CLEF de son libelle puis
 * remonte jusqu'au `TouchableOpacity` qui le porte.
 * @param {any} root - Racine du rendu.
 * @param {string} cle - La cle de la rangee.
 * @returns {any} - Le pressable, ou null.
 */
const rangeeDuMenu = (/** @type {any} */ root, /** @type {string} */ cle) => {
  const [etiquette] = root.findAll(
    (/** @type {any} */ node) => node.props?.testID === `event-manage-label-${cle}`,
    { deep: false },
  );
  let noeud = etiquette ? etiquette.parent : null;
  while (noeud && noeud.type !== TouchableOpacity) noeud = noeud.parent;

  return noeud;
};

/**
 * Les clefs de toutes les rangees actuellement rendues dans la feuille.
 * @param {any} root - Racine du rendu.
 * @returns {string[]} - Les clefs, dans l'ordre d'affichage.
 */
const clefsDesRangees = (/** @type {any} */ root) => root
  .findAll(
    (/** @type {any} */ node) => typeof node.props?.testID === 'string'
      && node.props.testID.startsWith('event-manage-label-'),
    { deep: false },
  )
  .map((/** @type {any} */ node) => String(node.props.testID).replace('event-manage-label-', ''));

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
 * La poignee de la feuille « Gerer l'evenement » parmi les feuilles montees.
 * On la reconnait a son cadre, qui porte `event-manage-sheet`.
 * @returns {any} - La poignee, ou null.
 */
const feuilleDeGestion = () => mockFeuilles.find((/** @type {any} */ poignee) => (
  poignee.monte
  && chercherDansElements(
    poignee.props?.children,
    (/** @type {any} */ noeud) => noeud?.props?.testID === 'event-manage-sheet',
  )
)) || null;

/**
 * Monte l'ecran vu par un organisateur, et ouvre la feuille de gestion.
 * @param {any} evenement - L'evenement affiche.
 * @returns {any} - La racine du rendu.
 */
const monterEtOuvrirLeMenu = (evenement) => {
  const root = mountScreen({
    auth: {
      canEditEvent: () => true,
      canManageEvent: () => true,
      userData: { documentId: 'user-1', role: { name: 'Entraineur' } },
    },
    event: evenement,
  });
  const bouton = boutonDeGestion();
  if (bouton) {
    act(() => {
      bouton.props.onPress();
    });
  }

  return root;
};

/**
 * Le nombre total d'effets observables declenches jusqu'ici : une navigation,
 * un prechargement, un message. C'est le compteur qui dit « quelque chose est
 * parti » sans avoir a nommer laquelle des six actions on vient de toucher.
 * @returns {number} - Le total.
 */
const effetsObserves = () => mockNavigate.mock.calls.length
  + mockPrefetch.mock.calls.length
  + (alerte ? alerte.mock.calls.length : 0);

const MATCH = () => buildEvent({
  name: 'Match contre Lyon',
  type: { name: 'Match' },
});

/** @type {any} */
let alerte = null;

beforeEach(() => {
  mockPrefetch.mockClear();
  mockNavigate.mockReset();
  mockSetOptions.mockClear();
  mockCancelEventMutate.mockClear();
  mockFeuilles.length = 0;
  alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  if (mounted) act(() => mounted.unmount());
  mounted = null;
  if (alerte) alerte.mockRestore();
  alerte = null;
});

// ---------------------------------------------------------------------------
// D5 / D1 — LA FEUILLE PART D'ABORD, L'ECRAN S'OUVRE ENSUITE
// ---------------------------------------------------------------------------
describe('EVEDIT-2 / D1 — la feuille part AVANT que l ecran suivant s ouvre', () => {
  test('choisir « Modifier » demande tout de suite la fermeture de la feuille', () => {
    const root = monterEtOuvrirLeMenu(buildEvent());
    const feuille = feuilleDeGestion();
    expect(feuille).not.toBeNull();

    act(() => {
      rangeeDuMenu(root, 'edit').props.onPress();
    });

    // La feuille a recu l'ordre de partir des le premier appui.
    expect(feuille.props.isVisible).toBe(false);
  });

  test('⛔ et l ecran de modification ne s ouvre PAS tant que la couche est la', () => {
    const root = monterEtOuvrirLeMenu(buildEvent());
    const feuille = feuilleDeGestion();

    act(() => {
      rangeeDuMenu(root, 'edit').props.onPress();
    });

    // 🧨 C'EST ICI QUE LE DEFAUT SE VOIT. Avant le correctif, la navigation
    // partait immediatement : l'ecran de modification s'ouvrait SOUS une
    // feuille encore montee, dont la couche avalait le premier appui sur le
    // premier champ. « Si je clique deux fois ca marche. »
    expect(feuille.monte).toBe(true);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('✅ puis il s ouvre AU MOMENT ou la feuille quitte l ecran', () => {
    const root = monterEtOuvrirLeMenu(buildEvent());
    const feuille = feuilleDeGestion();

    act(() => {
      rangeeDuMenu(root, 'edit').props.onPress();
    });
    act(() => {
      feuille.terminerFermeture();
    });

    // ⛔ CE TEST INTERDIT LE FAUX REMEDE : un `setTimeout` en dur ne serait pas
    // encore parti a cet instant precis. L'action doit etre branchee sur la FIN
    // DE FERMETURE, pas sur un pari de duree.
    expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
      params: { eventId: 'event-1' },
      screen: 'EventEdit',
    });
  });

  test('et le prechargement d EVEDIT-1 part toujours AVANT la navigation', () => {
    const root = monterEtOuvrirLeMenu(buildEvent());
    const feuille = feuilleDeGestion();

    act(() => {
      rangeeDuMenu(root, 'edit').props.onPress();
    });
    act(() => {
      feuille.terminerFermeture();
    });

    const clefs = mockPrefetch.mock.calls.map((/** @type {any} */ appel) => appel[0].queryKey);
    expect(clefs).toEqual(
      expect.arrayContaining([['event', 'event-1', 'edit'], ['event-types']]),
    );
    expect(Math.max(...mockPrefetch.mock.invocationCallOrder))
      .toBeLessThan(mockNavigate.mock.invocationCallOrder[0]);
  });
});

// ---------------------------------------------------------------------------
// D2 — LA CORRECTION VIT AU POINT DE SORTIE COMMUN, PAS SUR « MODIFIER »
// ---------------------------------------------------------------------------
describe('EVEDIT-2 / D2 — les rangees sortent TOUTES par la meme porte', () => {
  test('la feuille d un match porte bien plusieurs actions', () => {
    const root = monterEtOuvrirLeMenu(MATCH());

    // Le balayage ci-dessous ne prouve rien s'il ne balaye qu'une rangee.
    expect(clefsDesRangees(root).length).toBeGreaterThan(1);
  });

  test('⛔ AUCUNE rangee ne declenche son action tant que la feuille est montee', () => {
    const clefs = clefsDesRangees(monterEtOuvrirLeMenu(MATCH()));

    clefs.forEach((cle) => {
      // Chaque rangee est jugee sur un ecran neuf : une action deja partie
      // fausserait le compteur de la suivante.
      if (mounted) act(() => mounted.unmount());
      mounted = null;
      mockNavigate.mockClear();
      mockPrefetch.mockClear();
      alerte.mockClear();
      mockFeuilles.length = 0;

      const root = monterEtOuvrirLeMenu(MATCH());
      const feuille = feuilleDeGestion();
      const rangee = rangeeDuMenu(root, cle);
      if (!rangee || rangee.props.disabled) return;

      act(() => {
        rangee.props.onPress();
      });

      // La rangee a ferme la feuille…
      expect(feuille.props.isVisible).toBe(false);
      // …et n'a RIEN lance pendant que la couche etait encore en place.
      expect(effetsObserves()).toBe(0);
    });
  });

  test('✅ et chaque rangee agit une fois la feuille partie', () => {
    const clefs = clefsDesRangees(monterEtOuvrirLeMenu(MATCH()));
    /** @type {string[]} */
    const muettes = [];

    clefs.forEach((cle) => {
      if (mounted) act(() => mounted.unmount());
      mounted = null;
      mockNavigate.mockClear();
      mockPrefetch.mockClear();
      alerte.mockClear();
      mockFeuilles.length = 0;

      const root = monterEtOuvrirLeMenu(MATCH());
      const feuille = feuilleDeGestion();
      const rangee = rangeeDuMenu(root, cle);
      if (!rangee || rangee.props.disabled) return;

      act(() => {
        rangee.props.onPress();
      });
      act(() => {
        feuille.terminerFermeture();
      });

      // Les rangees qui ouvrent une AUTRE feuille (« A la une », le score)
      // n'ont pas d'effet observable ici : elles ne sont pas comptees muettes
      // a tort, on ne retient que celles dont on sait qu'elles voyagent.
      if (['cancel', 'edit', 'lineup', 'matchStats', 'poster'].includes(cle)
        && effetsObserves() === 0) {
        muettes.push(cle);
      }
    });

    // ⛔ Une action qui ne repart JAMAIS serait pire que le defaut d'origine.
    expect(muettes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// LES CAS LIMITES — fermer sans choisir, et rouvrir
// ---------------------------------------------------------------------------
describe('EVEDIT-2 / D1 — fermer sans choisir ne declenche rien', () => {
  test('glisser la feuille vers le bas n ouvre aucun ecran', () => {
    monterEtOuvrirLeMenu(buildEvent());
    const feuille = feuilleDeGestion();

    act(() => {
      feuille.props.close();
    });
    act(() => {
      feuille.terminerFermeture();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(effetsObserves()).toBe(0);
  });

  test('rouvrir la feuille ne rejoue pas l action a peine annulee', () => {
    const root = monterEtOuvrirLeMenu(buildEvent());
    const feuille = feuilleDeGestion();

    // On touche « Modifier », puis on rouvre la feuille avant qu'elle ait fini
    // de partir : la bibliotheque represente alors la meme feuille sans jamais
    // emettre sa fermeture (`staleDismissUntilRef`, `BottomModal.js`).
    act(() => {
      rangeeDuMenu(root, 'edit').props.onPress();
    });
    act(() => {
      boutonDeGestion().props.onPress();
    });
    act(() => {
      feuille.props.close();
    });
    act(() => {
      feuille.terminerFermeture();
    });

    // ⛔ L'action ne doit pas ressortir plus tard, sur une fermeture qui n'a
    // rien a voir avec elle.
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// D4 — LE VERDICT SUR G6 : « je dois faire une AUTRE action »
// ---------------------------------------------------------------------------
//
// 🎯 G6 N'EST PAS UNE LENTEUR, C'EST LE MEME APPUI MANGE. Adel decrit sur
// « Enregistrer » exactement ce qu'il decrit sur les champs (G1) : le premier
// appui ne compte pas, le second passe. La feuille etait restee montee au-dessus
// de l'ecran de modification pendant TOUT le sejour sur cet ecran — donc
// au-dessus du bouton « Enregistrer » aussi.
//
// 🔬 LES DEUX AUTRES CAUSES POSSIBLES ONT ETE MESUREES ET ECARTEES :
//   1. le clavier qui avale le premier appui — ECARTE : `EventEdit.js` pose
//      `keyboardShouldPersistTaps="always"` sur sa zone defilante, et le bouton
//      « Enregistrer » vit HORS de cette zone, apres `</ScrollView>` ;
//   2. l'enregistrement qui attend les rafraichissements — ECARTE : EVEDIT-1/R1
//      a deja rendu les trois `invalidateQueries` non bloquantes
//      (`EventEdit.js`, dans le `onSuccess` de la mutation).
//
// ⇒ Ce que ce temoin verrouille : au moment ou l'ecran suivant s'ouvre, PLUS
// AUCUNE feuille ne demande a etre affichee. Rien ne peut donc s'interposer
// entre le doigt et le premier champ, ni entre le doigt et « Enregistrer ».
describe('EVEDIT-2 / D4 — aucune couche ne survit au-dessus de l ecran d arrivee', () => {
  test('quand la navigation part, plus aucune feuille ne demande l affichage', () => {
    /** @type {number[]} */
    const feuillesVisiblesALaNavigation = [];
    mockNavigate.mockImplementation(() => {
      feuillesVisiblesALaNavigation.push(
        mockFeuilles.filter((/** @type {any} */ poignee) => poignee.props?.isVisible).length,
      );
    });

    const root = monterEtOuvrirLeMenu(buildEvent());
    const feuille = feuilleDeGestion();

    act(() => {
      rangeeDuMenu(root, 'edit').props.onPress();
    });
    act(() => {
      feuille.terminerFermeture();
    });

    // 🧨 AVANT LE CORRECTIF, ce releve valait [1] : on naviguait alors que la
    // feuille se declarait encore visible. C'est ce « 1 » qui mangeait l'appui.
    expect(feuillesVisiblesALaNavigation).toEqual([0]);
  });
});

// ---------------------------------------------------------------------------
// D3 — LE BALAYAGE : L'AUTRE SORTIE DE FEUILLE DE CET ECRAN
// ---------------------------------------------------------------------------
//
// Le balayage du lot a trouve UNE seule autre feuille de cet ecran qui menait
// ailleurs : celle de fin de creation (« Bravo, ton evenement est en ligne »).
// Elle fermait ET naviguait dans la meme foulee — la forme qui PARAIT correcte
// et ne l'est pas, puisque la fermeture est animee.
//
// 🏷️ Ce bloc verrouille aussi l'ETIQUETTE : deux feuilles se partagent le meme
// rangement, et la fermeture de l'une ne doit JAMAIS lancer l'action armee par
// l'autre.
describe('EVEDIT-2 / D3 — la feuille de fin de creation part elle aussi d abord', () => {
  /**
   * Monte l'ecran juste apres une creation, ce qui fait apparaitre la feuille
   * de suivi d'abonnement, puis rend sa poignee et son bouton.
   * @returns {any} - { feuille, bouton, root }
   */
  const monterApresCreation = () => {
    const root = mountScreen({
      auth: {
        canEditEvent: () => true,
        canManageEvent: () => true,
        subscriptionAccessLevel: 'FREE',
        userData: { documentId: 'user-1', role: { name: 'Entraineur' } },
      },
      event: buildEvent(),
      params: {
        eventId: 'event-1',
        fromEventCreation: true,
        subscriptionFollowUp: { beforeRemaining: 1, consumedCount: 1, total: 2 },
      },
    });

    act(() => {
      jest.advanceTimersByTime(1200);
    });

    const feuille = mockFeuilles.find((/** @type {any} */ poignee) => poignee.monte
      && chercherDansElements(
        poignee.props?.children,
        (/** @type {any} */ noeud) => noeud?.props?.title === 'Voir mon abonnement',
      ));

    return {
      bouton: feuille ? chercherDansElements(
        feuille.props.children,
        (/** @type {any} */ noeud) => noeud?.props?.title === 'Voir mon abonnement',
      ) : null,
      feuille,
      root,
    };
  };

  /** @type {any} */
  let interactions = null;

  beforeEach(() => {
    // `runAfterInteractions` ne rend jamais la main tout seul sous Jest : on
    // lui demande d'executer sa suite tout de suite, sinon la feuille ne
    // s'ouvre pas et le temoin ne mesurerait rien.
    interactions = jest.spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((/** @type {any} */ rappel) => {
        if (typeof rappel === 'function') rappel();
        return { cancel: () => {}, done: Promise.resolve(), then: () => {} };
      });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (interactions) interactions.mockRestore();
    interactions = null;
  });

  test('la feuille de fin de creation s ouvre bien', () => {
    const { feuille } = monterApresCreation();

    // Sans elle, les deux temoins suivants ne mesureraient rien.
    expect(feuille).toBeTruthy();
  });

  test('⛔ « Voir mon abonnement » n ouvre pas les offres pendant la fermeture', () => {
    const { bouton, feuille } = monterApresCreation();

    act(() => {
      bouton.props.onPress();
    });

    expect(feuille.props.isVisible).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('✅ et il les ouvre des que la feuille est partie', () => {
    const { bouton, feuille } = monterApresCreation();

    act(() => {
      bouton.props.onPress();
    });
    act(() => {
      feuille.terminerFermeture();
    });

    expect(mockNavigate).toHaveBeenCalledWith('ProfileStack', expect.objectContaining({
      screen: 'SubscriptionOffers',
    }));
  });

  test('🏷️ la fermeture d une feuille ne lance JAMAIS l action armee par l autre', () => {
    const { feuille: feuilleAbonnement, root } = monterApresCreation();

    // On arme depuis le menu ⋯ …
    act(() => {
      boutonDeGestion().props.onPress();
    });
    const feuilleGestion = feuilleDeGestion();
    act(() => {
      rangeeDuMenu(root, 'edit').props.onPress();
    });

    // … puis c'est l'AUTRE feuille qui finit de partir.
    act(() => {
      feuilleAbonnement.terminerFermeture();
    });
    expect(mockNavigate).not.toHaveBeenCalled();

    // L'action n'est pas perdue pour autant : elle attend SA feuille.
    act(() => {
      feuilleGestion.terminerFermeture();
    });
    expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
      params: { eventId: 'event-1' },
      screen: 'EventEdit',
    });
  });
});
