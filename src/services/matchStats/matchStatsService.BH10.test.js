// BH10 P3-10 : `{ data: null }` veut dire « aucune reponse », pas l enveloppe.
const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (...args) => mockGet(...args), post: jest.fn() },
}));

const { getEventMyMatchResponse } = require('./matchStatsService');

test('P3-10 : une absence de reponse rend null', async () => {
  mockGet.mockResolvedValueOnce({ data: { data: null } });
  await expect(getEventMyMatchResponse('event-1', 'team-1')).resolves.toBeNull();
});

test('P3-10 : une reponse presente est deballee', async () => {
  mockGet.mockResolvedValueOnce({ data: { data: { id: 1 } } });
  await expect(getEventMyMatchResponse('event-1', 'team-1')).resolves.toEqual({ id: 1 });
});
