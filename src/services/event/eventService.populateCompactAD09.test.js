const mockGet = jest.fn();

// Lot AD09 - « la couleur vient de l'installation », versant CARTES.
// Les listes de cartes allument deja `useFacilityAccentColor`, mais le populate
// compact ne demandait au serveur que `documentId` et `name` de l'installation :
// la couleur choisie par le club n'arrivait JAMAIS, et EventCardNew retombait en
// silence sur son repli par hachage du nom.

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
 * Declenche un appel compact et rend le `populate` REELLEMENT envoye au serveur.
 * @returns {Promise<any>}
 */
const readCompactPopulate = async () => {
  mockGet.mockResolvedValueOnce(emptyPage);
  await getEvents({ compact: true, viewerDocumentId: 'user-doc-1' });

  expect(mockGet).toHaveBeenCalledTimes(1);
  const [url, config] = mockGet.mock.calls[0];
  expect(url).toBe('/events');
  return config?.params?.populate;
};

describe('AD09 - le populate compact des cartes d evenement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('AD09 · temoin 6 — le populate compact des cartes demande planningColor', async () => {
    const populate = await readCompactPopulate();

    expect(populate?.facility?.fields).toContain('planningColor');
  });

  test('AD09 · temoin 7 — le populate compact n a rien perdu au passage', async () => {
    const populate = await readCompactPopulate();

    expect(populate?.facility?.fields).toContain('documentId');
    expect(populate?.facility?.fields).toContain('name');

    // Les autres relations peuplees restent exactement celles d'avant : ce
    // temoin est le garde-fou qui interdit qu'un ajout d'un champ emporte une
    // relation au passage.
    expect(Object.keys(populate).sort()).toEqual([
      'club',
      'facility',
      'invitedTeams',
      'league_match',
      'missings',
      'parentEvent',
      'participationRequests',
      'participations',
      'team',
      'tournamentActivity',
      'tournamentCategory',
      'tournamentSection',
      'type',
    ]);
    expect(populate?.club?.fields).toEqual(['documentId', 'name', 'addressDetails']);
    expect(populate?.invitedTeams?.fields).toEqual(['documentId', 'name']);
    expect(populate?.league_match?.fields).toEqual(['documentId']);
    expect(populate?.parentEvent?.fields).toEqual(['documentId']);
  });
});
