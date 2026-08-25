const mockGet = jest.fn();

jest.mock('../client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
  },
}));

jest.mock('@/domains/guidance/guidanceRuntime', () => ({
  emitGuidanceAction: jest.fn(),
}));

const mockLoggerWarn = jest.fn();

jest.mock('@/utils/logger/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: mockLoggerWarn,
  })),
}));

const { getChatById, getChatMessages } = require('./chatService');

describe('chatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getChatById accepts multisport chat details without participants', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          createdAt: '2026-06-05T18:14:40.174Z',
          documentId: 'chat-multisport-1',
          messages: [],
          multisportClub: {
            admins: [{ documentId: 'user-1' }],
            documentId: 'multisport-1',
            name: 'Union Demo Omnisports',
          },
          type: 'multisport',
          updatedAt: '2026-06-05T22:00:09.189Z',
        },
      },
    });

    await expect(getChatById('chat-multisport-1')).resolves.toMatchObject({
      documentId: 'chat-multisport-1',
      multisportClub: {
        admins: [{ documentId: 'user-1' }],
        documentId: 'multisport-1',
      },
      type: 'multisport',
    });

    expect(mockGet).toHaveBeenCalledWith('/chats/chat-multisport-1', {
      params: {
        chat: 'chat-multisport-1',
      },
    });
  });
  // 🧾 S10-C / D4 — LE MESSAGE SYSTEME DU FIL D'EQUIPE.
  //
  // S10-A (D8bis) va poster dans le fil de l'equipe invitee un message SANS
  // expediteur (`sender: null`, motif deja en service :
  // admin/matchmaking-engine.js:1343 et post-slot-resolution.js:159).
  //
  // 🧨 MESURE AVANT CORRECTIF : `sender: Joi.object().required()` refusait
  // `null`. UNE ligne systeme faisait donc tomber la PAGE ENTIERE de messages
  // dans le repli non valide (chatService.js:203-223) — les bulles
  // s'affichaient quand meme, mais plus aucun message de la page n'etait
  // valide, et un avertissement partait a chaque ouverture. C'est le piege
  // « une liste validee EN BLOC meurt pour UNE ligne », 4e occurrence.
  test('getChatMessages valide une page portant un message systeme', async () => {
    const systemMessage = {
      createdAt: '2026-08-26T09:00:00.000Z',
      documentId: 'msg-systeme-1',
      message: 'Ton equipe est invitee au match. Accepte ou refuse depuis la fiche.',
      sender: null,
      updatedAt: '2026-08-26T09:00:00.000Z',
    };
    const humanMessage = {
      createdAt: '2026-08-26T09:05:00.000Z',
      documentId: 'msg-humain-1',
      message: 'On y va !',
      sender: { documentId: 'user-1' },
      updatedAt: '2026-08-26T09:05:00.000Z',
    };

    mockGet.mockResolvedValueOnce({
      data: {
        data: [systemMessage, humanMessage],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 20,
            total: 2,
          },
        },
      },
    });

    const result = await getChatMessages('chat-equipe-1', 1, 20);

    // 🪤 CE QUI TRANCHE, ET RIEN D'AUTRE : le repli rend EXACTEMENT la meme
    // forme (memes messages, meme pagination recopiee). Compter les lignes ou
    // relire la pagination laisse donc le temoin VERT sur le code casse.
    // Le seul signe observable du repli est son avertissement.
    expect(mockLoggerWarn).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(2);
    expect(result.data[0].sender).toBeNull();
  });
});
