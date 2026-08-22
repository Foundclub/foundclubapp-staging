import { Text, TouchableOpacity } from 'react-native';
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

// 🈯 La doublure de traduction INTERPOLE, contrairement a celle des filets
// precedents. Ce n'est pas du zele : l'etape 1 du chemin de detection affiche
// « N pointé·e·s sur M », et c'est precisement le nombre que le lot doit
// prendre sur le SERVEUR et non dans l'etat local d'un ecran de repartition. Un
// `t` qui rendrait « {{pointed}} pointé·e·s sur {{total}} » laisserait cette
// regle sans temoin.
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (
      /** @type {string} */ key,
      /** @type {any} */ fallback,
      /** @type {any} */ options,
    ) => {
      const modele = typeof fallback === 'string' ? fallback : key;
      if (!options || typeof options !== 'object') return modele;
      return Object.keys(options).reduce(
        (texte, nom) => texte.split(`{{${nom}}}`).join(String(options[nom])),
        modele,
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
  useGetEventAttendance: () => ({ ...emptyQuery(), data: mockAttendance.data }),
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
      participations: [
        { documentId: 'p-1', participationStatus: 'accepted', user: { documentId: 'u-1' } },
      ],
      startTime: '09:00:00.000',
    },
    {
      date: '2026-10-21T09:00:00.000Z',
      documentId: 'jour-2',
      endTime: '17:00:00.000',
      participations: [],
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

const monter = (/** @type {any} */ { attendance = null, auth, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockAttendance.data = attendance;
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

describe('N2 · caracterisation — LE STAGE PARENT tel qu il est au 23/08', () => {
  test('il monte, et il porte SES DEUX PASTILLES MAISON, pas des onglets', () => {
    const root = monter({ event: buildStageParent() });

    // ⛔ LE DEFAUT A CORRIGER : deux jeux de navigation coexistent sur la page.
    // « Vue générale » / « Jours » sont des `TouchableOpacity` dessines a la
    // main DANS une carte, et non le `SegmentedControl` de la maquette.
    expect(contient(root, 'Vue générale')).toBe(true);
    expect(contient(root, 'Jours')).toBe(true);
    expect(parTestID(root, 'doublure-onglets')).toHaveLength(0);
  });

  test('la pastille « Vue générale » montre periode, horaires et lieu', () => {
    const root = monter({ event: buildStageParent() });

    expect(contient(root, 'Période')).toBe(true);
    expect(contient(root, 'Horaires')).toBe(true);
    expect(contient(root, 'Lieu principal')).toBe(true);
    // Les deux compteurs que la carte affiche aujourd'hui.
    expect(contient(root, '2 jour(s)')).toBe(true);
    expect(contient(root, '2 inscrit(s)')).toBe(true);
  });

  test('la LISTE DES PARTICIPANTS du stage est montee, sans aucun appui', () => {
    const root = monter({ event: buildStageParent() });

    expect(contient(root, 'LISTE_DES_PARTICIPANTS')).toBe(true);
  });

  test('la DESCRIPTION est montee — mais APRES le bloc du stage', () => {
    // 🧾 Le defaut que la note du jalon N3 signale : la regle 2 du pack veut la
    // description EN HAUT de l'Aperçu. Sur un stage, elle passe apres. Ce
    // temoin fige l'ordre ACTUEL, pour que le rangement le change VISIBLEMENT
    // plutot que par accident.
    const root = monter({ event: buildStageParent() });
    const textes = textesVisibles(root).join(' | ');

    expect(textes).toContain(DESCRIPTION);
    expect(textes.indexOf('Période')).toBeLessThan(textes.indexOf(DESCRIPTION));
  });
});

describe('N2 · caracterisation — LE TOURNOI ET SES EQUIPES INSCRITES', () => {
  test('le panneau de TETE porte « Gérer le tournoi »', () => {
    const root = monter({ event: buildTournoi() });

    expect(contient(root, 'Gérer le tournoi')).toBe(true);
  });

  test('un lecteur qui ne gere PAS lit « Voir le tournoi »', () => {
    const root = monter({
      auth: authPour('visiteur-1', false),
      event: buildTournoi(),
    });

    expect(contient(root, 'Voir le tournoi')).toBe(true);
  });

  test('la section tournoi montre l etat de la competition et le compte d equipes', () => {
    const root = monter({ event: buildTournoi() });

    expect(contient(root, 'TOURNOI')).toBe(true);
    expect(contient(root, 'Compétition en brouillon')).toBe(true);
    expect(contient(root, 'Équipes tournoi')).toBe(true);
    expect(contient(root, '1 validée(s) · 1 en attente')).toBe(true);
  });

  test('🔒 une equipe EN ATTENTE porte « Valider » et « Refuser » pour l organisateur', () => {
    // ⚠️ LE TEMOIN LE PLUS IMPORTANT DU FICHIER. Ces deux boutons acceptent ou
    // refusent l'inscription d'une equipe a un tournoi — un geste qui engage
    // l'organisateur vis-a-vis d'un tiers. Il n'etait tenu par AUCUN test.
    const root = monter({ event: buildTournoi() });

    expect(contient(root, 'Les Lions')).toBe(true);
    expect(contient(root, 'Validation en attente')).toBe(true);
    expect(contient(root, 'Valider')).toBe(true);
    expect(contient(root, 'Refuser')).toBe(true);
  });

  test('un lecteur qui ne gere PAS ne voit ni « Valider » ni « Refuser »', () => {
    const root = monter({
      auth: authPour('visiteur-1', false),
      event: buildTournoi(),
    });

    expect(contient(root, 'Les Lions')).toBe(true);
    expect(contient(root, 'Valider')).toBe(false);
    expect(contient(root, 'Refuser')).toBe(false);
  });

  test('l equipe VALIDEE est dite inscrite', () => {
    const root = monter({ event: buildTournoi() });

    expect(contient(root, 'Les Aigles')).toBe(true);
    expect(contient(root, 'Équipe inscrite')).toBe(true);
  });

  test('un tournoi n a AUCUNE barre du bas — et c est le defaut a corriger', () => {
    // `renderActionButtons` rend `null` des que l'evenement est un tournoi
    // (inchange depuis avril). L'ecran se termine donc sur du vide.
    const root = monter({ event: buildTournoi() });

    expect(contient(root, 'DOUBLURE_EventAnswerButtons')).toBe(false);
  });

  test('un tournoi n a AUCUN onglet aujourd hui', () => {
    const root = monter({ event: buildTournoi() });

    expect(parTestID(root, 'doublure-onglets')).toHaveLength(0);
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
