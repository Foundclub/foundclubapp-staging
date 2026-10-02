/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import { Alert, Text } from 'react-native';
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
    matchStats = statsAvec(),
    myMatchResponse = null,
  } = options;

  mockUseAuth.mockReturnValue(auth);
  mockEventQuery.data = event;
  mockMatchStatsQuery.data = matchStats;
  mockMyMatchResponseQuery.data = myMatchResponse;
  mockAttendanceQuery.data = HORLOGE;

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
        route={{ params: { eventId: 'event-1' } }}
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
    expect(textesVisibles(root)).toEqual(expect.arrayContaining(['Valider le score']));
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

  test('le joueur garde SA reponse : « Mon retour post-match » ouvre son propre questionnaire', () => {
    const root = monter(vuDuJoueur());

    act(() => { boutonNomme(root, 'Voir').props.onPress(); });

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
