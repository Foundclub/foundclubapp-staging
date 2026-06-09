const mockGet = jest.fn();

jest.mock('react-native-blob-util', () => ({
  fs: {},
}));

jest.mock('@/config/runtimeUrls', () => ({
  getApiBaseUrl: jest.fn(() => 'http://localhost:1337'),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: jest.fn(() => null),
}));

jest.mock('@/domains/guidance/guidanceRuntime', () => ({
  emitGuidanceAction: jest.fn(),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({
  celebrate: jest.fn(),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
  },
}));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  })),
}));

const { getEventByIdForEdit } = require('./eventService');

describe('eventService edit projection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getEventByIdForEdit requests the lightweight edit projection', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          date: '2025-01-01T00:00:00.000Z',
        },
      },
    });

    await expect(getEventByIdForEdit('event-doc-1')).resolves.toMatchObject({
      date: new Date('2025-01-01T00:00:00.000Z'),
    });

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/events/event-doc-1', {
      params: {
        projection: 'edit',
      },
    });
  });
});
