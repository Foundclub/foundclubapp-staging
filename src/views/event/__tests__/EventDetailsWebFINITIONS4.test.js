import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// FINITIONS4 (recette emulateur, tournee 6, 29/09) — LE SITE SUIT LE TELEPHONE.
//
// `EventDetails.web.js` est une reecriture DOM de la fiche : aucune porte ne la
// compare au telephone. Les regles corrigees sur le telephone le sont donc ici
// aussi, et verifiees sur le CONTENU RENDU :
//   · D6 — un evenement ou l on ne repond pas (ou termine) ne dit plus « Sans
//     réponse » mais « Pas renseigné », sans groupes Present / Absent vides ;
//   · D7 — sans la charge d appel, la carte « Faire l appel » n invente pas
//     d heure d ouverture.
// Harnais repris tel quel de `EventDetailsWebNextActionCard.test.js` (P9).
// ==========================================================================

const mockNavigate = jest.fn();
const mockUseAuth = jest.fn();
const mockEventQuery = { data: null };
const mockConvocationQuery = { data: null };
const mockAttendanceQuery = { data: null };
const mockMatchStatsQuery = { data: null };

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

// Le theme est monte avec les VRAIS modules : un mock en Proxy rend les echecs
// Jest illisibles (piege paye au lot paywall).
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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

const emptyQuery = () => ({
  data: null,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
});

// 🧭 `useGetEventAttendance` REJOINT CETTE FABRIQUE : c est la charge qui porte
// la fenetre d appel, l horloge du serveur et le nombre d attendus. Sans elle,
// la carte n aurait aucune raison de savoir quoi dire.
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

// 🧨 CE MODULE N EST JAMAIS CHARGE POUR DE VRAI, et c est deliberé : il tire
// `matchStatsService`, donc le client HTTP, donc un `.env` que git ignore et
// qu aucune copie de travail ne possede. Un seul import reel de service fait
// tomber la SUITE ENTIERE — zero test execute, et le compteur « Tests: »
// n en dit rien.
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => ({
    data: mockMatchStatsQuery.data,
    isFetching: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  // ST-VUES3-ORDI — « Relancer les N » de la carte « Après le match », sur le site.
  useRemindEventMatchResponses: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

// ST-RETOURS2 · point 1 — la fiche du site lit les avis d entrainement : doublure, comme
// les autres services (le client HTTP refuse de se charger sans `.env`).
jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetMyTrainingReview: () => ({ data: undefined }),
  useGetTrainingReviews: () => ({ data: undefined }),
}));

jest.mock('@/services/event/eventService', () => ({ updateEvent: jest.fn() }));

jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: jest.fn(),
  deleteEventParticipation: jest.fn(),
}));

jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  createCustomTournamentTeam: jest.fn(),
  registerClubTeamToTournament: jest.fn(),
  reviewTournamentTeamRegistration: jest.fn(),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

jest.mock('@/platform/share', () => ({ share: jest.fn() }));

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

// Une fabrique jest.mock est remontee en tete de fichier : elle ne peut donc pas
// s'appuyer sur un import ESM, evalue trop tard.
/* eslint-disable global-require */
jest.mock(
  '../components/EventTasksSection',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTasksSection'),
);
jest.mock(
  '../components/EventTeamAudiencesSection',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTeamAudiencesSection'),
);
/* eslint-enable global-require */

// ⛔ NI `EventNextActionCard` NI `react-i18next` NE SONT DOUBLES, et c est le
// coeur du temoin : on veut les VRAIS libelles francais de `fr.js`. L instance
// i18n s initialise toute seule ici, par la chaine d imports de l ecran
// (`@/domains/event/eventUseCases` importe `@/theme/strings`).

// eslint-disable-next-line import/first
import EventDetailsWeb from '../EventDetails.web';

// Le premier montage transpile tout le graphe d'imports de l'ecran : au-dela des
// 5 s par defaut de Jest sur un poste froid, sans que rien ne soit casse.
jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const USER_ID = 'user-1';

/** L entraineur qui organise : il est DANS l equipe, donc le gate le laisse passer. */
const COACH = { documentId: USER_ID, firstname: 'Ada', lastname: 'Coach' };

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T17:00:00.000Z',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Entrainement du mardi',
  participations: [],
  startTime: '18:00',
  team: {
    club: { documentId: CLUB_ID },
    documentId: TEAM_ID,
    name: 'U15',
    players: [],
    trainers: [COACH],
  },
  type: { name: 'Entrainement' },
  ...overrides,
});

/**
 * La charge d appel telle que le serveur la rend : une fenetre, une horloge, des lignes.
 * @param {object} [input] - Les bornes voulues.
 * @param {string} [input.closesAt] - Fermeture de la fenetre, en ISO.
 * @param {number} [input.itemCount] - Combien de lignes d appel.
 * @param {string} [input.opensAt] - Ouverture de la fenetre, en ISO.
 * @param {string} [input.serverNow] - L instant du SERVEUR, en ISO.
 * @returns {any} - La charge, dans son enveloppe `data`.
 */
