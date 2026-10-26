/* eslint-disable max-len -- témoin BH04 : entrées du rapport gardées sur une ligne */
import { QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { creerQueryClientDeTest } from '../../testSupport/queryClientDeTest';

// ANONSITE (26/10) — l'anonymat d'un fil de ligue SUR LE SITE : copie du banc BH04 (vrai écran web).

const CHAT_ID = 'fil-equipe';
const MOI = { documentId: 'moi', firstname: 'Adel', lastname: 'Ferchichi' };
const BRUNO = { documentId: 'bruno', firstname: 'Bruno', lastname: 'Dupont' };

let mockLargeur = 1280;
/** @type {any[]} */
let mockReactions = [];
/** @type {any[]} */
let mockMessagesDuFil = [];
/** @type {any} */
let mockFil = null;
/** @type {any} */
let mockSocket = null;
/** @type {any[]} */
let mockFilsDeLaColonne = [];
const mockStopFrappe = jest.fn();
const mockVoter = jest.fn(() => Promise.resolve({}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 900, scale: 1, width: mockLargeur,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/store/authRuntime', () => ({
  getAuthRuntimeSnapshot: () => ({ auth: { user: { documentId: 'moi' } } }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: new Proxy({}, { get: () => 1 }),
    scheme: 'dark',
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});

/** @type {any} */
let mockMoi = null;
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    allMyTeams: [],
    hasClubAccess: (/** @type {string} */ clubId) => clubId === 'club-1',
    userData: mockMoi,
  }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    isSocketConnected: true,
    joinChat: jest.fn(),
    leaveChat: jest.fn(),
    reactToMessage: jest.fn(),
    respondToProposal: jest.fn(),
    retryFailedMessage: jest.fn(),
    sendMessage: jest.fn(() => 'temp-1'),
    sendReadReceipt: jest.fn(),
    sendTypingStart: jest.fn(),
    sendTypingStop: mockStopFrappe,
    socket: mockSocket,
    votePoll: (/** @type {any[]} */ ...args) => mockVoter(...args),
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({
    data: mockFil, error: null, isLoading: false, refetch: jest.fn(),
  }),
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: mockReactions } }),
  useGetChatMessages: () => ({
    data: { pages: [{ data: mockMessagesDuFil }] },
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useGetChats: () => ({ data: { pages: [{ data: mockFilsDeLaColonne }] }, isLoading: false }),
}));

jest.mock('@/services/collectivite/collectiviteCanauxQueries', () => ({
  useMembresDuFil: () => ({ data: null }),
  useMesCanauxDeLaVille: () => ({ data: [] }),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => ({ data: [] }),
  useMyCollectivites: () => ({ data: [] }),
}));
jest.mock('@/services/collectivite/collectiviteActualiteQueries', () => ({
  useMesActualitesDeLaVille: () => ({ data: undefined }),
}));

