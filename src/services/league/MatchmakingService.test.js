const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
    post: mockPost,
  },
}));

const MatchmakingService = require('./MatchmakingService').default;

describe('MatchmakingService.cancelRequest', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore?.();
  });

  test('resolves true when the backend accepts the cancellation', async () => {
    mockPost.mockResolvedValueOnce({ data: { status: 'cancelled' } });

    await expect(MatchmakingService.cancelRequest('request-doc-1')).resolves.toBe(true);

    expect(mockPost).toHaveBeenCalledWith('/matchmaking-request/cancel', {
      requestId: 'request-doc-1',
    });
  });

  test('throws a structured error when the backend refuses the cancellation', async () => {
    mockPost.mockRejectedValueOnce({
      code: 'ERR_BAD_REQUEST',
      response: {
        data: {
          code: 'UNAUTHORIZED_TEAM_ACTION',
          details: { code: 'UNAUTHORIZED_TEAM_ACTION' },
          message: 'Only squad captain or co-captain can cancel this matchmaking request',
        },
        status: 403,
      },
    });

    await expect(MatchmakingService.cancelRequest('request-doc-2')).rejects.toMatchObject({
      code: 'UNAUTHORIZED_TEAM_ACTION',
      details: { code: 'UNAUTHORIZED_TEAM_ACTION' },
      message: 'Only squad captain or co-captain can cancel this matchmaking request',
      status: 403,
    });
  });
});
