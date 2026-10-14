/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// 🚧 COLL-C4B (02/10/2026) — design HY521H1, « P4v3-fermer-tel » ecran 5 : SUR L ENTRAINEMENT
// TOUCHE PAR UNE FERMETURE DE LA VILLE, UN BANDEAU ET LES DEUX GESTES DU CLUB. D16 : rien n est annule
// a sa place ; « Changer l heure ou le lieu » ouvre la modification, « Annuler l entrainement »
// l annulation de la fiche (les gestes d aujourd hui, rien de neuf). La fermeture vient du serveur
// (`facilityClosure` dans la fiche) : l ecran n ajoute AUCUN service, donc aucune doublure de plus.
// ROUGE avant le lot : la fiche ne disait rien d une fermeture. Harnais repris du temoin P8.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockEventQuery = { data: null };

// Le `t` du mock rend le REPLI, INTERPOLE : c'est exactement ce que
// l'utilisateur voit tant que la clef n'existe pas dans fr.js. Il note au
// passage les clefs demandees — sans ce releve, une clef mal orthographiee
// resterait invisible pour toujours. (Motif N1.)
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

jest.mock('react-i18next', () => {
  const askedKeys = /** @type {string[]} */ ([]);
  const rendre = (/** @type {any} */ modele, /** @type {any} */ options) => String(modele)
    .replace(
      /\{\{(\w+)\}\}/g,
      (/** @type {any} */ _tout, /** @type {any} */ nom) => (
        options && nom in options ? String(options[nom]) : `{{${nom}}}`
      ),
    );
  return {
    ...jest.requireActual('react-i18next'),
    askedKeys,
    useTranslation: () => ({
      t: (
        /** @type {string} */ key,
        /** @type {any} */ fallback,
        /** @type {any} */ options,
      ) => {
        askedKeys.push(key);
        const modele = typeof fallback === 'string' ? fallback : key;
        const reglages = typeof fallback === 'string' ? options : fallback;
        return rendre(modele, reglages);
      },
    }),
  };
});

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
    prefetchQuery: jest.fn(),
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
  useGetEventConvocation: () => emptyQuery(),
  useGetEventTeamComposition: () => emptyQuery(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseCampaigns: () => ({ ...emptyQuery(), data: { data: [] } }),
}));

// 🏆 Doublure MUETTE imposee par N7 item 5 (vague P) : `useGetTournamentDashboard`
// tire `@/services/client`, et un import de service reel fait tomber la suite
// ENTIERE a 0 test (piege connu : `.env` absent d'une copie de travail).
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

// ⚠️ La doublure du bouton porte `accessibilityRole: 'button'` — c'est par la
// que le temoin retrouve LE bouton, et pas un cadre qui l'entoure. Le vrai
// `Button` du depot ne laisse PAS passer de `testID` (liste de props fermee,
// Button.js:30-47) : chercher par le titre est le seul chemin honnete.
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
        { key: option.value, onPress: () => props.onChange(option.value) },
        react.createElement(rn.Text, null, option.label),
      )),
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

// eslint-disable-next-line import/first
import { askedKeys } from 'react-i18next';

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const COACH = 'coach-1';
const JOUEUR = 'joueur-1';

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  capacity: 0,
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  description: 'Rendez-vous au stade a 9 h.',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Seance du samedi',
  participations: [],
  startTime: '10:00',
  team: {
    club: { documentId: CLUB_ID },
    documentId: TEAM_ID,
    name: 'U15',
    players: [{ documentId: JOUEUR }],
    trainers: [{ documentId: COACH }],
  },
  type: { name: 'Entrainement' },
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

const ORGANISATEUR = () => authPour(COACH, true);
const SPECTATEUR = () => authPour('visiteur-1', false);

/** @type {any} */
let monte = null;

const demonter = () => {
  if (!monte) return;
  act(() => {
    monte.unmount();
  });
  monte = null;
};

