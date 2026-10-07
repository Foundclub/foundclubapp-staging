import { QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { creerQueryClientDeTest } from '../../testSupport/queryClientDeTest';

// ==========================================================================
// 💬 MESSAGERIE-1W (07/10/2026) — LA MESSAGERIE DU SITE AU MEME HABILLAGE QUE LE TELEPHONE
// (pack « modele WhatsApp » d Adel). Les temoins Playwright (`web/tests/components/
// msg1w-fil.spec.ts`) verifient la page dans un vrai navigateur ; ceux-ci verifient ce que le
// banc du navigateur ne sait pas simuler : la socket (« … écrit »), et les regles lues dans la
// fiche du fil. Chaque bloc est ROUGE avant sa section.
// ==========================================================================

const CHAT_ID = 'fil-equipe';
const MOI = { documentId: 'moi', firstname: 'Adel', lastname: 'Ferchichi' };
const BRUNO = { documentId: 'bruno', firstname: 'Bruno', lastname: 'Dupont' };
const FRAPPE_DE_BRUNO = { chatDocumentId: CHAT_ID, userDocumentId: BRUNO.documentId };

let mockLargeur = 1280;
/** @type {any[]} */
let mockMessagesDuFil = [];
/** @type {any} */
let mockFil = null;
/** @type {any} */
let mockSocket = null;

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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    allMyTeams: [],
    userData: {
      documentId: 'moi', firstname: 'Adel', lastname: 'Ferchichi', role: { type: 'coach' },
    },
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
    sendTypingStop: jest.fn(),
    socket: mockSocket,
    votePoll: jest.fn(),
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({
    data: mockFil, error: null, isLoading: false, refetch: jest.fn(),
  }),
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatMessages: () => ({
    data: { pages: [{ data: mockMessagesDuFil }] },
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useGetChats: () => ({ data: { pages: [{ data: [] }] }, isLoading: false }),
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
jest.mock('@/services/chat/chatService', () => ({ createChatMessage: jest.fn() }));
jest.mock('@/services/league/leagueMatchService', () => ({
  createLeagueProposal: jest.fn(),
  respondToLeagueProposal: jest.fn(),
}));
jest.mock('@/services/messageReport/messageReportService', () => ({
  createMessageReport: jest.fn(),
}));
jest.mock('@/services/event/eventService', () => ({
  getEventConvocation: jest.fn(),
  getEvents: jest.fn(() => Promise.resolve({
    data: [], meta: { pagination: { page: 1, pageCount: 1 } },
  })),
  missingEvent: jest.fn(),
  respondToEventRsvp: jest.fn(),
}));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: {} }));

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

// eslint-disable-next-line import/first
import ConversationWeb from '../Conversation.web';

// Les noms d evenements de la socket, ceux que l ecran ecoute.
const { EVENTS } = jest.requireActual('@/hooks/useSocket');

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
 * Tout le texte rendu sous un nœud, colle comme le navigateur le colle.
 * @param {any} noeud - Le nœud.
 * @returns {string} Le texte.
 */
const texteDe = (noeud) => {
  /** @type {string[]} */
  const morceaux = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    (enfant.children || []).forEach(parcourir);
  };
  parcourir(noeud);
  return morceaux.join(' ').replace(/\s+/g, ' ').trim();
};

const parTestId = (/** @type {any} */ arbre, /** @type {string} */ testId) => arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.type === 'string' && n.props?.['data-testid'] === testId,
);

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

// 📐 §3.1 — « … écrit ». Le site envoyait ses signaux de frappe, sans en afficher aucun.
describe('MSG1W §3.1 — « Bruno écrit… » sur le site', () => {
  test('un signal de Bruno affiche « Bruno écrit... » sous le titre, puis s eteint', async () => {
    const { arbre } = await monter();
    expect(parTestId(arbre, 'MSG1W-qui-ecrit')).toHaveLength(0);

    await act(async () => {
      mockSocket.emettre(EVENTS.TYPING_STARTED, FRAPPE_DE_BRUNO);
    });
    const [ligne] = parTestId(arbre, 'MSG1W-qui-ecrit');
    expect(ligne).toBeDefined();
    expect(texteDe(ligne)).toContain('Bruno');

    await act(async () => {
      mockSocket.emettre(EVENTS.TYPING_STOPPED, FRAPPE_DE_BRUNO);
    });
    expect(parTestId(arbre, 'MSG1W-qui-ecrit')).toHaveLength(0);
  });

  test('ma propre frappe ne s affiche pas chez moi', async () => {
    const { arbre } = await monter();
    await act(async () => {
      mockSocket.emettre(EVENTS.TYPING_STARTED, { ...FRAPPE_DE_BRUNO, userDocumentId: 'moi' });
    });
    expect(parTestId(arbre, 'MSG1W-qui-ecrit')).toHaveLength(0);
  });
});
