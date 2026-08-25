import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// R5 (vague R, retours de recette de la 2.6.26) — DEUX CONSTATS D'ADEL, UN SEUL
// ECRAN : la feuille « Gerer l'evenement » est TROP PETITE (on ne voit pas
// toutes les actions du premier coup), et « Modifier » MET DU TEMPS a s'ouvrir.
//
// Ce fichier verrouille les deux gestes, et RIEN D'AUTRE :
//   (a) la feuille reclame explicitement un plafond plus haut que le defaut du
//       composant partage — sans le deplacer pour ses 70 autres appelants ;
//   (b) toucher « Modifier » fait PARTIR les deux lectures dont EventEdit a
//       besoin, AVANT la navigation, sous les clefs EXACTES qu'il relit.
//
// 🔑 Le point qui fait tout le travail en (b) est la CLEF. Un caractere d'ecart
// et le prechargement remplirait une case que personne ne lit : l'ecran
// repartirait au reseau, l'attente serait la meme, et les temoins resteraient
// verts. C'est pour ca qu'on ne compte pas les appels : on RELIT la clef, et on
// APPELLE la fonction de chargement pour voir ce qu'elle demande vraiment.
//
// ⚠️ CE QU'IL NE PROUVE PAS : aucun temps en millisecondes. Jest ne mesure pas
// une attente reseau ; le gain se constate en recette, sur un telephone.
//
// La doublure d'ecran est celle, eprouvee, de EventDetailsManagePanel.test.js —
// mocks compris. Deux ecarts, et deux seulement : le client de requetes expose
// ici un `prefetchQuery` espionne, et la doublure de `BottomModal` GARDE les
// proprietes qu'on lui donne, puisque c'est exactement ce qui est mesure.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
// L4-B : partage, pour pouvoir relire le `headerRight` que l ecran y depose.
const mockSetOptions = jest.fn();
const mockPerfMark = jest.fn();
const mockCancelEventMutate = jest.fn();
const mockPrefetch = jest.fn();
/** @type {any[]} */
const mockFeuillesRendues = [];
const mockEventQuery = { data: null };
const mockTeamCompositionQuery = { data: null };

// `initReactI18next` doit rester le vrai : le graphe d'imports de l'ecran
// initialise i18next au chargement, et un module indefini le fait exploser.
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
// illisibles (piege paye au lot paywall). Seul Images est stube, pour ne pas
// dependre de la resolution des assets.
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
  // D44 : la charge de composition decide a elle seule si l'ecran propose la
  // creation automatique d'equipes. Elle reste `null` par defaut, donc tous les
  // tests d'avant voient exactement ce qu'ils voyaient.
  useGetEventTeamComposition: () => ({ ...emptyQuery(), data: mockTeamCompositionQuery.data }),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseCampaigns: () => ({ ...emptyQuery(), data: { data: [] } }),
}));

// 🏆 N7 item 5 (vague P, 23/08) — le fil du tournoi lit `useGetTournamentDashboard`,
// qui tire `@/services/client`. Sans cette doublure MUETTE, la suite entiere
// tombe a 0 test (piege connu : un import de service de plus). `data: undefined`
// = le calcul de repli de la page, identique a ce que ces temoins decrivaient.
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
  // R5 (b) : ces deux-la ne sont pas du decor. Les temoins APPELLENT la
  // fonction de chargement confiee au prechargement, pour lire ce qu elle
  // demande — une bonne clef sur la mauvaise donnee resterait verte sinon.
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

// La doublure de Button rend un VRAI pressable portant son titre : sans ca, un
// bouton et une chip TouchableOpacity ne se pilotent pas de la meme facon et le
// test mourrait a la refonte.
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
    mockFeuillesRendues.push(props);
    return react.createElement(rn.View, null, props.children);
  };
});

// Une fabrique jest.mock est remontee en tete de fichier : elle ne peut donc
// pas s'appuyer sur un import ESM, evalue trop tard. Le require local est ici
// la seule facon d'avoir une doublure partagee.
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

// Le premier montage transpile tout le graphe d'imports de l'ecran (6 060 lignes) :
// au-dela des 5 s par defaut de Jest sur un poste froid, sans que rien ne soit casse.
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

