// BH10 P10-15 : le classement lit TOUTES les pages, pas les 25 premieres equipes.
const mockGet = jest.fn();

jest.mock('@/domains/auth/authUseCases', () => ({ getAuthTokens: jest.fn(() => null) }));
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (...args) => mockGet(...args) },
}));

const { getRanking } = require('./leagueTeamService');

const page = (from, count, pageNumber, pageCount) => ({
  data: {
    data: Array.from({ length: count }, (_, index) => ({ documentId: `team-${from + index}` })),
    meta: { pagination: { page: pageNumber, pageCount } },
  },
});

test('P10-15 : la 26e equipe et les suivantes apparaissent', async () => {
  mockGet.mockImplementation((url, { params }) => {
    const pageNumber = params?.pagination?.page || 1;
    return Promise.resolve(pageNumber === 1 ? page(1, 25, 1, 2) : page(26, 5, 2, 2));
  });

  const ranking = await getRanking(5);

  expect(ranking).toHaveLength(30);
  expect(ranking[29].documentId).toBe('team-30');
});