// Le client HTTP lit ses adresses au CHARGEMENT du module : `.env` est absent d'une copie.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
const mockQuitterLeGroupe = jest.fn(() => Promise.resolve({ left: true }));
// T19R — les noms des votants lus au serveur (`GET /chat-messages/:id/poll-voters`).
// (le comportement est posé par chaque témoin qui affiche un sondage)
const mockLireLesVotants = jest.fn();
jest.mock('@/services/chat/chatService', () => ({
  createChatMessage: jest.fn(),
  getPollVoterProfiles: (/** @type {string} */ id) => mockLireLesVotants(id),
  leaveGroupChat: (/** @type {string} */ id) => mockQuitterLeGroupe(id),
}));
jest.mock('@/services/league/leagueMatchService', () => ({
  createLeagueProposal: jest.fn(),
  respondToLeagueProposal: jest.fn(),
}));
jest.mock('@/services/messageReport/messageReportService', () => ({
  createMessageReport: jest.fn(),
}));
const mockRsvp = jest.fn(() => Promise.resolve({}));
const mockAbsent = jest.fn(() => Promise.resolve({}));
jest.mock('@/services/event/eventService', () => ({
  getEventConvocation: jest.fn(),
  getEvents: jest.fn(() => Promise.resolve({
    data: [], meta: { pagination: { page: 1, pageCount: 1 } },
  })),
  missingEvent: (/** @type {any} */ id) => mockAbsent(id),
  respondToEventRsvp: (...args) => mockRsvp(...args),
}));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: {} }));
// MSG1W §3.5 — les fenetres du « + » (grande carte d evenement, sondage du telephone) : leurs
// modules natifs ne se chargent pas dans ce banc, et ce temoin ne les regarde pas.
jest.mock('@/components/molecules/eventCard/EventCardNew', () => () => null);
// §3.8 — la bulle d evenement du telephone : le banc la remplace par une doublure qui expose
// ses gestes (Présent / Absent / Rejoindre), pour verifier QUI le site appelle.
jest.mock('@/components/molecules/eventMessageBubble/EventMessageBubble', () => {
  const react = jest.requireActual('react');
  return function BulleEvenementDouble(/** @type {any} */ props) {
    return react.createElement('div', {
      'data-testid': 'MSG1W-bulle-evenement-double',
      onDecline: props.onDecline,
      onJoin: props.onJoin,
      onParticipate: props.onParticipate,
    }, String(props.event?.name || ''));
  };
});
const mockParticipation = jest.fn(() => Promise.resolve({ data: {} }));
// §3.16 — les personnes que J AI bloquees (K3, K4).
/** @type {any[]} */
let mockBloques = [];
jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useBlockUser: () => ({ isPending: false, mutate: jest.fn() }),
  useGetMyBlockedUsers: () => ({ data: mockBloques }),
  useUnblockUser: () => ({ isPending: false, mutate: jest.fn() }),
}));
jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: (/** @type {any} */ donnees) => mockParticipation(donnees),
}));
jest.mock('@/components/organisms/pollCreationModal/PollCreationModal', () => () => null);
// L assistant de convocation (MESSAGERIE-1C) charge le mur payant et son stockage natif :
// une doublure ici ; les temoins Playwright du site ouvrent le vrai.
jest.mock('@/views/conversationConvocation/ConvocationWizard', () => () => null);

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

// eslint-disable-next-line import/first
import ConversationWeb from '../Conversation.web';

jest.setTimeout(30000);

/**
 * Une socket de banc : `on` / `off` comme socket.io, et `emettre` pour jouer le serveur.
 * @returns {any} La socket.
 */
const fausseSocket = () => {
  /** @type {Map<string, Set<Function>>} */
  const ecoutes = new Map();
  return {
    emettre: (/** @type {string} */ evenement, /** @type {any} */ charge) => (
      ecoutes.get(evenement) || new Set()
    ).forEach((f) => f(charge)),
    emit: jest.fn(),
    off: jest.fn((/** @type {string} */ evenement, /** @type {Function} */ f) => {
      ecoutes.get(evenement)?.delete(f);
    }),
    on: jest.fn((/** @type {string} */ evenement, /** @type {Function} */ f) => {
      if (!ecoutes.has(evenement)) ecoutes.set(evenement, new Set());
      ecoutes.get(evenement)?.add(f);
    }),
  };
};

/** @type {any} */
let queryClient;
/** @type {any[]} */
const montes = [];

/**
 * Monte la messagerie du site.
 * @param {Record<string, unknown>} [params] - Les parametres de route.
 * @returns {Promise<{ arbre: any, navigation: any }>} L arbre et la navigation.
 */
