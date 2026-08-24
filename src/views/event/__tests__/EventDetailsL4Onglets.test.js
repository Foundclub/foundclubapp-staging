import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// L4-A — LA PAGE DE DETAIL D'UN MATCH GAGNE SES ONGLETS.
//
// Constat de l'audit du pack de design (`CONSTAT_DETAIL_EVENEMENT.md`, ecart 2) :
// l'ecran empilait 19 blocs dans UNE SEULE COLONNE. La maquette (planche 04)
// la coupe en trois onglets — Aperçu · Participants · Convocation — sous une
// zone fixe (carte d'entete + statut de convocation) qui, elle, ne bouge pas.
//
// ⛔ UN SEUL TYPE DANS CE LOT : le MATCH. Le tournoi, le stage, la detection et
// l'entrainement gardent leur colonne A L'IDENTIQUE — decision du CONSTAT
// (l. 1235) et d'Adel (Q2, 20/08). Le temoin 4 le verrouille des deux cotes :
// trois onglets sur un match, ZERO ailleurs.
//
// ⚠️ « Match amical » contient « match » : `isMatchEvent` est VRAI pour lui
// (`EventDetails.js:2748`, comparaison par sous-chaine). C'est voulu — meme
// metier — et c'est teste ci-dessous plutot que suppose.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest n'a pas de moteur de mise en page. Il
// lit ce qui est MONTE et ce qui ne l'est pas. Le rendu reel se voit a la
// recette.

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
      { fullLabels: Boolean(props.fullLabels), testID: 'doublure-onglets' },
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

describe('L4 · temoin 4 — trois onglets sur un match, zero ailleurs', () => {
  // 🔢 MIS A JOUR PAR N2 : l'onglet des personnes porte desormais son EFFECTIF.
  // C'est une regle de la planche 04 qui vaut pour les quatre types ranges, pas
  // une decoration du match : « Participants · 8 », « Candidats · 9 »,
  // « Personnes · 74 ». Ici l'evenement de reference n'a aucune participation,
  // d'ou le `· 0` — un onglet vide reste affiche AVEC son compte, il ne se
  // cache pas. La matrice complete est tenue par `EventDetailsN2Onglets`.
  test('un MATCH porte Aperçu · Participants · N · Convocation, dans cet ordre', () => {
    const root = monter();

    expect(libellesDesOnglets(root)).toEqual(['Aperçu', 'Participants · 0', 'Convocation']);
  });

  // 📏 R6 (vague R) — LES TROIS LIBELLES NE SE ROGNENT PLUS.
  //
  // 🧨 CONSTAT DE RECETTE DU 24/08, un entraineur sur un MATCH : les trois
  // onglets arrivaient COUPES. Le controle segmente repartit ses options en
  // TIERS EGAUX et coupait a UNE ligne : sur un telephone de 360 pt, un tiers
  // vaut ~110 pt, et « Participants · 12 » n'y tient pas.
  //
  // ⛔ LE COMPTEUR NE PART PAS POUR AUTANT — c'est la tentation que ce temoin
  // interdit. La planche 04 l'EXIGE sur les quatre types ranges ; raccourcir le
  // libelle aurait rendu l'ecran vert en SUPPRIMANT l'information. Ce qui change
  // est la consigne d'affichage : deux lignes autorisees, zero troncature
  // (`fullLabels`, pose par D63 sur `FacilityForm` et jamais passe ici).
  test('les libelles sont demandes ENTIERS au controle segmente (R6, vague R)', () => {
    const root = monter();

    const [controle] = parTestID(root, 'doublure-onglets');

    expect(controle.props.fullLabels).toBe(true);
    // 🔒 Contre-epreuve dans le MEME temoin : la consigne d'affichage change,
    // les compteurs restent. Sans cette ligne, vider les libelles passerait.
    expect(libellesDesOnglets(root)).toEqual(['Aperçu', 'Participants · 0', 'Convocation']);
  });

  test('un « Match amical » les porte AUSSI — meme metier, meme page', () => {
    // `isMatchEvent` compare par SOUS-CHAINE (`EventDetails.js:2748`) : « Match
    // amical » contient « match ». C'est voulu, et c'est mesure ici plutot que
    // suppose — le jour ou quelqu'un resserre la comparaison, ce temoin parle.
    const root = monter({ event: buildEvent({ type: { name: 'Match amical' } }) });

    expect(libellesDesOnglets(root)).toEqual(['Aperçu', 'Participants · 0', 'Convocation']);
  });

  test('un ENTRAINEMENT n a AUCUN onglet, et sa colonne est intacte', () => {
    const root = monter({ event: buildEvent({ type: { name: 'Entrainement' } }) });

    expect(parTestID(root, 'doublure-onglets')).toHaveLength(0);
    // ⛔ LE COEUR DU TEMOIN : sur un non-match, TOUT reste empile dans la meme
    // colonne, visible d'un coup — description ET liste, sans le moindre appui.
    expect(contient(root, DESCRIPTION)).toBe(true);
    expect(contient(root, 'Exporter la liste (Excel/CSV)')).toBe(true);
  });

  // ♻️ REECRIT PAR N2. Ce temoin disait « le tournoi n'a AUCUN onglet : ce lot
  // ne touche qu'au match ». C'etait vrai de L4, et Adel l'avait voulu ainsi
  // (Q2, 20/08 : le tournoi apres qu'il ait retrouve une barre du bas). C'est
  // fait — le tournoi rejoint la matrice avec ses trois onglets a lui.
  test('un TOURNOI porte MAINTENANT les siens : Aperçu · Équipes · Personnes', () => {
    const root = monter({ event: buildEvent({ type: { name: 'Tournoi' } }) });

    expect(libellesDesOnglets(root)).toEqual(['Aperçu', 'Équipes · 0', 'Personnes · 0']);
  });

  test('un ENTRAINEMENT, lui, n en a toujours AUCUN', () => {
    // ⛔ La matrice ne ratisse pas tout : quatre types seulement en ont assez
    // pour deborder d'une colonne. L'entrainement garde la sienne, entiere.
    const root = monter({ event: buildEvent({ type: { name: 'Entrainement' } }) });

    expect(parTestID(root, 'doublure-onglets')).toHaveLength(0);
  });

  test('sur un match, Aperçu est l onglet ouvert au montage', () => {
    const root = monter();

    // La description vit dans Aperçu : elle se lit sans aucun appui.
    expect(contient(root, DESCRIPTION)).toBe(true);
    // La liste, elle, vit dans son propre onglet et n'est donc PAS montee.
    expect(contient(root, 'Exporter la liste (Excel/CSV)')).toBe(false);
  });

  test('la DESCRIPTION ouvre l onglet Aperçu — elle passe avant les taches', () => {
    // Regle 2 des six regles du 22/08 (CONSTAT, ecart 4) : « un seul champ, le
    // meme nom pour les six types, EN HAUT DE L'APERÇU, sous la carte ».
    // Avant L4-A, la description etait rendue au 9e rang de la page, apres les
    // taches. Le bloc des taches redescend donc SOUS elle.
    const root = monter({
      event: buildEvent({
        eventTasks: [{ documentId: 'tache-1', title: 'Apporter les ballons' }],
      }),
    });

    const textes = textesVisibles(root);
    const rangDescription = textes.findIndex((/** @type {string} */ t) => t.includes(DESCRIPTION));
    const rangTaches = textes.findIndex(
      (/** @type {string} */ t) => t.includes('DOUBLURE_EventTasksSection'),
    );

    expect(rangDescription).toBeGreaterThanOrEqual(0);
    expect(rangTaches).toBeGreaterThanOrEqual(0);
    expect(rangDescription).toBeLessThan(rangTaches);
  });

  test('l onglet Convocation porte la composition publiee, Aperçu ne la porte pas', () => {
    const root = monter({
      auth: authPour(JOUEUR),
      convocation: CONVOCATION,
    });

    expect(contient(root, 'Composition d')).toBe(false);

    allerSurLOnglet(root, 'callUp');

    expect(contient(root, 'Composition d')).toBe(true);
    // Et la description a laisse la place : un onglet a la fois.
    expect(contient(root, DESCRIPTION)).toBe(false);
  });
});

