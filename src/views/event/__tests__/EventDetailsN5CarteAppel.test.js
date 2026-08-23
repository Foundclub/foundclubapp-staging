import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// N5 (D3/D4/D5) — LA PORTE D ENTREE DE L APPEL, BRANCHEE SUR L APERÇU.
//
// 🚪 LE MOTIF : L5-A a livre `EventAttendanceCall` — un ecran d appel complet,
// sa route, son modele de fenetre — et AUCUN code de production ne navigue
// vers lui. Une fonctionnalite qu aucun bouton n atteint n existe pas pour
// celui qui l utilise.
//
// CE QUI SE VERIFIE ICI :
//   · QUI voit la carte (D3) — et surtout qui ne la voit PAS ;
//   · OU elle se pose (D4) — au-dessus de la description ;
//   · CE QU ELLE DIT selon l heure du SERVEUR, jamais celle du telephone ;
//   · 🕳️ LE TROU CONNU, nomme et tenu par un temoin : un dirigeant
//     organisateur qui n est pas de l equipe est `canEdit` mais PAS
//     `canAccessAttendance` — il ne voit pas la carte, et le serveur lui
//     repondrait 403. Lui montrer la porte serait lui mentir.
// ==========================================================================

const mockUseAuth = jest.fn();
const mockSetOptions = jest.fn();
const mockNavigate = jest.fn();
const mockEventQuery = { data: null };
const mockAttendanceQuery = { data: null };

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

// ⚠️ LISTE FIGEE, copiee telle quelle : 13 suites la partagent. N5 n ajoute
// aucune mutation — il ne fait que NAVIGUER vers un ecran deja livre.
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

// La doublure IGNORE `testID` — comme le vrai atome, qui ne le transmet pas.
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
import { RouteNames } from '@/navigation/routeNames';

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const COACH = 'coach-1';
const JOUEUR = 'joueur-1';
const DIRIGEANT_HORS_EQUIPE = 'dirigeant-2';
const DESCRIPTION = 'Rendez-vous au stade une heure avant.';

// Un match a VENIR. 16:00 UTC = 18:00 a Paris en aout : l appel ouvre donc a
// 17:30 heure du club. C est l heure exacte de la maquette 2A.
const DEBUT = '2026-08-25T16:00:00.000Z';

const evenementDeType = (/** @type {string} */ typeName) => ({
  club: { documentId: CLUB_ID },
  date: DEBUT,
  description: DESCRIPTION,
  documentId: 'event-1',
  endDate: '2026-08-25T18:00:00.000Z',
  eventTasks: [{ documentId: 'tache-1', title: 'Apporter les ballons' }],
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Match contre Saint-Julien',
  participations: [],
  startTime: '18:00',
  team: {
    club: { documentId: CLUB_ID },
    documentId: TEAM_ID,
    name: 'U15',
    players: [{ documentId: JOUEUR }],
    trainers: [{ documentId: COACH }],
  },
  type: { name: typeName },
});

const MATCH = evenementDeType('Match');
const ENTRAINEMENT = evenementDeType('Entraînement');
const TOURNOI = evenementDeType('Tournoi');

// 22 personnes attendues — le chiffre que la maquette additionne (18+2+2).
const VINGT_DEUX = Array.from({ length: 22 }, (_, index) => ({
  user: { documentId: `u-${index}` },
}));

/**
 * La charge d appel telle que le serveur la rend, avec SA fenetre et SON heure.
 * @param {string} serverNow - L instant du serveur.
 * @returns {any} - La charge.
 */
const chargeAppel = (serverNow) => ({
  data: {
    eventStartAt: DEBUT,
    items: VINGT_DEUX,
    serverNow,
    timezone: 'Europe/Paris',
    window: {
      closesAt: '2026-08-25T20:00:00.000Z',
      enabled: true,
      opensAt: '2026-08-25T15:30:00.000Z',
    },
  },
});

const AVANT_LA_FENETRE = chargeAppel('2026-08-25T14:00:00.000Z');
const DANS_LA_FENETRE = chargeAppel('2026-08-25T16:30:00.000Z');
const APRES_LA_FENETRE = chargeAppel('2026-08-25T21:00:00.000Z');

const authPour = (/** @type {string} */ documentId, /** @type {boolean} */ peutGerer = false) => ({
  canEditClub: () => peutGerer,
  canEditEvent: () => peutGerer,
  canManageEvent: () => peutGerer,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { documentId, role: { name: peutGerer ? 'Dirigeant' : 'Joueur' } },
});

// 🧹 L horloge serveur d `EventDetails` pose un `setInterval` : un ecran
// orphelin le laisse tourner et jest ne rend jamais la main.
/** @type {any[]} */
const montes = [];

const monter = (/** @type {any} */ options = {}) => {
  const {
    attendance = DANS_LA_FENETRE,
    auth = authPour(COACH, true),
    event = MATCH,
  } = options;

  mockUseAuth.mockReturnValue(auth);
  mockEventQuery.data = event;
  mockAttendanceQuery.data = attendance;

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

// On ne garde que les vrais noeuds d affichage : `findAllByProps` remonte
// aussi le composant qui porte la prop, ce qui compterait double.
const parTestID = (/** @type {any} */ root, /** @type {string} */ id) => root
  .findAllByProps({ testID: id })
  .filter((/** @type {any} */ node) => typeof node.type === 'string');

const laCarte = (/** @type {any} */ root) => parTestID(root, 'event-next-action')[0] || null;

const leBouton = (/** @type {any} */ root) => {
  const enveloppe = parTestID(root, 'event-next-action-button')[0];

  return enveloppe ? enveloppe.findByType(TouchableOpacity) : null;
};

const rangDe = (/** @type {string[]} */ textes, /** @type {string} */ fragment) => textes
  .findIndex((texte) => texte.includes(fragment));

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
});