const monter = async (params = {}) => {
  const navigation = { goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <ConversationWeb
          navigation={navigation}
          route={{ params: { chatId: CHAT_ID, ...params } }}
        />
      </QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return { arbre, navigation };
};

beforeEach(() => {
  queryClient = creerQueryClientDeTest();
  mockLargeur = 1280;
  mockSocket = fausseSocket();
  mockBloques = [];
  mockMoi = {
    documentId: 'moi', firstname: 'Adel', lastname: 'Ferchichi', role: { type: 'coach' },
  };
  mockFil = {
    documentId: CHAT_ID,
    name: 'Seniors A',
    participants: [MOI, BRUNO],
    team: {
      club: { documentId: 'club-1', name: 'Aix-Perd en Buvette' },
      documentId: 'team-1',
      name: 'Seniors A',
    },
    type: 'team',
  };
  mockMessagesDuFil = [{
    createdAt: '2026-10-07T08:00:00.000Z',
    documentId: 'm1',
    message: 'On se retrouve a 18h',
    sender: BRUNO,
  }];
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
  queryClient.clear();
});

const LEA = { documentId: 'lea', firstname: 'Léa', lastname: 'Martin' };
const AVANT_LE_MATCH = '2099-06-10T16:00:00.000Z';
const APRES_LE_MATCH = '2025-06-10T16:00:00.000Z';

/**
 * Un fil de ligue : Bruno est l'adversaire, Léa ma coéquipière.
 * @param {string} date - La date du match.
 * @returns {any} Le fil.
 */
const filDeLigue = (date) => ({
  documentId: CHAT_ID,
  league_match: {
    date, documentId: 'match-1', team_a: {}, team_b: {},
  },
  myTeamMembers: [LEA],
  participants: [MOI, BRUNO, LEA],
  type: 'league_match',
});

/**
 * Tout ce que l'écran montre ou dit (textes, title, aria-label, photos), en une chaîne.
 * @param {any} arbre - L'arbre rendu.
 * @returns {string} Le rendu sérialisé.
 */
const toutLEcran = (arbre) => JSON.stringify(arbre.toJSON());

/**
 * Le fil complet : une bulle de Bruno, une citation de Bruno, un sondage où il a voté, une
 * réaction de lui, et un message de Léa.
 * @param {{ frappe?: boolean }} [options] - Bruno est-il en train d'écrire ?
 * @returns {Promise<any>} L'arbre.
 */
const monterLeFilDeLigue = async ({ frappe = true } = {}) => {
  mockLireLesVotants.mockResolvedValue({ data: [{ ...BRUNO, avatar: { url: '/bruno.png' } }] });
  mockReactions = [{
    messageDocumentId: 'm-lea',
    reactions: [{ count: 1, emoji: '👍', users: [BRUNO] }],
  }];
  mockMessagesDuFil = [
    {
      createdAt: '2026-10-07T08:00:00.000Z',
      documentId: 'm-bruno',
      message: 'On vous attend',
      sender: { ...BRUNO, avatar: { url: '/bruno.png' } },
    },
    {
      composition: { options: [{ id: 'o1', label: 'Oui', voters: ['bruno'] }], question: 'Terrain ?', type: 'poll' },
      createdAt: '2026-10-07T08:01:00.000Z',
      documentId: 'm-sondage',
      sender: MOI,
    },
    {
      createdAt: '2026-10-07T08:02:00.000Z',
      documentId: 'm-lea',
      message: 'Je réponds',
      replyTo: { documentId: 'm-bruno', message: 'On vous attend', sender: BRUNO },
      sender: LEA,
    },
  ];
  const { arbre } = await monter();
  await act(async () => { await new Promise((r) => { setTimeout(r, 20); }); });
  if (frappe) {
    await act(async () => {
      mockSocket.emettre('typing-started', { chatDocumentId: CHAT_ID, userDocumentId: 'bruno' });
    });
  }
  return arbre;
};

describe('ANONSITE — fil de ligue sur le site : l adversaire reste anonyme avant le match', () => {
  afterEach(() => { mockReactions = []; mockLireLesVotants.mockReset(); });

  test('avant le match : ni le nom, ni la photo de l adversaire, nulle part', async () => {
    mockFil = filDeLigue(AVANT_LE_MATCH);
    const arbre = await monterLeFilDeLigue();
    const ecran = toutLEcran(arbre);
    expect(ecran).not.toMatch(/Bruno|Dupont/);
    expect(ecran).not.toContain('/bruno.png');
    expect(ecran).toContain('Joueur Adverse');
    // Ma coéquipière garde son nom.
    expect(ecran).toContain('Léa');
  });

  test('avant le match : « Répondre » à l adversaire ne montre pas son nom dans la barre', async () => {
    mockFil = filDeLigue(AVANT_LE_MATCH);
    const arbre = await monterLeFilDeLigue();
    const repondre = arbre.root.findByProps({ 'data-testid': 'MSG1W-repondre-m-bruno' });
    await act(async () => { repondre.props.onClick(); });
    expect(toutLEcran(arbre)).not.toMatch(/Bruno|Dupont/);
  });

  test('avant le match : la ligne sous le titre ne donne pas le prénom de l adversaire', async () => {
    mockFil = filDeLigue(AVANT_LE_MATCH);
    const arbre = await monterLeFilDeLigue({ frappe: false });
    const ecran = toutLEcran(arbre);
    expect(ecran).toContain('Joueur Adverse, Léa, Vous');
    expect(ecran).not.toMatch(/Bruno|Dupont/);
  });

  test('avant le match : le votant adverse, nommé par le serveur, reste « Joueur Adverse »', async () => {
    mockFil = filDeLigue(AVANT_LE_MATCH);
    const arbre = await monterLeFilDeLigue({ frappe: false });
    expect(mockLireLesVotants).toHaveBeenCalledWith('m-sondage');
    const option = arbre.root.findAll((/** @type {any} */ n) => (
      String(n.props?.accessibilityLabel || '').startsWith('Oui')
    ))[0];
    expect(option.props.accessibilityLabel).toBe('Oui, 1 vote, Joueur Adverse');
  });

  test('après le match : le vrai nom revient (témoin)', async () => {
    mockFil = filDeLigue(APRES_LE_MATCH);
    const arbre = await monterLeFilDeLigue();
    expect(toutLEcran(arbre)).toContain('Bruno');
    expect(toutLEcran(arbre)).not.toContain('Joueur Adverse');
    const option = arbre.root.findAll((/** @type {any} */ n) => (
      String(n.props?.accessibilityLabel || '').startsWith('Oui')
    ))[0];
    expect(option.props.accessibilityLabel).toBe('Oui, 1 vote, Bruno Dupont');
  });
});

/**
 * Le texte rendu sous un noeud (les chaînes de ses enfants).
 * @param {any} noeud - Une instance du rendu.
 * @returns {string} Le texte.
 */
const texteDe = (noeud) => {
  /** @type {string[]} */
  const morceaux = [];
  const parcourir = (/** @type {any} */ n) => {
    if (n === null || n === undefined || n === false) return;
    if (typeof n === 'string' || typeof n === 'number') { morceaux.push(String(n)); return; }
    (n.children || []).forEach(parcourir);
  };
  parcourir(noeud);
  return morceaux.join(' ');
};
const bouton = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === 'button' && texteDe(n).trim() === libelle,
)[0];

