/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// N4 (E6) — CE QUE LA PAGE DIT APRES LE MATCH, AVANT QU ON Y TOUCHE.
//
// 🧨 LE MOTIF : les trois blocs post-match (« Mes stats », « Mon retour
// coach », « Stats du match ») et la relance n avaient AUCUN temoin qui les
// nomme. Or N4 refond leur tete : sans filet, rien n aurait dit qu une
// information a disparu en route — et c est exactement la regression la plus
// chere du projet (du code devenu inatteignable, que personne ne relit).
//
// Ces temoins decrivent le COMPORTEMENT, pas la forme de l arbre :
//   · les blocs presents et ce qu ils annoncent ;
//   · les chiffres qui doivent survivre (score, reponses, version) ;
//   · ce que la relance ENVOIE aujourd hui.
// Ils sont ADAPTES par les etapes suivantes du lot, et chaque adaptation est
// nommee dans son commit — c est la le filet.
// ==========================================================================

const mockUseAuth = jest.fn();
const mockSetOptions = jest.fn();
const mockRemindMutate = jest.fn();
const mockRemindMatchMutateAsync = jest.fn();
const mockNavigate = jest.fn();
const mockStartWhisperChat = jest.fn();
// ST-MONMATCH (écran 2, état 3) — « Présent » sur la ligne d'un absent à l'appel.
const mockUpdateLateMutate = jest.fn();
const mockEventQuery = { data: null };
const mockMatchStatsQuery = { data: null };
const mockMyMatchResponseQuery = { data: null };
const mockAttendanceQuery = { data: null };
/** @type {any[]} */
const propsDesParticipants = [];

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

// ST-MATCH (écran 2) — la doublure INTERPOLE les {{…}} quand on lui en donne : « Karim
// t'a marqué absent samedi à 18:55. ». Aucun témoin d'avant ne lisait un {{…}} brut.
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback, /** @type {any} */ options) => {
      // ST-MATCH (écran 7) — les pluriels de i18next (`count`, defaultValue_one/_other).
      if (fallback && typeof fallback === 'object' && fallback.defaultValue_one) {
        const modele = Number(fallback.count) <= 1 ? fallback.defaultValue_one : fallback.defaultValue_other;
        return String(modele).replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ tout, /** @type {string} */ nom) => (
          nom in fallback ? String(fallback[nom]) : tout
        ));
      }
      return (typeof fallback === 'string'
        ? fallback.replace(
          /\{\{(\w+)\}\}/g,
          (/** @type {string} */ tout, /** @type {string} */ nom) => (
            options && nom in options ? String(options[nom]) : tout
          ),
        )
        : key
      );
    },
  }),
}));

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

jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    options,
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { config: jest.fn(), fs: { dirs: {} } },
}));

jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockUseAuth() }));

// ST-MATCH (écran 2) — « Écrire à Karim » passe par `startWhisperChat`.
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ sendMessage: jest.fn(), startWhisperChat: mockStartWhisperChat }),
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
  useGetEventAttendance: () => ({ ...emptyQuery(), data: mockAttendanceQuery.data }),
  useGetEventConvocation: () => emptyQuery(),
  useGetEventTeamComposition: () => emptyQuery(),
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
  useGetEventMatchStats: () => ({ ...emptyQuery(), data: mockMatchStatsQuery.data }),
  useGetEventMyMatchResponse: () => ({ ...emptyQuery(), data: mockMyMatchResponseQuery.data }),
}));

jest.mock('@/services/event/eventService', () => ({
  approveFeatured: jest.fn(),
  exportEventParticipants: jest.fn(),
  rejectFeatured: jest.fn(),
}));

jest.mock('@/services/recruitment/recruitmentService', () => ({ applyToRecruitmentAd: jest.fn() }));

jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  createCustomTournamentTeam: jest.fn(),
  registerClubTeamToTournament: jest.fn(),
  requestJoinTournamentTeam: jest.fn(),
  respondToTournamentTeam: jest.fn(),
  reviewTournamentTeamRegistration: jest.fn(),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));

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
      remindEventMutation: { isPending: false, mutate: mockRemindMutate },
      // ST-MATCH (écran 7) — « Relancer » depuis la carte (remind-responses).
      remindMatchResponsesMutation: { isPending: false, mutateAsync: mockRemindMatchMutateAsync },
      reportEventMutation: idleMutation(),
      requestFeaturedMutation: idleMutation(),
      resetAttendanceMutation: idleMutation(),
      respondToEventRsvpMutation: idleMutation(),
      saveMatchResultMutation: { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() },
      selfArrivalMutation: idleMutation(),
      selfLateMutation: idleMutation(),
      sosAlertMutation: idleMutation(),
      updateEventMutation: idleMutation(),
      updateEventNoNavMutation: idleMutation(),
      updateLateMinutesMutation: { isPending: false, mutate: mockUpdateLateMutate },
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
    return react.createElement(
      rn.View,
      null,
      props.headerComponent || null,
      props.children,
      props.footerComponent || null,
    );
  };
});

// 🎯 LA DOUBLURE QUI ENREGISTRE SES PROPS. `handleRemindPlayers` descend
// jusqu ici : c est donc ici qu on lit CE QUE L ECRAN ENVOIE quand on relance,
// sans avoir a monter les 1 179 lignes de la vraie liste.
jest.mock('../components/EventParticipants', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function EventParticipantsDouble(/** @type {any} */ props) {
    propsDesParticipants.push(props);

    return react.createElement(rn.View, { testID: 'doublure-participants' });
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
import RemindTeamsSheet from '../components/RemindTeamsSheet';
// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const COACH = 'coach-1';
const JOUEUR = 'joueur-1';

// Un match FINI : c est l horloge du SERVEUR qui le decide (AC10), jamais celle
// du telephone — sans `serverNow`, la reponse est toujours « non ».
const MATCH_FINI = {
  club: { documentId: CLUB_ID },
  date: '2020-01-01T10:00:00.000Z',
  documentId: 'event-1',
  endDate: '2020-01-01T12:00:00.000Z',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Match contre Saint-Julien',
  participations: [],
  startTime: '10:00',
  team: {
    club: { documentId: CLUB_ID },
    documentId: TEAM_ID,
    name: 'U15',
    players: [{ documentId: JOUEUR }],
    trainers: [{ documentId: COACH }],
  },
  type: { name: 'Match' },
};

const HORLOGE = { data: { serverNow: '2020-01-01T14:00:00.000Z' } };

const statsAvec = (/** @type {any} */ champs = {}) => ({
  permissions: { canManage: true, canView: true },
  report: null,
  score: {
    available: false,
    locked: false,
    scoreAgainst: null,
    scoreFor: null,
    source: null,
    waitingOfficial: false,
  },
  sport: 'football',
  team: { documentId: TEAM_ID, name: 'U15' },
  ...champs,
});

const authPour = (/** @type {string} */ documentId, /** @type {boolean} */ peutGerer = false) => ({
  canEditClub: () => peutGerer,
  canEditEvent: () => peutGerer,
  canManageEvent: () => peutGerer,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { documentId, role: { name: peutGerer ? 'Dirigeant' : 'Joueur' } },
});

// 🧹 L horloge serveur d `EventDetails` pose un `setInterval` : un ecran
// orphelin le laisse tourner apres la fin du fichier, et jest ne rend jamais
// la main. On demonte donc TOUT ce qui a ete monte.
/** @type {any[]} */
const montes = [];

const monter = (/** @type {any} */ options = {}) => {
  const {
    auth = authPour(COACH, true),
    event = MATCH_FINI,
    horloge = HORLOGE,
    matchStats = statsAvec(),
    myMatchResponse = null,
    // ST-MONMATCH — `focusSection` : la notification « Retour de Karim » ouvre la fiche ici.
    params = {},
  } = options;

  mockUseAuth.mockReturnValue(auth);
  mockEventQuery.data = event;
  mockMatchStatsQuery.data = matchStats;
  mockMyMatchResponseQuery.data = myMatchResponse;
  mockAttendanceQuery.data = horloge;

  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(
      <EventDetails
        navigation={{
          addListener: () => () => {},
          canGoBack: () => true,
          goBack: jest.fn(),
          navigate: mockNavigate,
          setOptions: mockSetOptions,
        }}
        route={{ params: { eventId: 'event-1', ...params } }}
      />,
    );
  });
  montes.push(arbre);

  return arbre.root;
};

