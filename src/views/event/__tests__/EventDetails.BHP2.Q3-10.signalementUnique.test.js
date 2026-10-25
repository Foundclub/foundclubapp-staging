import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// Lot N1 — LES QUATRE PETITS BLOCS QUI SE TAISENT OU QUI TROMPENT.
//
// Constat du pack « detail evenement » (regle 5 : aucun bloc muet, aucun bouton
// muet). Quatre endroits de cette page ne disent pas ce qu'ils savent :
//
//   (a) une DETECTION sans poste n'affiche RIEN — l'organisateur ne sait pas si
//       c'est normal. Le branchement se temoigne ici ; l'etat vide lui-meme vit
//       dans le composant et se temoigne dans `EventDetectionSlotsN1.test.js`.
//   (b) « Accueille N joueurs de l'exterieur » n'existe que pour l'ORGANISATEUR.
//       Le joueur qui regarde un entrainement ouvert ne voit pas qu'il est
//       ouvert — c'est pourtant l'information qui le concerne.
//   (c) un evenement « Autre » a une capacite en base (`event.capacity`) que la
//       pastille de type n'affiche jamais.
//   (d) deux boutons desactives portent deja leur motif DANS leur titre. Rien a
//       corriger : on FIGE cette garantie avant que quelqu'un ne l'efface.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest n'a pas de moteur de mise en page. Il
// lit ce qui est MONTE et ce qui ne l'est pas. Le rendu reel se voit a la
// recette.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockEventQuery = { data: null };

// Le `t` du mock rend le REPLI, INTERPOLE : c'est exactement ce que
// l'utilisateur voit tant que la clef n'existe pas dans fr.js. Sans
// l'interpolation, « Accueille {{count}} joueur·se·s » resterait litteral et le
// temoin de la ligne publique ne mesurerait aucun chiffre.
// Il note au passage les clefs demandees — sans ce releve, une clef mal
// orthographiee resterait invisible pour toujours.
// 🧨 R9 — CE MOCK N EST PAS DECORATIF. `teamMembershipRequestService`
// importe `@/services/client`, qui JETTE AU CHARGEMENT quand `.env` est absent
// — et `.env` est gitignore, donc absent de toute copie de travail. Sans cette
// doublure, la SUITE ENTIERE tombe a 0 test execute des que l ecran importe le
// service (piege documente, deja paye plusieurs fois).
// 👪 PAR-L11b (13/10) — le bloc « Inscrire mes enfants » charge ses propres services : double ici,
// comme chaque service de l ecran (EventDetails.js:123-128).

// Q3-10 (BUGHUNT P2, 25/10) — SIGNALER UN ÉVÉNEMENT SUR TÉLÉPHONE : la feuille ne recevait pas
// `isLoading` et restait ouverte après l'envoi ; chaque nouvel appui créait un signalement de plus.
// Banc repris de EventDetailsN1PetitsBlocs.test.js (montage, doublures), feuille enregistrée.

/** @type {{ props: any }} */
const mockFeuille = { props: null };
const mockReport = { isPending: false, mutate: jest.fn() };

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
      reportEventMutation: mockReport,
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

