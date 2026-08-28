import {
  createNavigatorFactory,
  NavigationContainer,
  useNavigationBuilder,
} from '@react-navigation/native';
import { StackRouter } from '@react-navigation/routers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, Fragment } from 'react';
import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// EVEDIT-4 — LE GESTE REEL D'ADEL, DE BOUT EN BOUT, DANS UN SEUL TEMOIN.
//
// 🚨 POURQUOI CE FICHIER EXISTE : DEUX LOTS ONT RENDU DES SUITES VERTES SUR UN
// DEFAUT VIVANT. L'autopsie (EVEDIT-4, phase 1) a nomme le trou, et il est
// structurel — pas une distraction :
//
//   · `EventDetailsEvedit2FeuilleAvaleAppui` REMPLACE `BottomModal` par une
//     doublure dont la fermeture est declenchee PAR LE TEST
//     (`terminerFermeture()`). La vraie feuille, elle, ne se ferme que si la
//     bibliotheque emet `onDismiss` ET que `handleDismiss` franchit ses TROIS
//     gardes (`visibilityRef`, fenetre `staleDismiss`, `shouldRender`). La
//     doublure n'a AUCUNE de ces gardes : le temoin decide lui-meme du resultat
//     qu'il mesure.
//   · `EventEditEvedit3Ouverture` monte `EventEdit` DIRECTEMENT, avec des props
//     fabriquees. Il ne traverse aucun routeur.
//
// ⇒ ENTRE LES DEUX, PERSONNE NE COUVRE LE MAILLON QUI PORTE LE GESTE : la
// fermeture REELLE de la feuille, la navigation qu'elle declenche, et l'arrivee
// de l'ecran suivant. C'est exactement le segment ou Adel dit « rien n'a
// change ».
//
// 🎯 CE QUE CE TEMOIN FAIT, ET QU'AUCUN AUTRE NE FAIT :
//   1. un VRAI routeur `@react-navigation` (pile racine + pile evenement),
//   2. le VRAI `BottomModal` — pas une doublure,
//   3. une doublure de `@gorhom/bottom-sheet` FIDELE : `dismiss()` n'emet
//      `onDismiss` que lorsque le test dit « l'animation est finie », comme la
//      vraie (motif deja pose par `BottomModal.reouverture.test.js`),
//   4. l'appui part du `TouchableOpacity` REELLEMENT RENDU, jamais d'un appel
//      a une fonction interne de l'ecran,
//   5. et l'assertion porte sur L'ECRAN QUI ARRIVE, pas sur un espion de
//      navigation.
//
// ⛔ CE QU'IL NE PROUVE PAS, ET IL FAUT LE DIRE : aucune milliseconde, aucun
// pixel, aucune couche de toucher native. Un temoin Jest ne peut pas voir une
// vue transparente avaler un contact — seul un doigt le peut. Il prouve la
// MECANIQUE : que le geste aboutit a un ecran monte et utilisable.

const mockUseAuth = jest.fn();
const mockPerfMark = jest.fn();
/** @type {{ data: any }} */
const mockEventQuery = { data: null };

// 🧨 Ces doublures de service ne sont pas decoratives : `@/services/client`
// JETTE AU CHARGEMENT quand `.env` est absent — et `.env` est gitignore, donc
// absent de toute copie de travail. Sans elles, la SUITE ENTIERE tombe a
// 0 test execute (piege connu du depot).
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
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// ⛔ Jamais un Proxy pour le theme : il rend les echecs Jest illisibles.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces: espaces,
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@sbaiahmed1/react-native-blur', () => ({ BlurView: () => null }));

jest.mock('@/context/StartupPhaseContext', () => ({
  STARTUP_PHASES: { SCREEN_LOCAL_PROMPTS: 'SCREEN_LOCAL_PROMPTS', STEADY_STATE: 'STEADY_STATE' },
  useStartupPhase: () => ({ phase: 'STEADY_STATE' }),
}));

