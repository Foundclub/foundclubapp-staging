const mockGet = jest.fn();
const mockPut = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
    put: mockPut,
  },
}));

const { getNotificationById, markApplicationResponsesAsRead } = require('./notificationService');

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getNotificationById fetches the current user notification through the owned list endpoint', async () => {
    const notification = {
      documentId: 'notification-doc-1',
      title: 'Notification',
    };
    mockGet.mockResolvedValue({
      data: {
        data: [notification],
        meta: {
          pagination: {
            page: 1,
            pageCount: 1,
            pageSize: 1,
            total: 1,
          },
        },
      },
    });

    await expect(getNotificationById('notification-doc-1')).resolves.toBe(notification);

    expect(mockGet).toHaveBeenCalledWith('/notifications', {
      params: expect.objectContaining({
        'filters[documentId][$eq]': 'notification-doc-1',
        'pagination[page]': 1,
        'pagination[pageSize]': 1,
      }),
    });
  });

  test('getNotificationById returns null for an empty identifier', async () => {
    await expect(getNotificationById('')).resolves.toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  test('getNotificationById returns null when no owned notification matches', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: [],
        meta: {
          pagination: {
            page: 1,
            pageCount: 0,
            pageSize: 1,
            total: 0,
          },
        },
      },
    });

    await expect(getNotificationById('missing-doc')).resolves.toBeNull();
  });

  // MES-CANDIDATURES (A13) : l'app nomme un PERIMETRE, jamais une liste de types —
  // c'est le serveur qui sait quelles notifications sont des « reponses a mes
  // candidatures », et un perimetre qu'il ne connait pas ne marque rien.
  test('markApplicationResponsesAsRead ne marque que les reponses a mes candidatures', async () => {
    mockPut.mockResolvedValue({ data: { ok: true, updated: 2 } });

    await expect(markApplicationResponsesAsRead()).resolves.toEqual({ ok: true, updated: 2 });

    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockPut).toHaveBeenCalledWith('/notifications/read-all', {
      scope: 'application-responses',
    });
  });
});