describe('ANONSERVEUR — la colonne « Messages » et « Partager un contact » du site', () => {
  afterEach(() => { mockFilsDeLaColonne = []; });

  test('la colonne : l aperçu d un message adverse dit « Joueur Adverse », jamais son prénom', async () => {
    mockFil = filDeLigue(AVANT_LE_MATCH);
    mockFilsDeLaColonne = [{
      ...filDeLigue(AVANT_LE_MATCH),
      messages: [{ createdAt: '2026-10-07T08:00:00.000Z', documentId: 'm-b', message: 'On vous attend', sender: BRUNO }],
    }];
    const { arbre } = await monter();
    const ligne = arbre.root.findByProps({ 'data-testid': `MSG1W-ligne-${CHAT_ID}` });
    const texte = texteDe(ligne);
    expect(texte).not.toMatch(/Bruno/);
    expect(texte).toContain('Joueur Adverse');
  });

  test('la colonne : un nom déjà masqué par le serveur (« Capitaine Adverse ») est gardé', async () => {
    mockFil = filDeLigue(AVANT_LE_MATCH);
    mockFilsDeLaColonne = [{
      ...filDeLigue(AVANT_LE_MATCH),
      messages: [{
        createdAt: '2026-10-07T08:00:00.000Z',
        documentId: 'm-b',
        message: 'On vous attend',
        sender: { anonyme: true, avatar: null, documentId: 'bruno', firstname: 'Capitaine Adverse', lastname: '' },
      }],
    }];
    const { arbre } = await monter();
    const ligne = arbre.root.findByProps({ 'data-testid': `MSG1W-ligne-${CHAT_ID}` });
    expect(texteDe(ligne)).toContain('Capitaine Adverse');
  });

  test('« Partager un contact » : l adversaire n est pas proposé avant le match, ma coéquipière oui', async () => {
    // Le menu « + » écoute le clavier et la souris du document (banc sans navigateur, cf. ConversationWebBH04).
    global.document = /** @type {any} */ ({ addEventListener: jest.fn(), removeEventListener: jest.fn() });
    mockFil = filDeLigue(AVANT_LE_MATCH);
    const { arbre } = await monter();
    await act(async () => { bouton(arbre, 'Ajouter').props.onClick(); });
    await act(async () => { bouton(arbre, 'Contact').props.onClick(); });
    const choix = arbre.root.findAll((/** @type {any} */ n) => n.type === 'input' && n.props.name === 'msg1w-contact');
    const fenetre = arbre.root.findByProps({ role: 'radiogroup' });
    expect(choix).toHaveLength(1);
    expect(texteDe(fenetre)).not.toMatch(/Bruno|Dupont/);
    expect(texteDe(fenetre)).toContain('Léa');
    act(() => { montes.splice(0).forEach((a) => a.unmount()); });
    // @ts-ignore — le banc n a pas de document
    delete global.document;
  });
});