// 🎯 LA DOUBLURE FIDELE DE LA BIBLIOTHEQUE — le coeur de ce fichier.
//
// `dismiss()` NE FERME RIEN toute seule : elle retient le rappel `onDismiss` et
// attend. C'est le test qui joue la fin de l'animation. C'est le seul montage
// qui laisse le VRAI `BottomModal` decider — avec ses trois gardes — si la
// feuille se retire pour de bon. Motif repris de
// `BottomModal.reouverture.test.js`, deja au depot.
const mockFeuilleNative = {
  /** @type {null | (() => void)} */ fermetureEnVol: null,
  presentations: 0,
  renvois: 0,
};

jest.mock('@gorhom/bottom-sheet', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: reactActuel.forwardRef(
      (/** @type {any} */ props, /** @type {any} */ ref) => {
        reactActuel.useImperativeHandle(ref, () => ({
          dismiss: () => {
            mockFeuilleNative.renvois += 1;
            mockFeuilleNative.fermetureEnVol = props.onDismiss;
          },
          present: () => { mockFeuilleNative.presentations += 1; },
        }));
        return reactActuel.createElement(VueRN, { testID: 'feuille-native' }, props.children);
      },
    ),
    BottomSheetScrollView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      null,
      props.children,
    ),
    BottomSheetView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      null,
      props.children,
    ),
  };
});

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

const requeteVide = () => ({
  data: null,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
});

// ⚠️ `useGetEventForEdit` RESTE LE VRAI : c'est lui que l'ecran de modification
// interroge, et c'est son etat (en vol / echoue / arrive) qui decide de ce
// qu'Adel voit. Le doubler reviendrait a refaire le defaut d'EVEDIT-3.
jest.mock('@/services/event/eventQueries', () => ({
  ...jest.requireActual('@/services/event/eventQueries'),
  useGetEvent: () => ({
    data: mockEventQuery.data,
    dataUpdatedAt: 1,
    error: null,
    isFetching: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useGetEventAttendance: () => requeteVide(),
  useGetEventConvocation: () => requeteVide(),
  useGetEventTeamComposition: () => requeteVide(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => requeteVide(),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseCampaigns: () => ({ ...requeteVide(), data: { data: [] } }),
}));

jest.mock('@/services/tournamentCompetition/tournamentCompetitionQueries', () => ({
  useGetTournamentDashboard: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => requeteVide(),
  useGetEventMyMatchResponse: () => requeteVide(),
}));

jest.mock('@/services/event/eventService', () => ({
  approveFeatured: jest.fn(),
  createEvent: jest.fn(() => Promise.resolve({})),
  exportEventParticipants: jest.fn(),
  getEventByIdForEdit: jest.fn(() => Promise.resolve(null)),
  getEventTypes: jest.fn(() => Promise.resolve([])),
  rejectFeatured: jest.fn(),
  updateEvent: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/services/team/teamService', () => ({
  getTeams: jest.fn(() => Promise.resolve({ data: [] })),
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
  const mutationInerte = () => ({ isPending: false, mutate: jest.fn() });
  return {
    useEventMutations: () => ({
      acceptParticipationMutation: mutationInerte(),
      bookFullMutation: mutationInerte(),
      cancelEventMutation: mutationInerte(),
      coachArrivalMutation: mutationInerte(),
      createEventParticipationMutation: mutationInerte(),
      declineParticipationMutation: mutationInerte(),
      deleteParticipationMutation: mutationInerte(),
      joinReservationMutation: mutationInerte(),
      missingEventMutation: mutationInerte(),
      openForPlayersMutation: mutationInerte(),
      remindEventMutation: mutationInerte(),
      reportEventMutation: mutationInerte(),
      requestFeaturedMutation: mutationInerte(),
      resetAttendanceMutation: mutationInerte(),
      respondToEventRsvpMutation: mutationInerte(),
      selfArrivalMutation: mutationInerte(),
      selfLateMutation: mutationInerte(),
      sosAlertMutation: mutationInerte(),
      updateEventMutation: mutationInerte(),
      updateEventNoNavMutation: mutationInerte(),
      updateLateMinutesMutation: mutationInerte(),
    }),
  };
});

// La doublure de bouton garde `disabled` ET `onPress` : sans `disabled` on ne
// verrait pas qu'« Enregistrer » refuse ; sans `onPress` on ne pourrait appuyer
// sur rien. Elle rend un VRAI `TouchableOpacity`, pas une `View`.
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BoutonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityLabel: props.accessibilityLabel,
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled || props.isLoading),
        onPress: props.onPress,
        testID: `bouton-${props.title || props.accessibilityLabel || 'sans-titre'}`,
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

// Publie en TypeScript non transforme : sans doublure, la SUITE ENTIERE meurt.
jest.mock('react-native-gesture-handler', () => {
  const { ScrollView: DefilementRN } = jest.requireActual('react-native');
  return { ScrollView: DefilementRN };
});

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function AutocompleteSelectDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      testID: `select-${props.label || 'sans-libelle'}`,
    });
  };
});

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
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_DatePickerInput'),
);
jest.mock(
  '@/components/molecules/dayPicker/DayPicker',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_DayPicker'),
);
jest.mock(
  '@/components/molecules/timePickerInput/TimePickerInput',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_TimePickerInput'),
);
jest.mock(
  '@/components/organisms/facilitySelector/FacilitySelector',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_FacilitySelector'),
);
jest.mock(
  '../components/EventTasksEditor',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTasksEditor'),
);
jest.mock(
  '../components/EventTeamAudiencesEditor',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTeamAudiencesEditor'),
);
/* eslint-enable global-require */

