const mockGet = jest.fn();

jest.mock('@/domains/auth/authUseCases', () => ({ getAuthTokens: jest.fn(() => null) }));
jest.mock('@/services/client', () => ({ __esModule: true, default: { get: mockGet } }));

const { searchSquads } = require('../leagueTeamService');

// BH09 P2-06 : la recherche foot à 5 ne doit pas rendre les équipes de foot à 11.
test('football5 exclut les équipes de foot à 11', async () => {
  mockGet.mockResolvedValue({
    data: { data: [
      { documentId: 'a', name: 'Cinq', sport: 'football5' },
      { documentId: 'b', name: 'Onze', sport: 'football11' },
      { documentId: 'c', name: 'Salle', sport: 'futsal' },
    ] },
  });
  const result = await searchSquads({ sport: 'football5' });
  const list = Array.isArray(result) ? result : (result?.data || []);
  expect(list.map((t) => t.documentId).sort()).toEqual(['a', 'c']);
});
