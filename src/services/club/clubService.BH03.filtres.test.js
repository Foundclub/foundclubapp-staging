const mockGet = jest.fn();
const mockPut = jest.fn();
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
    put: mockPut,
  },
}));

const { getClubs } = require('./clubService');

// BH03 · P1-11 — une recherche FILTREE (activite, partenaire, client) ajoutait en tete
// des clubs multisports NON filtres, et gonflait `pagination.total`.
const CLUB = {
  address: { city: 'Marseille', label: '1 rue du Stade' },
  clubPartner: true,
  documentId: 'club-1',
  id: 1,
  maxTeamNumber: 3,
  name: 'SMUC Football',
};
const PAGINATION = {
  page: 1, pageCount: 1, pageSize: 7, total: 1,
};

describe('BH03 · P1-11 — getClubs filtre', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockImplementation((url) => Promise.resolve({
      data: url === '/clubs'
        ? { data: [CLUB], meta: { pagination: PAGINATION } }
        : { data: [], meta: { pagination: { ...PAGINATION, total: 4 } } },
    }));
  });

  test.each([
    [{ activity: 'football' }],
    [{ clubPartner: true }],
    [{ isCustomer: true }],
  ])('%p : aucun club multisport ajoute', async (params) => {
    const result = await getClubs(params);
    expect(mockGet.mock.calls.map(([url]) => url)).toEqual(['/clubs']);
    expect(result.meta.pagination.total).toBe(1);
  });
});