// 🪢 LA DOUBLURE BRANCHEE DES POSTES DE DETECTION — motif d'`AD10ExportFeuille
// Branchee`. Elle ne rend pas son nom : elle rend CE QUE L'ECRAN LUI DONNE.
// C'est le seul moyen de temoigner, depuis l'ecran, que le bloc est monte pour
// une detection SANS poste et qu'il recoit bien le drapeau `isDetection`.
jest.mock('../components/EventDetectionSlots', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function EventDetectionSlotsDouble(/** @type {any} */ props) {
    const drapeau = String(Boolean(props.isDetection));
    const nombre = String((props.slots || []).length);
    return react.createElement(
      rn.View,
      { testID: 'doublure-postes-detection' },
      react.createElement(rn.Text, null, `isDetection=${drapeau} postes=${nombre}`),
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
// Q3-10 — la doublure garde les props que la fiche donne à la feuille de signalement.
jest.mock(
  '@/components/organisms/reportEventModal/ReportEventModal',
  () => function ReportEventModalDouble(/** @type {any} */ props) {
    mockFeuille.props = props;
    return null;
  },
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

// Trois personnes qui ne sont PAS de l'equipe : c'est ce qui en fait des
// « participants externes » au sens de l'ecran (l. 1878).
const EXT_UN = 'externe-1';
const EXT_DEUX = 'externe-2';
const EXT_TROIS = 'externe-3';

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

/**
 * Un entrainement ouvert, avec 2 places prises et 1 demande en attente.
 * @param {any} overrides - Ce qui change d'un cas a l'autre.
 * @returns {any} L'evenement.
 */
const entrainementOuvert = (overrides = {}) => buildEvent({
  externalParticipantLimit: 8,
  externalParticipantValidationMode: 'manual',
  participationRequests: [{
    documentId: 'req-1',
    isActive: true,
    participationStatus: 'pending',
    user: { documentId: EXT_TROIS, firstname: 'Sam' },
  }],
  participations: [
    { documentId: EXT_UN, firstname: 'Ana' },
    { documentId: EXT_DEUX, firstname: 'Bilal' },
  ],
  sessionStatus: 'open',
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

// ⋯ N7 item 4 (vague P, 23/08) — la bascule « Ouvrir / Fermer l'entraînement »
// vit desormais dans la feuille du menu ⋯, qui s'ouvre depuis l'EN-TETE de
// navigation. On va la chercher la ou elle est (motif L4MenuTroisPoints).
const chercherDansElements = (
  /** @type {any} */ element,
  /** @type {(n: any) => boolean} */ predicat,
) => {
  if (!element || typeof element !== 'object') return null;
  if (Array.isArray(element)) {
    return element.reduce(
      (/** @type {any} */ trouve, /** @type {any} */ enfant) => (
        trouve || chercherDansElements(enfant, predicat)
      ),
      null,
    );
  }
  if (element.props && predicat(element)) return element;
  return chercherDansElements(element.props?.children, predicat);
};

const ouvrirLeMenu = () => {
  const appels = mockSetOptions.mock.calls.filter(
    (/** @type {any} */ appel) => appel[0]?.headerRight,
  );
  const entete = appels.length ? appels[appels.length - 1][0].headerRight() : null;
  const bouton = chercherDansElements(
    entete,
    (/** @type {any} */ noeud) => noeud?.props?.testID === 'event-actions-menu-button',
  );
  if (!bouton) throw new Error('Aucun bouton trois-points dans l en-tete de navigation');
  act(() => {
    bouton.props.onPress();
  });
};

const parTestID = (
  /** @type {any} */ racine,
  /** @type {string} */ id,
) => racine.findAll((/** @type {any} */ noeud) => noeud.props?.testID === id, { deep: false });

// AVIS (09/09) - EventDetails lit desormais les avis d entrainement. Sans ce
// double, l import tire `@/services/client`, qui JETTE sans `.env` et fait
// tomber la suite ENTIERE avant le premier temoin.
jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetTrainingReviews: () => ({ data: null }),
}));


const appuyerSurLeDrapeau = () => {
  const appels = mockSetOptions.mock.calls.filter((/** @type {any} */ appel) => appel[0]?.headerRight);
  const entete = appels[appels.length - 1][0].headerRight();
  const drapeau = chercherDansElements(entete, (/** @type {any} */ n) => n?.props?.icon === 'flag');
  act(() => { drapeau.props.onPress(); });
};

beforeEach(() => {
  mockFeuille.props = null;
  mockReport.isPending = false;
  mockReport.mutate.mockReset();
});

test('Q3-10 — envoyer le signalement ferme la feuille : un 2e appui n en crée pas un 2e', () => {
  monter({ auth: SPECTATEUR() });
  appuyerSurLeDrapeau();
  expect(mockFeuille.props.isVisible).toBe(true);

  act(() => { mockFeuille.props.onSubmit('spam'); });

  expect(mockReport.mutate).toHaveBeenCalledTimes(1);
  expect(mockReport.mutate).toHaveBeenCalledWith({ event: 'event-1', reason: 'spam' });
  expect(mockFeuille.props.isVisible).toBe(false);
});

test('Q3-10 — pendant l envoi, la feuille le sait (isLoading)', () => {
  mockReport.isPending = true;
  monter({ auth: SPECTATEUR() });

  expect(mockFeuille.props.isLoading).toBe(true);
});