describe('L4 · temoin 5 — le convoque lit son statut sans un seul appui', () => {
  // 🔒 GARANTIE REPRISE D'AC08 (temoin 5) ET D'AD01 (temoins 1 et 2) : la
  // phrase de convocation etait lisible AU MONTAGE, avant tout appui. Les
  // onglets ne la renegocient PAS — elle vit dans la ZONE FIXE, au-dessus de la
  // barre d'onglets, donc elle est vraie quel que soit l'onglet actif.
  test('« Tu es convoqué · Titulaire » se lit au montage, onglet Aperçu', () => {
    const root = monter({ auth: authPour(JOUEUR), convocation: CONVOCATION });

    expect(contient(root, 'Tu es convoqué · Titulaire')).toBe(true);
  });

  test('et elle reste lisible sur CHACUN des trois onglets', () => {
    const root = monter({ auth: authPour(JOUEUR), convocation: CONVOCATION });

    ['overview', 'participants', 'callUp'].forEach((onglet) => {
      allerSurLOnglet(root, onglet);
      expect(contient(root, 'Tu es convoqué · Titulaire')).toBe(true);
    });
  });

  test('le remplacant lit la sienne, au montage aussi', () => {
    const root = monter({ auth: authPour(REMPLACANT), convocation: CONVOCATION });

    expect(contient(root, 'Tu es convoqué · Remplaçant')).toBe(true);
  });
});

describe('L4 · temoin 6 — l export reste atteignable', () => {
  test('onglet Participants : « Exporter la liste (Excel/CSV) » est la', () => {
    const root = monter();

    allerSurLOnglet(root, 'participants');

    expect(contient(root, 'Exporter la liste (Excel/CSV)')).toBe(true);
    expect(parTestID(root, 'bouton-export')).toHaveLength(1);
  });

  test('et il est branche : son appui appelle bien le declencheur de l ecran', () => {
    const root = monter();
    allerSurLOnglet(root, 'participants');

    const [bouton] = parTestID(root, 'bouton-export');
    expect(typeof bouton.props.onPress).toBe('function');
  });

  test('on revient a Aperçu et la description est de nouveau la : rien n est perdu', () => {
    const root = monter();

    allerSurLOnglet(root, 'participants');
    expect(contient(root, DESCRIPTION)).toBe(false);

    allerSurLOnglet(root, 'overview');
    expect(contient(root, DESCRIPTION)).toBe(true);
  });
});