const monter = (/** @type {any} */ { auth, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockUseAuth.mockReturnValue(auth || ORGANISATEUR());

  demonter();
  askedKeys.length = 0;
  mockSetOptions.mockClear();

  act(() => {
    monte = renderer.create(
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

  return monte.root;
};

afterEach(() => {
  demonter();
});

const texteDe = (/** @type {any} */ node) => {
  const morceaux = /** @type {string[]} */ ([]);
  const parcourir = (/** @type {any} */ enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    const enfants = enfant?.props?.children;
    if (Array.isArray(enfants)) enfants.forEach(parcourir);
    else parcourir(enfants);
  };
  parcourir(node);
  return morceaux.join(' ').replace(/\s+/g, ' ').trim();
};

const textesVisibles = (/** @type {any} */ racine) => racine
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => texteDe(noeud))
  .filter(Boolean);

const contient = (
  /** @type {any} */ racine,
  /** @type {string} */ extrait,
) => textesVisibles(racine).join(' | ').includes(extrait);

const parTestID = (
  /** @type {any} */ racine,
  /** @type {string} */ id,
) => racine.findAll((/** @type {any} */ noeud) => noeud.props?.testID === id, { deep: false });

const boutonAvecTitre = (
  /** @type {any} */ racine,
  /** @type {string} */ titre,
) => racine
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'button'
    && texteDe(noeud).includes(titre));

// AVIS (09/09) - EventDetails lit desormais les avis d entrainement. Sans ce
// double, l import tire `@/services/client`, qui JETTE sans `.env` et fait
// tomber la suite ENTIERE avant le premier temoin.
jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetTrainingReviews: () => ({ data: null }),
}));

const FERMETURE = {
  collectivite: { documentId: 'ville-1', name: 'Ville de Montrivage' },
  documentId: 'f1',
  endDate: '2026-10-02',
  endTime: null,
  facility: { documentId: 'gym-1', name: 'Gymnase des Tilleuls' },
  kind: 'closure',
  label: null,
  message: 'Réfection du sol',
  reason: 'travaux',
  startDate: '2026-10-02',
  startTime: null,
  status: 'active',
};
const touchee = () => buildEvent({ facility: { documentId: 'gym-1', name: 'Gymnase des Tilleuls' }, facilityClosure: FERMETURE });

