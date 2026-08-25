import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// R6 (b) — L'ONGLET « CONVOCATION » DIT ENFIN QUI VIENT.
//
// 🗣️ Constat de recette 2.6.26 (24/08), un entraineur sur un MATCH : l'onglet
// « Convocation » ne montrait ni de quoi creer sa compo, ni la liste des joueurs
// convoques. Deux trous distincts ; ce filet tient le second.
//
// 🧨 CE QUE LE RESUME PUBLIE DISAIT, MOT POUR MOT : « 1 equipe(s) publiee(s) »,
// « 1 branche(s) visible(s) », « Publie le ... ». Trois lignes de COMPTAGE, zero
// nom. Or les noms voyagaient DEJA dans la meme reponse, a la meme milliseconde
// (`published.snapshotPlayers`) : il fallait ouvrir un second ecran pour lire une
// donnee qui etait deja arrivee.
//
// ♻️ HARNAIS REPRIS DE `EventDetailsL4Onglets` — memes doublures, et surtout la
// MEME charge de convocation (forme `branches`, celle que le serveur envoie
// vraiment). Un harnais invente ici aurait pu rendre vert un code qui ne lit pas
// la vraie forme.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest n'a pas de moteur de mise en page. Il
// lit ce qui est MONTE, pas ce qui tient a l'ecran. Le rendu se voit a la recette.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
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

// 🎛️ LA DOUBLURE DES ONGLETS. `SegmentedControl` est deja sous test chez lui
// (201 lignes) : ce n'est pas son dessin qu'on verifie ici, c'est CE QU'ON LUI
// DONNE et CE QU'IL COMMANDE. La doublure rend donc un pressable par option,
// portant son libelle — exactement ce qu'un doigt peut atteindre.
// ⛔ Elle est aussi ce qui evite de monter `react-native-reanimated` et
// `react-native-gesture-handler` pour rien dans une suite qui monte deja
// 6 800 lignes d'ecran.
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

// 🪢 La doublure d'`EventParticipants` rend le MEME bouton que le vrai et le
// branche sur la MEME propriete — motif repris d'`AD10ExportFeuilleBranchee`,
// ou le temoin 0 compare cette doublure au vrai composant monte pour de bon.
// C'est ce qui rend le temoin 6 credible sans monter 784 lignes de liste.
// ⚽ S5-D (vague S) — LA DOUBLURE DU TERRAIN. Elle relaie ce qu on lui DEMANDE
// de dessiner : le nombre de placements et le sport. Le dessin lui-meme (jetons,
// traces SVG) est mesure dans le filet du composant, `ConvocationFieldPreview`.
// Ici on verifie l ASSEMBLAGE : l onglet lui passe-t-il la bonne compo ?
jest.mock('@/components/tactical/ConvocationFieldPreview', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ConvocationFieldPreviewDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      placementsCount: (props.placements || []).length,
      snapshotCount: (props.snapshotPlayers || []).length,
      sportContext: props.sportContext,
      testID: 'doublure-terrain',
    });
  };
});