// 🖊️ LE CHAMP DE SAISIE — il doit rester ATTEIGNABLE AU DOIGT.
// Adel : « quand je clique sur un champ il ne s'ouvre pas instantanement, mais
// si je clique DEUX FOIS ca marche ». La doublure compte donc les appuis et
// n'ouvre qu'a partir du premier — un champ qui exigerait deux appuis se verrait.
jest.mock('@/components/molecules/input/Input', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function InputDouble(/** @type {any} */ props) {
    const [ouvert, setOuvert] = react.useState(false);
    return react.createElement(
      rn.TouchableOpacity,
      {
        onPress: () => setOuvert(true),
        testID: `champ-${props.label || props.placeholder || 'sans-libelle'}`,
      },
      react.createElement(rn.Text, null, ouvert ? 'CHAMP_OUVERT' : 'CHAMP_FERME'),
    );
  };
});

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';
// eslint-disable-next-line import/first
import EventEdit from '../EventEdit';

jest.setTimeout(45000);

const eventService = jest.requireMock('@/services/event/eventService');

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';

/**
 * Une pile minimale batie sur le VRAI routeur. Elle rend tous ses ecrans, comme
 * une vraie pile : l'ecran visible est le dernier. Motif deja au depot
 * (`friendlyMatchWizardAtterrissage.test.js`).
 * @param {any} props - Les props du navigateur.
 * @returns {any} - Le contenu de la pile.
 */
function PileMinimale(props) {
  const { descriptors, NavigationContent, state } = useNavigationBuilder(StackRouter, props);
  return createElement(
    NavigationContent,
    null,
    state.routes.map((/** @type {any} */ route) => {
      const descripteur = descriptors[route.key];
      // 🧭 LE HAUT DE L ECRAN EST RENDU, ET CE N EST PAS UN DETAIL : le menu ⋯
      // qui ouvre « Gerer l evenement » vit dans l EN-TETE DE NAVIGATION
      // (`navigation.setOptions({ headerRight })`), pas dans le corps de la
      // page. Une pile qui ne rend pas son en-tete ne peut donc pas voir le
      // premier maillon du geste — c est precisement l angle mort des temoins
      // precedents, qui atteignaient ce bouton en fouillant l objet passe a
      // `setOptions` au lieu de le rendre.
      const enTete = descripteur.options?.headerRight;
      return createElement(
        Fragment,
        { key: route.key },
        typeof enTete === 'function' ? enTete({}) : null,
        descripteur.render(),
      );
    }),
  );
}

