import { InfiniteQueryObserver, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import useMessaging from './useMessaging';

// RECETTE-WEB-COACH (29/10) — CHERCHER LE CANAL D'UNE ÉQUIPE NE CASSE PAS LA LISTE DES FILS.
//
// Publier une convocation cherche le canal de l'équipe (`startTeamChat` → `loadChatsForLookup`).
// Liste pas encore en cache (le site ouvert directement sur le match) : la recherche la
// téléchargeait avec `fetchQuery` et rangeait UNE page nue ({ data, meta }) sous la clef de
// `useGetChats`, qui est une liste PAGINÉE ({ pages, pageParams }). La colonne des conversations,
// montée juste après, lisait `pages.length` sur cette page nue : « Cannot read properties of
// undefined (reading 'length') », et le site affichait « Écran temporairement indisponible ».
//
// ROUGE avant le lot : la clef de la liste contient { data, meta }, sans `pages`.

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
const mockGetChats = jest.fn();
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
  getChats: (/** @type {any[]} */ ...args) => mockGetChats(...args),
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

// La clef exacte de `useGetChats` pour cet utilisateur (sans équipe : liste vide, gardée).
const CLEF_LISTE = ['chats', { currentUserId: 'moi', currentUserTeamIds: [] }];

const PAGE_DU_SERVEUR = {
  data: [{ documentId: 'fil-equipe', team: { documentId: 'equipe-1' }, type: 'team' }],
  meta: { pagination: { page: 1, pageCount: 1, total: 1 } },
};

/**
 * Monte le vrai crochet sur un cache VIDE (aucune liste des fils chargée).
 * @returns {Promise<{ client: QueryClient, messagerie: () => any }>}
 */
const monter = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

beforeEach(() => {
  mockGetChats.mockReset();
  mockGetChats.mockResolvedValue(PAGE_DU_SERVEUR);
});

test('le canal existant est retrouvé, sans en créer un autre (comportement gardé)', async () => {
  const { messagerie } = await monter();
  /** @type {any} */
  let fil;
  await act(async () => { fil = await messagerie().startTeamChat('equipe-1'); });
  expect(fil?.documentId).toBe('fil-equipe');
  expect(mockGetChats).toHaveBeenCalledTimes(1);
});

test('🚨 la liste en cache reste paginée : la colonne des fils peut la lire', async () => {
  const { client, messagerie } = await monter();
  await act(async () => { await messagerie().startTeamChat('equipe-1'); });

  const enCache = /** @type {any} */ (client.getQueryData(CLEF_LISTE));
  expect(Array.isArray(enCache?.pages)).toBe(true);
  expect(enCache.pages[0].data[0].documentId).toBe('fil-equipe');

  // Ce que fait useGetChats en se montant : il ne doit pas lever.
  expect(() => new InfiniteQueryObserver(client, {
    getNextPageParam: () => undefined,
    initialPageParam: 1,
    queryFn: () => PAGE_DU_SERVEUR,
    queryKey: CLEF_LISTE,
  }).getCurrentResult()).not.toThrow();
});