const textOf = (/** @type {any} */ node) => {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (node.children) return textOf(node.children);

  return '';
};

const textesVisibles = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node.props.children).trim())
  .filter(Boolean);

const rangDe = (/** @type {string[]} */ textes, /** @type {string} */ fragment) => textes
  .findIndex((texte) => texte.includes(fragment));

/**
 * Bascule sur un onglet. La liste des participants — donc la relance — vit
 * dans l onglet « Participants » depuis L4 : sans ce geste, la doublure n est
 * jamais rendue et l on croirait la relance disparue.
 * @param {any} root - Racine du rendu.
 * @param {string} valeur - 'overview' | 'participants' | 'callUp'.
 * @returns {void}
 */
const allerSurLOnglet = (root, valeur) => {
  const [onglet] = root.findAll(
    (/** @type {any} */ node) => node.props?.testID === `onglet-${valeur}`,
    { deep: false },
  );
  if (!onglet) return;
  act(() => { onglet.props.onPress(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  propsDesParticipants.length = 0;
});

afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
});

// ---------------------------------------------------------------------------
// E6/1 — LES BLOCS POST-MATCH, ET LES CHIFFRES QUI DOIVENT SURVIVRE
// ---------------------------------------------------------------------------

// AVIS (09/09) - EventDetails lit desormais les avis d entrainement. Sans ce
// double, l import tire `@/services/client`, qui JETTE sans `.env` et fait
// tomber la suite ENTIERE avant le premier temoin.
jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetTrainingReviews: () => ({ data: null }),
}));