const creerPile = createNavigatorFactory(PileMinimale);
const Racine = creerPile();
const PileEvenement = creerPile();

/**
 * La pile evenement REELLE, reduite aux deux ecrans du geste.
 * @returns {any} - La pile.
 */
function PileDesEvenements() {
  return createElement(
    PileEvenement.Navigator,
    { id: undefined, initialRouteName: 'EventDetails' },
    createElement(PileEvenement.Screen, {
      component: EventDetails,
      initialParams: { eventId: 'event-1' },
      key: 'details',
      name: 'EventDetails',
    }),
    createElement(PileEvenement.Screen, {
      component: EventEdit,
      key: 'edit',
      name: 'EventEdit',
    }),
  );
}

/**
 * Un ecran temoin sans contenu : il n existe que pour que la pile racine ait un
 * ailleurs, et que « revenir en arriere » veuille dire quelque chose.
 * @returns {null} - Rien.
 */
function EcranTemoin() {
  return null;
}

/** @type {any} */
let arbre = null;
/** @type {any} */
let conteneur = null;

const evenementAffiche = () => ({
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
});

/**
 * La fiche complete que l'ecran de modification doit recevoir.
 * @returns {any} - L'evenement d'edition.
 */
const ficheDeModification = () => ({
  date: '2099-01-01T10:00:00.000Z',
  description: 'Seance technique',
  documentId: 'event-1',
  endTime: '12:00:00.000',
  eventTasks: [{ documentId: 'task-1', title: 'Apporter les plots' }],
  facility: { documentId: 'facility-1' },
  invitedTeams: [{ documentId: 'team-2' }],
  participantIdentityVisibility: 'VISIBLE',
  sessionStatus: 'closed',
  startTime: '10:00:00.000',
  team: { club: { documentId: CLUB_ID }, documentId: TEAM_ID },
  teamAudiences: [],
  type: { documentId: 'type-entrainement', name: 'Entrainement' },
  validationMode: 'manual',
});

const authDirigeant = () => ({
  canEditClub: () => true,
  canEditEvent: () => true,
  canManageEvent: () => true,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: {
    club: { documentId: CLUB_ID },
    documentId: 'user-1',
    role: { name: 'Dirigeant' },
    trainedTeams: [{ club: { documentId: CLUB_ID }, documentId: TEAM_ID, name: 'U15' }],
  },
});

/**
 * Laisse react-query et les effets repondre. Une vidange de micro-taches ne
 * suffit pas : il faut des MACRO-taches (piege deja paye par EVEDIT-3).
 * @returns {Promise<void>} - Quand l'arbre a fini de reagir.
 */
const laisserRepondre = async () => {
  for (let tour = 0; tour < 6; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- les tours sont sequentiels par nature
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

/**
 * Monte l'application reduite : conteneur de navigation, pile racine, pile
 * evenement, et un vrai `QueryClient`.
 * @returns {Promise<void>} - Quand tout est monte.
 */
const monter = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  await act(async () => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client },
      createElement(
        NavigationContainer,
        { ref: (/** @type {any} */ reference) => { if (reference) conteneur = reference; } },
        createElement(
          Racine.Navigator,
          { id: undefined, initialRouteName: 'EventStack' },
          createElement(Racine.Screen, {
            component: EcranTemoin,
            key: 'home',
            name: 'HomeTab',
          }),
          createElement(Racine.Screen, {
            component: PileDesEvenements,
            key: 'event',
            name: 'EventStack',
          }),
        ),
      ),
    ));
  });

  await laisserRepondre();
};

