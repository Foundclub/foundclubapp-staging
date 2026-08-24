import { Alert, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// LOT AA01 (E6) — LA BASCULE « ABSENT -> PRESENT » SUR LA FICHE D UN EVENEMENT.
//
// 🔴 CONSTAT D ADEL, 2026-08-20 : « si je suis absent et que je fais "modifier
// ma reponse" et que je mets present, mon statut passe en "sans reponse". »
//
// 📏 CE QUE CE FICHIER MESURE, ET C EST LA SEULE CHOSE QUI COMPTE : QUELLE PORTE
// L ECRAN FRAPPE. `resolveOwnAnswerAction` rendait deja la bonne DECISION
// (`switchToPresent`, corrige avant ce lot) — le defaut etait dans ce qu on en
// faisait : `POST /event-participations`, la porte des DEMANDES. Sur un
// evenement a validation manuelle elle rend `pending`, et `pending` n entre ni
// dans `participations` ni dans `missings` cote serveur
// (`event-audience.ts:917`) : a l ecran, « sans reponse ». La reponse est perdue.
//
// 🎯 La porte des REPONSES est `POST /events/:id/rsvp`
// (`respondToEventRsvpMutation`) — deja celle du bandeau de l accueil.
//
// ⚠️ LES DOUBLURES QUI COMPTENT ICI, ET POURQUOI :
//   · `EventAnswerButtons` est PILOTABLE (et non un simple texte) : c est lui
//     qui porte le bouton « Modifier ma reponse ».
//   · `Alert.alert` appuie tout seul sur le DERNIER bouton — la confirmation.
//     Sans ca, la mutation n est jamais atteinte et le temoin serait vert sur
//     du code casse.
//   · `useGetEventParticipations` est pilotable : c est elle qui porte la ligne
//     « absent » que la decision lit.
const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockEventQuery = { data: null };
const mockCampaignsQuery = { data: { data: [] }, isLoading: false };
const mockMatchStatsQuery = { data: null, isFetching: false };
const mockRouteParams = { params: { eventId: 'event-1' } };
const mockParticipationsQuery = { data: null };
const mockRespondToRsvp = jest.fn();
const mockCreateParticipation = jest.fn();
const mockMissingEvent = jest.fn();
const mockDeleteParticipation = jest.fn();

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
  useGetEventParticipations: () => ({
    ...emptyQuery(),
    data: mockParticipationsQuery.data,
  }),
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
      createEventParticipationMutation: { isPending: false, mutate: mockCreateParticipation },
      declineParticipationMutation: idleMutation(),
      deleteParticipationMutation: { isPending: false, mutate: mockDeleteParticipation },
      joinReservationMutation: idleMutation(),
      missingEventMutation: { isPending: false, mutate: mockMissingEvent },
      openForPlayersMutation: idleMutation(),
      remindEventMutation: idleMutation(),
      reportEventMutation: idleMutation(),
      requestFeaturedMutation: idleMutation(),
      resetAttendanceMutation: idleMutation(),
      respondToEventRsvpMutation: { isPending: false, mutate: mockRespondToRsvp },
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
// DOUBLURE PILOTABLE, pas un texte : c est ce composant qui porte le bouton
// « Modifier ma reponse » (`onDeleteParticipation`) et le bouton « Participer »
// (`onJoin`). Une doublure muette rendrait la bascule d Adel intestable.
jest.mock('@/components/molecules/eventAnswerButtons/EventAnswerButtons', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function EventAnswerButtonsDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.View,
      null,
      react.createElement(
        rn.TouchableOpacity,
        { onPress: props.onDeleteParticipation },
        react.createElement(rn.Text, null, 'BASCULER_MA_REPONSE'),
      ),
      react.createElement(
        rn.TouchableOpacity,
        { onPress: props.onJoin },
        react.createElement(rn.Text, null, 'REPONDRE_PRESENT'),
      ),
    );
  };
});
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

const TEAM_ID = 'team-1';
const ME = 'user-1';

