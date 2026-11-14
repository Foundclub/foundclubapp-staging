const mockGet = jest.fn();

// EVT-AUTRE-PLANNING (13/11, M1179 « À modifier ») — la carte de la liste
// « Événements à partir de » disait « Seniors E » au lieu du nom d un « Autre » :
// `EventCardNew` lit `customName` (EVT-AUTRE-NOM), mais la liste COMPACTE ne le
// demandait pas au serveur (`?fields` = seules ces colonnes reviennent).

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

const { getEvents } = require('./eventService');

const emptyPage = {
  data: {
    data: [],
    meta: {
      pagination: {
        page: 1,
        pageCount: 0,
        pageSize: 10,
        total: 0,
      },
    },
  },
};

/**
 * Declenche un appel et rend les `fields` REELLEMENT envoyes au serveur.
 * @param {Record<string, any>} params Parametres de la liste.
 * @returns {Promise<string[] | undefined>}
 */
const readFields = async (params) => {
  mockGet.mockResolvedValueOnce(emptyPage);
  await getEvents(params);

  const [url, config] = mockGet.mock.calls[0];
  expect(url).toBe('/events');
  return config?.params?.fields;
};

describe('EVT-AUTRE-PLANNING — la liste compacte demande le nom d un « Autre »', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('EVTAUTREPLAN-app/1 — les champs compacts contiennent customName', async () => {
    const fields = await readFields({ compact: true, viewerDocumentId: 'user-doc-1' });

    expect(fields).toContain('customName');
  });

  test('EVTAUTREPLAN-app/2 — rien d autre ne change dans les champs compacts', async () => {
    const fields = await readFields({ compact: true, viewerDocumentId: 'user-doc-1' });

    const base = ['documentId', 'name', 'date', 'startTime', 'endTime'];
    expect(fields).toEqual(expect.arrayContaining(base));
    const autres = (fields || []).filter((field) => field !== 'customName');
    expect(autres).toHaveLength(26);
  });

  test('EVTAUTREPLAN-app/3 — la liste complete ne restreint toujours rien', async () => {
    const fields = await readFields({ compact: false, viewerDocumentId: 'user-doc-1' });

    expect(fields).toBeUndefined();
  });
});
