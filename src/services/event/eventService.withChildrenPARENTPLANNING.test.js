const mockGet = jest.fn();

// PARENT-PLANNING (06/10/2026) — la liste « mes equipes » du planning demande AUSSI les
// evenements a venir des enfants mineurs du lecteur (`withChildren`, lu par le serveur avec
// `myTeams`), et la marque du serveur (`viewerChildren`, `viewerChildrenOnly`,
// `meta.viewerChildren`) traverse la validation de la reponse jusqu a l ecran.

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

const { getEvents, getMyPlanning } = require('./eventService');

const HUGO = { documentId: 'hugo', firstname: 'Hugo' };
const PAGE = {
  data: {
    data: [{
      date: '2026-12-05T17:00:00.000Z',
      documentId: 'e1',
      name: 'Entrainement U15',
      viewerChildren: [HUGO],
      viewerChildrenOnly: true,
    }],
    meta: {
      pagination: {
        page: 1, pageCount: 1, pageSize: 10, total: 1,
      },
      viewerChildren: [HUGO],
    },
  },
};

describe('PARENT-PLANNING — getEvents et les evenements des enfants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('3-12 ROUGE-AVANT — `withChildren` part au serveur, a cote de `myTeams`', async () => {
    mockGet.mockResolvedValueOnce(PAGE);
    await getEvents({
      compact: true, myTeams: true, viewerDocumentId: 'paul', withChildren: true,
    });
    const [, config] = mockGet.mock.calls[0];
    expect(config.params.myTeams).toBe(true);
    expect(config.params.withChildren).toBe(true);
  });

  test('3-13 PROTEGE — sans `withChildren`, la requete ne le porte pas', async () => {
    mockGet.mockResolvedValueOnce(PAGE);
    await getEvents({ compact: true, myTeams: true, viewerDocumentId: 'paul' });
    const [, config] = mockGet.mock.calls[0];
    expect(Object.prototype.hasOwnProperty.call(config.params, 'withChildren')).toBe(false);
  });

  test('3-17 ROUGE-AVANT — le calendrier d un parent demande ses enfants', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    await getMyPlanning({ from: '2026-12-01', to: '2026-12-07', withChildren: true });
    expect(mockGet).toHaveBeenCalledWith(
      '/users/me/planning?from=2026-12-01&to=2026-12-07&withChildren=true',
    );
  });

  test('3-18 PROTEGE — sans le drapeau, l adresse du calendrier ne change pas', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [] } });
    await getMyPlanning({ from: '2026-12-01', to: '2026-12-07' });
    expect(mockGet).toHaveBeenCalledWith('/users/me/planning?from=2026-12-01&to=2026-12-07');
  });

  test('3-14 — la marque du serveur arrive a l ecran (la validation la garde)', async () => {
    mockGet.mockResolvedValueOnce(PAGE);
    const reponse = await getEvents({ compact: true, myTeams: true, withChildren: true });
    expect(reponse.data[0].viewerChildren).toEqual([HUGO]);
    expect(reponse.data[0].viewerChildrenOnly).toBe(true);
    expect(/** @type {any} */ (reponse.meta).viewerChildren).toEqual([HUGO]);
  });
});