const mountScreen = (/** @type {any} */ { auth, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockUseAuth.mockReturnValue(defaultAuth(auth));

  act(() => {
    mounted = renderer.create(
      <EventDetails
        navigation={{
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: mockNavigate,
          setOptions: mockSetOptions,
        }}
        route={{ params: { eventId: 'event-1' } }}
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

const eventService = require('@/services/event/eventService');

/**
 * Les proprietes recues par la feuille d'organisation, reperee par la carte
 * qu'elle est SEULE a porter (`event-manage-sheet`). Prendre la derniere
 * feuille rendue serait faux : l'ecran en monte plusieurs.
 * @returns {any} - Les proprietes de la feuille, ou null si elle n'est pas la.
 */
const feuilleDeGestion = () => mockFeuillesRendues.find(
  (/** @type {any} */ proprietes) => chercherDansElements(
    proprietes.children,
    (/** @type {any} */ noeud) => noeud?.props?.testID === 'event-manage-sheet',
  ),
) || null;

/**
 * Monte l'ecran vu par un organisateur, ouvre son menu, et rend sa racine.
 * @returns {any} - La racine du rendu.
 */
const monterEtOuvrirLeMenu = () => {
  const root = mountScreen({
    auth: {
      canEditEvent: () => true,
      canManageEvent: () => true,
      userData: { documentId: 'user-1', role: { name: 'Entraineur' } },
    },
  });
  ouvrirLaFeuilleDeGestion();

  return root;
};

beforeEach(() => {
  mockPrefetch.mockClear();
  mockNavigate.mockClear();
  mockSetOptions.mockClear();
  mockFeuillesRendues.length = 0;
  eventService.getEventByIdForEdit.mockClear();
  eventService.getEventTypes.mockClear();
});

afterEach(() => {
  if (mounted) act(() => mounted.unmount());
  mounted = null;
});

describe('R5 (a) — la feuille « Gerer l evenement » n est plus bridee a 70 %', () => {
  test('elle reclame explicitement 90 % de la hauteur d ecran', () => {
    monterEtOuvrirLeMenu();

    expect(feuilleDeGestion()?.maxContentHeightRatio).toBe(0.9);
  });

  // ⛔ CE QUI NE CHANGE PAS : la feuille reste sans hauteur fixe. Lui donner des
  // `snapPoints` reglerait la hauteur, mais figerait aussi la feuille a 90 % de
  // l'ecran quand il n'y a que deux actions a montrer.
  // ⚠️ Ce qui rend le dimensionnement dynamique JUSTE, depuis S2, c est que
  // plus rien ne vit hors du contenu mesure — voir le bloc S2 ci-dessous.
  test('et elle garde son dimensionnement dynamique (aucun snapPoints)', () => {
    monterEtOuvrirLeMenu();

    expect(feuilleDeGestion()).not.toBeNull();
    expect(feuilleDeGestion()?.snapPoints).toBeUndefined();
  });
});

describe('S2 — le titre de la feuille vit DANS le contenu mesure', () => {
  // 🧨 LE DEFAUT, ET IL EST GEOMETRIQUE, PAS COSMETIQUE (recette 2.6.27,
  // capture de 12h35 : « Annuler » coupe, et la feuille NE DEFILE PAS).
  //
  // En dimensionnement dynamique, la hauteur de la feuille est celle du CONTENU
  // DEFILANT SEUL : un `headerComponent` fixe (~64 pt) n'entre JAMAIS dans la
  // mesure. La boite visible est donc taillee trop court, et comme son masque
  // coupe par le BAS pendant que l'en-tete pousse le contenu vers le bas, les
  // dernieres rangees sortent du cadre. Elles ne sont pas non plus rattrapables
  // au doigt : du point de vue de la zone defilante il ne DEBORDE rien —
  // sa fenetre vaut exactement son contenu, donc zero course de defilement.
  //
  // ⛔ Le plafond de 90 % pose en R5 ne corrigeait pas ca : il a AGGRAVE le cas
  // long, puisque 90 % de l'ecran PLUS l'en-tete depasse le conteneur.
  //
  // ✅ Le correctif ne touche pas `BottomModal` (69 autres appelants) : le titre
  // descend dans le contenu, et la mesure redevient exacte.
  test('elle ne recoit plus d en-tete fixe', () => {
    monterEtOuvrirLeMenu();

    expect(feuilleDeGestion()).not.toBeNull();
    expect(feuilleDeGestion()?.headerComponent).toBeUndefined();
  });

  // L ORDRE fait partie du temoin : le titre doit venir AVANT les rangees,
  // sinon on aurait deplace le probleme au lieu de le regler.
  test('et le titre est le PREMIER element du contenu, devant les rangees', () => {
    monterEtOuvrirLeMenu();
    const contenu = [].concat(feuilleDeGestion()?.children || []);

    expect(contenu[0]?.props?.testID).toBe('event-manage-title');
    expect(contenu[1]?.props?.testID).toBe('event-manage-sheet');
  });

  test('et il porte toujours le meme libelle', () => {
    monterEtOuvrirLeMenu();
    const titre = chercherDansElements(
      feuilleDeGestion()?.children,
      (/** @type {any} */ noeud) => noeud?.props?.testID === 'event-manage-title',
    );

    expect(titre?.props?.children).toBe("Gérer l'événement");
  });
});

describe('R5 (b) — toucher « Modifier » fait partir les lectures avant l ecran', () => {
  /**
   * Ouvre le menu et appuie sur la rangee « Modifier ».
   * @returns {void}
   */
  const toucherModifier = () => {
    const root = monterEtOuvrirLeMenu();
    const rangee = rangeeDuMenu(root, 'edit');
    if (!rangee) throw new Error('La rangee « Modifier » est introuvable');
    act(() => {
      rangee.props.onPress();
    });
  };

  test('les deux clefs prechargees sont EXACTEMENT celles que relit EventEdit', () => {
    toucherModifier();

    const clefs = mockPrefetch.mock.calls.map((/** @type {any} */ appel) => appel[0].queryKey);

    expect(clefs).toEqual(
      expect.arrayContaining([['event', 'event-1', 'edit'], ['event-types']]),
    );
  });

  test('et chaque clef part avec la lecture qui la remplit vraiment', async () => {
    toucherModifier();

    const parClef = (/** @type {string} */ tete) => mockPrefetch.mock.calls
      .map((/** @type {any} */ appel) => appel[0])
      .find((/** @type {any} */ option) => option.queryKey[0] === tete);

    await parClef('event').queryFn();
    await parClef('event-types').queryFn();

    expect(eventService.getEventByIdForEdit).toHaveBeenCalledWith('event-1');
    expect(eventService.getEventTypes).toHaveBeenCalled();
  });

  // 🪤 UNE FRAICHEUR OUBLIEE ICI ANNULERAIT CELLE DE L AUTRE COTE. La liste
  // des types est declaree immuable par son lecteur (`EventEdit.js`) ; si ce
  // prechargement-ci ne le disait pas aussi, il repartirait au reseau a CHAQUE
  // appui sur « Modifier » — et tous les autres temoins resteraient verts.
  test('la liste des types part avec la meme fraicheur que son lecteur', () => {
    toucherModifier();

    const lectureDesTypes = mockPrefetch.mock.calls
      .map((/** @type {any} */ appel) => appel[0])
      .find((/** @type {any} */ option) => option.queryKey[0] === 'event-types');

    expect(lectureDesTypes.staleTime).toBe(Infinity);
  });

  // LE POINT QUI FAIT LE GAIN : un prechargement lance APRES la navigation
  // n'avancerait rien — l'ecran suivant serait deja monte, et il aurait deja
  // redemande exactement la meme chose.
  test('le depart des lectures precede la navigation', () => {
    toucherModifier();

    expect(mockPrefetch).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalled();
    expect(Math.max(...mockPrefetch.mock.invocationCallOrder))
      .toBeLessThan(mockNavigate.mock.invocationCallOrder[0]);
  });

  // CARACTERISATION — la destination ne bouge pas d'un pouce.
  test('et la destination reste EventEdit, avec le meme evenement', () => {
    toucherModifier();

    expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
      params: { eventId: 'event-1' },
      screen: 'EventEdit',
    });
  });
});