// ---------------------------------------------------------------------------
// 1 — CE QUE LA CARTE DIT, SELON L HEURE DU SERVEUR
// ---------------------------------------------------------------------------

describe('N5 — la carte « Faire l appel » sur l Aperçu', () => {
  test('dans la fenetre : le coach appuie, et l ecran d appel s ouvre', () => {
    const root = monter();

    expect(laCarte(root)).toBeTruthy();
    expect(textesVisibles(root)).toEqual(expect.arrayContaining(['Faire l’appel', '22 attendus']));

    const bouton = leBouton(root);
    expect(bouton.props.disabled).toBe(false);

    act(() => { bouton.props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledWith(
      RouteNames.EventAttendanceCall,
      { eventId: 'event-1' },
    );
  });

  test('avant la fenetre : « Ouvre à 17:30 », ferme — et l heure est celle du CLUB', () => {
    // 🧨 16:00 UTC = 18:00 a Paris. Une heure lue avec l horloge de la machine
    // afficherait autre chose des que le developpeur (ou le coach) voyage.
    const root = monter({ attendance: AVANT_LA_FENETRE });

    expect(textesVisibles(root)).toContain('Ouvre à 17:30');
    expect(leBouton(root).props.disabled).toBe(true);

    act(() => { leBouton(root).props.onPress?.(); });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('apres la fenetre : « Appel terminé », et la porte reste fermee', () => {
    const root = monter({ attendance: APRES_LA_FENETRE });

    expect(textesVisibles(root)).toContain('Appel terminé');
    expect(leBouton(root).props.disabled).toBe(true);

    act(() => { leBouton(root).props.onPress?.(); });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('D5 — sans la charge d appel, le coach voit la porte mais ne peut pas l ouvrir', () => {
    // La requete est desactivee ou en vol. La carte se dessine avec le repli
    // local du modele (30 min avant le debut), et elle n est PAS cliquable :
    // on n ouvre pas une fenetre que le serveur n a pas confirmee.
    const root = monter({ attendance: null });

    expect(laCarte(root)).toBeTruthy();
    expect(textesVisibles(root)).toContain('Ouvre à 17:30');
    expect(leBouton(root).props.disabled).toBe(true);
    // Et le compte n est pas invente : on ne sait pas qui est attendu.
    expect(textesVisibles(root).some((texte) => texte.includes('attendus'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2 — QUI LA VOIT (D3), ET SURTOUT QUI NE LA VOIT PAS
// ---------------------------------------------------------------------------

describe('N5 — a qui la carte s adresse', () => {
  test('un joueur de l equipe ne la voit pas : ce n est pas lui qui pointe', () => {
    const root = monter({ auth: authPour(JOUEUR, false) });

    expect(laCarte(root)).toBeNull();
  });

  test('🕳️ TROU CONNU — un dirigeant hors de l equipe ne la voit pas non plus', () => {
    // Il est `canEdit` (il organise), mais PAS `canAccessAttendance` : la
    // grille ne regarde que l appartenance a l equipe et la participation
    // (`eventAttendanceGate`). Le serveur lui repondrait 403. Lui afficher la
    // porte serait lui promettre une piece fermee a clef.
    // ⇒ Elargir la grille est un lot a part (L5-0), pas une correction ici.
    const root = monter({ auth: authPour(DIRIGEANT_HORS_EQUIPE, true) });

    expect(laCarte(root)).toBeNull();
  });

  test('un tournoi n a pas d appel : pas de carte', () => {
    const root = monter({ event: TOURNOI });

    expect(laCarte(root)).toBeNull();
  });

  test('un entrainement n a pas d onglets : la carte est en haut de la colonne', () => {
    const root = monter({ event: ENTRAINEMENT });

    expect(laCarte(root)).toBeTruthy();

    const textes = textesVisibles(root);
    expect(rangDe(textes, 'Faire l’appel')).toBeLessThan(rangDe(textes, DESCRIPTION));
  });
});

// ---------------------------------------------------------------------------
// 3 — OU ELLE SE POSE (D4) — le temoin d ordre de L4, ADAPTE
// ---------------------------------------------------------------------------

describe('N5 — la place de la carte dans l Aperçu', () => {
  test('⚖️ TEMOIN L4 ADAPTE — la carte precede la description, qui precede les taches', () => {
    // AVANT N5, la regle de L4 etait : « la DESCRIPTION ouvre l onglet Aperçu,
    // elle passe avant les taches ». Elle n est pas annulee, elle est
    // PRECISEE : la prochaine action passe devant elle (maquette 2A, juste
    // sous l entete), et la description continue de passer avant les taches.
    // La moitie L4 du temoin — description AVANT taches — est donc verifiee
    // ici telle quelle : rien n a ete perdu en chemin.
    const textes = textesVisibles(monter());

    const rangCarte = rangDe(textes, 'Faire l’appel');
    const rangDescription = rangDe(textes, DESCRIPTION);
    const rangTaches = rangDe(textes, 'DOUBLURE_EventTasksSection');

    expect(rangCarte).toBeGreaterThanOrEqual(0);
    expect(rangDescription).toBeGreaterThanOrEqual(0);
    expect(rangTaches).toBeGreaterThanOrEqual(0);

    expect(rangCarte).toBeLessThan(rangDescription);
    expect(rangDescription).toBeLessThan(rangTaches);
  });
});
