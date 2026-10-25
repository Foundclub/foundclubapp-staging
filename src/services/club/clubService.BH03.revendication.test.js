const mockGet = jest.fn();
const mockPut = jest.fn();
const mockPost = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@/config/runtimeUrls', () => ({
  getUploadEndpoint: jest.fn(() => 'http://localhost:1337/api/upload'),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: jest.fn(() => null),
}));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: mockLoggerWarn,
  })),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
  },
}));

const { claimClub } = require('./clubService');

// BH03 · P11-19 — revendication de club refusee par le serveur : la RAISON (code,
// details) etait jetee, l'ecran ne pouvait afficher qu'un message generique.
describe('BH03 · P11-19 — claimClub garde la raison du refus', () => {
  it('le code et les details du serveur survivent', async () => {
    mockPost.mockRejectedValueOnce({
      message: 'Request failed with status code 403',
      response: {
        data: {
          error: {
            code: 'CLUB_ALREADY_CLAIMED',
            details: { scope: 'claim' },
            message: 'Forbidden',
          },
        },
        status: 403,
      },
    });

    await expect(claimClub('club-1')).rejects.toMatchObject({
      code: 'CLUB_ALREADY_CLAIMED',
      details: { scope: 'claim' },
      status: 403,
    });
  });
});
