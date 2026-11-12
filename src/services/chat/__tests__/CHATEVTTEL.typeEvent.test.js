// ==========================================================================
// CHAT-EVT-TEL (12/11/2026) — M1176, iPhone 2.6.99 : le chat d'un événement s'ouvre en
// « Canal d'annonce (lecture seule) ».
//
// LA CAUSE : `getChatById` valide la réponse de GET /chats/:id avec une liste blanche de types
// (Joi `.valid(...)`). `event` n'y était pas : la validation JETAIT (« Failed to fetch chat »),
// `useGetChatById` restait sans donnée, et `canWrite` (Conversation.js) rend `false` dès que
// `chatData` manque — avant même de lire le type. L'en-tête, lui, tient par `route.params`
// (chatType: 'event') et `useChatDeLEvenement`, d'où un écran « presque normal ».
// Le site ne le voyait pas : son `joi` est une doublure qui valide tout (web/src/shims/joi.ts).
//
// LA FORME DE LA RÉPONSE vient du serveur du train 8 (en prod), chemin rapide :
// admin src/api/chat/controllers/chat.ts, `findOne` → `toSafeChatDetailItem(fastEntity)` :
// `toSafeChatBase` (documentId, createdAt, groupName, type, updatedAt, id) + les aperçus lus
// dans `chat_detail_snapshot` (archivedBy, club, groupAdmins, league_match, multisportClub,
// participants, pinnedBy, team), puis `withChatStaffRoles`.
// ==========================================================================

const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: mockGet },
}));

jest.mock('@/domains/guidance/guidanceRuntime', () => ({ emitGuidanceAction: jest.fn() }));

const mockLoggerWarn = jest.fn();
jest.mock('@/utils/logger/logger', () => ({
  createLogger: jest.fn(() => ({ info: jest.fn(), warn: mockLoggerWarn })),
}));

const { getChatById, getChats } = require('@/services/chat/chatService');

// Ce que GET /chats/:id rend pour un chat d'événement (chemin rapide du train 8).
const DETAIL_CHAT_EVENEMENT = {
  archivedBy: [],
  club: null,
  createdAt: '2026-11-12T15:58:00.000Z',
  documentId: 'chat-evenement-1',
  groupAdmins: [],
  groupName: 'Autre - 13/11/2026 - U20',
  id: 1589,
  league_match: null,
  multisportClub: null,
  participants: [
    {
      documentId: 'membre-1', firstname: 'Prénom', lastname: 'Nom', username: 'membre1',
    },
  ],
  pinnedBy: [],
  team: null,
  type: 'event',
  updatedAt: '2026-11-12T15:58:00.000Z',
};

// L'énumération du serveur (admin src/api/chat/content-types/chat/schema.json, train 8 et 9).
// Tout type que le serveur peut rendre doit passer la validation du téléphone.
const TYPES_DU_SERVEUR = [
  'whisper', 'club', 'team', 'multisport', 'league_match', 'friendly_match', 'group',
  'collectivite_conversation', 'collectivite_dirigeants', 'collectivite_club',
  'collectivite_ville', 'assistance', 'event',
];

beforeEach(() => { jest.clearAllMocks(); });

describe('CHAT-EVT-TEL — le chat d\'un événement passe la validation du détail', () => {
  test('getChatById rend le chat d\'événement tel que le serveur du train 8 le sert', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: DETAIL_CHAT_EVENEMENT } });
    await expect(getChatById('chat-evenement-1')).resolves.toMatchObject({
      documentId: 'chat-evenement-1',
      type: 'event',
    });
  });

  test.each(TYPES_DU_SERVEUR)('le type serveur « %s » passe getChatById', async (type) => {
    mockGet.mockResolvedValueOnce({ data: { data: { ...DETAIL_CHAT_EVENEMENT, type } } });
    await expect(getChatById('chat-1')).resolves.toMatchObject({ type });
  });

  test('getChats valide une page avec un chat d\'événement, sans avertissement', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [DETAIL_CHAT_EVENEMENT],
        meta: {
          pagination: {
            page: 1, pageCount: 1, pageSize: 20, total: 1,
          },
        },
      },
    });
    await getChats({ page: 1, pageSize: 20 });
    expect(mockLoggerWarn).not.toHaveBeenCalledWith(
      'Chat list schema mismatch, using fallback payload',
      expect.anything(),
    );
  });
});
