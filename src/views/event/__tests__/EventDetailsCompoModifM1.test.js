import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// COMPOMODIF · M1 — LE HARNAIS.
//
// Meme ecran, memes doublures que `EventDetailsCompolectTerrain.test.js` : ce
// fichier ne mesure QUE l'apparition de la porte « Modifier » dans l'onglet
// « Convocation ». Les temoins de COMPOLECT-2 restent dans leur fichier, et ce
// lot ne les touche pas.
// ==========================================================================

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockEventQuery = { data: null };
const mockConvocationQuery = { data: null };

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
  useGetEventConvocation: () => ({ ...emptyQuery(), data: mockConvocationQuery.data }),
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

/**
 * Bascule sur l'onglet demande. Sans effet sur un evenement qui n'a pas
 * d'onglets (tout type autre que le match) : la colonne y est entiere.
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
  act(() => {
    onglet.props.onPress();
  });
};

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

// Le premier montage transpile tout le graphe d'imports de l'ecran.
jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const JOUEUR = 'joueur-1';
const REMPLACANT = 'joueur-2';
const SPECTATEUR = 'joueur-9';

// Le pack publie par le coach : un titulaire sur le terrain, un sur le banc.
const PACK = {
  publishedAt: '2026-08-20T09:00:00.000Z',
  publishedBy: { firstname: 'Coach', lastname: 'Karim' },
  reservePlayerIds: [REMPLACANT],
  reserveSnapshotPlayers: [{ documentId: REMPLACANT, firstname: 'Leo', lastname: 'Diarra' }],
  snapshotPlayers: [{
    documentId: JOUEUR, firstname: 'Karim', lastname: 'Sylla', number: 1,
  }],
  sportContext: 'football',
  teams: [{
    id: 'team_1',
    name: 'U15',
    placements: [{
      playerId: JOUEUR, positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
    }],
  }],
};

// 🧨 La charge telle que `GET /events/:id/convocation` l'envoie VRAIMENT
// (`getPlayerConvocationView`, forme `branches`) — aucun `published` a la racine.
const CONVOCATION = {
  branches: [{
    published: PACK,
    responses: { byPlayerId: {}, counts: { absent: 0, pending: 2, present: 0 } },
    team: { documentId: TEAM_ID, name: 'U15' },
    viewer: { inReserve: false, teamEntryIds: [] },
  }],
  event: { date: '2099-01-01T10:00:00.000Z', documentId: 'event-1', name: 'Match' },
  eventKind: 'event',
  schemaVersion: 3,
};

const buildMatch = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
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
    // 🔑 C'est cette liste qui ouvre `canViewPublishedComposition` a un joueur
    // (`isTeamMember`) : sans elle, la page ne demande meme pas la convocation.
    players: [{ documentId: JOUEUR }, { documentId: REMPLACANT }],
    trainers: [{ documentId: 'coach-1' }],
  },
  type: { name: 'Match' },
  ...overrides,
});

const authPour = (/** @type {string} */ documentId, /** @type {boolean} */ peutGerer = false) => ({
  canEditClub: () => peutGerer,
  canEditEvent: () => peutGerer,
  canManageEvent: () => peutGerer,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { documentId, role: { name: peutGerer ? 'Dirigeant' : 'Joueur' } },
});

/** @type {any} */
let mounted = null;

const monter = (/** @type {any} */ { auth, convocation = CONVOCATION, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildMatch() : event;
  mockConvocationQuery.data = convocation;
  mockUseAuth.mockReturnValue(auth || authPour(JOUEUR));

  act(() => {
    mounted = renderer.create(
      <EventDetails
        navigation={{
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: mockNavigate,
          setOptions: jest.fn(),
        }}
        route={{ params: { eventId: 'event-1' } }}
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

const textesVisibles = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node))
  .filter(Boolean);

const appuyer = (/** @type {any} */ root, /** @type {string} */ libelle) => {
  const bouton = root
    .findAllByProps({ accessibilityRole: 'button' })
    .find((/** @type {any} */ node) => textOf(node).includes(libelle));
  if (!bouton) {
    const vu = textesVisibles(root).join(' | ');
    throw new Error(`Aucun bouton ne porte le libelle « ${libelle} ». Vu : ${vu}`);
  }
  act(() => {
    bouton.props.onPress();
  });
};

const derniereRoute = () => {
  const call = [...mockNavigate.mock.calls].pop();
  return call ? call[0] : null;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEventQuery.data = null;
  mockConvocationQuery.data = null;
});

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
    mounted = null;
  }
});

// Une convocation publiee SANS aucun placement — le chemin S5-c, legitime.
const PACK_SANS_PLACEMENT = {
  ...PACK,
  reservePlayerIds: [JOUEUR, REMPLACANT],
  teams: [{ id: 'team_1', name: 'U15', placements: [] }],
};

