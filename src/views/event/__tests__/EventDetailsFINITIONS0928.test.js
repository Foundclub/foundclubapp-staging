import {
  InteractionManager, ScrollView, StyleSheet, Text,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

// FINITIONS — LA RECETTE ÉMULATEUR DU 2026-09-28 (Android 16, tournée 3), SUR LA FICHE
// D'UN MATCH. Trois défauts, chacun écrit ROUGE avant son correctif :
//   1b · libellés coupés : « Voir la convocation et les » (réponses), « Voir tous mes
//        matchs en » (attente) — captures T3-B3-zoom-boutons-fiche, T3-B3-apercu ;
//   2  · textes de l'onglet Convocation vu par l'entraîneur : « Composition d'equipes »,
//        « 1 équipe(s) publiée(s) », « 1 branche(s) visible(s) · 1 remplacant(s) »,
//        « Publie le » — capture T3-B3-onglet-milieu ;
//   4  · bruit : `GET /events/:id/my-match-response` → 400 « Match statistics are only
//        available after… », 6 fois en une tournée, AVANT la fin du match.
//
// ♻️ HARNAIS REPRIS D'`EventDetailsR6Convocation` (mêmes doublures, même charge de
// convocation en forme `branches`), avec trois différences voulues :
//   · la doublure de `t` délègue au VRAI i18next démarré sur `fr.js` (jest.setup.js) :
//     un pluriel, un accent ou une clef sans repli se lisent comme à l'écran ;
//   · la doublure de `Button` relaie `style` et `variant` : le témoin 1b lit la
//     DISPOSITION des boutons, pas seulement leur texte ;
//   · `refetch` de la réponse perso est un espion stable (témoin 4).
//
// ⚠️ Jest ne calcule aucune mise en page : les témoins 1b tiennent la STRUCTURE (boutons
// empilés, texte étiré, espaces insécables). Seul un Android 16 prouvera le mot entier.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockRefetchMyMatchResponse = jest.fn();
const mockEventQuery = { data: null };
const mockConvocationQuery = { data: null };
const mockAttendanceQuery = { data: null };

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  inviteToTeam: () => Promise.resolve(null),
  resolveTeamInvitationAvailability: () => ({
    candidateId: '',
    canInvite: false,
    reason: 'missing-team',
  }),
}));

// 🔤 Le VRAI i18next, démarré en français par `jest.setup.js` : pluriels `_one`/`_other`,
// interpolation, et la valeur de `fr.js` pour une clef appelée sans repli.
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repliOuOptions, /** @type {any} */ options) => {
      const i18n = jest.requireActual('i18next');
      if (typeof repliOuOptions === 'string') {
        return i18n.t(cle, { defaultValue: repliOuOptions, ...(options || {}) });
      }
      return i18n.t(cle, repliOuOptions);
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
  const theme = {
    Alignments,
    ApplicationStyle: generateApplicationStyle(Colors),
    Colors,
    Fonts: generateFonts(Colors),
    Images: new Proxy({}, { get: () => 1 }),
    scheme: 'dark',
    Spaces,
  };
  return { __esModule: true, default: () => theme };
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
  useGetEventAttendance: () => ({ ...emptyQuery(), data: mockAttendanceQuery.data }),
  useGetEventConvocation: () => ({ ...emptyQuery(), data: mockConvocationQuery.data }),
  useGetEventTeamComposition: () => emptyQuery(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseCampaigns: () => ({ ...emptyQuery(), data: { data: [] } }),
}));