/**
 * Un evenement de MON equipe, a validation MANUELLE — le reglage par defaut du
 * schema Strapi (`event/schema.json`, `"default": "manual"`), donc le cas le
 * plus courant, et celui ou l ancienne porte fabriquait une « demande ».
 * @param {any} [overrides]
 * @returns {any} L evenement.
 */
const buildEvent = (overrides = {}) => ({
  capacity: 20,
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  missings: [],
  name: 'Entrainement du mardi',
  participationRequests: [],
  participations: [],
  sessionStatus: 'closed',
  startTime: '10:00',
  team: {
    documentId: TEAM_ID,
    name: 'U15',
    players: [{ documentId: ME }],
    trainers: [{ documentId: 'coach-1' }],
  },
  type: { name: 'Entrainement' },
  validationMode: 'manual',
  ...overrides,
});

const defaultAuth = () => ({
  canEditClub: () => false,
  canEditEvent: () => false,
  canManageEvent: () => false,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { documentId: ME, role: { name: 'Joueur' } },
});

const buildNavigation = () => ({
  addListener: () => () => {},
  getParent: () => undefined,
  getState: () => ({ routeNames: ['EventDetails', 'EventEdit'] }),
  goBack: jest.fn(),
  navigate: mockNavigate,
  setOptions: jest.fn(),
});

/** @type {any} */
let mounted = null;

// UN SEUL ARBRE VIVANT A LA FOIS : `EventDetails` arme au montage une tache
// `InteractionManager.runAfterInteractions` qu un arbre abandonne ne peut plus
// annuler — elle tire alors apres la fin de la suite, sur un environnement Jest
// deja demoli. Meme motif que `EventDetailsBottomActions.test.js`.
const unmountScreen = () => {
  if (!mounted) return;
  act(() => {
    mounted.unmount();
  });
  mounted = null;
};