const convocationDe = (/** @type {any} */ pack) => ({
  ...CONVOCATION,
  branches: [{ ...CONVOCATION.branches[0], published: pack }],
});

const derniersParametres = () => {
  const call = [...mockNavigate.mock.calls].pop();
  return call ? call[1] : null;
};

const evenementSansRole = () => buildMatch({
  team: {
    club: { documentId: CLUB_ID },
    documentId: TEAM_ID,
    name: 'U15',
    players: [{ documentId: JOUEUR }, { documentId: SPECTATEUR }],
    trainers: [],
  },
});

// ==========================================================================
// COMPOMODIF · M1 — LE COACH VOIT « Modifier », DES QU'IL PEUT VOIR LA COMPO.
//
// 🗣️ Adel, 27/08 : « si c'est le coach qui ouvre, il manque un petit bouton
// Modifier, a chaque fois, des qu'il peut voir la compo ».
//
// ⛔ ON N'EN FABRIQUE PAS UN DEUXIEME : la porte d'ecriture est UNE seule route
// — `MatchCallUpSelection`, avec le meme libelle `matchComposition.board.edit`.
// COMPOLECT-2 l'a posee sur le plateau plein ecran ; ce lot la rend atteignable
// depuis l'onglet « Convocation » aussi, sans obliger a ouvrir le plein ecran.
//
// 🔒 ET ELLE RESTE FERMEE A QUI NE PEUT PAS MODIFIER : un joueur, un membre
// d'equipe sans role, un spectateur ne la voient jamais.
// ==========================================================================

// Le harnais ci-dessus est celui de `EventDetailsCompolectTerrain.test.js` :
// meme ecran, memes doublures. Ce fichier n'ajoute que les temoins de M1.

describe('COMPOMODIF · M1 — « Modifier » dans l onglet Convocation', () => {
  test('🥇 le COACH voit le bouton « Modifier » a cote de la compo publiee', () => {
    const root = monter({ auth: authPour('coach-1', true) });

    allerSurLOnglet(root, 'callUp');

    expect(textesVisibles(root).join(' | ')).toContain('Modifier');
  });

  test('🥇 il mene a la porte d ecriture, avec la compo publiee en main', () => {
    const root = monter({ auth: authPour('coach-1', true) });

    allerSurLOnglet(root, 'callUp');
    appuyer(root, 'Modifier');

    expect(derniereRoute()).toBe('MatchCallUpSelection');
    const parametres = derniersParametres();
    expect(parametres?.canEdit).toBe(true);
    expect(parametres?.readOnly).toBe(false);
    expect(parametres?.teamId).toBe(TEAM_ID);
    // La compo publiee voyage : sans elle, l'ecran de selection repartirait de
    // zero et effacerait les convoques (c'est exactement le defaut M4).
    expect(parametres?.existingComposition).toBeTruthy();
    expect((parametres?.startPlacements || []).map((/** @type {any} */ p) => p.playerId))
      .toEqual([JOUEUR]);
    // Et l'effectif ELIGIBLE, pas seulement les publies : c'est la liste ou le
    // coach va repecher quelqu'un.
    expect(Array.isArray(parametres?.players)).toBe(true);
  });

  test('🔒 un JOUEUR convoque ne voit aucun bouton « Modifier »', () => {
    const root = monter({ auth: authPour(JOUEUR) });

    allerSurLOnglet(root, 'callUp');

    expect(textesVisibles(root).join(' | ')).not.toContain('Modifier');
  });

  test('🔒 un membre d equipe SANS role ne le voit pas non plus', () => {
    const root = monter({ auth: authPour(SPECTATEUR), event: evenementSansRole() });

    allerSurLOnglet(root, 'callUp');

    expect(textesVisibles(root).join(' | ')).not.toContain('Modifier');
  });

  // ⛔ Sans terrain dessinable, la porte n'a pas de point de depart a offrir :
  // on garde le comportement d'avant (D6), le coach passe par le plein ecran.
  test('🔒 sans aucun placement, le bouton ne parait pas', () => {
    const root = monter({
      auth: authPour('coach-1', true),
      convocation: convocationDe(PACK_SANS_PLACEMENT),
    });

    allerSurLOnglet(root, 'callUp');

    expect(textesVisibles(root).join(' | ')).not.toContain('Modifier');
  });

  // 🔒 NON-REGRESSION COMPOLECT-2 : le bouton d'ouverture reste la, et il mene
  // toujours au plateau plein ecran.
  test('🔒 le bouton d ouverture mene toujours au plateau plein ecran', () => {
    const root = monter({ auth: authPour('coach-1', true) });

    allerSurLOnglet(root, 'callUp');
    appuyer(root, 'matchConvocation.published.openCta');

    expect(derniereRoute()).toBe('MatchCompositionBoard');
    expect(derniersParametres()?.readOnly).toBe(true);
    expect(derniersParametres()?.canEdit).toBe(true);
  });
});
