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

jest.mock('@/utils/logger/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
  })),
}));

const { getChatById } = require('./chatService');

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
});