describe('COLL-C4B · le bandeau de la seance touchee par une fermeture', () => {
  test('le club organisateur lit le bandeau : ce qui se passe, pourquoi, le mot de la Ville', () => {
    const racine = monter({ auth: ORGANISATEUR(), event: touchee() });
    expect(parTestID(racine, 'bandeau-fermeture')).toHaveLength(1);
    expect(contient(racine, 'L’installation est fermée ce jour-là')).toBe(true);
    expect(contient(racine, 'Travaux. Mot de la Ville : « Réfection du sol ».')).toBe(true);
    expect(contient(racine, 'Les joueurs ne sont prévenus que si le club déplace ou annule.')).toBe(true);
  });

  test('« Changer l heure ou le lieu » ouvre la modification de la seance', () => {
    const racine = monter({ auth: ORGANISATEUR(), event: touchee() });
    const bouton = boutonAvecTitre(racine, 'Changer l’heure ou le lieu');
    expect(bouton).toBeTruthy();
    act(() => { bouton.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('EventStack', { params: { eventId: 'event-1' }, screen: 'EventEdit' });
  });

  test('« Annuler l entrainement » ouvre l annulation de la fiche (la confirmation d aujourd hui)', () => {
    const { Alert } = jest.requireActual('react-native');
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const racine = monter({ auth: ORGANISATEUR(), event: touchee() });
    const bouton = boutonAvecTitre(racine, 'Annuler l’entraînement');
    expect(bouton).toBeTruthy();
    act(() => { bouton.props.onPress(); });
    expect(alerte).toHaveBeenCalledTimes(1);
    alerte.mockRestore();
  });

  // CRFERM (13/10) — décision d'Adel « D8 B » (12/10), planche P8v4-fermee-tel état 3 : TOUS les
  // membres voient la fermeture. Le joueur lit le bandeau SANS les deux gestes (c'est toujours au
  // club de déplacer ou d'annuler, D16) et sans le mot de la Ville, avec la phrase qui lui dit ce
  // qui va se passer. (Avant : « un joueur ne lit pas le bandeau ».) ROUGE avant le lot.
  test('CRFERM-5/6 un joueur lit le bandeau SANS gestes ni mot de la Ville, avec ce qui va se passer', () => {
    const racine = monter({ auth: SPECTATEUR(), event: touchee() });
    expect(parTestID(racine, 'bandeau-fermeture')).toHaveLength(1);
    expect(contient(racine, 'L’installation est fermée ce jour-là')).toBe(true);
    expect(contient(racine, 'Travaux. Ton club peut déplacer ou annuler la séance : tu seras prévenu·e.')).toBe(true);
    expect(contient(racine, 'Réfection du sol')).toBe(false);
    expect(boutonAvecTitre(racine, 'Changer l’heure ou le lieu')).toBeUndefined();
    expect(boutonAvecTitre(racine, 'Annuler l’entraînement')).toBeUndefined();
  });

  test('sans fermeture, aucun bandeau', () => {
    const racine = monter({ auth: ORGANISATEUR(), event: buildEvent() });
    expect(parTestID(racine, 'bandeau-fermeture')).toHaveLength(0);
    expect(contient(racine, 'L’installation est fermée')).toBe(false);
  });

  // FINITIONS11-COLL (03/10), planche 25 (« P4v3-fermer-tel » ecran 5) : la fiche lit le TYPE de
  // l installation (`facility.type`, peuple par findOne) ; ROUGE avant le lot.
  test('FIN11-COLL/1 le type de l installation nomme le lieu : « Le gymnase est fermé ce jour-là »', () => {
    const racine = monter({
      auth: ORGANISATEUR(),
      event: buildEvent({
        facility: { documentId: 'gym-1', name: 'Gymnase des Tilleuls', type: 'Gymnase' },
        facilityClosure: FERMETURE,
      }),
    });
    expect(contient(racine, 'Le gymnase est fermé ce jour-là')).toBe(true);
    expect(contient(racine, 'L’installation est fermée')).toBe(false);
  });
});

// 🎨 FINITIONS13-COLL (04/10) — point 8 : une séance EN ATTENTE dit qui décide (tournée T13, C2_1a :
// la séance d'une série demandée à la Ville ne disait rien). Le serveur le dit (`pendingDecider`).
// ROUGE avant le lot.
describe('FINITIONS13-COLL point 8 — la séance en attente dit qui décide', () => {
  const enAttente = (pendingDecider) => buildEvent({
    facility: { documentId: 'gym-1', name: 'Gymnase des Tilleuls' },
    pendingDecider,
    pendingReason: pendingDecider === 'dirigeant' ? 'club_slot_overflow' : 'facility_overbooking',
    status: 'pending_validation',
  });

  test('la mairie décidera : « En attente de la mairie »', () => {
    const racine = monter({ auth: ORGANISATEUR(), event: enAttente('mairie') });
    expect(parTestID(racine, 'event-attente-decision')).toHaveLength(1);
    expect(contient(racine, 'En attente de la mairie')).toBe(true);
  });

  test('le créneau du club est complet : « En attente de ton dirigeant »', () => {
    const racine = monter({ auth: ORGANISATEUR(), event: enAttente('dirigeant') });
    expect(contient(racine, 'En attente de ton dirigeant')).toBe(true);
  });

  test('une séance qui n’attend pas : rien', () => {
    const racine = monter({ auth: ORGANISATEUR(), event: buildEvent() });
    expect(parTestID(racine, 'event-attente-decision')).toHaveLength(0);
  });
});