/**
 * Les ecrans empiles dans la pile evenement, du fond vers le sommet.
 * @returns {string[]} - Les noms de route.
 */
const pileEvenement = () => {
  const racine = conteneur.getRootState();
  const route = racine.routes.find((/** @type {any} */ item) => item.name === 'EventStack');
  if (!route?.state) return [];
  return route.state.routes.map((/** @type {any} */ item) => item.name);
};

/**
 * Retrouve un noeud par son identifiant, puis remonte au `TouchableOpacity` qui
 * le porte : c'est LUI qui recoit le doigt.
 * @param {string} testID - L'identifiant cherche.
 * @returns {any} - Le pressable, ou null.
 */
const pressable = (testID) => {
  const [noeud] = arbre.root.findAll(
    (/** @type {any} */ item) => item.props?.testID === testID,
  );
  let courant = noeud || null;
  while (courant && courant.type !== TouchableOpacity) courant = courant.parent;
  return courant;
};

/**
 * Appuie sur un element rendu, comme un doigt : on passe par le pressable, pas
 * par une fonction interne de l'ecran.
 * @param {string} testID - L'identifiant de la cible.
 * @returns {Promise<void>} - Quand l'arbre a fini de reagir.
 */
const appuyerSur = async (testID) => {
  const cible = pressable(testID);
  if (!cible) throw new Error(`Rien a toucher pour "${testID}"`);
  if (cible.props.disabled) throw new Error(`"${testID}" refuse le doigt (disabled)`);
  await act(async () => { cible.props.onPress(); });
  await laisserRepondre();
};

/**
 * Joue la FIN de l'animation de sortie de la feuille, exactement comme la
 * bibliotheque : elle emet `onDismiss` une fois l'animation terminee.
 * @returns {Promise<void>} - Quand l'arbre a fini de reagir.
 */
const finirAnimationDeFermeture = async () => {
  const fermeture = mockFeuilleNative.fermetureEnVol;
  mockFeuilleNative.fermetureEnVol = null;
  if (!fermeture) return;
  await act(async () => { fermeture(); });
  await laisserRepondre();
};

/**
 * Tous les textes ecrits a l'ecran.
 * @returns {string[]} - Les textes.
 */
const textesAffiches = () => arbre.root.findAll(
  (/** @type {any} */ noeud) => typeof noeud.props?.children === 'string',
  { deep: true },
).map((/** @type {any} */ noeud) => noeud.props.children);

beforeEach(() => {
  jest.clearAllMocks();
  mockFeuilleNative.fermetureEnVol = null;
  mockFeuilleNative.presentations = 0;
  mockFeuilleNative.renvois = 0;
  mockEventQuery.data = evenementAffiche();
  mockUseAuth.mockReturnValue(authDirigeant());
  eventService.getEventByIdForEdit.mockResolvedValue(ficheDeModification());
  eventService.getEventTypes.mockResolvedValue([
    { documentId: 'type-entrainement', name: 'Entrainement' },
  ]);
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  conteneur = null;
});

