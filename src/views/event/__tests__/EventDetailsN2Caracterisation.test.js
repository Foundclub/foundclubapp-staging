import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// Lot N2 — LE FILET AVANT DE RANGER (E6). Ce fichier ne demande RIEN de neuf.
//
// Il decrit, tel quel, ce que la page rend AUJOURD'HUI pour les trois types que
// le lot N2 va ranger en onglets : la DETECTION, le STAGE PARENT et le TOURNOI.
// Aucun des trois n'avait de filet — au 23/08, zero test montait un
// `stage_parent`, et zero test montait un tournoi AVEC des equipes inscrites.
// Les boutons « Valider » / « Refuser » d'une inscription, qui engagent
// l'organisateur vis-a-vis d'un tiers, n'etaient tenus par rien.
//
// ⚠️ C'EST LE POINT DE TOUT LE FICHIER : sans lui, ranger en onglets ne se
// distingue pas de PERDRE un bloc. Un ecran deplace et un ecran disparu se
// ressemblent exactement, vus depuis une porte verte.
//
// ⛔ Les temoins ci-dessous sont donc VOLONTAIREMENT conservateurs : ils nomment
// ce qui est a l'ecran, pas ce qui devrait y etre. Ceux que le rangement fera
// passer au rouge seront REECRITS dans l'etape qui les casse, en nommant la
// matrice de la planche 04 — jamais supprimes.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest n'a pas de moteur de mise en page. Il
// lit ce qui est MONTE et ce qui ne l'est pas, jamais ou ni comment. Le rendu
// reel se voit a la recette.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockEventQuery = { data: null };
const mockAttendance = { data: null };
const mockCampaigns = { value: [] };
const mockBulkReminder = jest.fn(() => Promise.resolve({}));
const mockGenerateAssignments = jest.fn(() => Promise.resolve({}));

// 🈯 La doublure de traduction INTERPOLE, contrairement a celle des filets
// precedents. Ce n'est pas du zele : l'etape 1 du chemin de detection affiche
// « N pointé·e·s sur M », et c'est precisement le nombre que le lot doit
// prendre sur le SERVEUR et non dans l'etat local d'un ecran de repartition. Un
// `t` qui rendrait « {{pointed}} pointé·e·s sur {{total}} » laisserait cette
// regle sans temoin.
// 🧨 R9 — CE MOCK N EST PAS DECORATIF. `teamMembershipRequestService`
// importe `@/services/client`, qui JETTE AU CHARGEMENT quand `.env` est absent
// — et `.env` est gitignore, donc absent de toute copie de travail. Sans cette
// doublure, la SUITE ENTIERE tombe a 0 test execute des que l ecran importe le
// service (piege documente, deja paye plusieurs fois).
// 👪 PAR-L11b (13/10) — le bloc « Inscrire mes enfants » charge ses propres services : double ici,
// comme chaque service de l ecran (EventDetails.js:123-128).
jest.mock('@/views/event/components/EventChildRegistration', () => ({
  __esModule: true,
  default: () => null,
  EventChildRegistrationsForOrganizer: () => null,
}));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  inviteToTeam: () => Promise.resolve(null),
  resolveTeamInvitationAvailability: () => ({
    candidateId: '',
    canInvite: false,
    reason: 'missing-team',
  }),
}));

// I18N-2 : les textes passent par t() avec {{jetons}} et pluriels — la doublure partagée
// rend le français de l app (fr.js, sinon le repli, jetons, pluriel français).
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

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

