// BH10 P2-14 : le client rejette `response.data.error` (erreur Strapi a plat) :
// le code « matchmaking ferme » est dans `details.code`, au premier niveau.
const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (...args) => mockGet(...args), post: jest.fn() },
}));

const MatchmakingService = require('./MatchmakingService').default;

test('P2-14 : un refus Strapi a plat garde son code et ses details', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGet.mockRejectedValueOnce({
    details: { code: 'LEAGUE_MATCHMAKING_CLOSED', runtime: { effectiveMatchmakingIsOpen: false } },
    message: 'Matchmaking closed',
    name: 'ForbiddenError',
    status: 403,
  });

  await expect(MatchmakingService.getActiveRequest('team-doc-1')).rejects.toMatchObject({
    code: 'LEAGUE_MATCHMAKING_CLOSED',
    details: { code: 'LEAGUE_MATCHMAKING_CLOSED' },
    status: 403,
  });
});
