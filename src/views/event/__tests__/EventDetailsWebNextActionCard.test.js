import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// P9 « BUREAU 1180 » — LE SITE RATTRAPE LE TELEPHONE, ECRAN PAR ECRAN.
//
// 🧱 CE QUE CE FICHIER VERROUILLE : `EventDetails.web.js` est une reecriture
// DOM independante de `EventDetails.js`. Aucune porte de `app` ne compare les
// deux, donc un manque cote site vit indefiniment, en silence — c est la 5e
// fois que ce motif coute un correctif (D08, D22, D40, D48, puis P9).
//
// Les deux ECRANS de ce lot, dans l ordre :
//   · ECRAN 1 — la carte « Faire l appel » (N5) sur l Apercu du site ;
//   · ECRAN 2 — la carte-parcours « APRES LE MATCH » (N4).
//
// ⛔ CE QUI SE MESURE ICI EST LE CONTENU RENDU, jamais « ca monte » : un
// composant natif servi par react-native-web peut compiler et dessiner du
// VIDE. Chaque temoin lit donc un TEXTE et/ou une NAVIGATION.
//
// 🚦 CE QUI N EST VOLONTAIREMENT PAS TESTE, ET POURQUOI : « un organisateur
// HORS de son equipe ne voit pas la carte ». C est vrai a 1c938d5
// (`resolveEventAttendanceGate` demande `isTeamMember || isCurrentUser
// Participating`), mais le lot P6 elargit precisement ce garde-corps en
// parallele. Un temoin sur ce cas serait ROUGE a la recolte de P6 alors que
// rien ne serait casse. On IMPORTE le gate, on ne le JUGE pas.
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

/**
 * Les parametres du dernier envoi vers cette route.
 * @param {string} route - Le nom de la route cherchee.
 * @returns {any} - Les parametres, ou null si la route n a jamais ete empruntee.
 */