// 🔌 `mutate` APPELLE VRAIMENT la `mutationFn`, contrairement aux filets
// precedents ou il etait un `jest.fn()` muet. Sans cela, un temoin qui presse
// « Relancer » ne prouverait que l'existence du bouton — pas qu'il est branche
// sur le bon appel serveur avec la bonne charge.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables, /** @type {any} */ handlers) => {
      const resultat = options?.mutationFn?.(variables);
      Promise.resolve(resultat)
        .then((valeur) => handlers?.onSuccess?.(valeur))
        .catch((erreur) => handlers?.onError?.(erreur));
    },
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
  useGetEventAttendance: () => ({ ...emptyQuery(), data: mockAttendance.data }),
  useGetEventConvocation: () => emptyQuery(),
  useGetEventTeamComposition: () => emptyQuery(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

// 💶 Le module des cotisations est mocke EN ENTIER, y compris ses deux
// fonctions de service : c'est ce qui permet de PRESSER le bouton de relance
// dans un temoin et de verifier la charge exacte envoyee au serveur.
jest.mock('@/services/license/licenseQueries', () => ({
  generateLicenseAssignments: (/** @type {any} */ ...args) => mockGenerateAssignments(...args),
  sendBulkLicenseReminder: (/** @type {any} */ ...args) => mockBulkReminder(...args),
  useLicenseCampaigns: () => ({ ...emptyQuery(), data: { data: mockCampaigns.value } }),
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

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
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

// 🎛️ Meme doublure d'onglets que le filet L4 : un pressable par option, portant
// son libelle. Elle sert ici a PROUVER UNE ABSENCE — au 23/08, aucun de ces
// trois types ne monte de `SegmentedControl`.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function SegmentedControlDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.View,
      // 🔎 R6 (vague R) — LA DOUBLURE RELAIE AUSSI LA CONSIGNE D'AFFICHAGE.
      // Le libelle a toujours ete complet DANS L'ARBRE : c'est `numberOfLines`
      // qui le coupait A L'ECRAN. Un temoin qui lirait le texte rendu serait
      // donc vert avant comme apres le correctif — seule la prop tranche.
      // 🔠 S5 (vague S) : la doublure relaie AUSSI `fitLabels`. Elle ne captait
      // que `fullLabels` — un temoin qui ne regarde pas la prop qui commande
      // reste vert quand l ecran change de mode.
      {
        fitLabels: Boolean(props.fitLabels),
        fullLabels: Boolean(props.fullLabels),
        testID: 'doublure-onglets',
      },
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

jest.mock('../components/EventParticipants', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function EventParticipantsDouble() {
    return react.createElement(
      rn.View,
      { testID: 'doublure-participants' },
      react.createElement(rn.Text, null, 'LISTE_DES_PARTICIPANTS'),
    );
  };
});

jest.mock('../components/EventDetectionSlots', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function EventDetectionSlotsDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.View,
      { testID: 'doublure-postes-detection' },
      react.createElement(rn.Text, null, `POSTES_DETECTION:${(props.slots || []).length}`),
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
const DESCRIPTION = 'Rendez-vous au gymnase, pensez a la gourde.';

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  description: DESCRIPTION,
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Evenement',
  participations: [],
  startTime: '10:00',
  team: {
    club: { documentId: CLUB_ID },
    documentId: TEAM_ID,
    name: 'U15',
    players: [{ documentId: 'joueur-1' }, { documentId: 'joueur-2' }],
    trainers: [{ documentId: 'coach-1' }],
  },
  type: { name: 'Entrainement' },
  ...overrides,
});

// 🏕️ UN STAGE PARENT, tel que le serveur le sert : c'est le FORMAT qui porte le
// type, jamais le nom. `stage_parent` est un `eventFormat`, pas un `type.name`.
const buildStageParent = (/** @type {any} */ overrides = {}) => buildEvent({
  childStageEvents: [
    {
      date: '2026-10-20T09:00:00.000Z',
      documentId: 'jour-1',
      endTime: '17:00:00.000',
      // 🧨 C'est `participationRequests` — et non `participations` — que lit le
      // resume d'une journee (`getStageDayStatusSummary`). Se tromper de champ
      // ferait afficher « 0 · 0 · 0 » a un stage plein.
      participationRequests: [
        { documentId: 'r-1', participationStatus: 'accepted', user: { documentId: 'u-1' } },
        { documentId: 'r-2', participationStatus: 'declined', user: { documentId: 'u-2' } },
        { documentId: 'r-3', participationStatus: 'pending', user: { documentId: 'u-3' } },
      ],
      startTime: '09:00:00.000',
    },
    {
      date: '2026-10-21T09:00:00.000Z',
      documentId: 'jour-2',
      endTime: '17:00:00.000',
      participationRequests: [],
      startTime: '09:00:00.000',
    },
  ],
  eventFormat: 'stage_parent',
  name: 'Stage de la Toussaint',
  participations: [{ documentId: 'u-1' }, { documentId: 'u-2' }],
  stageDefaultEndTime: '17:00:00.000',
  stageDefaultStartTime: '09:00:00.000',
  stageEndDate: '2026-10-24',
  stageStartDate: '2026-10-20',
  type: { name: 'Stage' },
  ...overrides,
});

// 🏆 UN TOURNOI AVEC DES EQUIPES INSCRITES — la charge qu'aucun test ne montait.
// `status: 'pending'` est exactement ce qui fait apparaitre « Valider » et
// « Refuser » sur la carte d'une equipe.
const buildTournoi = (/** @type {any} */ overrides = {}) => buildEvent({
  name: 'Tournoi de printemps',
  tournamentConfig: {
    competitionState: 'draft',
    formatMode: 'groups_only',
    registrationMode: 'manual',
  },
  tournamentTeams: [
    {
      documentId: 'equipe-a',
      members: [
        {
          documentId: 'm-1',
          responseStatus: 'present',
          user: { documentId: 'u-1', firstname: 'Ana', lastname: 'Diaz' },
        },
        {
          documentId: 'm-2',
          responseStatus: 'pending',
          user: { documentId: 'u-2', firstname: 'Bilal', lastname: 'Sow' },
        },
      ],
      name: 'Les Aigles',
      sourceType: 'custom',
      status: 'accepted',
    },
    {
      captainUser: { documentId: 'u-3', firstname: 'Chloe', lastname: 'Meunier' },
      documentId: 'equipe-b',
      members: [
        {
          documentId: 'm-3',
          responseStatus: 'present',
          user: { documentId: 'u-3', firstname: 'Chloe', lastname: 'Meunier' },
        },
      ],
      name: 'Les Lions',
      sourceType: 'custom',
      status: 'pending',
    },
  ],
  type: { name: 'Tournoi' },
  ...overrides,
});

// 🔎 UNE DETECTION AVEC DES POSTES RECHERCHES.
const buildDetection = (/** @type {any} */ overrides = {}) => buildEvent({
  name: 'Detection U15',
  recruitmentAds: [
    { documentId: 'poste-1', position: 'Gardien', slots: 2 },
    { documentId: 'poste-2', position: 'Attaquant', slots: 3 },
  ],
  type: { name: 'Detection' },
  ...overrides,
});

const authPour = (
  /** @type {string} */ documentId,
  /** @type {boolean} */ peutGerer = false,
) => ({
  canEditClub: () => peutGerer,
  canEditEvent: () => peutGerer,
  canManageEvent: () => peutGerer,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: {
    documentId,
    role: { name: peutGerer ? 'Dirigeant' : 'Joueur' },
  },
});

/** @type {any} */
let mounted = null;

const demonter = () => {
  if (!mounted) return;
  act(() => {
    mounted.unmount();
  });
  mounted = null;
};

const monter = (/** @type {any} */ {
  attendance = null,
  auth,
  campagnes = [],
  event,
} = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockAttendance.data = attendance;
  mockCampaigns.value = campagnes;
  mockBulkReminder.mockClear();
  mockGenerateAssignments.mockClear();
  mockUseAuth.mockReturnValue(auth || authPour('coach-1', true));

  demonter();
  mockSetOptions.mockClear();

  act(() => {
    mounted = renderer.create(
      <EventDetails
        navigation={{
          addListener: () => () => {},
          getParent: () => undefined,
          getState: () => ({ routeNames: ['EventDetails', 'EventEdit'] }),
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

afterEach(() => {
  demonter();
});

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

const textesVisibles = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node))
  .filter(Boolean);

const contient = (/** @type {any} */ root, /** @type {string} */ extrait) => textesVisibles(root)
  .join(' | ')
  .includes(extrait);

const parTestID = (/** @type {any} */ root, /** @type {string} */ id) => root
  .findAll((/** @type {any} */ node) => node.props?.testID === id, { deep: false });

const libellesDesOnglets = (/** @type {any} */ root) => parTestID(root, 'doublure-onglets')
  .flatMap((/** @type {any} */ node) => node
    .findAllByType(TouchableOpacity)
    .map((/** @type {any} */ item) => textOf(item)));

// 👆 Presse le bouton dont le libelle CONTIENT cet extrait. La doublure de
// `Button` rend un `TouchableOpacity` portant son titre : c'est exactement ce
// qu'un doigt atteint.
const appuyerSur = (/** @type {any} */ root, /** @type {string} */ extrait) => {
  const cible = root
    .findAllByType(TouchableOpacity)
    .find((/** @type {any} */ node) => textOf(node).includes(extrait));
  if (!cible) throw new Error(`Aucun bouton « ${extrait} » a l ecran`);
  if (cible.props.disabled) throw new Error(`Le bouton « ${extrait} » est grise`);
  act(() => {
    cible.props.onPress();
  });
};

const allerSurLOnglet = (/** @type {any} */ root, /** @type {string} */ valeur) => {
  const [onglet] = parTestID(root, `onglet-${valeur}`);
  if (!onglet) throw new Error(`Aucun onglet « ${valeur} » a l ecran`);
  act(() => {
    onglet.props.onPress();
  });
};

// AVIS (09/09) - EventDetails lit desormais les avis d entrainement. Sans ce
// double, l import tire `@/services/client`, qui JETTE sans `.env` et fait
// tomber la suite ENTIERE avant le premier temoin.
jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetTrainingReviews: () => ({ data: null }),
}));

describe('N2 · 4F — LE STAGE PARENT SE RANGE EN TROIS ONGLETS', () => {
  // ♻️ REECRITS PAR L'ETAPE 3. Les quatre temoins de caracterisation disaient :
  // deux pastilles maison, pas d'onglets · les puces « 2 jour(s) / 2 inscrit(s) »
  // dans une carte · la liste sans appui · la description apres le bloc. Les
  // quatre changent, et c'est EXACTEMENT le rangement demande.

  test('il porte Aperçu · Jours · N · Personnes · N, et PLUS ses pastilles maison', () => {
    const root = monter({ event: buildStageParent() });

    expect(libellesDesOnglets(root)).toEqual(['Aperçu', 'Jours · 2', 'Personnes · 2']);
    // ⛔ LE COEUR DE L'ETAPE : le second jeu de navigation a disparu. Tant que
    // « Vue générale » traine a l'ecran, c'est qu'il reste des onglets DANS un
    // onglet — l'emboitement que la planche 04 interdit.
    expect(contient(root, 'Vue générale')).toBe(false);
  });

  test('les deux compteurs ont quitte les puces pour les ONGLETS', () => {
    // Les puces « 2 jour(s) » et « 2 inscrit(s) » disaient la meme chose que les
    // onglets « Jours · 2 » et « Personnes · 2 ». Elles ne sont pas perdues :
    // elles sont remontees a l'endroit ou on les cherche.
    const root = monter({ event: buildStageParent() });

    expect(contient(root, '2 jour(s)')).toBe(false);
    expect(contient(root, '2 inscrit(s)')).toBe(false);
    expect(libellesDesOnglets(root)).toContain('Jours · 2');
    expect(libellesDesOnglets(root)).toContain('Personnes · 2');
  });

  test('l Aperçu garde periode, horaires et lieu', () => {
    const root = monter({ event: buildStageParent() });

    expect(contient(root, 'Période')).toBe(true);
    expect(contient(root, 'Horaires')).toBe(true);
    expect(contient(root, 'Lieu principal')).toBe(true);
  });

  test('🧾 la DESCRIPTION ouvre desormais l Aperçu — elle passe AVANT le stage', () => {
    // Regle 2 du pack, signalee par la note du jalon N3 : quatre blocs passaient
    // devant elle sur un stage. Le sens de la comparaison s'inverse ici, et
    // c'est la preuve que le rangement a bien change l'ordre.
    const root = monter({ event: buildStageParent() });
    const textes = textesVisibles(root).join(' | ');

    expect(textes).toContain(DESCRIPTION);
    expect(textes.indexOf(DESCRIPTION)).toBeLessThan(textes.indexOf('Période'));
  });

  test('la liste des personnes vit dans l onglet « Personnes »', () => {
    const root = monter({ event: buildStageParent() });

    expect(contient(root, 'LISTE_DES_PARTICIPANTS')).toBe(false);

    allerSurLOnglet(root, 'participants');
    expect(contient(root, 'LISTE_DES_PARTICIPANTS')).toBe(true);
  });

  test('📅 l onglet « Jours » liste les journees, numerotees, avec leur legende', () => {
    const root = monter({ event: buildStageParent() });
    allerSurLOnglet(root, 'stageDays');

    expect(parTestID(root, 'stage-days')).toHaveLength(1);
    expect(contient(root, 'présent·e·s · absent·e·s · sans réponse')).toBe(true);
    expect(contient(root, 'Jour 1')).toBe(true);
    expect(contient(root, 'Jour 2')).toBe(true);
    // Jour 1 : un·e accepte·e, un·e refuse·e, un·e sans reponse. Jour 2 : vide.
    expect(contient(root, '1 · 1 · 1')).toBe(true);
    expect(contient(root, '0 · 0 · 0')).toBe(true);
  });

  test('un stage SANS journee garde l onglet, avec son etat vide', () => {
    // Regle de la planche 04 : un onglet vide reste affiche. Le compteur dit 0,
    // et l'onglet explique — il ne disparait pas.
    const root = monter({ event: buildStageParent({ childStageEvents: [] }) });

    expect(libellesDesOnglets(root)).toContain('Jours · 0');

    allerSurLOnglet(root, 'stageDays');
    expect(parTestID(root, 'stage-days-empty')).toHaveLength(1);
  });
});

describe('N2 · caracterisation — LE TOURNOI ET SES EQUIPES INSCRITES', () => {
  // ♻️ REECRITS PAR L'ETAPE 4. Ces deux temoins cherchaient un TEXTE a l'ecran.
  // 🧨 C'est trop faible : quand l'action a demenage du panneau de tete vers la
  // barre du bas, ils sont restes VERTS sans rien mesurer de vrai. Ils nomment
  // maintenant l'ENDROIT, qui est tout le sujet du deplacement.
  test('l action primaire a QUITTE le panneau de tete pour la barre du bas', () => {
    const root = monter({ event: buildTournoi() });

    const barre = parTestID(root, 'tournament-bottom-bar');
    expect(barre).toHaveLength(1);
    expect(textesVisibles(barre[0]).join(' ')).toContain('Gérer le tournoi');
  });

  test('un lecteur qui ne gere PAS lit « Voir le tournoi », dans la barre', () => {
    const root = monter({
      auth: authPour('visiteur-1', false),
      event: buildTournoi(),
    });

    const barre = parTestID(root, 'tournament-bottom-bar');
    expect(barre).toHaveLength(1);
    expect(textesVisibles(barre[0]).join(' ')).toContain('Voir le tournoi');
  });

  // ♻️ REECRITS PAR L'ETAPE 5 : tout ce qui parle des EQUIPES a rejoint son
  // onglet. L'Apercu garde l'etat de la competition, et lui seul.
  test('l Apercu garde l etat de la competition', () => {
    const root = monter({ event: buildTournoi() });

    expect(contient(root, 'TOURNOI')).toBe(true);
    expect(contient(root, 'Compétition en brouillon')).toBe(true);
    // ⛔ Les cartes d'equipe, elles, ne sont plus la : elles ont un onglet.
    expect(contient(root, 'Équipes tournoi')).toBe(false);
    expect(contient(root, 'Les Lions')).toBe(false);
  });

  test('🔒 « Valider » et « Refuser » VIVENT DANS L ONGLET Équipes, intacts', () => {
    // ⚠️ LE TEMOIN LE PLUS IMPORTANT DU FICHIER, et la raison d'etre du filet
    // de l'etape 1 : ces deux boutons acceptent ou refusent l'inscription d'une
    // equipe — un geste qui engage l'organisateur vis-a-vis d'un tiers. Le
    // rangement les DEPLACE ; il ne doit ni les perdre, ni elargir qui les voit.
    const root = monter({ event: buildTournoi() });
    allerSurLOnglet(root, 'tournamentTeams');

    expect(contient(root, 'Les Lions')).toBe(true);
    expect(contient(root, 'À VÉRIFIER')).toBe(true);
    expect(contient(root, 'Valider')).toBe(true);
    expect(contient(root, 'Refuser')).toBe(true);
  });

  test('👑 la carte dit A QUI s adresser pour cette equipe', () => {
    // La carte disait le NOMBRE de joueurs sans jamais nommer le referent :
    // un organisateur qui veut verifier une inscription ne savait pas qui
    // contacter.
    const root = monter({ event: buildTournoi() });
    allerSurLOnglet(root, 'tournamentTeams');

    expect(contient(root, 'Référent·e : Chloe Meunier')).toBe(true);
  });

  test('un lecteur qui ne gere PAS ne voit ni « Valider » ni « Refuser »', () => {
    const root = monter({
      auth: authPour('visiteur-1', false),
      event: buildTournoi(),
    });
    allerSurLOnglet(root, 'tournamentTeams');

    // Il voit bien les equipes — c'est public — mais aucun geste d'arbitrage.
    expect(contient(root, 'Les Lions')).toBe(true);
    expect(contient(root, 'Valider')).toBe(false);
    expect(contient(root, 'Refuser')).toBe(false);
  });

  test('l equipe VALIDEE est dite inscrite, dans le meme onglet', () => {
    const root = monter({ event: buildTournoi() });
    allerSurLOnglet(root, 'tournamentTeams');

    expect(contient(root, 'Les Aigles')).toBe(true);
    expect(contient(root, 'INSCRITE')).toBe(true);
  });

  // ♻️ REECRIT PAR L'ETAPE 4 : le defaut est corrige. `renderActionButtons`
  // rendait `null` des qu'il voyait un tournoi, depuis avril.
  test('🏆 un tournoi A une barre du bas, et elle ne porte QU UN bouton', () => {
    const root = monter({ event: buildTournoi() });

    const barre = parTestID(root, 'tournament-bottom-bar');
    expect(barre).toHaveLength(1);
    // ⛔ UN seul, jamais la pile de six que portait le panneau de tete.
    expect(barre[0].findAllByType(TouchableOpacity)).toHaveLength(1);
    // Et ce n'est pas le RSVP classique : un tournoi repond par son equipe.
    expect(contient(root, 'DOUBLURE_EventAnswerButtons')).toBe(false);
  });

  // ♻️ REECRIT PAR L'ETAPE 5 : le tournoi rejoint la matrice.
  test('un tournoi porte Apercu · Équipes · N · Personnes · N', () => {
    const root = monter({ event: buildTournoi() });

    // 2 equipes inscrites · 3 membres actifs au total (2 chez les Aigles, 1
    // chez les Lions) — les deux compteurs ne mesurent PAS la meme chose.
    expect(libellesDesOnglets(root)).toEqual(['Aperçu', 'Équipes · 2', 'Personnes · 3']);
  });
});

describe('N2 · caracterisation — LA DETECTION ET SES POSTES', () => {
  test('les postes recherches sont montes des que c est une detection', () => {
    const root = monter({ event: buildDetection() });

    expect(contient(root, 'POSTES_DETECTION:2')).toBe(true);
  });

  // ♻️ REECRIT PAR L'ETAPE 2. Ce temoin disait « la liste est dans la meme
  // colonne, sans onglet ». C'est exactement ce que le rangement change : la
  // liste vit maintenant dans l'onglet « Candidats », et il faut un appui pour
  // l'atteindre. Le temoin ne disparait pas — il dit la NOUVELLE regle.
  test('la liste des candidats vit desormais DANS l onglet « Candidats »', () => {
    const root = monter({ event: buildDetection() });

    // Au montage on est sur l'Aperçu : la liste n'est PAS montee.
    expect(contient(root, 'LISTE_DES_PARTICIPANTS')).toBe(false);

    allerSurLOnglet(root, 'participants');
    expect(contient(root, 'LISTE_DES_PARTICIPANTS')).toBe(true);
  });

  test('la description d une detection est montee elle aussi', () => {
    const root = monter({ event: buildDetection() });

    expect(contient(root, DESCRIPTION)).toBe(true);
  });
});

describe('N2 · LES BARRES DU BAS QUE LE RANGEMENT NE DOIT PAS EMPORTER', () => {
  // 🧪 La planche 04 donne a la DETECTION et au STAGE la meme barre du bas
  // qu'avant : « Présent·e / Absent·e », c'est-a-dire le RSVP classique
  // (`EventAnswerButtons`). Ce lot ne la touche pas — mais « ne pas toucher »
  // se PROUVE, sinon c'est une supposition. Seul le tournoi change (etape 4).
  test('une DETECTION garde sa barre du bas Présent·e / Absent·e', () => {
    const root = monter({ event: buildDetection() });

    expect(contient(root, 'DOUBLURE_EventAnswerButtons')).toBe(true);
    expect(parTestID(root, 'tournament-bottom-bar')).toHaveLength(0);
  });

  test('elle la garde AUSSI depuis l onglet Répartition', () => {
    // ⚠️ La barre vit HORS de la zone a onglets : changer d'onglet ne doit pas
    // l'emporter. C'est exactement le genre de perte qu'un rangement provoque.
    const root = monter({ event: buildDetection() });
    allerSurLOnglet(root, 'detectionSplit');

    expect(contient(root, 'DOUBLURE_EventAnswerButtons')).toBe(true);
  });

  test('un STAGE garde sa barre du bas, sur chacun de ses trois onglets', () => {
    const root = monter({ event: buildStageParent() });

    expect(contient(root, 'DOUBLURE_EventAnswerButtons')).toBe(true);
    allerSurLOnglet(root, 'stageDays');
    expect(contient(root, 'DOUBLURE_EventAnswerButtons')).toBe(true);
    allerSurLOnglet(root, 'participants');
    expect(contient(root, 'DOUBLURE_EventAnswerButtons')).toBe(true);
  });

  test('le TOURNOI garde la sienne sur ses trois onglets', () => {
    const root = monter({ event: buildTournoi() });

    expect(parTestID(root, 'tournament-bottom-bar')).toHaveLength(1);
    allerSurLOnglet(root, 'tournamentTeams');
    expect(parTestID(root, 'tournament-bottom-bar')).toHaveLength(1);
    allerSurLOnglet(root, 'participants');
    expect(parTestID(root, 'tournament-bottom-bar')).toHaveLength(1);
  });
});

describe('N2 · caracterisation — CE QUI NE DOIT PAS BOUGER', () => {
  test('un ENTRAINEMENT garde sa colonne unique et n a aucun onglet', () => {
    const root = monter({ event: buildEvent() });

    expect(parTestID(root, 'doublure-onglets')).toHaveLength(0);
    expect(contient(root, DESCRIPTION)).toBe(true);
    expect(contient(root, 'LISTE_DES_PARTICIPANTS')).toBe(true);
  });

  // ♻️ REECRIT PAR L'ETAPE 2 : le match garde ses trois onglets, mais celui des
  // personnes porte maintenant son effectif (D1, retro-applique au match).
  test('un MATCH garde ses trois onglets, avec l effectif sur « Participants »', () => {
    const root = monter({ event: buildEvent({ type: { name: 'Match' } }) });

    expect(libellesDesOnglets(root)).toEqual(['Aperçu', 'Participants · 0', 'Convocation']);
  });
});

describe('N2 · 4E — « OÙ EN EST LE TOURNOI », LE FIL DES CINQ ETAPES', () => {
  test('il montre les cinq etapes, dans l ordre, sur l Aperçu', () => {
    const root = monter({ event: buildTournoi() });

    expect(parTestID(root, 'tournament-progress-rail')).toHaveLength(1);
    const textes = textesVisibles(root).join(' | ');
    expect(textes).toContain('OÙ EN EST LE TOURNOI');
    ['Réglages', 'Équipes', 'Poules', 'Matchs', 'Publié'].forEach((etape) => {
      expect(textes).toContain(etape);
    });
    expect(textes.indexOf('Poules')).toBeLessThan(textes.indexOf('Matchs'));
    expect(textes.indexOf('Matchs')).toBeLessThan(textes.indexOf('Publié'));
  });

  // 🧷 Le fil rend la coche et le libelle dans DEUX `Text` distincts : on
  // lit donc une etape entiere par son testID, jamais la page a plat.
  const etapeDuFil = (/** @type {any} */ root, /** @type {number} */ rang) => {
    const [noeud] = parTestID(root, `tournament-rail-step-${rang}`);
    if (!noeud) throw new Error(`Aucune etape ${rang} dans le fil`);
    // SANS-EMOJI (01/10/2026) : la coche est une icône (`SvgIcon` « check »), plus
    // un caractère. Elle se lit ici comme le mot « [coche] » en tête de l'étape.
    const coche = noeud.findAll((n) => n.props && n.props.name === 'check').length ? ['[coche]'] : [];
    return coche.concat(noeud
      .findAllByType(Text)
      .map((/** @type {any} */ n) => textOf(n)))
      .join(' ');
  };

  test('un BROUILLON n a que ses « Réglages » de faits', () => {
    // ⚠️ Une seule coche : le format est choisi, mais une seule equipe est
    // validee — il en faut deux pour qu'un tournoi existe.
    const root = monter({ event: buildTournoi() });

    expect(etapeDuFil(root, 1)).toContain('[coche]');
    expect(etapeDuFil(root, 1)).toContain('Réglages');
    // Les quatre suivantes portent leur RANG, pas une coche.
    expect(etapeDuFil(root, 2)).toContain('2');
    expect(etapeDuFil(root, 2)).not.toContain('[coche]');
    expect(etapeDuFil(root, 5)).not.toContain('[coche]');
  });

  test('un tournoi PUBLIE a ses cinq etapes cochees', () => {
    // 🔑 La regle qui rend le fil honnete sans appel serveur supplementaire :
    // publier EXIGE des poules et des matchs. Un tournoi publie les a donc
    // forcement franchies.
    const root = monter({
      event: buildTournoi({
        tournamentConfig: {
          competitionState: 'published',
          formatMode: 'groups_only',
          registrationMode: 'manual',
        },
        tournamentTeams: [
          {
            documentId: 'a', members: [], name: 'A', status: 'accepted',
          },
          {
            documentId: 'b', members: [], name: 'B', status: 'accepted',
          },
        ],
      }),
    });

    [1, 2, 3, 4, 5].forEach((rang) => {
      expect(etapeDuFil(root, rang)).toContain('[coche]');
    });
  });

  test('le fil dit combien d inscriptions restent a verifier', () => {
    const root = monter({ event: buildTournoi() });

    expect(contient(root, '1 inscription à vérifier')).toBe(true);
  });
});

describe('N2 · 4E — « Personnes » : QUI VIENT, TOUTES EQUIPES CONFONDUES', () => {
  test('l organisateur voit les personnes, groupees par equipe', () => {
    const root = monter({ event: buildTournoi() });
    allerSurLOnglet(root, 'participants');

    expect(parTestID(root, 'tournament-people')).toHaveLength(1);
    expect(contient(root, 'Ana Diaz')).toBe(true);
    expect(contient(root, 'Bilal Sow')).toBe(true);
    expect(contient(root, 'Chloe Meunier')).toBe(true);
  });

  test('🔒 un VISITEUR voit l onglet et son compte, JAMAIS les noms', () => {
    // ⚠️ C'est la reunion des effectifs de toutes les equipes — souvent des
    // dizaines de personnes, parfois mineures. Un nombre ne designe personne ;
    // une liste de noms, si.
    const root = monter({
      auth: authPour('visiteur-1', false),
      event: buildTournoi(),
    });

    expect(libellesDesOnglets(root)).toContain('Personnes · 3');

    allerSurLOnglet(root, 'participants');
    expect(parTestID(root, 'tournament-people-locked')).toHaveLength(1);
    expect(contient(root, 'Ana Diaz')).toBe(false);
    expect(contient(root, 'Chloe Meunier')).toBe(false);
  });

  test('🪦 un compte SUPPRIME ne laisse pas de fantome dans la liste', () => {
    // AA02 : le serveur RENOMME sans effacer. La garde de reference exige
    // `blocked` EN PLUS du tombstone, pour qu'un joueur vivant ne soit jamais
    // masque par erreur.
    const root = monter({
      event: buildTournoi({
        tournamentTeams: [{
          documentId: 'equipe-a',
          members: [
            {
              documentId: 'm-1',
              responseStatus: 'present',
              user: { documentId: 'u-1', firstname: 'Ana', lastname: 'Diaz' },
            },
            {
              documentId: 'm-2',
              responseStatus: 'present',
              user: {
                blocked: true,
                documentId: 'u-9',
                firstname: 'Utilisateur',
                lastname: 'Supprimé',
                username: 'deleted_user_9_1700000000',
              },
            },
          ],
          name: 'Les Aigles',
          status: 'accepted',
        }],
      }),
    });
    allerSurLOnglet(root, 'participants');

    expect(contient(root, 'Ana Diaz')).toBe(true);
    expect(contient(root, 'Utilisateur Supprimé')).toBe(false);
  });

  test('un tournoi SANS personne garde l onglet, avec son etat vide', () => {
    const root = monter({
      event: buildTournoi({
        tournamentTeams: [{
          documentId: 'a', members: [], name: 'A', status: 'accepted',
        }],
      }),
    });

    expect(libellesDesOnglets(root)).toContain('Personnes · 0');

    allerSurLOnglet(root, 'participants');
    expect(parTestID(root, 'tournament-people-empty')).toHaveLength(1);
  });

  test('⛔ « Composition d équipes » a disparu du tournoi (bloc mort)', () => {
    // D7 : ce bloc parlait de la composition de l'EQUIPE de l'evenement, notion
    // qui n'a aucun sens sur un tournoi — on y joue par equipe inscrite. Il ne
    // se rend plus, sur aucun des trois onglets.
    const root = monter({ event: buildTournoi() });
    expect(contient(root, 'Composition d')).toBe(false);

    allerSurLOnglet(root, 'tournamentTeams');
    expect(contient(root, 'Composition d')).toBe(false);

    allerSurLOnglet(root, 'participants');
    expect(contient(root, 'Composition d')).toBe(false);
  });
});

describe('N2 · 4E — LA BARRE DU BAS DU TOURNOI DIT CE QUE CE LECTEUR-LA PEUT FAIRE', () => {
  // 🎯 Six etats, six libelles — tous DEJA ecrits dans l'ancien panneau de tete.
  // Ce lot les deplace, il n'en invente aucun. Chaque temoin verifie qu'un role
  // recoit SON action, et une seule.
  // 🧨 On lit les `Text` RENDUS a l interieur de la barre, jamais `textOf` sur
  // le noeud lui-meme : `<Button title="..." />` ne porte pas d enfants, son
  // libelle vit dans une prop. `textOf` y rendrait la chaine vide, et le temoin
  // passerait au vert sur une barre muette.
  const libelleDeLaBarre = (/** @type {any} */ root) => {
    const barre = parTestID(root, 'tournament-bottom-bar');
    if (!barre.length) throw new Error('Aucune barre du bas a l ecran');
    return barre[0]
      .findAllByType(Text)
      .map((/** @type {any} */ node) => textOf(node))
      .join(' ');
  };

  test('1/6 — l ORGANISATEUR lit « Gérer le tournoi »', () => {
    const root = monter({ event: buildTournoi() });

    expect(libelleDeLaBarre(root)).toContain('Gérer le tournoi');
  });

  test('2/6 — le CAPITAINE d une equipe lit « Gérer mon équipe inscrite »', () => {
    const root = monter({
      auth: authPour('cap-1', false),
      event: buildTournoi({
        tournamentTeams: [{
          captainUser: { documentId: 'cap-1' },
          documentId: 'equipe-a',
          members: [],
          name: 'Les Aigles',
          status: 'accepted',
        }],
      }),
    });

    expect(libelleDeLaBarre(root)).toContain('Gérer mon équipe inscrite');
  });

  test('3/6 — un MEMBRE lit « Voir mon équipe inscrite »', () => {
    // `u-1` est membre actif des Aigles dans la charge de reference.
    const root = monter({
      auth: authPour('u-1', false),
      event: buildTournoi(),
    });

    expect(libelleDeLaBarre(root)).toContain('Voir mon équipe inscrite');
  });

  test('4/6 — un INVITE lit « Répondre à mon invitation »', () => {
    const root = monter({
      auth: authPour('invite-1', false),
      event: buildTournoi({
        tournamentTeams: [{
          documentId: 'equipe-a',
          members: [
            { documentId: 'm-9', responseStatus: 'invited', user: { documentId: 'invite-1' } },
          ],
          name: 'Les Aigles',
          status: 'accepted',
        }],
      }),
    });

    expect(libelleDeLaBarre(root)).toContain('Répondre à mon invitation');
  });

  test('5/6 — qui a DEMANDE a rejoindre lit « Suivre ma demande »', () => {
    const root = monter({
      auth: authPour('demandeur-1', false),
      event: buildTournoi({
        tournamentTeams: [{
          documentId: 'equipe-a',
          members: [
            { documentId: 'm-9', responseStatus: 'requested', user: { documentId: 'demandeur-1' } },
          ],
          name: 'Les Aigles',
          status: 'accepted',
        }],
      }),
    });

    expect(libelleDeLaBarre(root)).toContain('Suivre ma demande');
  });

  test('6/6 — un VISITEUR lit « Voir le tournoi »', () => {
    const root = monter({
      auth: authPour('inconnu-1', false),
      event: buildTournoi(),
    });

    expect(libelleDeLaBarre(root)).toContain('Voir le tournoi');
  });

  test('⛔ une JOURNEE de stage n est pas un tournoi : elle garde sa barre normale', () => {
    // La condition `!isStageDayEvent` protege ce cas depuis toujours ; elle est
    // reprise telle quelle dans la barre. Un temoin plutot qu'une supposition.
    const root = monter({
      event: buildTournoi({ eventFormat: 'stage_day' }),
    });

    expect(parTestID(root, 'tournament-bottom-bar')).toHaveLength(0);
    expect(contient(root, 'DOUBLURE_EventAnswerButtons')).toBe(true);
  });
});

// 💶 Une campagne de cotisation telle que le serveur la sert : neuf compteurs,
// dont la page ne lisait qu'un seul avant ce lot.
const buildCampagne = (/** @type {any} */ overrides = {}) => ({
  currency: 'EUR',
  defaultAmountCents: 8000,
  documentId: 'camp-1',
  name: 'Stage Toussaint',
  status: 'active',
  totals: {
    expectedCents: 192000,
    paidCents: 144000,
    paidCount: 18,
    statusCounts: { overdue: 2, partial: 1, pending: 3 },
    total: 24,
  },
  ...overrides,
});

describe('N2 · 4F — « QUI N A PAS PAYE » ARRIVE SUR LA PAGE DU STAGE', () => {
  test('la carte annonce combien d impayés, sur combien d inscrit·e·s', () => {
    const root = monter({
      campagnes: [buildCampagne()],
      event: buildStageParent(),
    });

    expect(parTestID(root, 'stage-license-card')).toHaveLength(1);
    expect(contient(root, 'PROCHAINE ACTION')).toBe(true);
    expect(contient(root, 'Relancer 6 impayés')).toBe(true);
    expect(contient(root, 'Sur 24 inscrit·e·s, 6 n’ont pas réglé')).toBe(true);
  });

  test('🔒 elle est INVISIBLE pour qui ne gere pas les cotisations du club', () => {
    // ⚠️ Donnee financiere : « 6 n'ont pas réglé » sur un groupe de 24 designe
    // un sixieme du groupe par soustraction. Elle ne sort jamais du perimetre
    // de qui gere l'argent du club.
    const root = monter({
      auth: authPour('parent-1', false),
      campagnes: [buildCampagne()],
      event: buildStageParent(),
    });

    expect(parTestID(root, 'stage-license-card')).toHaveLength(0);
    expect(contient(root, 'Relancer 6 impayés')).toBe(false);
    expect(contient(root, 'PROCHAINE ACTION')).toBe(false);
  });

  test('📮 « Relancer » demande confirmation, puis envoie LES TROIS etats impayes', () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const root = monter({
      campagnes: [buildCampagne()],
      event: buildStageParent(),
    });

    appuyerSur(root, 'Relancer 6 impayés');

    // Rien n'est parti tant que la confirmation n'est pas donnee : envoyer un
    // message a six familles ne se declenche pas sur un appui unique.
    expect(mockBulkReminder).not.toHaveBeenCalled();
    expect(alerte).toHaveBeenCalled();

    const boutons = alerte.mock.calls[0][2];
    const envoyer = boutons.find((/** @type {any} */ b) => b.text === 'Envoyer');
    act(() => {
      envoyer.onPress();
    });

    // 🔑 La charge est EXACTEMENT celle de l'ecran des cotisations du club :
    // meme definition d'un impaye, meme appel serveur.
    expect(mockBulkReminder).toHaveBeenCalledWith(
      'camp-1',
      { statuses: ['pending', 'partial', 'overdue'] },
    );

    alerte.mockRestore();
  });

  test('🔇 une campagne NON ACTIVE grise le bouton, et dit pourquoi', () => {
    const root = monter({
      campagnes: [buildCampagne({ status: 'draft' })],
      event: buildStageParent(),
    });

    expect(contient(root, 'La campagne n’est pas active')).toBe(true);
    // Le bouton est la, mais ferme : `appuyerSur` refuse un bouton grise.
    expect(() => appuyerSur(root, 'Relancer 6 impayés')).toThrow('est grise');
    expect(mockBulkReminder).not.toHaveBeenCalled();
  });

  test('🧮 les inscrit·e·s SANS cotisation sont comptes, et rattrapables', () => {
    // ⚠️ Ce trou-la est invisible partout ailleurs : ces personnes ne sont ni
    // payeuses ni impayees — elles n'existent pas dans la campagne.
    const root = monter({
      campagnes: [buildCampagne()],
      event: buildStageParent({
        participations: Array.from({ length: 27 }, (_, i) => ({ documentId: `p-${i}` })),
      }),
    });

    expect(contient(root, '3 inscrit·e·s sans cotisation')).toBe(true);

    appuyerSur(root, 'Mettre à jour les affectations');
    expect(mockGenerateAssignments).toHaveBeenCalledWith('camp-1');
  });

  test('sans aucun impaye, la carte felicite au lieu de proposer une relance', () => {
    const root = monter({
      campagnes: [buildCampagne({
        totals: {
          expectedCents: 192000,
          paidCents: 192000,
          paidCount: 24,
          statusCounts: { overdue: 0, partial: 0, pending: 0 },
          total: 24,
        },
      })],
      event: buildStageParent(),
    });

    expect(contient(root, 'Tout le monde a réglé sa cotisation.')).toBe(true);
    expect(contient(root, 'Relancer')).toBe(false);
  });

  test('sans campagne rattachee, aucune carte — la page ne parle pas d argent', () => {
    const root = monter({ event: buildStageParent() });

    expect(parTestID(root, 'stage-license-card')).toHaveLength(0);
  });
});

describe('N2 · 4G — LA DETECTION SE RANGE EN TROIS ONGLETS', () => {
  test('elle porte Aperçu · Répartition · Candidats · N, dans cet ordre', () => {
    // 🔢 « Répartition » est le SEUL onglet de toute la matrice sans compteur —
    // il ne compte pas des personnes, il montre un chemin. C'est une regle de
    // la planche 04, et c'est ce que `withTabCount` rend possible sans un
    // second helper : un compteur absent rend le libelle nu.
    const root = monter({ event: buildDetection() });

    expect(libellesDesOnglets(root)).toEqual(['Aperçu', 'Répartition', 'Candidats · 0']);
  });

  test('le compteur de « Candidats » suit les inscrit·e·s acceptes', () => {
    const root = monter({
      event: buildDetection({
        participations: [
          { documentId: 'c-1', firstname: 'Ana' },
          { documentId: 'c-2', firstname: 'Bilal' },
          { documentId: 'c-3', firstname: 'Chloe' },
        ],
      }),
    });

    expect(libellesDesOnglets(root)).toEqual(['Aperçu', 'Répartition', 'Candidats · 3']);
  });

  test('les postes recherches restent dans l Aperçu, pas dans la Répartition', () => {
    const root = monter({ event: buildDetection() });

    expect(contient(root, 'POSTES_DETECTION:2')).toBe(true);

    allerSurLOnglet(root, 'detectionSplit');
    expect(contient(root, 'POSTES_DETECTION:2')).toBe(false);
  });

  test('🧭 la Répartition montre LE CHEMIN COMPLET, ses 4 etapes dans l ordre', () => {
    const root = monter({ event: buildDetection() });
    allerSurLOnglet(root, 'detectionSplit');

    expect(parTestID(root, 'detection-split-path')).toHaveLength(1);
    const textes = textesVisibles(root).join(' | ');
    expect(textes).toContain('LE CHEMIN COMPLET');
    expect(textes).toContain('1. Pointer les présent·e·s');
    expect(textes).toContain('2. Répartir en équipes');
    expect(textes).toContain('3. Placer sur le terrain');
    expect(textes).toContain('4. Faire tourner');
    // L'ordre des quatre gestes EST le sujet de l'onglet : il se verifie.
    expect(textes.indexOf('1. Pointer')).toBeLessThan(textes.indexOf('2. Répartir'));
    expect(textes.indexOf('2. Répartir')).toBeLessThan(textes.indexOf('3. Placer'));
    expect(textes.indexOf('3. Placer')).toBeLessThan(textes.indexOf('4. Faire tourner'));
  });

  test('🔢 l etape 1 compte le pointage DU SERVEUR, et ignore « not_marked »', () => {
    // ⚠️ LA REGLE QUE CE TEMOIN TIENT : le nombre de pointe·e·s se lit sur
    // `GET /events/:id/attendance`, jamais dans l'etat local de l'ecran de
    // repartition — celui-la ne survit pas a un retour en arriere et dirait
    // « 0 pointé » a un coach qui vient d'en pointer trois.
    // ⛔ Et `not_marked` est la valeur que le serveur donne a quelqu'un qu'on
    // n'a PAS pointe : la compter afficherait « 3 sur 3 » avant le coup d'envoi.
    const root = monter({
      attendance: {
        data: {
          items: [
            { attendanceStatus: 'arrived_on_time', user: { documentId: 'c-1' } },
            { attendanceStatus: 'not_marked', user: { documentId: 'c-2' } },
            { attendanceStatus: 'no_show', user: { documentId: 'c-3' } },
          ],
        },
      },
      event: buildDetection({
        participations: [
          { documentId: 'c-1', firstname: 'Ana' },
          { documentId: 'c-2', firstname: 'Bilal' },
          { documentId: 'c-3', firstname: 'Chloe' },
        ],
      }),
    });
    allerSurLOnglet(root, 'detectionSplit');

    expect(contient(root, '2 pointé·e·s sur 3')).toBe(true);
  });

  test('sans aucun candidat inscrit, l etape 1 le dit au lieu d afficher « 0 sur 0 »', () => {
    const root = monter({ event: buildDetection() });
    allerSurLOnglet(root, 'detectionSplit');

    expect(contient(root, 'Aucun candidat inscrit pour l’instant')).toBe(true);
  });

  test('l etape 2 propose « Générer la répartition »', () => {
    const root = monter({ event: buildDetection() });
    allerSurLOnglet(root, 'detectionSplit');

    expect(contient(root, 'Générer la répartition')).toBe(true);
  });

  test('🔇 les etapes 3 et 4 sont GRISEES, et elles DISENT pourquoi', () => {
    // ⛔ Regle 5 du pack : jamais un bouton gris sans son motif. Tant que la
    // repartition n'existe pas, le terrain et la rotation ne mènent nulle part
    // — mais ils restent visibles et expliquent ce qui les ouvre.
    const root = monter({ event: buildDetection() });
    allerSurLOnglet(root, 'detectionSplit');

    expect(contient(root, 'Placer sur le terrain')).toBe(true);
    expect(contient(root, 'Faire tourner')).toBe(true);
    expect(contient(root, 'Génère d’abord la répartition, à l’étape 2.')).toBe(true);
  });

  test('🔒 un candidat voit l onglet Répartition, mais avec son etat vide', () => {
    // La planche 04 est explicite : un onglet vide reste AFFICHE. Le retirer
    // ferait changer la page de forme selon qui regarde.
    const root = monter({
      auth: authPour('candidat-1', false),
      event: buildDetection(),
    });

    expect(libellesDesOnglets(root)).toEqual(['Aperçu', 'Répartition', 'Candidats · 0']);

    allerSurLOnglet(root, 'detectionSplit');
    expect(parTestID(root, 'detection-split-staff-only')).toHaveLength(1);
    expect(contient(root, 'Réservé au staff de la séance')).toBe(true);
    // ⛔ Et surtout : AUCUN des quatre gestes de staff ne lui est propose.
    expect(parTestID(root, 'detection-split-path')).toHaveLength(0);
    expect(contient(root, 'Générer la répartition')).toBe(false);
  });
});

// 📏 R6 (vague R) — LA MATRICE ENTIERE DEMANDE SES LIBELLES ENTIERS.
//
// 🧨 Le constat de recette du 24/08 portait sur un MATCH, mais le defaut n'est
// pas au match : il est dans la repartition en TIERS EGAUX, que les quatre
// types partagent. Et ce sont les AUTRES types qui portent les libelles les
// plus longs — « Répartition », « Candidats · 12 », « Personnes · 74 ».
// ⇒ Mesurer le seul match aurait laisse trois ecrans casses derriere un
// temoin vert. Le voici sur les trois types que N2 a ranges.
// ♻️ MIS A JOUR PAR S5 (vague S) : meme exigence, autre reponse. R6 obtenait
// « entier » avec DEUX lignes ; a l'ecran, les libelles se cassaient sur leur
// derniere lettre. C'est desormais UNE ligne avec retrecissement (`fitLabels`).
describe('N2 · S5 — aucun libelle d onglet n est coupe, quel que soit le type', () => {
  test.each([
    ['stage parent', () => buildStageParent()],
    ['tournoi', () => buildTournoi()],
    ['detection', () => buildDetection()],
  ])('un %s demande ses libelles ENTIERS, sur UNE ligne', (_nom, construire) => {
    const root = monter({ event: construire() });

    const [controle] = parTestID(root, 'doublure-onglets');

    expect(controle.props.fitLabels).toBe(true);
    expect(controle.props.fullLabels).toBe(false);
    // 🔒 Contre-epreuve : la consigne d'affichage change, les compteurs de la
    // planche 04 restent. Trois onglets, jamais moins.
    expect(libellesDesOnglets(root)).toHaveLength(3);
  });
});

// T-FINITIONS2 (16/11, chef « go a+b ») — recette 39, iPhone 2.6.904 : l'entraîneur d'un
// AUTRE club, capitaine d'une équipe en attente, voyait « Inscrire une équipe du club » (refus
// certain du serveur, `registerClubTeam`) et le rail « OÙ EN EST LE TOURNOI » avec
// « N inscriptions à vérifier ».
describe('T-FINITIONS2 — la fiche du tournoi pour qui n organise pas', () => {
  const CLUB_ORGA = { documentId: 'club-orga', name: 'AR Soccer' };
  const entraineur = (/** @type {any} */ club, /** @type {boolean} */ peutGerer = false) => ({
    ...authPour('coach-autre', peutGerer),
    userData: {
      documentId: 'coach-autre',
      role: { name: peutGerer ? 'Dirigeant' : 'Entraineur' },
      trainedTeams: [{ club, documentId: 'equipe-u13', name: 'U13' }],
    },
  });
  const tournoi = (/** @type {any} */ sur = {}) => buildTournoi({
    club: CLUB_ORGA, tournamentTeams: [], ...sur,
  });

  test('🔴 b — entraîneur d un autre club : pas de « Inscrire une équipe du club »', () => {
    const root = monter({ auth: entraineur({ documentId: 'club-autre' }), event: tournoi() });
    expect(contient(root, 'Inscrire une équipe du club')).toBe(false);
  });

  test('b caractérisant — entraîneur du club organisateur : le bouton reste', () => {
    const root = monter({ auth: entraineur(CLUB_ORGA), event: tournoi() });
    expect(contient(root, 'Inscrire une équipe du club')).toBe(true);
  });

  test('b caractérisant — tournoi privé : une équipe d un autre club peut demander', () => {
    const root = monter({
      auth: entraineur({ documentId: 'club-autre' }),
      event: tournoi({ sessionStatus: 'closed' }),
    });
    expect(contient(root, 'Inscrire une équipe du club')).toBe(true);
  });

  test('🔴 a — qui ne gère pas : ni le rail ni « inscriptions à vérifier » ; le badge reste', () => {
    const root = monter({ auth: authPour('visiteur-1', false), event: buildTournoi() });
    expect(contient(root, 'OÙ EN EST LE TOURNOI')).toBe(false);
    expect(contient(root, 'à vérifier')).toBe(false);
    expect(contient(root, 'Compétition en brouillon')).toBe(true);
  });

  test('a caractérisant — l organisateur garde le rail', () => {
    const root = monter({ event: buildTournoi() });
    expect(contient(root, 'OÙ EN EST LE TOURNOI')).toBe(true);
  });
});

// ==========================================================================
// T-FINITIONS-3 (16/11, tournoi du 19/12) — la fiche du tournoi au TÉLÉPHONE.
// (b) un compte plus jeune que `tournamentConfig.minAge` lit « Ce tournoi est ouvert à partir de
// {minAge} ans. »
//     et n'a aucun bouton d'inscription ; âge inconnu ou assez grand : rien ne change.
// « À partir de {minAge} ans » remplace l'âge de la catégorie (« Sénior (+18 ans) ») ; sans minAge
// elle reste.
// ==========================================================================
describe('T-FINITIONS-3 — âge minimum et catégorie du tournoi', () => {
  const joueurNeLe = (/** @type {string | null} */ birthdate) => ({
    ...authPour('joueur-seul', false),
    userData: { birthdate, documentId: 'joueur-seul', role: { name: 'Joueur' } },
  });
  const tournoi1912 = (/** @type {any} */ config = { minAge: 16 }) => buildTournoi({
    date: '2026-12-19T17:15:00.000Z',
    tournamentCategory: { name: 'Sénior (+18 ans)' },
    tournamentConfig: {
      competitionState: 'draft',
      formatMode: 'groups_only',
      registrationMode: 'manual',
      ...config,
    },
  });

  test('🔴 15 ans au jour du tournoi : « ouvert à partir de 16 ans », aucun bouton', () => {
    const root = monter({ auth: joueurNeLe('2011-06-01'), event: tournoi1912() });
    expect(contient(root, 'Ce tournoi est ouvert à partir de 16 ans.')).toBe(true);
    expect(contient(root, 'Créer une équipe pour ce tournoi')).toBe(false);
    expect(contient(root, 'Inscrire une équipe du club')).toBe(false);
  });

  test('caractérisant — 18 ans, ou âge inconnu : « Créer une équipe… » reste', () => {
    ['2008-01-01', null].forEach((birthdate) => {
      const root = monter({ auth: joueurNeLe(birthdate), event: tournoi1912() });
      expect(contient(root, 'Créer une équipe pour ce tournoi')).toBe(true);
      expect(contient(root, 'Ce tournoi est ouvert à partir de')).toBe(false);
    });
  });

  test('🔴 minAge posé : « À partir de 16 ans » remplace « Sénior (+18 ans) »', () => {
    const root = monter({ auth: joueurNeLe('2008-01-01'), event: tournoi1912() });
    expect(contient(root, 'À partir de 16 ans')).toBe(true);
    expect(contient(root, 'Sénior (+18 ans)')).toBe(false);
  });

  test('caractérisant — sans minAge, la catégorie reste « Sénior (+18 ans) »', () => {
    const root = monter({ auth: joueurNeLe('2008-01-01'), event: tournoi1912({}) });
    expect(contient(root, 'Sénior (+18 ans)')).toBe(true);
    expect(contient(root, 'À partir de')).toBe(false);
  });
});

// Ajout du chef (17/11, recette 41) : la case « Validation » dit la vraie règle (témoin du site).
describe('T-FINITIONS-3 — la case « Validation » du tournoi', () => {
  const tournoiConfig = (/** @type {any} */ config) => buildTournoi({
    tournamentConfig: { competitionState: 'draft', formatMode: 'groups_only', ...config },
  });

  const PAYANT = 2000;
  test('🔴 payant en « manual » : « Équipe validée au 5ᵉ joueur payé », sans « Manuelle »', () => {
    const root = monter({ event: tournoiConfig({ entryFeeCents: PAYANT, registrationMode: 'manual' }) });
    expect(contient(root, 'Équipe validée au 5ᵉ joueur payé')).toBe(true);
    expect(contient(root, 'Manuelle')).toBe(false);
  });

  test('caractérisant — gratuit en « manual » : « Manuelle » ; « auto » payant : « Auto »', () => {
    const gratuit = monter({ event: tournoiConfig({ registrationMode: 'manual' }) });
    expect(contient(gratuit, 'Manuelle')).toBe(true);
    const auto = monter({ event: tournoiConfig({ entryFeeCents: PAYANT, registrationMode: 'auto' }) });
    expect(contient(auto, 'Auto')).toBe(true);
    expect(contient(auto, 'joueur payé')).toBe(false);
  });
});

// ==========================================================================
// T-PARCOURS-2 (17/11, tournoi du 19/12) — la fiche du tournoi au TÉLÉPHONE.
// Point 3 : personne n'a `tournament-team-member.find`, le serveur retire donc `members` de la
// fiche et l'app proposait « Créer une équipe pour ce tournoi » à qui en avait déjà une (le refus
// n'arrivait qu'après le nom, la déclaration et les 2 cases). Le serveur rend maintenant la ligne
// du LECTEUR par équipe (`viewerMembership: { responseStatus }`) : la fiche la lit.
// Point 2 : le visiteur a un bouton « Se connecter pour s'inscrire », qui range le tournoi où
// revenir (navigation/retourAuTournoi.js) puis ouvre la connexion.
// ==========================================================================
describe('T-PARCOURS-2 — « Voir mon équipe » et le bouton du visiteur', () => {
  const libelleDeLaBarre = (/** @type {any} */ root) => parTestID(
    root,
    'tournament-bottom-bar',
  )[0]
    .findAllByType(Text)
    .map((/** @type {any} */ node) => textOf(node))
    .join(' ');
  // Les équipes comme le serveur les rend : sans `members`.
  const tournoiDuServeur = (/** @type {any} */ viewerMembership = null) => buildTournoi({
    tournamentTeams: [
      {
        documentId: 'equipe-a',
        name: 'Les Aigles',
        sourceType: 'custom',
        status: 'accepted',
        viewerMembership,
      },
      {
        documentId: 'equipe-b',
        name: 'Les Lions',
        sourceType: 'custom',
        status: 'pending',
        viewerMembership: null,
      },
    ],
  });
  const CREER = 'Créer une équipe pour ce tournoi';

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  test('3 caractérisant — sans équipe : « Créer une équipe », barre « Voir le tournoi »', () => {
    const root = monter({ auth: authPour('u-777', false), event: tournoiDuServeur() });
    expect(contient(root, CREER)).toBe(true);
    expect(libelleDeLaBarre(root)).toContain('Voir le tournoi');
  });

  test('🔴 3 — déjà membre (ligne du lecteur) : « Voir mon équipe inscrite »', () => {
    const root = monter({
      auth: authPour('u-777', false),
      event: tournoiDuServeur({ responseStatus: 'pending' }),
    });
    expect(contient(root, CREER)).toBe(false);
    expect(libelleDeLaBarre(root)).toContain('Voir mon équipe inscrite');
    appuyerSur(root, 'Voir mon équipe inscrite');
    expect(mockNavigate).toHaveBeenCalledWith('TournamentTeamDetails', {
      eventId: 'event-1', teamId: 'equipe-a',
    });
  });

  test('🔴 3 — invité en attente : « Répondre à mon invitation », plus de « Créer »', () => {
    const root = monter({
      auth: authPour('u-777', false),
      event: tournoiDuServeur({ responseStatus: 'invited' }),
    });
    expect(contient(root, CREER)).toBe(false);
    expect(libelleDeLaBarre(root)).toContain('Répondre à mon invitation');
  });

  test('🔴 2 — visiteur : le bouton de connexion range le tournoi et ouvre la connexion', () => {
    // eslint-disable-next-line global-require
    const { prendreLeRetourAuTournoi } = require('@/navigation/retourAuTournoi');
    prendreLeRetourAuTournoi();
    const root = monter({
      auth: { ...authPour('', false), userData: null },
      event: tournoiDuServeur(),
    });
    expect(libelleDeLaBarre(root)).toContain("Se connecter pour s'inscrire");
    appuyerSur(root, "Se connecter pour s'inscrire");
    expect(mockNavigate).toHaveBeenCalledWith('PublicAuthStack', {
      params: { origin: 'EventDetails', source: 'event-details-tournament-register' },
      screen: 'Login',
    });
    expect(prendreLeRetourAuTournoi()).toBe('event-1');
  });

  test('2 caractérisant — visiteur sur un tournoi clôturé : « Voir le tournoi »', () => {
    const root = monter({
      auth: { ...authPour('', false), userData: null },
      event: buildTournoi({
        tournamentConfig: { closedAt: '2026-11-01T10:00:00.000Z', registrationMode: 'manual' },
        tournamentTeams: [],
      }),
    });
    expect(libelleDeLaBarre(root)).toContain('Voir le tournoi');
  });
});
