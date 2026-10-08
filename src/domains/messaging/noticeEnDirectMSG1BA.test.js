import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import useMessaging from './useMessaging';

// MSG1BA (§3.17) — L'EVENEMENT `group-notice` (contrat MESSAGERIE-1B §7) : une notice de
// groupe arrive en temps reel, JAMAIS par `message-received`. L'app l'ajoute au fil (une
// seule fois, meme recue par deux salles), la pose en apercu de la liste SANS toucher aux
// non-lus (une notice ne compte jamais), et relit le detail du groupe (nom, photo, admins,
// autorisations ont pu changer). Meme banc que `nonLuMSG1BA.test.js`.

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

const CLEF_FIL = ['chat-messages', 'chat-1'];

const NOTICE = {
  createdAt: '2026-10-07T15:02:11.000Z',
  documentId: 'n1',
  message: 'Karim Benali a renommé le groupe en « Les U13 bis ».',
  sender: null,
  systemNotice: {
    actor: { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' },
    groupName: 'Les U13 bis',
    kind: 'group_renamed',
    targets: [],
    version: 1,
  },
};

/**
 * Le serveur emet une notice.
 * @param {any} charge
 * @returns {void}
 */
const notice = (charge) => {
  act(() => {
    (mockSocket.ecouteurs['group-notice'] || []).forEach((fn) => fn(charge));
  });
};

beforeEach(() => {
  mockSocket.ecouteurs = {};
});

describe('MSG1BA (§3.17) — `group-notice` en temps reel', () => {
  test('GN1 — la notice entre dans le fil, en tete, avec `systemNotice`', async () => {
    const { client } = await monter();
    client.setQueryData(CLEF_FIL, {
      pageParams: [1],
      pages: [{
        data: [{ createdAt: '2026-10-07T15:00:00.000Z', documentId: 'm1', message: 'Salut' }],
      }],
    });
    notice({ chatDocumentId: 'chat-1', message: NOTICE });
    const fil = /** @type {any} */ (client.getQueryData(CLEF_FIL)).pages[0].data;
    expect(fil.map((/** @type {any} */ m) => m.documentId)).toEqual(['n1', 'm1']);
    expect(fil[0].systemNotice.kind).toBe('group_renamed');
  });

  test('GN2 — recue par deux salles (le fil ET la mienne) : une seule fois', async () => {
    const { client } = await monter();
    client.setQueryData(CLEF_FIL, { pageParams: [1], pages: [{ data: [] }] });
    notice({ chatDocumentId: 'chat-1', message: NOTICE });
    notice({ chatDocumentId: 'chat-1', message: NOTICE });
    expect(/** @type {any} */ (client.getQueryData(CLEF_FIL)).pages[0].data).toHaveLength(1);
  });

  test('GN3 — l apercu de la liste devient la notice, SANS bouger les non-lus', async () => {
    const { client } = await monter();
    notice({ chatDocumentId: 'chat-2', message: NOTICE });
    const page = pageUne(client);
    const fil = page.data.find((/** @type {any} */ chat) => chat.documentId === 'chat-2');
    expect(fil.messages[0].documentId).toBe('n1');
    expect(fil.unreadCount).toBe(3);
    expect(page.meta.unreadTotal).toBe(3);
  });

  test('GN4 — le detail du groupe est relu (nom, photo, admins, autorisations)', async () => {
    const { client } = await monter();
    const relire = jest.spyOn(client, 'invalidateQueries');
    notice({ chatDocumentId: 'chat-1', message: NOTICE });
    expect(relire).toHaveBeenCalledWith({ queryKey: ['chat', 'chat-1'] });
  });
});
