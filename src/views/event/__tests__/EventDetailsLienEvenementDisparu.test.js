import renderer, { act } from 'react-test-renderer';

// LIENS-EVENEMENT (15/09, decision Q2 = B d'Adel) — un lien d'evenement partage
// ouvre desormais la fiche dans l'app. Un lien envoye il y a des semaines peut viser
// un evenement SUPPRIME : le serveur repond 404 (findOne, filtre isActive — mesure le
// 15/09 : `GET /api/events/<id inexistant>` = 404, anonyme). Avant le lot, l'ecran
// remettait l'erreur brute au pave rouge, qui disait « La ressource demandee est
// introuvable. » — vrai, mais muet sur CE qui manque.
// Un evenement PRIVE, lui, n'est pas une erreur : le serveur le rend (200) avec les
// noms masques (event.ts, shieldEventPayloadForViewer) et la fiche s'affiche.
//
// En-tete de mocks COPIE d'EventDetailsComptesSupprimes.test.js, deux differences :
//   1. `useGetEvent` porte une erreur pilotable ;
//   2. `WithDataWrapper` CAPTURE ses props au lieu de les ignorer.

const mockUseAuth = jest.fn();
// Le nom commence par `mock` : c'est la SEULE forme qu'une fabrique `jest.mock`
// (remontee en tete de fichier) a le droit de refermer sur une variable exterieure.
const mockWrapperProps = { value: null };
const mockNavigate = jest.fn();
const mockEventQuery = { data: null, error: null };
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
  // Le VRAI WithDataWrapper (dernier temoin) lit ce contexte ; nu, il rend `undefined`.
  QueryClientContext: jest.requireActual('react').createContext(undefined),
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
    error: mockEventQuery.error,
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
  // La couture de ce temoin : ce que l'ecran REMET au pave d'erreur. Que le VRAI pave
  // affiche ce message est prouve par le dernier temoin de ce fichier.
  return function WithDataWrapperCapture(/** @type {any} */ props) {
    mockWrapperProps.value = props;
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

// Le squelette de chargement tire `@react-native-masked-view`, que jest ne transforme
// pas : le VRAI WithDataWrapper (dernier temoin) ne se chargerait pas sans ce double.
jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function SkeletonLoaderDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

// AVIS (09/09), copie de la suite source : sans ce double, l'import tire
// `@/services/client`, qui JETTE sans `.env` et fait tomber la suite ENTIERE.
jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetTrainingReviews: () => ({ data: null }),
}));

jest.setTimeout(30000);

const MESSAGE_DISPARU = 'Cet événement n’est plus disponible ou a été supprimé.';

/** @type {any} */
let mounted = null;

// UN SEUL ARBRE VIVANT A LA FOIS (piege paye au lot D21, voir la suite copiee).
const unmountScreen = () => {
  if (!mounted) return;
  act(() => {
    mounted.unmount();
  });
  mounted = null;
};

afterEach(unmountScreen);

const buildNavigation = () => ({
  addListener: () => () => {},
  getParent: () => undefined,
  getState: () => ({ routeNames: ['EventDetails'] }),
  goBack: jest.fn(),
  navigate: mockNavigate,
  setOptions: jest.fn(),
});

/**
 * Monte la fiche comme l'ouvre un lien : identifiant seul, rien d'autre.
 * @param {{ auth?: any, data?: any, error?: any }} etat - Ce que rend le serveur et qui lit.
 * @returns {any} Les props remises au pave de chargement / d'erreur.
 */
const mountFromLink = ({ auth, data = null, error = null }) => {
  mockEventQuery.data = data;
  mockEventQuery.error = error;
  mockRouteParams.params = { eventId: 'evt-doc-42' };
  mockUseAuth.mockReturnValue({
    canEditClub: () => false,
    canEditEvent: () => false,
    canManageEvent: () => false,
    freeUsageSummary: null,
    subscriptionAccessLevel: 'FREE',
    userData: { documentId: 'user-1', id: 1, role: { name: 'Joueur' } },
    ...auth,
  });
  unmountScreen();
  mockWrapperProps.value = null;
  act(() => {
    mounted = renderer.create(
      <EventDetails navigation={buildNavigation()} route={mockRouteParams} />,
    );
  });
  return mockWrapperProps.value;
};

// La forme reelle d'un refus axios, telle que la remet `client.get`.
const refus = (/** @type {number} */ status) => Object.assign(
  new Error(`Request failed with status code ${status}`),
  { response: { data: { error: { message: 'Not Found', status } }, status } },
);

describe('LIENS-EVENEMENT — la fiche ouverte par un lien', () => {
  it('🔴 evenement SUPPRIME (404) : l ecran dit que l evenement n est plus disponible', () => {
    const props = mountFromLink({ error: refus(404) });

    expect({ error: Boolean(props?.error), errorMessage: props?.errorMessage })
      .toEqual({ error: true, errorMessage: MESSAGE_DISPARU });
  });

  it('meme chose sans compte (le lien s ouvre aussi deconnecte)', () => {
    const props = mountFromLink({ auth: { userData: null }, error: refus(404) });

    expect(props?.errorMessage).toBe(MESSAGE_DISPARU);
  });

  it('une panne serveur (500) garde le message generique : ce n est pas une disparition', () => {
    const props = mountFromLink({ error: refus(500) });

    expect({ error: Boolean(props?.error), errorMessage: props?.errorMessage })
      .toEqual({ error: true, errorMessage: undefined });
  });

  it('evenement PRIVE (noms masques par le serveur) : la fiche s affiche, aucune erreur', () => {
    const props = mountFromLink({
      auth: { userData: null },
      data: {
        date: '2099-01-01T10:00:00.000Z',
        documentId: 'evt-doc-42',
        featuredRequests: [],
        id: 42,
        invitedTeams: [],
        isActive: true,
        missings: [],
        name: 'Entrainement du mardi',
        participantIdentitiesHidden: true,
        participations: [],
        startTime: '10:00',
        type: { name: 'Entrainement' },
      },
    });

    expect({ error: props?.error ?? null, errorMessage: props?.errorMessage })
      .toEqual({ error: null, errorMessage: undefined });
    expect(mounted.root.findAllByProps({ children: 'DOUBLURE_EventHeader' }).length)
      .toBeGreaterThan(0);
  });

  it('le VRAI pave d erreur affiche le message que l ecran lui remet', () => {
    const WithDataWrapperReel = jest.requireActual(
      '@/components/molecules/withDataWrapper/WithDataWrapper',
    ).default;
    const { Text } = jest.requireActual('react-native');
    /** @type {any} */
    let arbre = null;
    act(() => {
      arbre = renderer.create(
        <WithDataWrapperReel error={refus(404)} errorMessage={MESSAGE_DISPARU} isLoading={false}>
          <Text>contenu</Text>
        </WithDataWrapperReel>,
      );
    });

    const textes = arbre.root.findAllByType(Text).map((/** @type {any} */ n) => n.props.children);
    act(() => arbre.unmount());
    expect(textes).toContain(MESSAGE_DISPARU);
  });
});
