import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import useMessaging from './useMessaging';

// MSG1BA (§3.14) — « MARQUER COMME NON LU » ET L'EVENEMENT `chat-unread-updated`
// (contrat MESSAGERIE-1B §3 et §7). Le serveur rend des comptes ABSOLUS (le fil et le
// total) : l'app les pose dans la liste en cache, ou la pastille du fil, de l'onglet et de
// l'accueil les lisent. Meme banc que `pastilleLectureMSG2.test.js` (le vrai crochet, un
// vrai cache react-query, une socket doublee qui garde ses ecouteurs).

const mockSocket = {
  connected: true,
  /** @type {Record<string, Function[]>} */
  ecouteurs: {},
  emit() {},
  off(/** @type {string} */ event, /** @type {Function} */ fn) {
    this.ecouteurs[event] = (this.ecouteurs[event] || []).filter((f) => f !== fn);
  },
  on(/** @type {string} */ event, /** @type {Function} */ fn) {
    this.ecouteurs[event] = [...(this.ecouteurs[event] || []), fn];
  },
};

jest.mock('@/hooks/useSocket', () => ({
  __esModule: true,
  default: () => ({ isConnected: true, socket: mockSocket }),
  EVENTS: {
    CHAT_UNREAD_UPDATED: 'chat-unread-updated',
    ERROR: 'error',
    GROUP_NOTICE: 'group-notice',
    JOIN_CHAT: 'join-chat',
    JOINED: 'joined',
    LEAVE_CHAT: 'leave-chat',
    MESSAGE_DELETED: 'message-deleted',
    MESSAGE_READ: 'message-read',
    MESSAGE_RECEIVED: 'message-received',
    MESSAGE_UPDATED: 'message-updated',
    READ_MESSAGE: 'read-message',
  },
}));

const mockAuth = { allMyTeams: [], userData: { documentId: 'moi' } };
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));

jest.mock('@/store/appContext', () => ({
  storage: { getString: jest.fn(() => undefined), set: jest.fn() },
}));

const mockMarkChatUnread = jest.fn();
// Service double ENTIEREMENT : il importe le client HTTP, qui refuse de se charger sans
// `API_URL` (jamais `requireActual`).
jest.mock('@/services/chat/chatService', () => ({
  addGroupMembers: jest.fn(),
  archiveChat: jest.fn(),
  createClubChat: jest.fn(),
  createGroupChat: jest.fn(),
  createTeamChat: jest.fn(),
  createWhisperChat: jest.fn(),
  deleteMessage: jest.fn(),
  editMessage: jest.fn(),
  getChats: jest.fn(),
  markChatUnread: (/** @type {any[]} */ ...args) => mockMarkChatUnread(...args),
  pinChat: jest.fn(),
  removeGroupMember: jest.fn(),
  respondProposalMessage: jest.fn(),
  unarchiveChat: jest.fn(),
  unpinChat: jest.fn(),
  updateGroupMeta: jest.fn(),
  votePollMessage: jest.fn(),
}));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn(),
  }),
}));

jest.mock('@/utils/performance/messagingPerformance', () => ({
  markMessagingPerf: jest.fn(),
}));

const CLEF_LISTE = ['chats', { currentUserId: 'moi' }];

/**
 * La liste en cache : chat-1 lu, chat-2 avec 3 non-lus, total 3.
 * @returns {any} Les pages en cache.
 */
const listeEnCache = () => ({
  pageParams: [1],
  pages: [{
    data: [
      { documentId: 'chat-1', unreadCount: 0 },
      { documentId: 'chat-2', unreadCount: 3 },
    ],
    meta: { pagination: { page: 1, pageCount: 1, total: 2 }, unreadTotal: 3 },
  }],
});

/**
 * Monte le vrai crochet, comme l'ecran de la liste (sans fil courant).
 * @returns {Promise<{ client: QueryClient, messagerie: () => any }>}
 */
const monter = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(CLEF_LISTE, listeEnCache());
  jest.spyOn(client, 'refetchQueries').mockResolvedValue(undefined);

  /** @type {any} */
  let dernier;
  /**
   * Le composant qui porte le crochet.
   * @returns {null}
   */
  function Sonde() {
    dernier = useMessaging();
    return null;
  }

  await act(async () => {
    renderer.create(
      <QueryClientProvider client={client}>
        <Sonde />
      </QueryClientProvider>,
    );
  });

  return { client, messagerie: () => dernier };
};

const pageUne = (/** @type {QueryClient} */ client) => (
  /** @type {any} */ (client.getQueryData(CLEF_LISTE)).pages[0]
);
const compteDuFil = (/** @type {QueryClient} */ client, /** @type {string} */ id) => pageUne(client)
  .data.find((/** @type {any} */ chat) => chat.documentId === id).unreadCount;

beforeEach(() => {
  mockSocket.ecouteurs = {};
  mockMarkChatUnread.mockReset();
});

describe('MSG1BA (§3.14) — marquer comme non lu', () => {
  test('NL1 — la reponse du serveur pose le compte du fil ET le total', async () => {
    mockMarkChatUnread.mockResolvedValue({
      chatDocumentId: 'chat-1', markedUnread: true, unreadCount: 1, unreadTotal: 4,
    });
    const { client, messagerie } = await monter();
    await act(async () => {
      await messagerie().markChatUnread('chat-1');
    });
    expect(mockMarkChatUnread).toHaveBeenCalledWith('chat-1');
    expect(compteDuFil(client, 'chat-1')).toBe(1);
    expect(pageUne(client).meta.unreadTotal).toBe(4);
  });

  test('NL2 — `markedUnread: false` (que mes messages) : rien ne bouge', async () => {
    mockMarkChatUnread.mockResolvedValue({ markedUnread: false, unreadCount: 0, unreadTotal: 3 });
    const { client, messagerie } = await monter();
    await act(async () => {
      await messagerie().markChatUnread('chat-1');
    });
    expect(compteDuFil(client, 'chat-1')).toBe(0);
    expect(pageUne(client).meta.unreadTotal).toBe(3);
  });

  test('NL3 — serveur d avant 1B : l erreur remonte a l ecran (qui cache le geste)', async () => {
    mockMarkChatUnread.mockRejectedValue({ response: { status: 404 } });
    const { client, messagerie } = await monter();
    await expect(messagerie().markChatUnread('chat-1')).rejects.toEqual({
      response: { status: 404 },
    });
    expect(compteDuFil(client, 'chat-1')).toBe(0);
  });
});

describe('MSG1BA (§3.14) — `chat-unread-updated`, vu d un autre appareil du compte', () => {
  test('NL4 — les comptes du serveur sont poses tels quels', async () => {
    const { client } = await monter();
    act(() => {
      (mockSocket.ecouteurs['chat-unread-updated'] || []).forEach((fn) => fn({
        chatDocumentId: 'chat-1', markedUnread: true, unreadCount: 1, unreadTotal: 4,
      }));
    });
    expect(compteDuFil(client, 'chat-1')).toBe(1);
    expect(pageUne(client).meta.unreadTotal).toBe(4);
  });

  test('NL5 — apres un depart (`left: true`), la liste est relue', async () => {
    const { client } = await monter();
    act(() => {
      (mockSocket.ecouteurs['chat-unread-updated'] || []).forEach((fn) => fn({
        chatDocumentId: 'chat-2', left: true, unreadCount: 0,
      }));
    });
    expect(client.refetchQueries).toHaveBeenCalledWith({ queryKey: ['chats'], type: 'all' });
  });
});
