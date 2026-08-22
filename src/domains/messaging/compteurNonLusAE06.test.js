// AE06 — « la pastille compte des conversations, pas des messages ».
//
// 📏 CE QUI A ETE MESURE LE 2026-08-23 :
// `useUnreadMessages` prend le DERNIER message de chaque fil et ajoute 1 s il
// est « non lu » LOCALEMENT (MMKV). Un fil avec 5 messages non lus pese donc 1,
// et le total ne voit que la page 1 (20 fils). Le serveur, lui, sait compter :
// il relit `chat_read_cursors`, et il rend maintenant `unreadCount` par fil et
// `meta.unreadTotal` pour l ensemble.
//
// Ce fichier tient les trois morceaux que la pastille ne peut pas prouver en
// montant l ecran :
//   ⑥ le NOMBRE par fil, et le « 99+ » au-dela ;
//   ⑦ ce qui la fait BAISSER : l echo de lecture (reseau) et la mise a jour
//      optimiste a l ouverture du fil (sans reseau) ;
//   ⑦bis le repli de lecture de `chatService`, qui perdait le total en silence.

jest.mock('@/store/appContext', () => ({
  storage: { getString: jest.fn(() => undefined), set: jest.fn() },
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ allMyTeams: [], userData: { documentId: 'moi' } }),
}));

jest.mock('@/hooks/useSocket', () => ({
  __esModule: true,
  EVENTS: { READ_MESSAGE: 'read-message' },
  default: () => ({ isConnected: false, socket: null }),
}));

const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: mockGet },
}));

jest.mock('@/domains/guidance/guidanceRuntime', () => ({
  emitGuidanceAction: jest.fn(),
}));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  })),
}));

const fs = require('fs');
const path = require('path');

const { formatThreadUnreadBadge } = require('./useUnreadMessages');
const {
  applyOptimisticChatRead,
  shouldRefetchChatsAfterRead,
} = require('./useMessaging');

const SOURCE_MESSAGERIE = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'views', 'Messaging.js'),
  'utf8',
);

describe('AE06 temoin 6 — le NOMBRE par conversation, et le 99+ au-dela', () => {
  test('un fil sans message non lu n affiche aucun nombre', () => {
    expect(formatThreadUnreadBadge(0)).toBe('');
    expect(formatThreadUnreadBadge(undefined)).toBe('');
    expect(formatThreadUnreadBadge(null)).toBe('');
    expect(formatThreadUnreadBadge(-3)).toBe('');
    expect(formatThreadUnreadBadge('pas un nombre')).toBe('');
  });

  test('un fil avec 5 messages non lus dit 5, pas 1', () => {
    expect(formatThreadUnreadBadge(5)).toBe('5');
    expect(formatThreadUnreadBadge('5')).toBe('5');
    expect(formatThreadUnreadBadge(99)).toBe('99');
  });

  test('au-dela de 99, la ligne dit 99+ au lieu d un nombre a rallonge', () => {
    expect(formatThreadUnreadBadge(100)).toBe('99+');
    expect(formatThreadUnreadBadge(150)).toBe('99+');
  });

  test('la liste des conversations branche bien ce nombre a cote du point Non lu', () => {
    expect(SOURCE_MESSAGERIE).toContain('formatThreadUnreadBadge');
    // Le point « Non lu » reste : le nombre vient A COTE, il ne le remplace pas.
    expect(SOURCE_MESSAGERIE).toContain("t('messaging.unread.badge', 'Non lu')");
  });
});