describe('EVEDIT-4 · le geste d Adel, avec la VRAIE feuille et un VRAI routeur', () => {
  test('temoin 1 — le menu ⋯ ouvre la feuille, et « Modifier » y est', async () => {
    await monter();

    await appuyerSur('event-actions-menu-button');

    expect(pressable('event-manage-label-edit')).toBeTruthy();
  });

  test('temoin 2 — 🎯 appuyer sur « Modifier » OUVRE L ECRAN DE MODIFICATION', async () => {
    await monter();
    await appuyerSur('event-actions-menu-button');

    // Le doigt part ici, sur la rangee REELLEMENT RENDUE.
    await appuyerSur('event-manage-label-edit');
    // Puis la feuille finit de se retirer, comme sur un telephone.
    await finirAnimationDeFermeture();

    // ⛔ PAS un espion sur `navigate` : l'ecran doit ETRE LA.
    expect(pileEvenement()).toContain('EventEdit');
  });

  test('temoin 3 — l ecran de modification arrive REMPLI, pas en chargement eternel', async () => {
    await monter();
    await appuyerSur('event-actions-menu-button');
    await appuyerSur('event-manage-label-edit');
    await finirAnimationDeFermeture();

    expect(textesAffiches()).not.toContain(
      "Chargement de l'événement… Le bouton s'active dès que tout est affiché.",
    );
  });

  test('temoin 4 — 🖊️ le PREMIER appui sur un champ l ouvre', async () => {
    await monter();
    await appuyerSur('event-actions-menu-button');
    await appuyerSur('event-manage-label-edit');
    await finirAnimationDeFermeture();

    const champs = arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.props?.testID === 'string'
        && noeud.props.testID.startsWith('champ-'),
    );
    expect(champs.length).toBeGreaterThan(0);

    await act(async () => { champs[0].props.onPress(); });
    await laisserRepondre();

    expect(textesAffiches()).toContain('CHAMP_OUVERT');
  });
});

describe('EVEDIT-4 · ce que le geste COUTE, et ce qu il montre quand ca rate', () => {
  test('temoin 5 — 📊 l ouverture ne coute QU UNE lecture de fiche, pas deux', async () => {
    // 🔗 CE QUE CE TEMOIN GARDE EN VIE : le prechargement pose au toucher
    // (`EventDetails.js`, `handleEditEvent`) et la lecture de l ecran de
    // modification (`useGetEventForEdit`) partagent la MEME clef et la MEME
    // duree de fraicheur. Si l une des deux derive, le prechargement cesse
    // d etre un gain et redevient un appel de plus — c est exactement le defaut
    // qu EVEDIT-3 a corrige, et rien ne le surveillait depuis le geste reel.
    //
    // ⚠️ POURQUOI CE CHIFFRE COMPTE PLUS QU IL N EN A L AIR : le lot FCMSTORM a
    // mesure 27 refus `429` en rafale le 28/08. Chaque lecture en trop rapproche
    // l app de la protection anti-abus du serveur — et un `429` sur CETTE
    // lecture-la fige l ecran, puisque le client ne retente jamais un 429.
    const teamService = jest.requireMock('@/services/team/teamService');

    await monter();
    await appuyerSur('event-actions-menu-button');
    await appuyerSur('event-manage-label-edit');
    await finirAnimationDeFermeture();

    expect(eventService.getEventByIdForEdit.mock.calls.length).toBe(1);
    expect(eventService.getEventTypes.mock.calls.length).toBe(1);
    expect(teamService.getTeams.mock.calls.length).toBe(1);
  });

  test('temoin 6 — 🛑 refus 429 : l ecran le DIT et propose une porte de sortie', async () => {
    // ⚠️ CE TEMOIN N EST PAS UN DOUBLON D EVEDIT-3. Celui-la montait l ecran
    // DIRECTEMENT, donc sans prechargement. Ici la lecture est d abord tentee
    // par `handleEditEvent` AU TOUCHER : c est le cache en echec qui accueille
    // l ecran. Rien ne garantissait que le message d echec survive a ce
    // chemin-la — et c est le chemin d Adel.
    const refus = Object.assign(
      new Error('Request failed with status code 429'),
      { response: { status: 429 }, status: 429 },
    );
    eventService.getEventByIdForEdit.mockRejectedValue(refus);

    await monter();
    await appuyerSur('event-actions-menu-button');
    await appuyerSur('event-manage-label-edit');
    await finirAnimationDeFermeture();

    expect(pileEvenement()).toContain('EventEdit');
    expect(textesAffiches()).toContain(
      "L'événement n'a pas pu être chargé. Vérifie ta connexion, puis appuie sur Réessayer.",
    );
    expect(pressable('bouton-Réessayer')).toBeTruthy();
  });
});