jest.mock('@/services/tournamentCompetition/tournamentCompetitionQueries', () => ({
  useGetTournamentDashboard: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => emptyQuery(),
  useGetEventMyMatchResponse: () => ({ ...emptyQuery(), refetch: mockRefetchMyMatchResponse }),
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

jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetTrainingReviews: () => ({ data: null }),
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

// 🧱 La doublure du bouton RELAIE ce que l'écran lui demande (`style`, `variant`) :
// c'est la disposition des boutons que le témoin 1b juge.
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

jest.mock('@/components/tactical/ConvocationFieldPreview', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ConvocationFieldPreviewDouble() {
    return react.createElement(rn.View, { testID: 'doublure-terrain' });
  };
});

jest.mock('../components/EventParticipants', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function EventParticipantsDouble() {
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

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const COACH = 'coach-1';
const JOUEUR = 'joueur-1';
const REMPLACANT = 'joueur-2';
const OUVRIR_LA_CONVOCATION = 'Voir la convocation et les réponses';

const PACK = {
  publishedAt: '2026-09-28T19:58:11.000Z',
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

const BRANCHE = {
  published: PACK,
  responses: { byPlayerId: {}, counts: { absent: 0, pending: 2, present: 0 } },
  team: { documentId: TEAM_ID, name: 'U15' },
  viewer: { inReserve: false, teamEntryIds: [] },
};

/**
 * La charge de `GET /events/:id/convocation`, forme `branches`.
 * @param {any[]} branches - Les branches publiées.
 * @returns {any} - La charge.
 */
const convocation = (branches = [BRANCHE]) => ({
  branches,
  event: { date: '2099-01-01T10:00:00.000Z', documentId: 'event-1', name: 'Match' },
  eventKind: 'event',
  schemaVersion: 3,
});

/**
 * Un pack publié avec N équipes et N remplaçants.
 * @param {number} equipes - Le nombre d'équipes du pack.
 * @param {number} remplacants - Le nombre de remplaçants.
 * @returns {any} - La branche.
 */
const brancheAvec = (equipes, remplacants) => {
  const idsDuBanc = Array.from({ length: remplacants }, (_v, i) => `banc-${i + 1}`);
  return {
    ...BRANCHE,
    published: {
      ...PACK,
      reservePlayerIds: idsDuBanc,
      reserveSnapshotPlayers: idsDuBanc.map((id, i) => ({
        documentId: id, firstname: 'Banc', lastname: String(i + 1),
      })),
      teams: Array.from({ length: equipes }, (_v, i) => ({
        ...PACK.teams[0],
        id: `team_${i + 1}`,
      })),
    },
  };
};

const MATCH_A_VENIR = {
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
    players: [{ documentId: JOUEUR }, { documentId: REMPLACANT }],
    trainers: [{ documentId: COACH }],
  },
  type: { name: 'Match' },
};

// Un match FINI : c'est l'horloge du SERVEUR qui le décide (AC10) — repris de N4.
const MATCH_FINI = {
  ...MATCH_A_VENIR,
  date: '2020-01-01T10:00:00.000Z',
  endDate: '2020-01-01T12:00:00.000Z',
};
const HORLOGE_APRES_LE_MATCH = { data: { serverNow: '2020-01-01T14:00:00.000Z' } };

const authCoach = () => ({
  canEditClub: () => true,
  canEditEvent: () => true,
  canManageEvent: () => true,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { documentId: COACH, role: { name: 'Dirigeant' } },
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
  convocationData = convocation(),
  event = MATCH_A_VENIR,
} = {}) => {
  mockEventQuery.data = event;
  mockConvocationQuery.data = convocationData;
  mockAttendanceQuery.data = attendance;
  mockUseAuth.mockReturnValue(authCoach());

  demonter();
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

/**
 * Le texte BRUT d'un nœud (sans normaliser les blancs : une espace insécable reste
 * visible pour le témoin).
 * @param {any} noeud - Le nœud rendu.
 * @returns {string} - Son texte.
 */
const texteBrut = (noeud) => {
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
  walk(noeud);
  return parts.join('');
};

const lisible = (/** @type {string} */ texte) => texte.replace(/\s+/g, ' ').trim();

const textesVisibles = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => lisible(texteBrut(node)))
  .filter(Boolean);

const toutLeTexte = (/** @type {any} */ root) => textesVisibles(root).join(' | ');

const texteNommé = (/** @type {any} */ root, /** @type {string} */ libelle) => root
  .findAllByType(Text)
  .find((/** @type {any} */ node) => lisible(texteBrut(node)) === libelle);

const allerSurLOnglet = (/** @type {any} */ root, /** @type {string} */ valeur) => {
  const [onglet] = root.findAll(
    (/** @type {any} */ node) => node.props?.testID === `onglet-${valeur}`,
    { deep: false },
  );
  if (!onglet) throw new Error(`Aucun onglet « ${valeur} » à l écran`);
  act(() => {
    onglet.props.onPress();
  });
};

/**
 * L'instance de la doublure de bouton qui porte ce titre (celle qui reçoit les props
 * de l'écran : `title`, `variant`, `style`).
 * @param {any} root - La racine.
 * @param {string} titre - Le libellé.
 * @returns {any} - L'instance, ou undefined.
 */
const boutonNommé = (root, titre) => root.findAll(
  (/** @type {any} */ node) => node.props?.title === titre && 'variant' in node.props,
)[0];

// ===========================================================================
// 1b · LIBELLÉS COUPÉS SUR LA FICHE
// ===========================================================================
describe('FINITIONS 1b — les libellés de la fiche ne perdent plus leur dernier mot', () => {
  test('« Voir la convocation et les réponses » et « Modifier » sont EMPILÉS, chacun sur toute la largeur', () => {
    // 🧨 Côte à côte, chaque bouton n'a qu'une demi-largeur : le libellé long y était
    // réduit à une police minuscule, et perdait quand même « réponses ».
    const root = monter();
    allerSurLOnglet(root, 'callUp');

    const ouvrir = boutonNommé(root, OUVRIR_LA_CONVOCATION);
    const modifier = boutonNommé(root, 'Modifier');

    expect(ouvrir).toBeDefined();
    expect(modifier).toBeDefined();
    // Même conteneur, et il n'est PAS une rangée.
    expect(ouvrir.parent).toBe(modifier.parent);
    expect(StyleSheet.flatten(ouvrir.parent.props.style)?.flexDirection).not.toBe('row');
    // ⛔ Plus de `flex: 1` : dans une colonne sans hauteur, il écraserait le bouton à 0.
    expect(StyleSheet.flatten(ouvrir.props.style)?.flex).toBeUndefined();
    expect(StyleSheet.flatten(modifier.props.style)?.flex).toBeUndefined();
  });

  test('« Voir tous mes matchs en attente » : le texte prend toute la largeur du lien, centré', () => {
    const root = monter();
    const libelle = texteNommé(root, 'Voir tous mes matchs en attente');

    expect(libelle).toBeDefined();
    const style = StyleSheet.flatten(libelle.props.style);
    expect({ flexGrow: style.flexGrow, textAlign: style.textAlign })
      .toEqual({ flexGrow: 1, textAlign: 'center' });
  });

  test('les pastilles « Mes stats » et « Mon retour coach » n offrent aucun point de coupure', () => {
    const root = monter({ attendance: HORLOGE_APRES_LE_MATCH, event: MATCH_FINI });

    const aFaire = texteNommé(root, 'À faire');
    const pasEncore = texteNommé(root, 'Pas encore partagé');

    expect(aFaire).toBeDefined();
    expect(pasEncore).toBeDefined();
    expect(texteBrut(aFaire)).not.toContain(' ');
    expect(texteBrut(pasEncore)).not.toContain(' ');
  });
});

// ===========================================================================
// 2 · LES TEXTES DE L'ONGLET CONVOCATION, VU PAR L'ENTRAÎNEUR
// ===========================================================================
describe('FINITIONS 2 — l onglet Convocation parle comme un dirigeant', () => {
  test('le titre porte son accent', () => {
    const root = monter();
    allerSurLOnglet(root, 'callUp');

    expect(toutLeTexte(root)).toContain('Composition d’équipes');
    expect(toutLeTexte(root)).not.toMatch(/Composition d.equipes/);
  });

  test.each([
    [0, 'Composition publiée'],
    [1, '1 équipe publiée'],
    [2, '2 équipes publiées'],
  ])('%i équipe(s) publiée(s) → « %s », jamais « (s) »', (equipes, attendu) => {
    const root = monter({ convocationData: convocation([brancheAvec(equipes, 1)]) });
    allerSurLOnglet(root, 'callUp');

    expect(textesVisibles(root)).toContain(attendu);
    expect(toutLeTexte(root)).not.toContain('(s)');
  });

  test.each([
    [0, null],
    [1, '1 remplaçant'],
    [2, '2 remplaçants'],
  ])('%i remplaçant(s) → %s', (remplacants, attendu) => {
    const root = monter({ convocationData: convocation([brancheAvec(1, remplacants)]) });
    allerSurLOnglet(root, 'callUp');
    const texte = toutLeTexte(root);

    if (attendu) {
      expect(texte).toContain(attendu);
    } else {
      expect(texte).not.toMatch(/\d+ rempla/);
    }
    // La cédille, et plus jamais le jargon « branche ».
    expect(texte).not.toContain('remplacant');
    expect(texte).not.toContain('branche');
  });

  test('une seule convocation ne se compte pas ; deux se disent « 2 convocations »', () => {
    const une = monter();
    allerSurLOnglet(une, 'callUp');
    expect(toutLeTexte(une)).not.toMatch(/\b1 convocation\b/);

    const deux = monter({
      convocationData: convocation([
        BRANCHE,
        { ...BRANCHE, team: { documentId: 'team-2', name: 'U15 B' } },
      ]),
    });
    allerSurLOnglet(deux, 'callUp');
    expect(toutLeTexte(deux)).toContain('2 convocations');
  });

  test('« Publiée le », avec son accent, et la date entière (aucune entité HTML)', () => {
    const root = monter();
    allerSurLOnglet(root, 'callUp');
    const texte = toutLeTexte(root);

    expect(texte).toMatch(/Publiée le \d{2}\/\d{2}\/\d{4}/);
    expect(texte).not.toContain('Publie le');
    expect(texte).not.toContain('&#x2F;');
  });
});