describe('AE06 temoin 7 — ce qui fait BAISSER la pastille', () => {
  test('un echo de lecture qui vient de MOI doit relire la liste', () => {
    expect(shouldRefetchChatsAfterRead({ userDocumentId: 'moi' }, 'moi')).toBe(true);
  });

  test('un echo de lecture qui vient d un AUTRE ne relit rien', () => {
    // Sinon chaque lecture de n importe qui dans le fil declencherait un appel
    // reseau chez tout le monde : mon compte a moi n a pas bouge.
    expect(shouldRefetchChatsAfterRead({ userDocumentId: 'le-coach' }, 'moi')).toBe(false);
    expect(shouldRefetchChatsAfterRead({}, 'moi')).toBe(false);
    expect(shouldRefetchChatsAfterRead({ userDocumentId: 'moi' }, '')).toBe(false);
  });

  test('entrer dans un fil met SON compte a zero et baisse le total, SANS reseau', () => {
    const avant = {
      pages: [{
        data: [
          { documentId: 'chat-1', unreadCount: 4 },
          { documentId: 'chat-2', unreadCount: 3 },
        ],
        meta: { pagination: { page: 1, pageCount: 1, total: 2 }, unreadTotal: 7 },
      }],
    };

    const apres = applyOptimisticChatRead(avant, 'chat-1');

    expect(apres.pages[0].data[0].unreadCount).toBe(0);
    expect(apres.pages[0].data[1].unreadCount).toBe(3);
    expect(apres.pages[0].meta.unreadTotal).toBe(3);
  });

  test('le total ne descend jamais sous zero, meme si le serveur est en retard', () => {
    const avant = {
      pages: [{
        data: [{ documentId: 'chat-1', unreadCount: 9 }],
        meta: { pagination: { page: 1 }, unreadTotal: 2 },
      }],
    };

    expect(applyOptimisticChatRead(avant, 'chat-1').pages[0].meta.unreadTotal).toBe(0);
  });

  test('sans compte serveur, la mise a jour optimiste ne casse RIEN', () => {
    // C est le cas quand l app est plus recente que le serveur : la liste doit
    // sortir intacte, et surtout GARDER l identite de son tableau `data` —
    // une liste dont l identite change relance sa pagination.
    const donnees = [{ documentId: 'chat-1' }, { documentId: 'chat-2' }];
    const avant = {
      pages: [{ data: donnees, meta: { pagination: { page: 1 } } }],
    };

    const apres = applyOptimisticChatRead(avant, 'chat-1');

    expect(apres).not.toBe(avant);
    expect(apres.pages[0].data).toBe(donnees);
    expect(apres.pages[0].meta.unreadTotal).toBeUndefined();
  });

  test('une liste absente ou d une autre forme traverse sans dommage', () => {
    expect(applyOptimisticChatRead(undefined, 'chat-1')).toBeUndefined();
    expect(applyOptimisticChatRead(null, 'chat-1')).toBeNull();

    const plat = { data: [{ documentId: 'chat-1', unreadCount: 2 }], meta: { unreadTotal: 2 } };
    const apres = applyOptimisticChatRead(plat, 'chat-1');
    expect(apres.data[0].unreadCount).toBe(0);
    expect(apres.meta.unreadTotal).toBe(0);
  });
});

describe('AE06 temoin 7bis — le repli de lecture ne doit plus perdre le total', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('quand la reponse ne passe pas le controle de forme, unreadTotal survit', async () => {
    const { getChats } = require('@/services/chat/chatService');

    // Un fil sans `type` : le controle de forme refuse la reponse et le service
    // bascule sur son repli. Ce repli reconstruisait `meta` de zero — le total
    // de la pastille disparaissait donc en SILENCE, sans erreur nulle part.
    mockGet.mockResolvedValueOnce({
      data: {
        data: [{
          createdAt: '2026-08-23T09:00:00.000Z',
          documentId: 'chat-1',
          messages: [],
          unreadCount: 4,
          updatedAt: '2026-08-23T10:00:00.000Z',
        }],
        meta: {
          pagination: { page: 1, pageCount: 1, total: 1 },
          unreadTotal: 12,
        },
      },
    });

    const reponse = await getChats();

    expect(reponse.meta.unreadTotal).toBe(12);
    expect(reponse.meta.pagination.page).toBe(1);
    expect(reponse.data[0].unreadCount).toBe(4);
  });

  test('un serveur qui ne compte pas ne fabrique pas un total a zero', async () => {
    const { getChats } = require('@/services/chat/chatService');

    mockGet.mockResolvedValueOnce({
      data: {
        data: [{ documentId: 'chat-1', messages: [] }],
        meta: { pagination: { page: 1, pageCount: 1, total: 1 } },
      },
    });

    const reponse = await getChats();

    // Pas de clef du tout : c est ce qui permet a l app de reconnaitre un
    // serveur muet et de retomber sur son ancien calcul.
    expect('unreadTotal' in reponse.meta).toBe(false);
  });
});