jest.mock('../components/EventParticipants', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function EventParticipantsDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      { onPress: props.handleExportParticipants, testID: 'bouton-export' },
      react.createElement(rn.Text, null, 'Exporter la liste (Excel/CSV)'),
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

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const JOUEUR = 'joueur-1';
const REMPLACANT = 'joueur-2';

const DESCRIPTION = 'Rendez-vous au stade a 9 h, pensez aux protege-tibias.';

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
// (forme `branches`) — aucun `published` a la racine.
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

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  description: DESCRIPTION,
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

const monter = (/** @type {any} */ { auth, convocation = null, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockConvocationQuery.data = convocation;
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

const allerSurLOnglet = (/** @type {any} */ root, /** @type {string} */ valeur) => {
  const [onglet] = parTestID(root, `onglet-${valeur}`);
  if (!onglet) throw new Error(`Aucun onglet « ${valeur} » a l ecran`);
  act(() => {
    onglet.props.onPress();
  });
};

describe('R6 · (b) une convocation publiee NOMME ses convoques', () => {
  test('les titulaires et le banc sont a l ecran, sans un appui de plus', () => {
    const root = monter({ auth: authPour('coach-1', true), convocation: CONVOCATION });

    // 🧭 On part bien de la page a onglets d'un match. Sans ce repere, le jour
    // ou les onglets changent de forme, ce filet passerait a cote de son sujet
    // en restant vert.
    expect(libellesDesOnglets(root)).toEqual(['Aperçu', 'Participants · 0', 'Convocation']);

    allerSurLOnglet(root, 'callUp');

    // 🎯 LE COEUR DU TEMOIN : des NOMS, la ou il n'y avait que des compteurs.
    expect(contient(root, 'Karim Sylla')).toBe(true);
    expect(contient(root, 'Leo Diarra')).toBe(true);
  });

  test('le terrain et le banc sont dits SEPAREMENT, jamais en vrac', () => {
    // Un coach ne lit pas « les 12 convoques » : il lit un onze et des
    // remplacants. Melanger les deux rendrait la liste plus longue ET moins
    // utile que le second ecran qu'elle remplace.
    const root = monter({ auth: authPour('coach-1', true), convocation: CONVOCATION });

    allerSurLOnglet(root, 'callUp');

    expect(contient(root, 'Sur le terrain')).toBe(true);
    expect(contient(root, 'Sur le banc')).toBe(true);
  });

  test('un JOUEUR convoque lit la meme liste que son entraineur', () => {
    // ⛔ La liste n'est pas un privilege de staff : « qui vient ? » est la
    // question de tout le monde, et le serveur envoie deja la charge aux
    // membres de l'equipe (`canViewPublishedComposition`).
    const root = monter({ auth: authPour(JOUEUR), convocation: CONVOCATION });

    allerSurLOnglet(root, 'callUp');

    expect(contient(root, 'Karim Sylla')).toBe(true);
    expect(contient(root, 'Leo Diarra')).toBe(true);
  });

  test('🔒 sans rien de publie : aucune liste, et surtout aucun titre VIDE', () => {
    // La contre-epreuve qui compte. Un « Sur le terrain » suivi de rien se lit
    // comme un bug ; c'est exactement ce qu'un rendu non garde produirait sur
    // un match dont la compo n'est pas encore publiee — le cas le plus frequent.
    const root = monter({ auth: authPour('coach-1', true) });

    allerSurLOnglet(root, 'callUp');

    expect(contient(root, 'Sur le terrain')).toBe(false);
    expect(contient(root, 'Sur le banc')).toBe(false);
  });

  test('🔒 un pack SANS remplacant n annonce pas de banc', () => {
    // Meme regle, appliquee a la moitie de la liste : un pack ou personne n'est
    // sur le banc est un pack normal, pas un pack casse.
    const packSansBanc = {
      ...PACK,
      reservePlayerIds: [],
      reserveSnapshotPlayers: [],
    };
    const root = monter({
      auth: authPour('coach-1', true),
      convocation: {
        ...CONVOCATION,
        branches: [{ ...CONVOCATION.branches[0], published: packSansBanc }],
      },
    });

    allerSurLOnglet(root, 'callUp');

    expect(contient(root, 'Karim Sylla')).toBe(true);
    expect(contient(root, 'Sur le terrain')).toBe(true);
    expect(contient(root, 'Sur le banc')).toBe(false);
  });

  test('🧨 les titulaires de TOUTES les equipes du pack, pas seulement la premiere', () => {
    // Le piege que ce temoin interdit : lire `teams[0].placements`, comme le
    // fait la carte du tchat pour son mini-terrain. Sur un pack a deux equipes,
    // la moitie des convoques manquerait — et RIEN a l'ecran ne le dirait.
    const packDeuxEquipes = {
      ...PACK,
      snapshotPlayers: [
        ...PACK.snapshotPlayers,
        { documentId: 'joueur-3', firstname: 'Ines', lastname: 'Bakouche' },
      ],
      teams: [
        ...PACK.teams,
        {
          id: 'team_2',
          name: 'U15 B',
          placements: [{
            playerId: 'joueur-3', positionX: 50, positionY: 40, slotId: 'team_2:slot_1',
          }],
        },
      ],
    };
    const root = monter({
      auth: authPour('coach-1', true),
      convocation: {
        ...CONVOCATION,
        branches: [{ ...CONVOCATION.branches[0], published: packDeuxEquipes }],
      },
    });

    allerSurLOnglet(root, 'callUp');

    expect(contient(root, 'Karim Sylla')).toBe(true);
    expect(contient(root, 'Ines Bakouche')).toBe(true);
  });
});

// 🧾 S5 (vague S) — UNE CONVOCATION PUBLIEE SANS COMPOSITION.
//
// C est le chemin que S5 (c) legitime : un coach coche ses joueurs et publie,
// sans jamais ouvrir le terrain. Le serveur l accepte deja (`publishConvocation`
// n exige qu un brouillon), et il range alors TOUS les convoques dans
// `reservePlayerIds` — mesure : `event-composition.ts:428`,
// `reservePlayerIds = selectedPlayerIds.filter(non places)`.
//
// 🧨 CONSEQUENCE A L ECRAN, avant ce lot : la page annoncait « Sur le banc » a
// des gens qui n avaient pas de terrain du tout. Factuellement faux, et vexant
// pour quelqu un qui se croyait titulaire.
describe('S5 · (c) publiee SANS placement : ce sont des convoques, pas un banc', () => {
  const packSansPlacement = {
    ...PACK,
    reservePlayerIds: [JOUEUR, REMPLACANT],
    reserveSnapshotPlayers: [...PACK.snapshotPlayers, ...PACK.reserveSnapshotPlayers],
    teams: [{ id: 'team_1', name: 'U15', placements: [] }],
  };

  const monterSansPlacement = () => monter({
    auth: authPour('coach-1', true),
    convocation: {
      ...CONVOCATION,
      branches: [{ ...CONVOCATION.branches[0], published: packSansPlacement }],
    },
  });

  test('🥇 le titre dit « Convoqués », jamais « Sur le banc »', () => {
    const root = monterSansPlacement();

    allerSurLOnglet(root, 'callUp');

    expect(contient(root, 'Convoqués')).toBe(true);
    expect(contient(root, 'Sur le banc')).toBe(false);
  });

  test('et tout le monde est nomme, comme avec une compo', () => {
    const root = monterSansPlacement();

    allerSurLOnglet(root, 'callUp');

    expect(contient(root, 'Karim Sylla')).toBe(true);
    expect(contient(root, 'Leo Diarra')).toBe(true);
  });

  test('⚽ S5-D : SANS placement, AUCUN terrain — la liste suffit', () => {
    // 🗣️ Adel valide S5-c : publiee sans compo, on garde la liste « Convoqués ».
    // ⛔ Un terrain VIDE serait pire que pas de terrain : il donnerait a croire
    // que la compo est vide, alors qu elle est simplement sans placement.
    const root = monterSansPlacement();

    allerSurLOnglet(root, 'callUp');

    expect(parTestID(root, 'doublure-terrain')).toHaveLength(0);
    expect(contient(root, 'Convoqués')).toBe(true);
  });

  test('🔒 contre-epreuve : DES QU IL Y A un titulaire, le banc redevient un banc', () => {
    // Sans cette ligne, remplacer « Sur le banc » partout passerait — et un
    // remplacant d une vraie compo serait annonce comme un convoque ordinaire,
    // alors que la distinction est justement l information du coach.
    const root = monter({ auth: authPour('coach-1', true), convocation: CONVOCATION });

    allerSurLOnglet(root, 'callUp');

    expect(contient(root, 'Sur le terrain')).toBe(true);
    expect(contient(root, 'Sur le banc')).toBe(true);
    expect(contient(root, 'Convoqués')).toBe(false);
  });
});

// ⚽ S5-D (vague S) — LE TERRAIN SE VOIT SANS APPUYER SUR RIEN.
//
// 🗣️ Retour de recette d Adel (26/08), apres avoir valide a/b/c : « une fois la
// composition creee et PUBLIEE, ca doit afficher LE TERRAIN avec les joueurs
// places directement dans l onglet, sans devoir cliquer le bouton du bas ».
//
// 🧨 CE QUI MANQUAIT : l onglet decrivait la compo (« 1 equipe(s) publiee(s) »,
// puis les noms depuis R6) et laissait le DESSIN derriere un appui. Or c est le
// dessin qui repond a la question d un coach — qui joue ou.
// ⇒ Le CTA reste : il mene a l ecran complet, ou l on peut modifier.
describe('S5-D · le terrain de la compo publiee, DANS l onglet', () => {
  test('🥇 il est monte avec les placements de la compo', () => {
    const root = monter({ auth: authPour('coach-1', true), convocation: CONVOCATION });

    allerSurLOnglet(root, 'callUp');

    const [terrain] = parTestID(root, 'doublure-terrain');

    expect(terrain).toBeTruthy();
    // 🎯 Le juge porte sur CE QU ON LUI DEMANDE DE DESSINER : un terrain monte
    // avec zero placement serait vert sur un simple `toBeTruthy`.
    expect(terrain.props.placementsCount).toBe(1);
    expect(terrain.props.snapshotCount).toBeGreaterThan(0);
    expect(terrain.props.sportContext).toBe('football');
  });

  test('🔒 le CTA vers l ecran complet reste EN DESSOUS', () => {
    // Le terrain de l onglet est un APERCU en lecture seule. Retirer le bouton
    // en meme temps qu on ajoute le dessin fermerait la seule porte vers la
    // modification — c est le genre de perte qu aucune porte ne signale.
    // ⚠️ Monte avec un CONVOQUE, pas avec le coach : le libelle du coach passe
    // par une clef SANS repli, et le mock de traduction de ce filet rend alors
    // la clef. Un juge textuel y mesurerait le mock, pas l ecran.
    const root = monter({ auth: authPour(JOUEUR), convocation: CONVOCATION });

    allerSurLOnglet(root, 'callUp');

    expect(parTestID(root, 'doublure-terrain')).toHaveLength(1);
    expect(contient(root, 'Voir ma convocation')).toBe(true);
  });

  test('🔒 un JOUEUR convoque voit le terrain, lui aussi', () => {
    // Meme regle que la liste (S5-c) : « qui joue ou » n est pas un privilege
    // de staff. Le serveur envoie deja la charge aux membres de l equipe.
    const root = monter({ auth: authPour(JOUEUR), convocation: CONVOCATION });

    allerSurLOnglet(root, 'callUp');

    expect(parTestID(root, 'doublure-terrain')).toHaveLength(1);
  });
});
