import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import useMessaging from './useMessaging';

// MSG2 — « la pastille Messages affiche 99+ et ne baisse jamais, meme apres
// avoir ouvert les conversations » (Adel, 15/09).
//
// 📏 MESURE DU 2026-09-15 SUR LA RECETTE (un seul conteneur) : ouvrir un fil
// ecrit le curseur et `GET /chats` rend le bon compte. Le chemin serveur marche.
//
// 🧨 CE QUE LA RECETTE NE PEUT PAS MONTRER : en production, l ecriture du
// curseur tourne dans `foundclub-admin`, mais `GET /api/chats` est servi par
// deux REPLIQUES (Caddyfile, @chatRead) qui ressert la liste depuis un cache
// chaud de 3 s, avant de relire un jeton de version lui-meme garde 5 s. Or l app
// relisait la liste A L INSTANT ou l echo `message-read` arrivait — c est-a-dire
// juste apres avoir affiche la liste pour ouvrir le fil : exactement la fenetre
// ou la replique rend l ANCIEN compte, et rien ne relit ensuite.
//
// ⇒ Le serveur repond maintenant a un ACCUSE qui porte le compte recalcule par
// le conteneur qui a ecrit. Ce fichier prouve que l app l APPLIQUE, et qu elle
// ne va plus ecraser ce compte frais par une relecture de replique. Un serveur
// ancien (sans accuse) garde l ancien comportement.