const mountScreen = (/** @type {any} */ { event, participations } = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockParticipationsQuery.data = participations || null;
  mockCampaignsQuery.data = { data: [] };
  mockCampaignsQuery.isLoading = false;
  mockMatchStatsQuery.data = null;
  mockRouteParams.params = { eventId: 'event-1' };
  mockUseAuth.mockReturnValue(defaultAuth());

  unmountScreen();

  act(() => {
    mounted = renderer.create(
      <EventDetails navigation={buildNavigation()} route={mockRouteParams} />,
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

const pressLabelled = (/** @type {any} */ root, /** @type {string} */ label) => {
  const target = root
    .findAllByType(TouchableOpacity)
    .find((/** @type {any} */ node) => textOf(node).includes(label));
  expect(target).toBeTruthy();
  act(() => {
    target.props.onPress();
  });
};

/**
 * Ma ligne de reponse « absent », telle que la file des participations la rend.
 * @returns {any} La reponse active.
 */
const myMissingResponse = () => ({
  documentId: 'resp-missing',
  isActive: true,
  participationStatus: 'missing',
  user: { documentId: ME },
});

beforeEach(() => {
  mockRespondToRsvp.mockClear();
  mockCreateParticipation.mockClear();
  mockMissingEvent.mockClear();
  mockDeleteParticipation.mockClear();
  mockNavigate.mockClear();
  // La confirmation s appuie toute seule : le DERNIER bouton d une Alert est
  // toujours celui qui valide (le premier porte `style: 'cancel'`).
  jest.spyOn(Alert, 'alert').mockImplementation((
    /** @type {any} */ _t,
    /** @type {any} */ _m,
    /** @type {any} */ buttons,
  ) => {
    const actions = Array.isArray(buttons) ? buttons : [];
    const confirm = actions[actions.length - 1];
    confirm?.onPress?.();
  });
});

afterEach(() => {
  unmountScreen();
  jest.restoreAllMocks();
});

describe('AA01 — la bascule d une reponse passe par la porte des reponses', () => {
  test('AA01/1 — 🥇 absent -> present frappe la porte des REPONSES, pas celle des demandes', () => {
    const root = mountScreen({
      event: buildEvent({ missings: [{ documentId: ME }] }),
      participations: { data: [myMissingResponse()] },
    });

    pressLabelled(root, 'BASCULER_MA_REPONSE');

    expect(mockRespondToRsvp).toHaveBeenCalledWith({
      answer: 'present',
      eventId: 'event-1',
    });
    expect(mockCreateParticipation).not.toHaveBeenCalled();
  });

  test('AA01/2 — la bascule est UN seul geste : aucun rattrapage supprimer-puis-recreer', () => {
    const root = mountScreen({
      event: buildEvent({ missings: [{ documentId: ME }] }),
      participations: { data: [myMissingResponse()] },
    });

    pressLabelled(root, 'BASCULER_MA_REPONSE');

    expect(mockRespondToRsvp).toHaveBeenCalledTimes(1);
    expect(mockDeleteParticipation).not.toHaveBeenCalled();
    expect(mockMissingEvent).not.toHaveBeenCalled();
  });

  test('AA01/6 — sans reponse -> present : le membre repond sans decharge', () => {
    const root = mountScreen();

    pressLabelled(root, 'REPONDRE_PRESENT');

    expect(mockRespondToRsvp).toHaveBeenCalledWith({
      answer: 'present',
      eventId: 'event-1',
    });
    expect(mockCreateParticipation).not.toHaveBeenCalled();
  });

  test('AA01/7 — 🔒 sur une DETECTION, la declaration de responsabilite revient', () => {
    const root = mountScreen({
      event: buildEvent({ sessionStatus: 'open', type: { name: 'Detection' } }),
    });

    pressLabelled(root, 'REPONDRE_PRESENT');

    // La detection n a PAS de reponse directe : elle ouvre la feuille de
    // participation, qui porte la decharge. Aucune reponse ne part sans elle.
    expect(mockRespondToRsvp).not.toHaveBeenCalled();
  });
});

// LOT R4 (decision d Adel du 2026-08-24) — LE BOUT EN BOUT DU BOUTON UNIQUE.
//
// Les temoins ci-dessus prouvent la bascule ABSENT -> PRESENT. Ceux-ci prouvent
// l autre sens, celui qu Adel a demande en recette : « Annuler ma
// participation » ne remet plus le membre « sans reponse », il le MARQUE
// ABSENT — donc il frappe `POST /events/:id/missing`, la porte que le compteur
// des absents ecoute (`syncEventRelationsFromResponses`).
//
// 🎭 La doublure `BASCULER_MA_REPONSE` appuie sur `onDeleteParticipation`,
// c est-a-dire exactement le bouton de la vue joueur.

/**
 * Ma ligne de reponse, telle que la fiche la porte (`participationRequests`).
 * @param {string} participationStatus Le statut Strapi de la ligne.
 * @returns {any} La reponse active.
 */
const myResponse = (participationStatus) => ({
  documentId: 'resp-mine',
  isActive: true,
  participationStatus,
  updatedAt: '2026-08-24T10:00:00.000Z',
  user: { documentId: ME },
});

describe('R4 — « Annuler ma participation » marque absent', () => {
  test('R4/12 — 🥇 un MEMBRE deja present est MARQUE ABSENT, sa reponse n est pas effacee', () => {
    const root = mountScreen({
      event: buildEvent({
        participationRequests: [myResponse('accepted')],
        participations: [{ documentId: ME }],
      }),
    });

    pressLabelled(root, 'BASCULER_MA_REPONSE');

    expect(mockMissingEvent).toHaveBeenCalledWith('event-1');
    expect(mockDeleteParticipation).not.toHaveBeenCalled();
  });

  test('R4/13 — 🔒 une demande EN ATTENTE est SUPPRIMEE, jamais rangee chez les absents', () => {
    const root = mountScreen({
      event: buildEvent({
        participationRequests: [myResponse('pending')],
        participations: [],
      }),
    });

    pressLabelled(root, 'BASCULER_MA_REPONSE');

    expect(mockDeleteParticipation).toHaveBeenCalledWith('resp-mine');
    expect(mockMissingEvent).not.toHaveBeenCalled();
  });

  test('R4/14 — 🔒 un participant VENU DU DEHORS voit toujours sa reponse SUPPRIMEE', () => {
    const root = mountScreen({
      event: buildEvent({
        participationRequests: [myResponse('accepted')],
        participations: [{ documentId: ME }],
        team: {
          documentId: TEAM_ID,
          name: 'U15',
          players: [],
          trainers: [],
        },
      }),
    });

    pressLabelled(root, 'BASCULER_MA_REPONSE');

    expect(mockDeleteParticipation).toHaveBeenCalledWith('resp-mine');
    expect(mockMissingEvent).not.toHaveBeenCalled();
  });
});

// 🗣️ R6 (vague R) — LE PARTIEL LAISSE PAR R4 : LE GESTE AVAIT CHANGE, PAS LES MOTS.
//
// R4 a fait qu un membre convie deja present soit MARQUE ABSENT au lieu de voir
// sa reponse effacee (temoin R4/12 juste au-dessus). La fenetre de confirmation,
// elle, a garde les chaines de la SUPPRESSION : « Annuler ma participation » et
// « Es-tu sur·e de vouloir annuler ta participation a cet evenement ? ».
//
// 🧨 La personne lisait donc une question et en executait une autre — et la
// difference n est pas cosmetique : effacer sa reponse et se declarer absent ne
// donnent pas le meme compteur au coach, ni le meme retour en arriere.
//
// ⛔ La branche SUPPRESSION garde ses mots : ils sont justes pour elle. C est
// tout le point d avoir deux jeux de chaines la ou il y a deux gestes.
describe('R6 — la fenetre dit le geste qu elle declenche', () => {
  test('R6/15 — 🥇 un MEMBRE marque absent ne lit plus la fenetre de suppression', () => {
    const root = mountScreen({
      event: buildEvent({
        participationRequests: [myResponse('accepted')],
        participations: [{ documentId: ME }],
      }),
    });

    pressLabelled(root, 'BASCULER_MA_REPONSE');

    const [titre, description] = /** @type {any} */ (Alert.alert).mock.calls[0];

    expect(titre).toBe('eventDetails.modals.declareMissing.title');
    expect(description).toBe('eventDetails.modals.declareMissing.description');
    // 🔒 Et le geste reste celui de R4 : les mots suivent le geste, ils ne le
    // remplacent pas.
    expect(mockMissingEvent).toHaveBeenCalledWith('event-1');
  });

  test('R6/16 — 🔒 la branche SUPPRESSION garde ses mots a elle', () => {
    // Contre-epreuve indispensable : un seul jeu de chaines pour DEUX gestes
    // est exactement le defaut qu on repare. Le remplacer par un autre jeu
    // unique ne serait pas une correction, juste un deplacement.
    const root = mountScreen({
      event: buildEvent({
        participationRequests: [myResponse('pending')],
        participations: [],
      }),
    });

    pressLabelled(root, 'BASCULER_MA_REPONSE');

    const [titre] = /** @type {any} */ (Alert.alert).mock.calls[0];

    expect(titre).toBe('eventDetails.modals.deleteParticipation.title');
    expect(mockDeleteParticipation).toHaveBeenCalledWith('resp-mine');
  });

  test('R6/17 — 🧨 et le dictionnaire porte VRAIMENT la phrase que la personne lit', () => {
    // ⛔ LE TEMOIN QUI EMPECHE LE FAUX VERT. Le mock de traduction de ce fichier
    // rend la CLEF quand il n y a pas de repli : les deux temoins ci-dessus
    // resteraient donc verts avec un dictionnaire VIDE, et l ecran afficherait
    // « eventDetails.modals.declareMissing.title » en toutes lettres.
    const fr = jest.requireActual('@/theme/strings/translations/fr').default;

    expect(fr.eventDetails.modals.declareMissing.title).toBe('Me déclarer absent·e');
    expect(fr.eventDetails.modals.declareMissing.description)
      .toContain('tu passeras chez les absent·e·s');
    // La branche de suppression n a pas ete touchee au passage.
    expect(fr.eventDetails.modals.deleteParticipation.title).toBe('Annuler ma participation');
  });
});