const dernierEnvoiVers = (/** @type {string} */ route) => {
  const call = [...mockNavigate.mock.calls].reverse()
    .find((/** @type {any} */ entry) => entry[0] === route);
  return call ? call[1] : null;
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

describe('P9 · ecran 1 — la carte « Faire l appel » sur l Apercu du site', () => {
  test('fenetre ouverte : la carte est la, avec son titre et le nombre d attendus', () => {
    const root = mountScreen({ attendance: buildAttendance() });

    const carte = parTestID(root, 'event-next-action')[0];
    expect(carte).toBeDefined();

    const texte = textOf(carte);
    expect(texte).toContain('Faire l’appel');
    expect(texte).toContain('22 attendus');
    expect(texte).toContain('appel devient disponible 30 minutes avant le début');
  });

  test('fenetre ouverte : le clic mene a l ecran d appel, avec le bon evenement', () => {
    const root = mountScreen({ attendance: buildAttendance() });

    const bouton = boutonDe(root, 'event-next-action-button');
    expect(textOf(bouton)).toContain('Faire l’appel');
    expect(bouton.props.disabled).toBe(false);

    act(() => {
      bouton.props.onPress();
    });

    expect(dernierEnvoiVers('EventAttendanceCall')).toEqual(
      expect.objectContaining({ eventId: 'event-1' }),
    );
  });

  test('avant l ouverture : la carte annonce l heure, la porte reste fermee', () => {
    const root = mountScreen({
      attendance: buildAttendance({ serverNow: '2099-01-01T15:00:00.000Z' }),
    });

    const carte = parTestID(root, 'event-next-action')[0];
    expect(carte).toBeDefined();

    // ⚠️ LE LIBELLE SE LIT SUR LE BOUTON, PAS SUR LA CARTE : l atome `Button`
    // fabrique son texte lui-meme, donc il n apparait pas dans les enfants
    // ECRITS de la carte. Mesurer la carte ici rendrait le temoin vert sur un
    // bouton muet.
    const bouton = boutonDe(root, 'event-next-action-button');
    // 16:30 UTC lu dans le fuseau DU CLUB, jamais celui de la machine de test.
    expect(textOf(bouton)).toContain('Ouvre à 17:30');
    expect(bouton.props.disabled).toBe(true);
    act(() => {
      bouton.props.onPress?.();
    });
    expect(dernierEnvoiVers('EventAttendanceCall')).toBeNull();
  });

  test('un visiteur sans compte ne voit RIEN de la carte (AD02)', () => {
    const root = mountScreen({
      attendance: buildAttendance(),
      auth: { canManageEvent: () => false, userData: null },
    });

    expect(parTestID(root, 'event-next-action')).toHaveLength(0);
  });

  test('un tournoi n a pas de carte d appel, comme sur le telephone', () => {
    const root = mountScreen({
      attendance: buildAttendance(),
      event: buildEvent({ type: { name: 'Tournoi' } }),
    });

    expect(parTestID(root, 'event-next-action')).toHaveLength(0);
  });
});

// ==========================================================================
// P9 · ECRAN 2 — LA CARTE-PARCOURS « APRES LE MATCH » (N4), SUR LE SITE.
// ==========================================================================

/**
 * Un match, avec sa fin DECLAREE : c est elle qui dit si l apres-match est ouvert.
 * @param {any} [overrides] - Les surcharges voulues.
 * @returns {any} - L evenement.
 */
const buildMatchEvent = (/** @type {any} */ overrides = {}) => buildEvent({
  endDate: '2099-01-01T19:00:00.000Z',
  name: 'Match vs Lyon',
  type: { name: 'Match' },
  ...overrides,
});

/**
 * La charge « stats du match » telle que le serveur la rend.
 * @param {any} [overrides] - Les surcharges voulues.
 * @returns {any} - La charge.
 */
const buildMatchStats = (/** @type {any} */ overrides = {}) => ({
  permissions: { canManage: true, canView: true },
  playerCollectiveRating: { average: 7, count: 4, eligibleCount: 12 },
  report: {
    needsReview: false,
    responseCompletionCount: 4,
    responseEligibleCount: 12,
    status: 'draft',
  },
  score: {
    available: true,
    scoreAgainst: 1,
    scoreFor: 3,
    source: 'manual',
    waitingOfficial: false,
  },
  sport: 'football',
  team: { name: 'U15' },
  ...overrides,
});

/** Apres le coup de sifflet final : l horloge serveur a depasse la fin declaree. */
const APRES_LE_MATCH = { serverNow: '2099-01-01T20:00:00.000Z' };

/** Avant la fin : le match court encore. */
const PENDANT_LE_MATCH = { serverNow: '2099-01-01T18:00:00.000Z' };

describe('P9 · ecran 2 — la carte « APRES LE MATCH » sur l Apercu du site', () => {
  test('un match avec compo : la carte est la, et elle NOMME ses trois etapes', () => {
    const root = mountScreen({
      attendance: buildAttendance(APRES_LE_MATCH),
      event: buildMatchEvent(),
      matchStats: buildMatchStats(),
    });

    const carte = parTestID(root, 'post-match-journey')[0];
    expect(carte).toBeDefined();

    const texte = textOf(carte);
    expect(texte).toContain('APRÈS LE MATCH');
    expect(texte).toContain('Score');
    expect(texte).toContain('Statistiques de l’équipe');
    expect(texte).toContain('Retours des joueurs');
    // Le score enregistre se lit avec son origine, comme sur le telephone.
    expect(texte).toContain('3 - 1');
    expect(texte).toContain('saisi à la main');
    expect(texte).toContain('4 sur 12 ont répondu');
  });

  test('match fini, score enregistre : le clic mene a l editeur de stats', () => {
    const root = mountScreen({
      attendance: buildAttendance(APRES_LE_MATCH),
      event: buildMatchEvent(),
      matchStats: buildMatchStats(),
    });

    const bouton = boutonDe(root, 'post-match-action');
    expect(bouton.props.disabled).toBe(false);

    act(() => {
      bouton.props.onPress();
    });

    expect(dernierEnvoiVers('MatchStatsEditor')).toEqual(
      expect.objectContaining({ eventId: 'event-1', sourceType: 'event', teamId: TEAM_ID }),
    );
  });

  test('AVANT la fin du match : la carte est deja la, porte fermee, et elle dit pourquoi', () => {
    const root = mountScreen({
      attendance: buildAttendance(PENDANT_LE_MATCH),
      event: buildMatchEvent(),
      matchStats: buildMatchStats(),
    });

    // 🧭 VOLONTAIRE, et repris du telephone : la carte apparait AVANT la fin du
    // match. Elle sert a montrer ce qui vient, pas seulement ce qui est du.
    const carte = parTestID(root, 'post-match-journey')[0];
    expect(carte).toBeDefined();
    expect(textOf(carte)).toContain('Les stats seront disponibles à la fin du match.');

    const bouton = boutonDe(root, 'post-match-action');
    expect(bouton.props.disabled).toBe(true);
    act(() => {
      bouton.props.onPress?.();
    });
    expect(dernierEnvoiVers('MatchStatsEditor')).toBeNull();
  });

  test('etape « Score » : sans destination sur le site, la porte se ferme et le DIT', () => {
    const root = mountScreen({
      attendance: buildAttendance(APRES_LE_MATCH),
      event: buildMatchEvent(),
      matchStats: buildMatchStats({
        score: { available: false, source: '', waitingOfficial: false },
      }),
    });

    const carte = parTestID(root, 'post-match-journey')[0];
    expect(carte).toBeDefined();
    // Le parcours designe bien l etape 1, et la carte le dit en toutes lettres.
    expect(textOf(carte)).toContain('Étape 1 sur 3');
    expect(textOf(carte)).toContain('À enregistrer');
    // ⛔ LE POINT DU TEMOIN : le telephone ouvre ici une feuille que ce fichier
    // n a pas. Un bouton qui ne ferait RIEN serait un menteur ; il se ferme.
    expect(textOf(carte)).toContain('Le score s’enregistre depuis l’application mobile.');

    const bouton = boutonDe(root, 'post-match-action');
    expect(bouton.props.disabled).toBe(true);
    act(() => {
      bouton.props.onPress?.();
    });
    expect(dernierEnvoiVers('MatchStatsEditor')).toBeNull();
  });

  test('un visiteur sans compte ne voit RIEN de la carte (AD02)', () => {
    const root = mountScreen({
      attendance: buildAttendance(APRES_LE_MATCH),
      auth: { canManageEvent: () => false, userData: null },
      event: buildMatchEvent(),
      matchStats: buildMatchStats({ permissions: { canManage: false, canView: false } }),
    });

    expect(parTestID(root, 'post-match-journey')).toHaveLength(0);
  });

  test('sans le droit de lire les stats, pas de carte non plus', () => {
    const root = mountScreen({
      attendance: buildAttendance(APRES_LE_MATCH),
      auth: {
        canManageEvent: () => false,
        userData: { documentId: 'quelqu-un-dautre', role: { name: 'Joueur' } },
      },
      event: buildMatchEvent(),
      matchStats: buildMatchStats({ permissions: { canManage: false, canView: false } }),
    });

    expect(parTestID(root, 'post-match-journey')).toHaveLength(0);
  });

  test('un entrainement n a pas de carte d apres-match', () => {
    const root = mountScreen({
      attendance: buildAttendance(APRES_LE_MATCH),
      matchStats: buildMatchStats(),
    });

    expect(parTestID(root, 'post-match-journey')).toHaveLength(0);
  });
});
