/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
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
// ST-VUES3-ORDI — la relance « Relancer les N » de la carte, observée.
const mockRelancer = jest.fn(() => Promise.resolve({ alreadyRemindedCount: 0, remindedCount: 2 }));

// 👪 PAR-L11b (13/10) — le bloc « Inscrire mes enfants » charge ses propres services : double ici,
// comme chaque service de l ecran (EventDetails.js:123-128).
// Le consentement de detection est couvert par EventDetailsWebVisiteurAD02.
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => () => null);

jest.mock('@/views/event/components/EventChildRegistration', () => ({
  __esModule: true,
  default: () => null,
  EventChildRegistrationsForOrganizer: () => null,
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
  useRemindEventMatchResponses: () => ({ isPending: false, mutateAsync: mockRelancer }),
}));

// ST-RETOURS2 · point 1 — la fiche du site lit les avis d entrainement : doublure, comme
// les autres services (le client HTTP refuse de se charger sans `.env`).
jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetMyTrainingReview: () => ({ data: undefined }),
  useGetTrainingReviews: () => ({ data: undefined }),
}));

// FINITIONS11 · point 1 — le drapeau « Signaler » du site tire le service de signalement :
// doublure, comme les autres services (le client HTTP refuse de se charger sans `.env`).
jest.mock('@/services/eventReport/eventReportService', () => ({ createEventReport: jest.fn() }));

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
    expect(texte).toContain('appel est ouvert dès la création de l’événement');
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
    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : la carte est PARTAGÉE avec le téléphone, ses
    // libellés suivent le design (« Après le match · étape 2 sur 3 », « Feuille de
    // match ») ; « saisi à la main » est retiré, sans auteur on lit le score seul.
    expect(texte).toContain('Après le match · étape 2 sur 3');
    expect(texte).toContain('Score');
    expect(texte).toContain('Feuille de match');
    expect(texte).toContain('Retours des joueurs');
    expect(texte).toContain('3 - 1');
    expect(texte).not.toContain('saisi à la main');
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
    // 🎯 ST-VUES3-ORDI (écran 7) — ADAPTÉ : le site sert la carte du TÉLÉPHONE (ST-MATCH,
    // écran 7) : avant la fin, plus de bouton éteint ni « Les stats seront disponibles à la
    // fin du match. » ; elle dit QUAND tout s'ouvre.
    expect(textOf(carte)).toContain('Tout s’ouvre à la fin du match');
    expect(textOf(carte)).not.toContain('Les stats seront disponibles à la fin du match.');
    expect(parTestID(root, 'post-match-action')).toHaveLength(0);
    expect(dernierEnvoiVers('MatchStatsEditor')).toBeNull();
  });

  test('etape « Score » : sur le site, elle ouvre la feuille de match, ou le score se saisit', () => {
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
    // 🎯 ST-MATCH (écran 7) — ADAPTÉ : l'étape dans le surtitre ; « À saisir ».
    expect(textOf(carte)).toContain('Après le match · étape 1 sur 3');
    expect(textOf(carte)).toContain('À saisir');
    // 🎯 ST-VUES3-ORDI (écrans 7 et 8) — ADAPTÉ : la porte est celle du TÉLÉPHONE
    // (`resolveMatchStatsDoor`). Elle n'est plus fermée sur « Le score s’enregistre depuis
    // l’application mobile. » : depuis ST-MATCH10, la feuille de match du site saisit aussi
    // le score (le serveur l'écrit avec la feuille tant qu'il n'en a pas).
    expect(textOf(carte)).not.toContain('Le score s’enregistre depuis l’application mobile.');

    const bouton = boutonDe(root, 'post-match-action');
    expect(bouton.props.disabled).toBe(false);
    act(() => {
      bouton.props.onPress();
    });
    expect(dernierEnvoiVers('MatchStatsEditor')).toEqual(
      expect.objectContaining({ eventId: 'event-1', sourceType: 'event', teamId: TEAM_ID }),
    );
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

// ==========================================================================
// POINTAGE (decisions d Adel du 29/09) — « SUIVRE LES ARRIVEES » DECOCHEE :
// pas de carte d appel sur le site non plus. Ecrit ROUGE contre app `8d017cd6`.
// ==========================================================================
describe('POINTAGE — la carte d appel suit l option « Suivre les arrivees »', () => {
  test('option decochee : pas de carte « Faire l appel »', () => {
    const root = mountScreen({
      attendance: buildAttendance(),
      event: buildEvent({ arrivalTrackingEnabled: false }),
    });

    expect(parTestID(root, 'event-next-action')).toHaveLength(0);
  });

  test('option cochee (ou evenement d avant le lot) : la carte est la, comme avant', () => {
    const root = mountScreen({
      attendance: buildAttendance(),
      event: buildEvent({ arrivalTrackingEnabled: null }),
    });

    expect(parTestID(root, 'event-next-action')[0]).toBeDefined();
  });
});

// ==========================================================================
// SECU-STATS (01/10) — SUR LE SITE NON PLUS, LA CARTE NE PROPOSE PLUS
// L EDITEUR DU COACH A UN JOUEUR.
//
// 🔒 Meme porte que le telephone : « un rapport publie se RELIT toujours, meme
// sans le droit de le gerer » ouvrait `MatchStatsEditor` — l avis du coach et
// l auto-evaluation de CHAQUE joueur — a tout membre de l equipe. La barriere
// est le serveur (corrige dans le meme lot) ; ceci retire la porte.
// ==========================================================================

describe('SECU-STATS — sur le site, la carte « APRES LE MATCH » ne propose plus l editeur du coach a un joueur', () => {
  const JOUEUR = { documentId: 'joueur-web', firstname: 'Lea', lastname: 'Joueuse' };

  /**
   * L ecran tel qu un JOUEUR de l equipe le voit, match fini, rapport publie.
   * @param {any} [rapport] - Les surcharges du rapport.
   * @returns {any} - Les options de `mountScreen`.
   */
  const vuDuJoueur = (rapport = {}) => ({
    attendance: buildAttendance(APRES_LE_MATCH),
    auth: {
      canEditClub: () => false,
      canEditEvent: () => false,
      canManageEvent: () => false,
      freeUsageSummary: null,
      subscriptionAccessLevel: 'FREE',
      userData: { ...JOUEUR, role: { name: 'Joueur' } },
    },
    event: buildMatchEvent({
      team: {
        club: { documentId: CLUB_ID },
        documentId: TEAM_ID,
        name: 'U15',
        players: [JOUEUR],
        trainers: [COACH],
      },
    }),
    matchStats: buildMatchStats({
      permissions: { canManage: false, canView: true },
      report: {
        needsReview: false,
        responseCompletionCount: 4,
        responseEligibleCount: 12,
        status: 'final',
        ...rapport,
      },
    }),
  });

  test.each([
    ['rapport publie', {}],
    ['rapport a re-verifier apres un score officiel', { needsReview: true }],
  ])('🔒 %s : pour un JOUEUR, aucune porte vers l editeur', (_cas, rapport) => {
    const root = mountScreen(vuDuJoueur(rapport));

    // 🎯 ST-VUES3-ORDI (écran 7) — ADAPTÉ : comme au téléphone (ST-MATCH, « le joueur n a
    // plus AUCUNE porte vers l éditeur »), le joueur lit « Le bilan de … » : ni la carte de
    // l'encadrement, ni aucun bouton qui mène à l'éditeur.
    expect(parTestID(root, 'post-match-journey')).toHaveLength(0);
    expect(parTestID(root, 'post-match-action')).toHaveLength(0);
    expect(parTestID(root, 'st-match-bilan-publie')[0]).toBeDefined();
    expect(dernierEnvoiVers('MatchStatsEditor')).toBeNull();
  });

  test('🔒 le joueur lit que la feuille est publiée, jamais « Rapport finalise »', () => {
    const root = mountScreen(vuDuJoueur({ finalizedAt: '2099-01-01T21:39:00.000Z' }));

    // 🎯 ST-VUES3-ORDI — ADAPTÉ : « Feuille publiée » devient « Le bilan de Ada · Publié le … ».
    const bilan = parTestID(root, 'st-match-bilan-publie')[0];
    expect(textOf(bilan)).toContain('Le bilan de Ada');
    expect(textOf(bilan)).toContain('Publié le');
    expect(textOf(bilan)).not.toContain('Rapport finalise');
  });

  test('PROTEGE : le COACH, rapport publie, ouvre toujours l editeur', () => {
    const root = mountScreen({
      attendance: buildAttendance(APRES_LE_MATCH),
      event: buildMatchEvent(),
      matchStats: buildMatchStats({
        report: {
          needsReview: false,
          responseCompletionCount: 4,
          responseEligibleCount: 12,
          status: 'final',
        },
      }),
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
});

// ==========================================================================
// ST-VUES3-ORDI (03/10) — LA PAGE DU MATCH SUR ORDINATEUR (planche P3-match-ordi) : écrans
// 1, 7 et 8 du design des statistiques, sur le site.
//   · point 2 — la ligne d'infos sous le titre : « U15 · jeu. 1 janv. · 18:00 » ;
//   · point 3 — l'encart du score du téléphone, ses états, l'auteur, les buteurs ;
//   · point 4 — la carte « Après le match » du téléphone, À DROITE, avec « Relancer les N » ;
//   · point 5 — « Gérer l'événement » : Modifier, Convocation, « Stats du match » et sa note.
// Avant ce lot, le site n'avait rien de tout cela (titre, date longue, ancienne carte à
// gauche, un seul bouton « Modifier »).
// ==========================================================================

describe('ST-VUES3-ORDI — la page du match sur ordinateur', () => {
  // Les boutons DOM (pas les boutons natifs) dont le texte contient ce libellé.
  const boutonsDOM = (/** @type {any} */ root, /** @type {string} */ libelle) => root
    .findAll((/** @type {any} */ n) => n.type === 'button' && textOf(n).includes(libelle));
  // Le texte RENDU (les composants natifs servis par react-native-web compris), pas celui du JSX.
  const texteRendu = (/** @type {any} */ noeud) => (noeud?.children || [])
    .map((/** @type {any} */ enfant) => (typeof enfant === 'string' ? enfant : texteRendu(enfant)))
    .join(' ').replace(/\s+/g, ' ').trim();
  const parSection = (/** @type {any} */ root, /** @type {string} */ nom) => root
    .findAll((/** @type {any} */ n) => n.props?.['data-event-section'] === nom);

  const FEUILLE_PUBLIEE = buildMatchStats({
    playerResponses: [
      { label: 'Hugo L.', status: 'submitted' },
      { label: 'Léa M.', status: 'pending' },
      { label: 'Max P.', status: 'pending' },
    ],
    report: {
      collectiveComment: 'Bon bloc en première mi-temps.',
      collectiveRating: 8,
      finalizedAt: '2099-01-01T21:39:00.000Z',
      needsReview: false,
      playerLines: [{ goals: 2, label: 'Hugo L.', player: { firstname: 'Hugo', lastname: 'Lemaire' } }],
      responseCompletionCount: 1,
      responseEligibleCount: 3,
      scoreAgainst: 1,
      scoreFor: 3,
      status: 'final',
    },
    score: {
      available: true,
      recordedAt: '2099-01-01T21:35:00.000Z',
      recordedBy: { documentId: 'karim', firstname: 'Karim' },
      scoreAgainst: 1,
      scoreFor: 3,
      source: 'manual',
      waitingOfficial: false,
    },
  });

  test('🔴 point 3 — l encart du score : la pastille, le face-à-face, le score et qui l a saisi', () => {
    const root = mountScreen({
      attendance: buildAttendance(APRES_LE_MATCH),
      event: buildMatchEvent({ opponentName: 'Test-COMPO', team: { ...buildEvent().team, club: { documentId: CLUB_ID, name: 'AS Montrivage' } } }),
      matchStats: FEUILLE_PUBLIEE,
    });

    const [encart] = parSection(root, 'match-encart');
    expect(encart).toBeDefined();
    const texte = texteRendu(encart);
    expect(texte).toContain('Match · TERMINÉ · VICTOIRE');
    expect(texte).toContain('AS Montrivage');
    expect(texte).toContain('Test-COMPO');
    expect(texte).toContain('3 - 1');
    expect(texte).toContain('Score saisi');
    expect(texte).toContain('Saisi par Karim le');
    expect(parTestID(encart, 'event-header-match-encart')[0]).toBeDefined();
  });

  test('🔴 point 3 — un visiteur lit le score, jamais qui l a saisi (mineurs en U15)', () => {
    const root = mountScreen({
      attendance: buildAttendance(APRES_LE_MATCH),
      auth: { canManageEvent: () => false, userData: null },
      event: buildMatchEvent({
        matchResult: {
          savedAt: '2099-01-01T21:35:00.000Z',
          savedBy: { firstname: 'Karim' },
          scoreAgainst: 1,
          scoreFor: 3,
          source: 'manual',
        },
        opponentName: 'Test-COMPO',
      }),
      matchStats: null,
    });

    const texte = texteRendu(parSection(root, 'match-encart')[0]);
    expect(texte).toContain('3 - 1');
    expect(texte).not.toContain('Saisi par');
  });

  test('🔴 point 2 — la ligne d infos du match, comme la planche : l équipe, le jour et l heure', () => {
    const root = mountScreen({ event: buildMatchEvent() });

    const jour = new Date('2099-01-01T17:00:00.000Z')
      .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', weekday: 'short' });
    const [ligne] = root.findAll((/** @type {any} */ n) => n.props?.['data-testid'] === 'event-info-line');
    expect(textOf(ligne)).toBe(`U15 · ${jour} · 18:00`);
  });

  test('🔴 point 4 — la carte du téléphone est À DROITE, nomme qui manque et relance', async () => {
    const root = mountScreen({
      attendance: buildAttendance(APRES_LE_MATCH),
      event: buildMatchEvent(),
      matchStats: FEUILLE_PUBLIEE,
    });

    const [bloc] = parSection(root, 'match-stats');
    expect(bloc).toBeDefined();
    const carte = parTestID(bloc, 'post-match-journey')[0];
    expect(texteRendu(carte)).toContain('Léa');
    expect(texteRendu(carte)).toContain('Max');
    const relancer = parTestID(bloc, 'post-match-relancer')[0].findAllByType(TouchableOpacity)[0];
    window.alert = jest.fn();
    await act(async () => {
      relancer.props.onPress();
    });
    expect(mockRelancer).toHaveBeenCalledWith({ eventId: 'event-1', teamId: TEAM_ID });
    expect(texteRendu(parTestID(bloc, 'post-match-relancer')[0])).toContain('Déjà relancés aujourd’hui');
  });

  test('🔴 point 5 — « Gérer l événement » : Modifier, Convocation, « Stats du match » et sa note', () => {
    const root = mountScreen({
      attendance: buildAttendance(PENDANT_LE_MATCH),
      event: buildMatchEvent(),
      matchStats: buildMatchStats(),
    });

    const [gerer] = boutonsDOM(root, "Gérer l'événement");
    expect(gerer).toBeDefined();
    act(() => gerer.props.onClick());
    const menu = root.findAll((/** @type {any} */ n) => n.props?.role === 'menu')[0];
    const items = menu.findAll((/** @type {any} */ n) => n.props?.role === 'menuitem');
    expect(items.map((/** @type {any} */ item) => textOf(item).split(' S’ouvre')[0]))
      .toEqual(['Modifier', 'Convocation', 'Stats du match']);
    // Avant la fin du match : la puce est éteinte et dit QUAND elle s'ouvrira.
    expect(textOf(items[2])).toContain('S’ouvre à la fin du match');
    expect(items[2].props.disabled).toBe(true);
  });

  test('🔴 point 5 — après la fin, « Stats du match » ouvre la feuille de match', () => {
    const root = mountScreen({
      attendance: buildAttendance(APRES_LE_MATCH),
      event: buildMatchEvent(),
      matchStats: buildMatchStats(),
    });

    act(() => boutonsDOM(root, "Gérer l'événement")[0].props.onClick());
    const stats = root.findAll((/** @type {any} */ n) => n.props?.role === 'menuitem')
      .find((/** @type {any} */ item) => textOf(item).includes('Stats du match'));
    expect(textOf(stats)).toContain('Étape 2 sur 3 : la feuille');
    act(() => stats.props.onClick());
    expect(dernierEnvoiVers('MatchStatsEditor')).toEqual(
      expect.objectContaining({ eventId: 'event-1', teamId: TEAM_ID }),
    );
  });

  test('protégé — un entraînement garde son seul bouton « Modifier », sans menu', () => {
    const root = mountScreen({});

    expect(boutonsDOM(root, "Gérer l'événement")).toHaveLength(0);
    expect(boutonsDOM(root, 'Modifier')).not.toHaveLength(0);
  });
});
// FINITIONS11-STATS · point 4 (écran 7) — le site lit le MÊME juge (`matchPageModel.js`) :
// « Relancer les N » compte les convoqués à relancer, comme le serveur.
describe('FINITIONS11 · point 4 — sur le site, « Relancer les N » = les convoqués à relancer', () => {
  const texteRendu = (/** @type {any} */ noeud) => (noeud?.children || [])
    .map((/** @type {any} */ enfant) => (typeof enfant === 'string' ? enfant : texteRendu(enfant)))
    .join(' ').replace(/\s+/g, ' ').trim();
  const reponse = (/** @type {string} */ label, /** @type {any} */ champs = {}) => ({
    convoked: true, label, status: 'pending', userDocumentId: `compte-${label}`, ...champs,
  });

  test('🔴 7 convoqués sans réponse, 1 hors convocation, 1 sans compte : « Relancer les 7 »', () => {
    const root = mountScreen({
      attendance: buildAttendance(APRES_LE_MATCH),
      event: buildMatchEvent(),
      matchStats: buildMatchStats({
        playerResponses: [
          reponse('Ali B.', { status: 'submitted' }),
          reponse('Hugo L.'),
          reponse('Léa M.'),
          reponse('Max P.'),
          reponse('Nina R.', { status: 'draft' }),
          reponse('Omar S.'),
          reponse('Paul T.'),
          reponse('Zoé V.'),
          reponse('Yanis K.', { convoked: false }),
          reponse('Joueur ajouté', { convoked: false, userDocumentId: null }),
        ],
        report: {
          finalizedAt: '2099-01-01T21:39:00.000Z',
          needsReview: false,
          responseCompletionCount: 1,
          responseEligibleCount: 8,
          status: 'final',
        },
        score: {
          available: true, scoreAgainst: 1, scoreFor: 3, source: 'manual', waitingOfficial: false,
        },
      }),
    });

    const [bloc] = root.findAll((/** @type {any} */ n) => n.props?.['data-event-section'] === 'match-stats');
    expect(texteRendu(parTestID(bloc, 'post-match-relancer')[0])).toContain('Relancer les 7');
    expect(texteRendu(parTestID(bloc, 'post-match-journey')[0])).not.toContain('Yanis');
  });
});
// FINITIONS11-STATS · point 6 bis — le site lit le MÊME juge : les deux listes de la carte.
describe('FINITIONS11 · point 6 bis — sur le site, « Convoqués : … » et « Aussi présents, sans convocation : … »', () => {
  const texteRendu = (/** @type {any} */ noeud) => (noeud?.children || [])
    .map((/** @type {any} */ enfant) => (typeof enfant === 'string' ? enfant : texteRendu(enfant)))
    .join(' ').replace(/\s+/g, ' ').trim();
  const reponse = (/** @type {string} */ label, /** @type {any} */ champs = {}) => ({
    label, participation: null, status: null, userDocumentId: `compte-${label.split(' ')[0]}`, ...champs,
  });

  test('🔴 les convoqués comptés, et les deux joueurs venus sans convocation nommés à part', () => {
    const root = mountScreen({
      attendance: buildAttendance(APRES_LE_MATCH),
      event: buildMatchEvent(),
      matchStats: buildMatchStats({
        playerResponses: [
          reponse('Léa M.', { convoked: true, participation: 'played', status: 'submitted' }),
          reponse('Sami D.', { convoked: true }),
          reponse('Lucas P.', { convoked: false, participation: 'played', status: 'submitted' }),
          reponse('Nathan R.', { convoked: false }),
          reponse('Yanis K.', { convoked: false }),
        ],
        report: {
          finalizedAt: '2099-01-01T21:39:00.000Z',
          needsReview: false,
          playerLines: [{ minutesPlayed: 30, userDocumentId: 'compte-Nathan' }],
          responseCompletionCount: 1,
          responseEligibleCount: 2,
          status: 'final',
        },
        score: {
          available: true, scoreAgainst: 1, scoreFor: 3, source: 'manual', waitingOfficial: false,
        },
      }),
    });

    const [bloc] = root.findAll((/** @type {any} */ n) => n.props?.['data-event-section'] === 'match-stats');
    const carte = texteRendu(parTestID(bloc, 'post-match-journey')[0]);
    expect(carte).toContain('Convoqués : 1 sur 2 a répondu · manquent Sami');
    expect(carte).toContain('Aussi présents, sans convocation : Lucas, Nathan');
    expect(carte).not.toContain('Yanis');
  });
});