describe('N4/E6 — ce que la page dit apres un match fini', () => {
  test('le suivi post-match est la des que le lecteur peut le voir', () => {
    const textes = textesVisibles(monter());

    expect(rangDe(textes, 'Stats du match')).toBeGreaterThanOrEqual(0);
  });

  // ⚠️ TEMOIN ADAPTE PAR L ETAPE 4 (D6). Avant : la page affichait
  // « Score à compléter » dans l entete du bloc. Depuis la carte-parcours, la
  // meme chose se dit a sa place — l ETAPE 1 du parcours, qui la nomme
  // (« Score ») et dit ce qu il reste a faire (« À enregistrer »).
  // L information n a pas disparu : elle a un titre.
  // 🎯 ST-MATCH (écran 7) — ADAPTÉ : « À enregistrer » devient « À saisir » (le langage du
  // design validé : « Saisir le score »).
  test('sans score, l etape 1 dit qu il reste a le saisir', () => {
    const textes = textesVisibles(monter());

    expect(rangDe(textes, 'Score')).toBeGreaterThanOrEqual(0);
    expect(rangDe(textes, 'À saisir')).toBeGreaterThanOrEqual(0);
  });

  test('🔢 avec un score, elle affiche le score DU SERVEUR', () => {
    const textes = textesVisibles(monter({
      matchStats: statsAvec({
        score: {
          available: true,
          locked: false,
          scoreAgainst: 1,
          scoreFor: 3,
          source: 'manual',
          waitingOfficial: false,
        },
      }),
    }));

    expect(rangDe(textes, '3 - 1')).toBeGreaterThanOrEqual(0);
  });

  test('🔢 le compteur de reponses des joueurs se lit, avec ses DEUX nombres', () => {
    const textes = textesVisibles(monter({
      matchStats: statsAvec({
        report: {
          responseCompletionCount: 4,
          responseEligibleCount: 12,
          status: 'draft',
          version: 1,
        },
      }),
    }));

    expect(textes.some((texte) => texte.includes('4') && texte.includes('12'))).toBe(true);
  });

  // 🎯 ST-MATCH (écran 7) — ADAPTÉ : « Version v3 » et la date brute sont RETIRÉS par le
  // design validé ; la carte dit « Feuille publiée — le 20 août à 20:30 ».
  test('la date de publication se lit en mots, sans « Version »', () => {
    const textes = textesVisibles(monter({
      matchStats: statsAvec({
        report: {
          finalizedAt: '2026-08-20T18:30:00.000Z',
          status: 'final',
          version: 3,
        },
        score: {
          available: true, locked: false, scoreAgainst: 1, scoreFor: 3, source: 'manual', waitingOfficial: false,
        },
      }),
    }));
    const publiee = new Date('2026-08-20T18:30:00.000Z');
    const jour = publiee.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const heure = publiee.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    expect(rangDe(textes, 'Feuille publiée')).toBeGreaterThanOrEqual(0);
    expect(rangDe(textes, `Le ${jour} à ${heure}`)).toBeGreaterThanOrEqual(0);
    expect(rangDe(textes, 'v3')).toBe(-1);
    expect(rangDe(textes, 'Publication')).toBe(-1);
  });

  test('⚠️ le motif d une verification requise ne disparait pas', () => {
    const textes = textesVisibles(monter({
      matchStats: statsAvec({
        report: { needsReview: true, status: 'final', version: 2 },
      }),
    }));

    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : l'étape 1 passe en orange et le dit.
    expect(rangDe(textes, 'Score officiel changé')).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// D6 — LA CARTE-PARCOURS, BRANCHEE DANS L ECRAN
// ---------------------------------------------------------------------------

describe('N4/D6 — la carte « APRÈS LE MATCH » est dans l Apercu', () => {
  const parTestID = (/** @type {any} */ root, /** @type {string} */ id) => root
    .findAll((/** @type {any} */ node) => node.props?.testID === id, { deep: false })[0];

  // 🪤 LE BOUTON EST SOUS LE `testID`, PAS DESSUS. L atome `Button` ne declare
  // ni ne transmet `testID` (son JSDoc s arrete a `accessibilityRole`) : le
  // repere vit donc sur le `View` qui l enveloppe. Pose sur le bouton, il
  // n aurait existe QUE dans les doublures de test — et ce temoin serait passe
  // au vert sur un repere absent de la vraie application.
  const boutonSous = (/** @type {any} */ root, /** @type {string} */ id) => {
    const conteneur = parTestID(root, id);
    if (!conteneur) return null;

    return conteneur.findAll(
      (/** @type {any} */ node) => typeof node.props?.onPress === 'function',
      { deep: false },
    )[0];
  };

  test('elle est la, et elle annonce l etape courante', () => {
    const root = monter();

    expect(parTestID(root, 'post-match-journey')).toBeTruthy();
    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : l'étape dans le surtitre, en une ligne.
    expect(textesVisibles(root)).toEqual(expect.arrayContaining(['Après le match · étape 1 sur 3']));
  });

  test('🎯 sans score, son bouton ouvre la FEUILLE DE SCORE, pas l editeur', () => {
    const root = monter();

    act(() => { boutonSous(root, 'post-match-action').props.onPress(); });

    // La feuille courte d AD01 : deux champs, et c est tout. Elle vit dans
    // l ecran, donc rien n est navigue — c est justement la preuve.
    expect(mockNavigate).not.toHaveBeenCalledWith(
      'MatchStatsEditor',
      expect.anything(),
    );
    // 🎯 ST-MATCH (écran 9) — ADAPTÉ : la feuille dit « Score final », et son bouton dit
    // le score qu'il enregistre (0 - 0 à l'ouverture).
    expect(textesVisibles(root)).toEqual(expect.arrayContaining(['Score final', 'Enregistrer 0 - 0']));
  });

  test('🎯 avec un score, son bouton ouvre l EDITEUR complet', () => {
    const root = monter({
      matchStats: statsAvec({
        score: {
          available: true,
          locked: false,
          scoreAgainst: 1,
          scoreFor: 3,
          source: 'manual',
          waitingOfficial: false,
        },
      }),
    });

    act(() => { boutonSous(root, 'post-match-action').props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledWith(
      'MatchStatsEditor',
      expect.objectContaining({ eventId: 'event-1' }),
    );
  });

  test('⛔ le motif d une porte fermee ne disparait pas avec les 7 titres', () => {
    // Un match PAS FINI : la porte est grisee, et elle doit dire pourquoi.
    const root = monter({
      event: {
        ...MATCH_FINI,
        date: '2099-01-01T10:00:00.000Z',
        endDate: '2099-01-01T12:00:00.000Z',
      },
    });

    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : avant la fin, plus de bouton éteint ; la carte dit
    // QUAND tout s'ouvre (« Tout s'ouvre à la fin du match, … »).
    expect(textesVisibles(root).some((texte) => texte.startsWith('Tout s’ouvre à la fin du match, ')))
      .toBe(true);
    expect(root.findAll((/** @type {any} */ n) => n.props?.testID === 'post-match-action')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// E6/2 — CE QUE LA RELANCE ENVOIE AUJOURD HUI
// ---------------------------------------------------------------------------

describe('N4/E6 — la relance, et ce que D5 y change', () => {
  test('elle descend jusqu a la liste des participants', () => {
    allerSurLOnglet(monter(), 'participants');

    const derniere = propsDesParticipants[propsDesParticipants.length - 1];

    expect(typeof derniere?.handleRemindPlayers).toBe('function');
  });

  // ⚠️ TEMOIN ADAPTE PAR L ETAPE 3 (D5), ET C EST LE SEUL DU LOT.
  // Avant : `handleRemindPlayers()` appelait `mutate('event-1')` tout de suite.
  // Depuis D5, quand il Y A des equipes a relancer, le geste OUVRE LA FEUILLE
  // au lieu d envoyer — parce que le serveur n accepte qu UN `teamId` par
  // appel et qu il faut bien savoir lequel. Le geste direct n a pas disparu :
  // il est le chemin de la liste plate, verrouille par le temoin suivant.
  test('🎯 avec des equipes a relancer, elle OUVRE la feuille sur CETTE equipe', () => {
    const root = monter();
    allerSurLOnglet(root, 'participants');

    const derniere = propsDesParticipants[propsDesParticipants.length - 1];
    act(() => { derniere.handleRemindPlayers(TEAM_ID); });

    const feuille = root.findByType(RemindTeamsSheet);
    expect(feuille.props.isVisible).toBe(true);
    expect(feuille.props.equipePreCochee).toBe(TEAM_ID);
    // ⛔ Rien n est parti : c est la feuille qui enverra, avec les equipes cochees.
    expect(mockRemindMutate).not.toHaveBeenCalled();
  });

  test('🔒 sans equipe a relancer, le geste d avant est INTACT : mutate en chaine', () => {
    // Une equipe sans joueur eligible n a personne a relancer : la feuille
    // n aurait rien a proposer, et proposer un choix entre zero option serait
    // une porte qui ne mene nulle part.
    const root = monter({
      event: { ...MATCH_FINI, team: { ...MATCH_FINI.team, players: [] } },
    });
    allerSurLOnglet(root, 'participants');

    const derniere = propsDesParticipants[propsDesParticipants.length - 1];
    act(() => { derniere.handleRemindPlayers(); });

    expect(mockRemindMutate).toHaveBeenCalledTimes(1);
    expect(mockRemindMutate.mock.calls[0][0]).toBe('event-1');
    expect(root.findByType(RemindTeamsSheet).props.isVisible).toBe(false);
  });

  test('🔢 la feuille ne recoit QUE les equipes ayant des sans-reponse', () => {
    const root = monter();
    allerSurLOnglet(root, 'participants');

    const feuille = root.findByType(RemindTeamsSheet);
    expect(feuille.props.sections.length).toBeGreaterThan(0);
    feuille.props.sections.forEach((/** @type {any} */ section) => {
      expect(section.notAnswered.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// SECU-STATS (01/10) — LA CARTE NE PROPOSE PLUS L EDITEUR DU COACH A UN JOUEUR
// ---------------------------------------------------------------------------
//
// 🔒 `MatchStatsEditor` est l outil de l encadrement : il affiche l avis du
// coach et l auto-evaluation de CHAQUE joueur. Rapport publie ou a re-verifier,
// la carte l ouvrait pourtant a tout membre de l equipe — c est par la qu un
// joueur LISAIT ces champs. La vraie barriere est le serveur (corrige dans le
// meme lot, `admin` SECU-STATS) ; ceci retire la porte. Le joueur garde SA
// reponse, par « Mon retour post-match ».

describe('SECU-STATS — la carte « APRÈS LE MATCH » ne propose plus l editeur du coach a un joueur', () => {
  const SCORE_SAISI = {
    available: true,
    locked: false,
    scoreAgainst: 1,
    scoreFor: 3,
    source: 'manual',
    waitingOfficial: false,
  };

  const boutonDeLaCarte = (/** @type {any} */ root) => {
    const [conteneur] = root.findAll(
      (/** @type {any} */ node) => node.props?.testID === 'post-match-action',
      { deep: false },
    );

    return conteneur.findAll(
      (/** @type {any} */ node) => typeof node.props?.onPress === 'function',
      { deep: false },
    )[0];
  };

  // Un bouton qui ne porte QUE ce titre : un conteneur appuyable qui
  // engloberait plusieurs textes ne doit pas passer pour lui.
  const boutonNomme = (/** @type {any} */ root, /** @type {string} */ titre) => root.findAll(
    (/** @type {any} */ node) => {
      if (typeof node.props?.onPress !== 'function') return false;
      const textes = node.findAllByType(Text);

      return textes.length === 1 && textOf(textes[0].props.children).trim() === titre;
    },
    { deep: false },
  )[0];

  /**
   * L ecran tel qu un JOUEUR de l equipe le voit, rapport publie.
   * @param {object} [rapport] - Les surcharges du rapport.
   * @returns {any} - Les options de `monter`.
   */
  const vuDuJoueur = (rapport = {}) => ({
    auth: authPour(JOUEUR),
    matchStats: statsAvec({
      permissions: { canManage: false, canRespond: true, canView: true },
      report: {
        needsReview: false,
        responseCompletionCount: 1,
        responseEligibleCount: 2,
        status: 'final',
        ...rapport,
      },
      score: SCORE_SAISI,
    }),
    myMatchResponse: {
      permissions: { canRespond: true },
      response: { selfComment: 'Mon propre ressenti', selfRating: 6, status: 'submitted' },
    },
  });

  // 🎯 ST-MATCH (écran 7) — ADAPTÉ : le joueur n'a plus la carte de l'encadrement (et son
  // bouton éteint) mais « Le bilan de … », SANS AUCUNE porte vers l'éditeur. La règle de
  // SECU-STATS tient plus fort : il n'y a plus rien à appuyer qui y mène.
  test.each([
    ['rapport publie', {}],
    ['rapport a re-verifier apres un score officiel', { needsReview: true }],
  ])('🔒 %s : pour un JOUEUR, aucune porte vers l editeur', (_cas, rapport) => {
    const root = monter(vuDuJoueur(rapport));

    expect(root.findAll((/** @type {any} */ n) => n.props?.testID === 'post-match-action')).toHaveLength(0);
    const bilan = root.findAll((/** @type {any} */ n) => n.props?.testID === 'st-match-bilan-publie')[0];
    expect(bilan).toBeTruthy();
    bilan.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')
      .forEach((/** @type {any} */ n) => act(() => { n.props.onPress(); }));
    expect(mockNavigate).not.toHaveBeenCalledWith('MatchStatsEditor', expect.anything());
  });

  test('🔒 le joueur lit le bilan publié, sans bouton éteint ; la moyenne attend 3 réponses', () => {
    const textes = textesVisibles(monter(vuDuJoueur()));

    expect(textes).toEqual(expect.arrayContaining(['Le bilan de l’entraîneur', 'Vos notes : dès 3 réponses']));
    expect(rangDe(textes, 'Rapport finalise')).toBe(-1);
  });

  // ST-MONMATCH (écran 12) — ADAPTÉ : « Voir » devient « Modifier ma réponse », qui dit ce
  // qu'il fait ; le geste et sa destination ne changent pas.
  test('le joueur garde SA reponse : « Modifier ma réponse » ouvre son propre questionnaire', () => {
    const root = monter(vuDuJoueur());

    act(() => { boutonNomme(root, 'Modifier ma réponse').props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledWith(
      'PlayerMatchResponse',
      expect.objectContaining({ eventId: 'event-1', teamId: TEAM_ID }),
    );
    expect(mockNavigate).not.toHaveBeenCalledWith('MatchStatsEditor', expect.anything());
  });

  test('PROTEGE : le COACH, rapport publie, ouvre toujours l editeur', () => {
    const root = monter({
      matchStats: statsAvec({
        report: {
          needsReview: false,
          responseCompletionCount: 1,
          responseEligibleCount: 2,
          status: 'final',
        },
        score: SCORE_SAISI,
      }),
    });
    const bouton = boutonDeLaCarte(root);

    expect(bouton.props.disabled).toBe(false);
    act(() => { bouton.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith(
      'MatchStatsEditor',
      expect.objectContaining({ eventId: 'event-1' }),
    );
  });
});

// ==========================================================================
// 🚩 ST-MATCH (écran 2, design des statistiques validé le 02/10) — « ABSENT À
// L'APPEL » : orange (et non plus rouge), QUI a pointé et QUAND, et « Écrire à
// Karim » qui ouvre la conversation privée avec lui.
// ==========================================================================
describe('ST-MATCH écran 2 — marqué absent à l appel', () => {
  const POINTE_A = '2026-09-05T16:55:00.000Z';
  const absent = (/** @type {any} */ champs = {}) => ({
    attendanceRestriction: 'no_show',
    attendanceRestrictionAt: POINTE_A,
    attendanceRestrictionBy: { documentId: COACH, firstname: 'Karim' },
    permissions: { canRespond: false, canView: true },
    response: null,
    ...champs,
  });
  const lePointage = () => {
    const at = new Date(POINTE_A);
    const jour = at.toLocaleDateString('fr-FR', { weekday: 'long' });
    const heure = at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `Karim t'a marqué absent ${jour} à ${heure}.`;
  };
  const textesDe = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
    .map((/** @type {any} */ n) => textOf(n.props.children).trim())
    .filter(Boolean);
  const boutonNomme = (/** @type {any} */ noeud, /** @type {string} */ fragment) => noeud.findAll(
    (/** @type {any} */ n) => n.props?.accessibilityRole === 'button'
      && typeof n.props.onPress === 'function'
      && n.findAllByType(Text)
        .some((/** @type {any} */ x) => textOf(x.props.children).includes(fragment)),
  )[0];
  const leBloc = (/** @type {any} */ racine) => racine
    .findAll((/** @type {any} */ n) => n.props?.testID === 'st-match-absent-a-l-appel')[0];

  test('🚨 état 1 — QUI l a pointé et QUAND, dans un bloc « Mon match » en orange', () => {
    const racine = monter({
      auth: authPour(JOUEUR, false),
      matchStats: statsAvec({ permissions: { canManage: false, canView: true } }),
      myMatchResponse: absent(),
    });

    const bloc = leBloc(racine);
    expect(bloc).toBeTruthy();
    const texte = textesDe(bloc).join(' | ');
    expect(texte).toContain('Mon match');
    expect(texte).toContain('Marqué absent à l\'appel');
    expect(texte).toContain(lePointage());
    expect(texte).toContain('fermé tant que ta présence n\'est pas corrigée.');
    expect(texte).toContain('Karim corrige l\'appel et ton questionnaire se rouvre');
    // Le titre rouge qui accusait le joueur est parti.
    expect(texte).not.toContain('Absent à l’appel');
  });

  test('« Écrire à Karim » ouvre la conversation privée avec lui', async () => {
    mockStartWhisperChat.mockResolvedValue({ documentId: 'chat-karim' });
    const racine = monter({
      auth: authPour(JOUEUR, false),
      matchStats: statsAvec({ permissions: { canManage: false, canView: true } }),
      myMatchResponse: absent(),
    });

    const bouton = boutonNomme(leBloc(racine), 'Écrire à Karim');
    expect(bouton).toBeTruthy();
    await act(async () => {
      await bouton.props.onPress();
    });

    expect(mockStartWhisperChat).toHaveBeenCalledWith([COACH]);
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', { chatId: 'chat-karim' });
  });

  test('🔒 serveur ancien (ni auteur ni heure) : phrase vraie, aucun bouton muet', () => {
    const racine = monter({
      auth: authPour(JOUEUR, false),
      matchStats: statsAvec({ permissions: { canManage: false, canView: true } }),
      myMatchResponse: absent({ attendanceRestrictionAt: null, attendanceRestrictionBy: null }),
    });

    const bloc = leBloc(racine);
    const texte = textesDe(bloc).join(' | ');
    expect(texte).toContain('Un encadrant t\'a marqué absent à l\'appel.');
    expect(boutonNomme(bloc, 'Écrire à')).toBeFalsy();
  });
});

// ==========================================================================
// 🎯 ST-MONMATCH (écran 12, et l'état 2 de l'écran 2) — « MON MATCH » SUR LA FICHE.
// Les états de la carte se testent seuls (`MonMatchCard.STMONMATCH.test.js`). Ici, ce
// que SEULE la fiche peut prouver : la carte remplace les deux anciens blocs, elle reçoit
// le bon nom et le bon avis, la notification la met en tête, et le joueur ne voit QUE lui.
// ==========================================================================
describe('ST-MONMATCH écran 12 — « Mon match » sur la fiche du match', () => {
  const SCORE = {
    available: true, locked: false, scoreAgainst: 1, scoreFor: 2, source: 'manual', waitingOfficial: false,
  };
  const COEQUIPIER = 'joueur-2';
  const MON_AVIS = 'AVIS-DU-COACH-POUR-LE-LECTEUR-INVENTE';
  const AVIS_SUR_UN_COEQUIPIER = 'AVIS-PRIVE-DU-COACH-SUR-UN-COEQUIPIER-INVENTE';
  const AUTO_EVAL_D_UN_COEQUIPIER = 'AUTO-EVALUATION-PRIVEE-D-UN-COEQUIPIER-INVENTEE';
  const AUTO_EVAL_BRUTE = 'AUTO-EVALUATION-BRUTE-D-UN-COEQUIPIER-INVENTEE';
  // Un bloc par testID : `deep: false` ne compte pas deux fois la vue et son hôte natif.
  const parTestID = (/** @type {any} */ root, /** @type {string} */ id) => root
    .findAll((/** @type {any} */ n) => n.props?.testID === id, { deep: false });
  const ENVOYEE = {
    minutesPlayed: 90,
    participation: 'played',
    quantitativeState: 'completed',
    selfComment: 'Mon propre ressenti',
    selfRating: 8,
    sportPayload: { assists: 0, goals: 1 },
    status: 'submitted',
    submittedAt: '2026-10-01T20:28:00.000Z',
    teamRating: 7,
  };

  /**
   * La fiche telle qu un JOUEUR de l equipe la lit, feuille publiee par Karim.
   * @param {object} [options] - Les surcharges.
   * @param {any} [options.reponse] - SA reponse.
   * @param {any} [options.retour] - L avis du coach pour LUI (`myCoachReview`).
   * @param {any} [options.feuille] - Les surcharges de la feuille (`matchStats`).
   * @param {any} [options.params] - Les parametres de la route.
   * @returns {any} - Les options de `monter`.
   */
  const vuDuJoueur = ({
    feuille = {}, params = {}, reponse = ENVOYEE, retour = { comment: MON_AVIS, rating: 7 },
  } = {}) => ({
    auth: authPour(JOUEUR),
    matchStats: statsAvec({
      myCoachReview: retour,
      permissions: { canManage: false, canRespond: true, canView: true },
      report: {
        coachPlayerReviews: [],
        needsReview: false,
        responseCompletionCount: 1,
        responseEligibleCount: 1,
        status: 'final',
        submittedBy: { documentId: COACH, firstname: 'Karim' },
      },
      score: SCORE,
      ...feuille,
    }),
    myMatchResponse: { permissions: { canRespond: true }, response: reponse },
    params,
  });

  test('🔴 une seule carte « Mon match » : plus de « Mes stats » ni de « Mon retour coach »', () => {
    const textes = textesVisibles(monter(vuDuJoueur()));

    expect(textes.filter((texte) => texte === 'Mon match')).toHaveLength(1);
    expect(rangDe(textes, 'Mes stats')).toBe(-1);
    expect(rangDe(textes, 'Mon retour coach')).toBe(-1);
    expect(rangDe(textes, 'Pas encore partagé')).toBe(-1);
    expect(textes).toEqual(expect.arrayContaining(['Ma réponse', 'Envoyée', 'Modifier ma réponse']));
  });

  test('🔴 le retour est NOMMÉ (l auteur de la feuille publiée) et dit privé', () => {
    const textes = textesVisibles(monter(vuDuJoueur()));

    expect(textes).toEqual(expect.arrayContaining(['Le retour de Karim', 'Toi et tes parents', '7/10', MON_AVIS]));
  });

  test('sans auteur de feuille, le prénom vient de l entraîneur de l équipe ; sans lui, la phrase reste vraie', () => {
    const avecEntraineur = textesVisibles(monter({
      ...vuDuJoueur({ feuille: { report: { status: 'final', submittedBy: null } }, retour: null }),
      event: {
        ...MATCH_FINI,
        team: { ...MATCH_FINI.team, trainers: [{ documentId: COACH, firstname: 'Karim' }] },
      },
    }));
    expect(avecEntraineur).toContain('Karim n\'a pas encore écrit de retour pour toi. Tu seras prévenu·e.');

    const sansNom = textesVisibles(monter(vuDuJoueur({
      feuille: { report: { status: 'final', submittedBy: null } }, retour: null,
    })));
    expect(sansNom).toContain('Ton entraîneur n\'a pas encore écrit de retour pour toi. Tu seras prévenu·e.');
  });

  test('🔴 arrivé par la notification : « Nouveau », et le retour AVANT la réponse', () => {
    const textes = textesVisibles(monter(vuDuJoueur({ params: { focusSection: 'coachFeedback' } })));

    expect(textes).toEqual(expect.arrayContaining(['Nouveau', 'Visible par toi et tes parents.']));
    expect(rangDe(textes, 'Le retour de Karim')).toBeLessThan(rangDe(textes, 'Ma réponse'));
  });

  test('🔴 « Donner mon retour » (rien d envoyé) ouvre SON questionnaire, jamais l éditeur', () => {
    const root = monter(vuDuJoueur({ reponse: null, retour: null }));
    const bouton = root.findAll((/** @type {any} */ n) => n.props?.title === 'Donner mon retour')[0];

    expect(bouton).toBeTruthy();
    act(() => { bouton.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith(
      'PlayerMatchResponse',
      expect.objectContaining({ eventId: 'event-1', teamId: TEAM_ID }),
    );
    expect(mockNavigate).not.toHaveBeenCalledWith('MatchStatsEditor', expect.anything());
  });

  test('écran 2, état 2 — la présence corrigée : l encadré disparaît, « Mon match » redevient un retour à donner', () => {
    const root = monter({
      ...vuDuJoueur({ reponse: null, retour: null }),
      myMatchResponse: {
        attendanceRestriction: null,
        attendanceRestrictionAt: null,
        attendanceRestrictionBy: null,
        permissions: { canRespond: true },
        response: null,
      },
    });
    const textes = textesVisibles(root);

    expect(parTestID(root, 'st-match-absent-a-l-appel')).toHaveLength(0);
    expect(rangDe(textes, 'Marqué absent')).toBe(-1);
    // La pastille porte des espaces insécables (`texteInsecable`) : on lit des espaces simples.
    expect(textes.map((texte) => texte.replace(/\s/g, ' '))).toEqual(expect.arrayContaining(['Mon match', 'À répondre']));
    expect(root.findAll((/** @type {any} */ n) => n.props?.title === 'Donner mon retour')).not.toHaveLength(0);
  });

  test('écran 2, état 1 — pointé absent : l encadré, et PAS de carte de réponse à côté', () => {
    const root = monter({
      ...vuDuJoueur({ reponse: null, retour: null }),
      myMatchResponse: {
        attendanceRestriction: 'no_show',
        attendanceRestrictionBy: { documentId: COACH, firstname: 'Karim' },
        permissions: { canRespond: false, canView: true },
        response: null,
      },
    });

    expect(parTestID(root, 'st-match-absent-a-l-appel')).toHaveLength(1);
    expect(parTestID(root, 'st-monmatch')).toHaveLength(0);
    expect(root.findAll((/** @type {any} */ n) => n.props?.title === 'Donner mon retour')).toHaveLength(0);
  });

  test('écran 2, état 3 — l entraîneur corrige l appel d un geste : « Présent » passe le joueur à l heure', () => {
    allerSurLOnglet(monter({ matchStats: statsAvec({ score: SCORE }) }), 'participants');
    const liste = propsDesParticipants[propsDesParticipants.length - 1];

    expect(liste.rouvreLeQuestionnaire).toBe(true);
    act(() => { liste.onCoachMarkPresent({ documentId: JOUEUR }); });
    expect(mockUpdateLateMutate).toHaveBeenCalledWith({
      eventId: 'event-1',
      payload: { lateMinutes: 0, note: null },
      userId: JOUEUR,
    });
  });

  test('écran 2, état 3 — avant la fin du match, la liste ne parle pas de questionnaire', () => {
    allerSurLOnglet(monter({
      event: { ...MATCH_FINI, date: '2099-01-01T10:00:00.000Z', endDate: '2099-01-01T12:00:00.000Z' },
      matchStats: statsAvec({ score: SCORE }),
    }), 'participants');

    expect(propsDesParticipants[propsDesParticipants.length - 1].rouvreLeQuestionnaire).toBe(false);
  });

  test('🔒 FUITE — le joueur ne voit QUE lui, même si une feuille d ancien serveur lui en envoyait plus', () => {
    // Une feuille comme la rendait la prod AVANT SECU-STATS : l avis du coach sur chaque
    // joueur et l auto-évaluation de chacun, deux fois. Le serveur ne les envoie plus ; la
    // fiche ne doit de toute façon RIEN en afficher.
    const root = monter(vuDuJoueur({
      feuille: {
        availablePlayers: [
          { documentId: JOUEUR, playerResponse: ENVOYEE },
          { documentId: COEQUIPIER, playerResponse: { selfComment: AUTO_EVAL_BRUTE, selfRating: 2, status: 'submitted' } },
        ],
        playerResponses: [
          { ...ENVOYEE, label: 'Moi', userDocumentId: JOUEUR },
          {
            label: 'Coéquipier', selfComment: AUTO_EVAL_D_UN_COEQUIPIER, selfRating: 2, status: 'submitted', teamRating: 3, userDocumentId: COEQUIPIER,
          },
        ],
        report: {
          coachPlayerReviews: [
            { comment: MON_AVIS, rating: 7, userDocumentId: JOUEUR },
            { comment: AVIS_SUR_UN_COEQUIPIER, rating: 3, userDocumentId: COEQUIPIER },
          ],
          needsReview: false,
          status: 'final',
          submittedBy: { documentId: COACH, firstname: 'Karim' },
        },
      },
    }));
    const textes = textesVisibles(root);

    // SA part reste : son avis, ses chiffres.
    expect(textes).toContain(MON_AVIS);
    expect(textes.filter((texte) => texte === MON_AVIS)).toHaveLength(1);
    // 🔒 Le filet : tout ce que la fiche écrit, d'un bloc. AUCUN texte privé d'un autre.
    const brut = JSON.stringify(textes);
    expect(brut).not.toContain(AVIS_SUR_UN_COEQUIPIER);
    expect(brut).not.toContain(AUTO_EVAL_D_UN_COEQUIPIER);
    expect(brut).not.toContain(AUTO_EVAL_BRUTE);
  });

  test('🔴 défaut 23 — une réponse envoyée : plus de « Tu étais là ? Passe en présent »', () => {
    // Un match fini il y a une heure : la porte « passer présent après coup » est ouverte
    // (72 h) pour un joueur « pas renseigné ».
    const maintenant = Date.now();
    const recent = {
      ...MATCH_FINI,
      date: new Date(maintenant - 3 * 3600 * 1000).toISOString(),
      endDate: new Date(maintenant - 3600 * 1000).toISOString(),
    };
    const horloge = { data: { serverNow: new Date(maintenant).toISOString() } };
    const porteDuPresent = (/** @type {any} */ root) => root
      .findAll((/** @type {any} */ n) => n.props && 'onDeclareLatePresence' in n.props)
      .some((/** @type {any} */ n) => typeof n.props.onDeclareLatePresence === 'function');

    // Contre-épreuve : rien d'envoyé, la porte reste.
    expect(porteDuPresent(monter({ ...vuDuJoueur({ reponse: null }), event: recent, horloge }))).toBe(true);
    // Réponse envoyée : elle disparaît.
    expect(porteDuPresent(monter({ ...vuDuJoueur(), event: recent, horloge }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 🎯 ST-MATCH (écran 7) — LA CARTE ET LE BILAN, SUR LA PAGE DU MATCH
// ---------------------------------------------------------------------------
//
// Les états de la carte se testent seuls (STMATCHCarteApresLeMatch.test.js). Ici, ce
// que SEULE la page peut prouver : qu'elle passe les bons faits, et que ses gestes
// partent au bon endroit.
describe('ST-MATCH écran 7 — la carte et le bilan, sur la page du match', () => {
  const SCORE_SAISI = {
    available: true,
    locked: false,
    scoreAgainst: 1,
    scoreFor: 3,
    source: 'manual',
    waitingOfficial: false,
  };
  const AVEC_KARIM = {
    ...MATCH_FINI,
    team: { ...MATCH_FINI.team, trainers: [{ documentId: COACH, firstname: 'Karim' }] },
  };
  const parTestID = (/** @type {any} */ root, /** @type {string} */ id) => root
    .findAll((/** @type {any} */ node) => node.props?.testID === id, { deep: false })[0];
  const appuyerSous = async (/** @type {any} */ root, /** @type {string} */ id) => {
    const bouton = parTestID(root, id).findAll(
      (/** @type {any} */ node) => typeof node.props?.onPress === 'function',
      { deep: false },
    )[0];
    await act(async () => { await bouton.props.onPress(); });
  };

  /**
   * La feuille publiée, 1 réponse sur 3 : Léo et Nina manquent.
   * @returns {any} - Le contenu de la requête des stats.
   */
  const feuillePubliee = () => statsAvec({
    playerResponses: [
      { label: 'Hugo Lefèvre', status: 'submitted' },
      { label: 'Léo Durand', status: 'pending' },
      { label: 'Nina Roux', status: 'draft' },
    ],
    report: {
      finalizedAt: '2020-01-01T12:39:00.000Z',
      needsReview: false,
      responseCompletionCount: 1,
      responseEligibleCount: 3,
      status: 'final',
    },
    score: SCORE_SAISI,
  });

  test('🔔 étape 3 : la carte NOMME qui manque, et « Relancer les 2 » part par la page', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockRemindMatchMutateAsync.mockResolvedValue({ missingCount: 2, remindedCount: 2 });
    const root = monter({ matchStats: feuillePubliee() });

    expect(textesVisibles(root)).toEqual(expect.arrayContaining([
      'Après le match · étape 3 sur 3',
      '1 sur 3 a répondu · manquent Léo, Nina',
      'Relancer les 2',
    ]));
    await appuyerSous(root, 'post-match-relancer');

    expect(mockRemindMatchMutateAsync).toHaveBeenCalledWith({ eventId: 'event-1', teamId: TEAM_ID });
    expect(alerte).toHaveBeenCalledWith('Relance envoyée', '2 joueurs relancés.');
    // La relance des CONVOCATIONS (l'ancienne cloche) n'est pas celle-ci.
    expect(mockRemindMutate).not.toHaveBeenCalled();
    alerte.mockRestore();
  });

  // STATS-FIX2 · 8-7 (tournee T10, ecran 7) — apres la relance, le bouton restait « Relancer
  // les 2 » : rien ne disait que c etait fait. Le serveur ne relance qu une fois par jour.
  test('🔴 STATS-FIX2 — apres la relance, le bouton dit « Déjà relancés aujourd’hui »', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockRemindMatchMutateAsync.mockResolvedValue({ missingCount: 2, remindedCount: 2 });
    const root = monter({ matchStats: feuillePubliee() });

    await appuyerSous(root, 'post-match-relancer');

    expect(textesVisibles(root)).toEqual(expect.arrayContaining(['Déjà relancés aujourd’hui']));
    expect(textesVisibles(root)).not.toContain('Relancer les 2');
    alerte.mockRestore();
  });

  test('🔴 STATS-FIX2 — deja relances ce jour (2e appui) : le bouton le dit aussi', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockRemindMatchMutateAsync.mockResolvedValue({ alreadyRemindedCount: 2, missingCount: 2, remindedCount: 0 });
    const root = monter({ matchStats: feuillePubliee() });

    await appuyerSous(root, 'post-match-relancer');

    expect(textesVisibles(root)).not.toContain('Relancer les 2');
    alerte.mockRestore();
  });

  test('🔔 une relance qui échoue le DIT, elle ne se tait pas', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockRemindMatchMutateAsync.mockRejectedValue(new Error('réseau'));
    const root = monter({ matchStats: feuillePubliee() });

    await appuyerSous(root, 'post-match-relancer');

    expect(alerte).toHaveBeenCalledWith('Erreur', 'La relance n’a pas pu partir. Réessaie.');
    alerte.mockRestore();
  });

  test('👤 le joueur lit « Le bilan de Karim », publié, la moyenne attend 3 réponses (moyenne B)', () => {
    const root = monter({
      auth: authPour(JOUEUR),
      event: AVEC_KARIM,
      matchStats: statsAvec({
        permissions: { canManage: false, canRespond: true, canView: true },
        // Ce que le serveur rend à un joueur sous 3 réponses (moyenne B) : pas de moyenne.
        playerCollectiveRating: { average: null, count: 2, hidden: true },
        report: { collectiveRating: 7, finalizedAt: '2020-01-01T12:39:00.000Z', status: 'final' },
        score: SCORE_SAISI,
      }),
    });

    expect(parTestID(root, 'st-match-bilan-publie')).toBeTruthy();
    expect(textesVisibles(root)).toEqual(expect.arrayContaining([
      'Le bilan de Karim',
      'L’équipe, selon Karim',
      '7/10',
      'Vos notes : dès 3 réponses',
      '—',
    ]));
    expect(parTestID(root, 'post-match-journey')).toBeUndefined();
  });

  test('📝 feuille pas encore publiée : le joueur lit qu elle se prépare, sans bouton éteint', () => {
    const root = monter({
      auth: authPour(JOUEUR),
      event: AVEC_KARIM,
      matchStats: statsAvec({
        permissions: { canManage: false, canRespond: true, canView: true },
        score: SCORE_SAISI,
      }),
    });

    expect(parTestID(root, 'st-match-bilan-preparation')).toBeTruthy();
    expect(textesVisibles(root)).toEqual(expect.arrayContaining([
      'En préparation',
      'Karim prépare la feuille du match. Tu la liras ici dès qu’il la publie.',
    ]));
  });

  test('🏛️ « score A » : le dirigeant qui n entraîne pas lit QUI saisit, et trouve les résultats', () => {
    const root = monter({
      auth: authPour('dirigeant-1', true),
      event: AVEC_KARIM,
      // Le serveur ne lui ouvre pas la feuille (aucun droit nouveau, « score A »).
      matchStats: statsAvec({ permissions: { canManage: false, canView: false } }),
    });

    expect(parTestID(root, 'st-match-bilan-dirigeant')).toBeTruthy();
    expect(textesVisibles(root)).toEqual(expect.arrayContaining([
      'Le score et la feuille sont saisis par l’entraîneur de l’équipe, Karim.',
      'Les résultats de U15',
    ]));
    const lien = parTestID(root, 'st-match-bilan-dirigeant').findAll(
      (/** @type {any} */ node) => node.props?.accessibilityRole === 'link'
        && typeof node.props?.onPress === 'function',
    )[0];
    act(() => { lien.props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledWith('TeamStack', {
      params: { initialTab: 'stats', teamId: TEAM_ID },
      screen: 'TeamDetails',
    });
    expect(parTestID(root, 'post-match-journey')).toBeUndefined();
  });

  test('⏳ avant la fin, le joueur lit QUAND tout s ouvre', () => {
    const root = monter({
      auth: authPour(JOUEUR),
      event: { ...AVEC_KARIM, date: '2099-01-01T10:00:00.000Z', endDate: '2099-01-01T12:00:00.000Z' },
      matchStats: statsAvec({ permissions: { canManage: false, canRespond: true, canView: true } }),
    });

    expect(parTestID(root, 'st-match-bilan-avant')).toBeTruthy();
    expect(textesVisibles(root).some((texte) => texte.startsWith(
      'Score, statistiques et retours s’ouvriront à la fin du match, ',
    ))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 🎯 ST-MATCH (écran 8) — LA PUCE « STATS DU MATCH » DU MENU « GÉRER »
// ---------------------------------------------------------------------------
//
// Design validé le 02/10 : la puce garde son nom ; sa NOTE dit l'étape, dans le langage
// de la carte. Retirés : « Commence par enregistrer le score du match. », « Rapport
// finalise », et chez le dirigeant « Les membres de ton équipe peuvent encore finaliser
// ce rapport. ».
describe('ST-MATCH écran 8 — la note de la puce « Stats du match » du menu Gérer', () => {
  const AVEC_KARIM = {
    ...MATCH_FINI,
    team: { ...MATCH_FINI.team, trainers: [{ documentId: COACH, firstname: 'Karim' }] },
  };
  const SCORE_SAISI = {
    available: true,
    locked: false,
    scoreAgainst: 1,
    scoreFor: 3,
    source: 'manual',
    waitingOfficial: false,
  };

  /**
   * Cherche un élément dans un arbre NON monté (le `headerRight` remis à `setOptions`).
   * @param {any} element - Racine.
   * @param {(noeud: any) => boolean} predicat - Le test.
   * @returns {any} - Le premier élément trouvé, ou null.
   */
  const chercher = (element, predicat) => {
    if (!element || typeof element !== 'object') return null;
    if (Array.isArray(element)) {
      return element.reduce(
        (/** @type {any} */ trouve, /** @type {any} */ enfant) => trouve || chercher(enfant, predicat),
        null,
      );
    }
    if (element.props && predicat(element)) return element;
    return chercher(element.props?.children, predicat);
  };

  const ouvrirGerer = () => {
    const appels = mockSetOptions.mock.calls.filter((/** @type {any} */ appel) => appel[0]?.headerRight);
    const bouton = chercher(
      appels[appels.length - 1][0].headerRight(),
      (/** @type {any} */ noeud) => noeud?.props?.testID === 'event-actions-menu-button',
    );
    act(() => { bouton.props.onPress(); });
  };

  const laPuce = (/** @type {any} */ root) => {
    ouvrirGerer();
    const [note] = root.findAll(
      (/** @type {any} */ node) => node.props?.testID === 'event-manage-note-matchStats',
      { deep: false },
    );
    const [etiquette] = root.findAll(
      (/** @type {any} */ node) => node.props?.testID === 'event-manage-label-matchStats',
      { deep: false },
    );
    let rangee = etiquette?.parent;
    while (rangee && rangee.type !== TouchableOpacity) rangee = rangee.parent;
    return {
      eteinte: Boolean(rangee?.props?.disabled),
      libelle: etiquette ? textOf(etiquette.props.children).trim() : '',
      note: note ? textOf(note.props.children).trim() : '',
    };
  };

  test('1 · étape 1 : la puce garde son nom, sa note dit « Étape 1 sur 3 : le score »', () => {
    const puce = laPuce(monter());

    expect(puce).toEqual({ eteinte: false, libelle: 'Stats du match', note: 'Étape 1 sur 3 : le score' });
  });

  test('étape 2 : le score saisi, la note dit « Étape 2 sur 3 : la feuille »', () => {
    const puce = laPuce(monter({ matchStats: statsAvec({ score: SCORE_SAISI }) }));

    expect(puce.note).toBe('Étape 2 sur 3 : la feuille');
  });

  test('2 · feuille publiée : « Rapport finalise » devient une date en mots', () => {
    const publiee = '2020-01-01T12:39:00.000Z';
    const puce = laPuce(monter({
      matchStats: statsAvec({
        report: { finalizedAt: publiee, needsReview: false, status: 'final' },
        score: SCORE_SAISI,
      }),
    }));
    const jour = new Date(publiee).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const heure = new Date(publiee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    expect(puce.note).toBe(`Feuille publiée le ${jour} à ${heure}`);
  });

  test('score officiel changé : la note le dit, dans le langage de la carte', () => {
    const puce = laPuce(monter({
      matchStats: statsAvec({
        report: { finalizedAt: '2020-01-01T12:39:00.000Z', needsReview: true, status: 'final' },
        score: SCORE_SAISI,
      }),
    }));

    expect(puce).toEqual(expect.objectContaining({ eteinte: false, note: 'Score officiel changé : vérifie la feuille' }));
  });

  test('3 · avant la fin : éteinte, la note dit QUAND elle s ouvrira', () => {
    const puce = laPuce(monter({
      event: { ...MATCH_FINI, date: '2099-01-01T10:00:00.000Z', endDate: '2099-01-01T12:00:00.000Z' },
    }));

    expect(puce.eteinte).toBe(true);
    expect(puce.note.startsWith('S’ouvre à la fin du match, ')).toBe(true);
    expect(puce.note).not.toContain('{{');
  });

  test('4 · dirigeant qui n entraîne pas (« score A ») : éteinte, la note dit QUI saisit', () => {
    const puce = laPuce(monter({
      auth: authPour('dirigeant-1', true),
      event: AVEC_KARIM,
      matchStats: statsAvec({ permissions: { canManage: false, canView: false } }),
    }));

    expect(puce).toEqual({
      eteinte: true,
      libelle: 'Stats du match',
      note: 'Saisies par l’entraîneur de l’équipe, Karim',
    });
  });

  test('🪤 dirigeant, entraîneur sans prénom connu : la phrase ne laisse pas de trou', () => {
    const puce = laPuce(monter({
      auth: authPour('dirigeant-1', true),
      matchStats: statsAvec({ permissions: { canManage: false, canView: false } }),
    }));

    expect(puce.note).toBe('Saisies par l’entraîneur de l’équipe');
  });
});

// ---------------------------------------------------------------------------
// 🎯 ST-MATCH (écran 5, ABANDONNÉ) — RIEN PAR-DESSUS LA PAGE DU MATCH
// ---------------------------------------------------------------------------
//
// Design validé le 02/10 : la fenêtre « Stats de fin de match » qui s'ouvrait toute
// seule par-dessus la page est RETIRÉE. Elle recouvrait la carte « Après le match », qui
// dit la même chose avec le bon bouton, et revenait à chaque étape.
describe('ST-MATCH écran 5 — la fenêtre « Stats de fin de match » est retirée', () => {
  const SCORE_SAISI = {
    available: true,
    locked: false,
    scoreAgainst: 1,
    scoreFor: 3,
    source: 'manual',
    waitingOfficial: false,
  };

  test.each([
    ['sans score (étape 1)', statsAvec()],
    ['score saisi (étape 2)', statsAvec({ score: SCORE_SAISI })],
    ['score officiel changé', statsAvec({
      report: { finalizedAt: '2020-01-01T12:39:00.000Z', needsReview: true, status: 'final' },
      score: SCORE_SAISI,
    })],
  ])('🚫 %s : l entraîneur arrive sur la page, aucune fenêtre ne la recouvre', (_cas, matchStats) => {
    const textes = textesVisibles(monter({ matchStats }));

    expect(textes).not.toEqual(expect.arrayContaining(['Stats de fin de match']));
    expect(textes.some((texte) => texte.includes('Enregistre d abord le score'))).toBe(false);
    expect(textes.some((texte) => texte.includes('Le score est prêt'))).toBe(false);
    // …et la carte, elle, est là : c'est elle qui porte l'étape et le geste.
    expect(textes.some((texte) => texte.startsWith('Après le match · '))).toBe(true);
  });

  test('la carte « Après le match » porte l étape et le geste, sans doublon « Plus tard »', () => {
    const textes = textesVisibles(monter({ matchStats: statsAvec({ score: SCORE_SAISI }) }));

    expect(textes).toEqual(expect.arrayContaining(['Après le match · étape 2 sur 3', 'Saisir la feuille']));
    expect(textes.filter((texte) => texte === 'Plus tard')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 🔒 T9 (02/10, capture T9_P1_4c) — « MOYENNE B » SUR LA PAGE DU MATCH, MÊME FACE À UN
// SERVEUR QUI NE LA CACHE PAS
// ---------------------------------------------------------------------------
//
// La tournée T9 a vu Hugo, simple joueur, lire « Ressenti joueurs 7/10 · 1 note
// collective » : la recette tournait alors sur un serveur SANS la règle (77852bff), et
// la prod n'a pas ST-MATCH. Avec UNE réponse, la moyenne EST la note d'un coéquipier :
// l'app ne l'affiche pas sous 3 réponses, quoi que le serveur envoie.
describe('T9 · moyenne B sur la page du match, serveur en retard', () => {
  const SCORE_SAISI = {
    available: true,
    locked: false,
    scoreAgainst: 1,
    scoreFor: 3,
    source: 'manual',
    waitingOfficial: false,
  };
  const vuParHugo = (/** @type {any} */ moyenne) => monter({
    auth: authPour(JOUEUR),
    matchStats: statsAvec({
      permissions: { canManage: false, canRespond: true, canView: true },
      playerCollectiveRating: moyenne,
      report: { finalizedAt: '2020-01-01T12:39:00.000Z', status: 'final' },
      score: SCORE_SAISI,
    }),
  });

  test.each([
    ['1 réponse', { average: 7, count: 1 }],
    ['2 réponses', { average: 6.5, count: 2 }],
  ])('🔒 %s, moyenne envoyée SANS « hidden » : le joueur ne la lit pas', (_cas, moyenne) => {
    const textes = textesVisibles(vuParHugo(moyenne));

    expect(textes).toEqual(expect.arrayContaining(['Vos notes : dès 3 réponses', '—']));
    expect(textes.some((texte) => texte.includes(`${moyenne.average}/10`))).toBe(false);
    expect(textes.some((texte) => /note collective/.test(texte))).toBe(false);
  });

  test('à partir de 3 réponses, la moyenne se lit', () => {
    const textes = textesVisibles(vuParHugo({ average: 7.3, count: 3 }));

    expect(textes).toEqual(expect.arrayContaining(['7.3/10', 'Vos notes · 3 réponses']));
  });
});

// 🔁 ST-VUES2 — la relance depuis la carte, 2e appui le même jour.
describe('ST-MATCH écran 7 — déjà relancés aujourd hui', () => {
  test('« Relancer les 2 » au 2e appui : « Déjà relancés aujourd’hui »', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockRemindMatchMutateAsync.mockResolvedValue({ alreadyRemindedCount: 2, missingCount: 2, remindedCount: 0 });
    const root = monter({
      matchStats: statsAvec({
        playerResponses: [
          { label: 'Hugo Lefèvre', status: 'submitted' },
          { label: 'Léo Durand', status: 'pending' },
          { label: 'Nina Roux', status: 'draft' },
        ],
        report: {
          finalizedAt: '2020-01-01T12:39:00.000Z',
          needsReview: false,
          responseCompletionCount: 1,
          responseEligibleCount: 3,
          status: 'final',
        },
        score: {
          available: true, locked: false, scoreAgainst: 1, scoreFor: 3, source: 'manual', waitingOfficial: false,
        },
      }),
    });
    const [conteneur] = root.findAll((/** @type {any} */ n) => n.props?.testID === 'post-match-relancer', { deep: false });
    const [bouton] = conteneur.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function', { deep: false });

    await act(async () => { await bouton.props.onPress(); });

    expect(alerte).toHaveBeenCalledWith('Déjà relancés aujourd’hui');
    expect(alerte.mock.calls.flat()).not.toContain('Aucune relance nécessaire pour ce match.');
    alerte.mockRestore();
  });
});
// FINITIONS11-STATS · point 4 (écran 7) — « Relancer les N » compte ceux que le SERVEUR
// relancera : convoqués (« c oui »), avec un compte, sans réponse envoyée. Avant : la liste
// des prénoms coupée à 5 + « +N » (7 manquants = « Relancer les 6 »), non-convoqués compris.
describe('FINITIONS11 · point 4 — sur le téléphone, « Relancer les N » = les convoqués à relancer', () => {
  const reponse = (/** @type {string} */ label, /** @type {any} */ champs = {}) => ({
    convoked: true, label, status: 'pending', userDocumentId: `compte-${label}`, ...champs,
  });

  test('🔴 7 convoqués sans réponse, 1 hors convocation, 1 sans compte : « Relancer les 7 »', () => {
    const root = monter({
      matchStats: statsAvec({
        playerResponses: [
          reponse('Ali Benali', { status: 'submitted' }),
          reponse('Hugo Lefèvre'),
          reponse('Léo Durand'),
          reponse('Max Petit'),
          reponse('Nina Roux', { status: 'draft' }),
          reponse('Omar Sow'),
          reponse('Paul Tran'),
          reponse('Zoé Vidal'),
          reponse('Yanis Kader', { convoked: false }),
          reponse('Joueur ajouté', { convoked: false, userDocumentId: null }),
        ],
        report: {
          finalizedAt: '2020-01-01T12:39:00.000Z',
          needsReview: false,
          responseCompletionCount: 1,
          responseEligibleCount: 8,
          status: 'final',
        },
        score: {
          available: true, locked: false, scoreAgainst: 1, scoreFor: 3, source: 'manual', waitingOfficial: false,
        },
      }),
    });
    const textes = textesVisibles(root);

    expect(textes).toEqual(expect.arrayContaining(['Relancer les 7']));
    expect(textes).not.toContain('Relancer les 6');
    expect(textes.join(' ')).not.toContain('Yanis');
  });
});
// FINITIONS11-STATS · point 6 bis — « listes ok » (Adel, 03/10 ~13h20) : la carte « Après le
// match » dit les deux listes, sur le téléphone, avec le juge partagé (`matchPageModel.js`).
describe('FINITIONS11 · point 6 bis — sur le téléphone, « Convoqués : … » et « Aussi présents, sans convocation : … »', () => {
  const reponse = (/** @type {string} */ label, /** @type {any} */ champs = {}) => ({
    label, participation: null, status: null, userDocumentId: `compte-${label.split(' ')[0]}`, ...champs,
  });

  test('🔴 les convoqués comptés, et les deux joueurs venus sans convocation nommés à part', () => {
    const root = monter({
      matchStats: statsAvec({
        playerResponses: [
          reponse('Léa Martin', { convoked: true, participation: 'played', status: 'submitted' }),
          reponse('Sami Diallo', { convoked: true }),
          reponse('Lucas Petit', { convoked: false, participation: 'played', status: 'submitted' }),
          reponse('Nathan Roux', { convoked: false }),
          reponse('Yanis Kader', { convoked: false }),
        ],
        report: {
          finalizedAt: '2020-01-01T12:39:00.000Z',
          needsReview: false,
          playerLines: [{ minutesPlayed: 30, userDocumentId: 'compte-Nathan' }],
          responseCompletionCount: 1,
          responseEligibleCount: 2,
          status: 'final',
        },
        score: {
          available: true, locked: false, scoreAgainst: 1, scoreFor: 3, source: 'manual', waitingOfficial: false,
        },
      }),
    });
    const textes = textesVisibles(root);

    expect(textes).toEqual(expect.arrayContaining([
      'Convoqués : 1 sur 2 a répondu · manquent Sami',
      'Aussi présents, sans convocation : Lucas, Nathan',
    ]));
    expect(textes.join(' ')).not.toContain('Yanis');
  });
});
