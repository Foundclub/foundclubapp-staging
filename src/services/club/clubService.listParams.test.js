const mockGet = jest.fn();

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@/config/runtimeUrls', () => ({
  getUploadEndpoint: jest.fn(() => 'http://localhost:1337/api/upload'),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: jest.fn(() => null),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
  },
}));

const { getClubs } = require('./clubService');

const EMPTY_PAGE = {
  data: {
    data: [],
    meta: {
      pagination: {
        page: 1, pageCount: 0, pageSize: 20, total: 0,
      },
    },
  },
};

/**
 * Joue getClubs et rend les paramètres réellement envoyés à /clubs.
 * @param {Record<string, any>} [params] - Paramètres passés à getClubs.
 * @returns {Promise<Record<string, any>>} - Les params axios de l'appel /clubs.
 */
const captureListParams = async (params = {}) => {
  mockGet.mockResolvedValue(EMPTY_PAGE);
  await getClubs({ includeMultisport: false, ...params });
  const call = mockGet.mock.calls.find(([url]) => url === '/clubs');
  if (!call) throw new Error('getClubs n a pas appele /clubs');
  return call[1].params;
};

describe('buildClubListParams — ce que la liste des clubs charge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Les chips « sections sportives » de ClubCard lisent item.activites[].name.
  // Sans ce populate, le bloc reste masqué en permanence.
  test('charge les sections sportives, en ne demandant que le nom', async () => {
    const params = await captureListParams();

    expect(params.populate.activites).toEqual({ fields: ['name'] });
  });

  // Garde-fou de poids : ces relations sont volumineuses (un club peut avoir
  // des centaines de membres). Les compteurs viennent du serveur, pas d'un
  // populate. Mesuré le 2026-07-31 sur api-staging, 20 clubs :
  // 18 654 o sans activites -> 20 803 o avec (+11,5 %) ; populate=* : 24 339 o.
  test('ne charge ni les membres ni les equipes ni les annonces', async () => {
    const params = await captureListParams();

    expect(params.populate.members).toBeUndefined();
    expect(params.populate.teams).toBeUndefined();
    expect(params.populate.recruitmentAds).toBeUndefined();
  });

  test('garde le logo et les sponsors deja charges', async () => {
    const params = await captureListParams();

    expect(params.populate.logo).toBe(true);
    expect(params.populate.sponsor).toEqual({ populate: ['logo'] });
  });

  test('conserve pagination, tri et filtres existants', async () => {
    const params = await captureListParams({ activity: 'act-1', name: 'smuc', pageSize: 20 });

    expect(params.pagination).toEqual({ page: 1, pageSize: 20 });
    expect(params.sort).toEqual({ clubPartner: 'desc', name: 'asc' });
    expect(params.filters).toEqual({
      activites: { documentId: 'act-1' },
      name: { $containsi: 'smuc' },
    });
  });
});
