import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

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
const mockNavigate = jest.fn();
const mockEventQuery = { data: null };
const mockMatchStatsQuery = { data: null };
const mockMyMatchResponseQuery = { data: null };
const mockAttendanceQuery = { data: null };
/** @type {any[]} */
const propsDesParticipants = [];

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
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
import EventDetails from '../EventDetails';
// eslint-disable-next-line import/first
import RemindTeamsSheet from '../components/RemindTeamsSheet';

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
  test('sans score, l etape 1 dit qu il reste a l enregistrer', () => {
    const textes = textesVisibles(monter());

    expect(rangDe(textes, 'Score')).toBeGreaterThanOrEqual(0);
    expect(rangDe(textes, 'À enregistrer')).toBeGreaterThanOrEqual(0);
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

  test('la version du rapport et sa date de publication se lisent', () => {
    const textes = textesVisibles(monter({
      matchStats: statsAvec({
        report: {
          finalizedAt: '2026-08-20T18:30:00.000Z',
          status: 'final',
          version: 3,
        },
      }),
    }));

    expect(rangDe(textes, 'v3')).toBeGreaterThanOrEqual(0);
    expect(rangDe(textes, 'Publication')).toBeGreaterThanOrEqual(0);
  });

  test('⚠️ le motif d une verification requise ne disparait pas', () => {
    const textes = textesVisibles(monter({
      matchStats: statsAvec({
        report: { needsReview: true, status: 'final', version: 2 },
      }),
    }));

    expect(rangDe(textes, 'score officiel a changé')).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// D6 — LA CARTE-PARCOURS, BRANCHEE DANS L ECRAN
// ---------------------------------------------------------------------------

describe('N4/D6 — la carte « APRÈS LE MATCH » est dans l Apercu', () => {
  const parTestID = (/** @type {any} */ root, /** @type {string} */ id) => root
    .findAll((/** @type {any} */ node) => node.props?.testID === id, { deep: false })[0];

  test('elle est la, et elle annonce l etape courante', () => {
    const root = monter();

    expect(parTestID(root, 'post-match-journey')).toBeTruthy();
    expect(textesVisibles(root)).toEqual(expect.arrayContaining(['APRÈS LE MATCH']));
  });

  test('🎯 sans score, son bouton ouvre la FEUILLE DE SCORE, pas l editeur', () => {
    const root = monter();

    act(() => { parTestID(root, 'post-match-action').props.onPress(); });

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

    act(() => { parTestID(root, 'post-match-action').props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledWith(
      'MatchStatsEditor',
      expect.objectContaining({ eventId: 'event-1' }),
    );
  });

  test('⛔ le motif d une porte fermee ne disparait pas avec les 7 titres', () => {
    // Un match PAS FINI : la porte est grisee, et elle doit dire pourquoi.
    const root = monter({
      event: { ...MATCH_FINI, date: '2099-01-01T10:00:00.000Z', endDate: '2099-01-01T12:00:00.000Z' },
    });

    expect(textesVisibles(root)).toEqual(expect.arrayContaining([
      'Les stats seront disponibles à la fin du match.',
    ]));
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