const mockSocket = {
  connected: true,
  /** @type {Record<string, Function[]>} */
  ecouteurs: {},
  /** @type {Array<{ event: string, payload: any, ack: any }>} */
  emissions: [],
  emit(/** @type {string} */ event, /** @type {any} */ payload, /** @type {any} */ ack) {
    this.emissions.push({ ack, event, payload });
  },
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
    ERROR: 'error',
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

// Service double ENTIEREMENT : il importe le client HTTP, qui refuse de se
// charger sans `API_URL` (jamais `requireActual`).
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
 * La liste en cache au moment ou l on ouvre le fil : chat-1 pese 4, total 7.
 * @returns {any} Les pages en cache.
 */
const listeEnCache = () => ({
  pageParams: [1],
  pages: [{
    data: [
      { documentId: 'chat-1', unreadCount: 4 },
      { documentId: 'chat-2', unreadCount: 3 },
    ],
    meta: { pagination: { page: 1, pageCount: 1, total: 2 }, unreadTotal: 7 },
  }],
});

/**
 * Monte le vrai crochet sur le fil `chat-1`, sous un vrai cache react-query.
 * @returns {Promise<{ client: QueryClient, messagerie: () => any }>} Le cache et le crochet.
 */
const monter = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(CLEF_LISTE, listeEnCache());
  jest.spyOn(client, 'refetchQueries').mockResolvedValue(undefined);

  /** @type {any} */
  let dernier;
  /**
   * Le composant qui porte le crochet.
   * @returns {null} Rien a afficher.
   */
  function Sonde() {
    dernier = useMessaging('chat-1');
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

/**
 * Le serveur previent le salon que MOI j ai lu le fil.
 * @param {any} payload La charge utile de l echo.
 */
const echoDeLecture = (payload) => {
  act(() => {
    (mockSocket.ecouteurs['message-read'] || []).forEach((fn) => fn(payload));
  });
};

const pageUne = (/** @type {QueryClient} */ client) => (
  /** @type {any} */ (client.getQueryData(CLEF_LISTE)).pages[0]
);
const totalEnCache = (/** @type {QueryClient} */ client) => pageUne(client).meta.unreadTotal;
const compteDuFil = (/** @type {QueryClient} */ client, /** @type {string} */ id) => pageUne(client)
  .data.find((/** @type {any} */ chat) => chat.documentId === id).unreadCount;

beforeEach(() => {
  mockSocket.emissions = [];
  mockSocket.ecouteurs = {};
});

// ⚠️ Point de depart REEL : a l entree dans le fil, AE06 remet deja son compte
// a zero SANS reseau (useMessaging, effet « entering/leaving chat »). Le total
// en cache vaut donc 3 des le montage. L accuse, lui, porte ce que le SERVEUR
// sait : 5 ici, parce qu un autre membre a ecrit dans chat-2 entre-temps.
describe('MSG2 — ouvrir un fil fait baisser la pastille, avec le compte du SERVEUR', () => {
  test('depart : entrer dans le fil a deja retire ses 4 messages, sans reseau', async () => {
    const { client } = await monter();

    expect(compteDuFil(client, 'chat-1')).toBe(0);
    expect(totalEnCache(client)).toBe(3);
  });

  test('la lecture part avec un accuse, dont le compte est applique tel quel', async () => {
    const { client, messagerie } = await monter();

    act(() => {
      messagerie().sendReadReceipt('chat-1', 'message-9');
    });

    const lecture = mockSocket.emissions.find((emission) => emission.event === 'read-message');
    expect(lecture?.payload).toEqual({ chatDocumentId: 'chat-1', lastSeenMessageId: 'message-9' });
    expect(typeof lecture?.ack).toBe('function');

    act(() => {
      lecture.ack({
        chatDocumentId: 'chat-1', ok: true, unreadCount: 0, unreadTotal: 5,
      });
    });

    expect(compteDuFil(client, 'chat-1')).toBe(0);
    expect(totalEnCache(client)).toBe(5);
  });

  // Une replique rendrait l ANCIEN compte et ecraserait celui de l accuse.
  test('apres un accuse chiffre, l echo ne relit PAS la liste', async () => {
    const { client, messagerie } = await monter();

    act(() => {
      messagerie().sendReadReceipt('chat-1', 'message-9');
    });
    const lecture = mockSocket.emissions.find((emission) => emission.event === 'read-message');
    act(() => {
      lecture?.ack?.({
        chatDocumentId: 'chat-1', ok: true, unreadCount: 0, unreadTotal: 5,
      });
    });

    echoDeLecture({ chatDocumentId: 'chat-1', userDocumentId: 'moi' });

    expect(client.refetchQueries).not.toHaveBeenCalled();
    expect(totalEnCache(client)).toBe(5);
  });

  test('serveur ancien (aucun accuse) : l echo relit la liste, comme avant', async () => {
    const { client, messagerie } = await monter();

    act(() => {
      messagerie().sendReadReceipt('chat-1', 'message-9');
    });
    echoDeLecture({ chatDocumentId: 'chat-1', userDocumentId: 'moi' });

    expect(client.refetchQueries).toHaveBeenCalledTimes(1);
    expect(client.refetchQueries).toHaveBeenCalledWith({ queryKey: ['chats'] });
  });

  test('accuse NON (quota depasse) : rien n est invente, et l echo relit la liste', async () => {
    const { client, messagerie } = await monter();

    act(() => {
      messagerie().sendReadReceipt('chat-1', 'message-9');
    });
    const lecture = mockSocket.emissions.find((emission) => emission.event === 'read-message');
    act(() => {
      lecture?.ack?.({ error: { code: 'RATE_LIMIT_EXCEEDED' }, ok: false });
    });

    expect(totalEnCache(client)).toBe(3);
    echoDeLecture({ chatDocumentId: 'chat-1', userDocumentId: 'moi' });
    expect(client.refetchQueries).toHaveBeenCalledTimes(1);
  });

  test('accuse OUI sans chiffre (compte indisponible) : on retombe sur la relecture', async () => {
    const { client, messagerie } = await monter();

    act(() => {
      messagerie().sendReadReceipt('chat-1');
    });
    const lecture = mockSocket.emissions.find((emission) => emission.event === 'read-message');
    act(() => {
      lecture?.ack?.({ chatDocumentId: 'chat-1', ok: true });
    });

    expect(totalEnCache(client)).toBe(3);
    echoDeLecture({ chatDocumentId: 'chat-1', userDocumentId: 'moi' });
    expect(client.refetchQueries).toHaveBeenCalledTimes(1);
  });

  test('l echo de lecture d un AUTRE membre ne touche ni la liste ni le compte', async () => {
    const { client } = await monter();

    echoDeLecture({ chatDocumentId: 'chat-1', userDocumentId: 'le-coach' });

    expect(client.refetchQueries).not.toHaveBeenCalled();
    expect(totalEnCache(client)).toBe(3);
  });
});
