const mockDelete = jest.fn();
jest.mock('@/services/client', () => ({ __esModule: true, default: { delete: mockDelete } }));
jest.mock('@/domains/guidance/guidanceRuntime', () => ({ emitGuidanceAction: jest.fn() }));
const { deleteMessage } = require('../chatService');

describe('IPH09 — contrat DELETE déjà en production 4b848230', () => {
  beforeEach(() => jest.clearAllMocks());
  test('rend les identifiants confirmés par HTTP au cache, sans socket', async () => {
    const data = { chatDocumentId: 'fil', deleted: true, messageDocumentId: 'message' };
    mockDelete.mockResolvedValue({ data });
    await expect(deleteMessage('message')).resolves.toBe(data);
    expect(mockDelete).toHaveBeenCalledWith('/chat-messages/message');
  });
  test('conserve le refus serveur, sans faux succès', async () => {
    const denied = new Error('403');
    mockDelete.mockRejectedValue(denied);
    await expect(deleteMessage('message')).rejects.toBe(denied);
  });
});