const buildAttendance = ({
  closesAt = '2099-01-01T21:00:00.000Z',
  itemCount = 22,
  opensAt = '2099-01-01T16:30:00.000Z',
  serverNow = '2099-01-01T17:05:00.000Z',
} = {}) => ({
  data: {
    items: Array.from({ length: itemCount }, (_, index) => ({
      user: { documentId: `joueur-${index}` },
    })),
    serverNow,
    timezone: 'Europe/Paris',
    window: { closesAt, enabled: true, opensAt },
  },
});

/** @type {any} */
let mounted = null;

const mountScreen = (
  /** @type {any} */ {
    attendance = null, auth, event, matchStats = null,
  } = {},
) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockAttendanceQuery.data = attendance;
  mockMatchStatsQuery.data = matchStats;
  mockUseAuth.mockReturnValue(auth || {
    canEditClub: () => true,
    canEditEvent: () => true,
    canManageEvent: () => true,
    freeUsageSummary: null,
    subscriptionAccessLevel: 'FREE',
    userData: { ...COACH, role: { name: 'Dirigeant' } },
  });

  act(() => {
    mounted = renderer.create(
      <EventDetailsWeb
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

/**
 * Les elements qui portent ce `testID`, ou un tableau vide.
 * @param {any} root - La racine du rendu.
 * @param {string} testID - L etiquette cherchee.
 * @returns {any[]} - Les elements trouves.
 */
const parTestID = (/** @type {any} */ root, /** @type {string} */ testID) => root
  .findAllByProps({ testID });

/**
 * Le bouton VIVANT de la carte : le `TouchableOpacity` du vrai atome `Button`.
 * @param {any} root - La racine du rendu.
 * @param {string} testID - L etiquette du conteneur du bouton.
 * @returns {any} - Le bouton.
 */
const boutonDe = (/** @type {any} */ root, /** @type {string} */ testID) => {
  const conteneur = parTestID(root, testID)[0];
  if (!conteneur) throw new Error(`Aucun element ne porte le testID ${testID}`);
  return conteneur.findAllByType(TouchableOpacity)[0];
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEventQuery.data = null;
  mockConvocationQuery.data = null;
  mockAttendanceQuery.data = null;
  mockMatchStatsQuery.data = null;
});

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
    mounted = null;
  }
});

const PAUL = { documentId: 'joueur-paul', firstname: 'Paul', lastname: 'Vidal' };

/**
 * Les groupes de la liste des participants du site, par leur `data-testid`.
 * @param {any} root - La racine du rendu.
 * @param {string} statut - `participating`, `missing` ou `notAnswered`.
 * @returns {any[]} - Les groupes trouves (hotes DOM seulement).
 */
const groupes = (/** @type {any} */ root, /** @type {string} */ statut) => root
  .findAll((/** @type {any} */ noeud) => typeof noeud.type === 'string'
    && noeud.props['data-testid'] === `PARTWEB-groupe-${statut}`);

/**
 * Un entrainement de l equipe U15 ou Paul est joueur.
 * @param {object} [options] - Les champs a surcharger.
 * @returns {any} - L evenement.
 */
const entrainementAvecPaul = (/** @type {any} */ options = {}) => {
  const base = buildEvent();
  return buildEvent({ ...options, team: { ...base.team, players: [PAUL] } });
};

describe('FINITIONS4 D6 — la liste du site suit la regle du telephone', () => {
  test('🚨 reponses decochees : « Pas renseigné », et pas de groupes Present / Absent vides', () => {
    const root = mountScreen({
      attendance: buildAttendance(),
      event: entrainementAvecPaul({ rsvpEnabled: false }),
    });

    expect(groupes(root, 'participating')).toHaveLength(0);
    expect(groupes(root, 'missing')).toHaveLength(0);
    const sansReponse = groupes(root, 'notAnswered')[0];
    expect(sansReponse).toBeDefined();
    expect(textOf(sansReponse)).toContain('Pas renseigné · 1');
    expect(textOf(sansReponse)).not.toContain('Sans réponse');
  });

  test('reponses ouvertes, evenement a venir : « Sans réponse » et 3 groupes, comme avant', () => {
    const root = mountScreen({
      attendance: buildAttendance(),
      event: entrainementAvecPaul(),
    });

    expect(groupes(root, 'participating')).toHaveLength(1);
    expect(groupes(root, 'missing')).toHaveLength(1);
    expect(textOf(groupes(root, 'notAnswered')[0])).toContain('Sans réponse · 1');
  });
});

describe('FINITIONS4 D7 — sans la charge d appel, la carte du site n invente pas d heure', () => {
  test('🚨 charge d appel absente : la carte est la, fermee, sans « Ouvre à »', () => {
    const root = mountScreen({ attendance: null });

    expect(parTestID(root, 'event-next-action')[0]).toBeDefined();
    const bouton = boutonDe(root, 'event-next-action-button');
    expect(textOf(bouton)).not.toContain('Ouvre à');
    expect(textOf(bouton)).not.toContain('Pas encore ouvert');
    expect(bouton.props.disabled).toBe(true);
  });

  test('l heure revient des que le serveur l a dite', () => {
    const root = mountScreen({
      attendance: buildAttendance({ serverNow: '2099-01-01T15:00:00.000Z' }),
    });

    expect(textOf(boutonDe(root, 'event-next-action-button'))).toContain('Ouvre à 17:30');
  });
});
