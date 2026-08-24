const mockGet = jest.fn();

// Lot R9 (vague R du 24/08) — LE TROU DE POPULATE QUI RENDAIT UN CANDIDAT
// INVISIBLE SOUS SON POSTE.
//
// 🧨 LE DEFAUT MESURE : l'ecran d'une detection range ses candidats par poste en
// lisant `participation.recruitmentAd.documentId` (EventDetails.js, memos
// `detectionSlots` et `detectionPositionSections`). Or les deux populate qui
// descendent `participationRequests` ne demandaient QUE `user`, `user.avatar` et
// `sourceTeam` : le lien vers l'annonce n'arrivait JAMAIS. Resultat a l'ecran,
// et c'est le constat de recette du 24/08 : un candidat n'apparait NI dans les
// candidats du poste avant sa validation, NI dans la liste du poste apres.
//
// 🪤 POURQUOI AUCUN TEST NE L'AVAIT VU : les fixtures des suites d'ecran posent
// `recruitmentAd` a la main sur les demandes embarquees. Elles decrivent donc un
// serveur plus genereux que le vrai. Ce filet-ci regarde la REQUETE REELLEMENT
// ENVOYEE, pas une fixture — c'est le seul endroit ou le trou se voit.

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

const { getEventById, getEvents } = require('./eventService');

const emptyList = {
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

const oneEvent = {
  data: {
    data: {
      date: '2099-01-01T10:00:00.000Z',
      documentId: 'event-1',
    },
  },
};

/**
 * Declenche la lecture d'UN evenement et rend le `populate` reellement envoye.
 * @returns {Promise<string[]>}
 */
const lirePopulateDeLaFiche = async () => {
  mockGet.mockResolvedValueOnce(oneEvent);
  await getEventById('event-1');

  expect(mockGet).toHaveBeenCalledTimes(1);
  const [url, config] = mockGet.mock.calls[0];
  expect(url).toBe('/events/event-1');
  return config?.params?.populate;
};

/**
 * Declenche la lecture de la LISTE complete et rend le `populate` envoye.
 * @returns {Promise<string[]>}
 */
const lirePopulateDeLaListe = async () => {
  mockGet.mockResolvedValueOnce(emptyList);
  await getEvents({});

  expect(mockGet).toHaveBeenCalledTimes(1);
  const [url, config] = mockGet.mock.calls[0];
  expect(url).toBe('/events');
  return config?.params?.populate;
};

describe('R9 - le lien vers l annonce voyage avec la demande de participation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('R9 · temoin 1 — la FICHE d un evenement demande participationRequests.recruitmentAd', async () => {
    const populate = await lirePopulateDeLaFiche();

    expect(populate).toContain('participationRequests.recruitmentAd');
  });

  test('R9 · temoin 2 — la LISTE complete le demande aussi', async () => {
    const populate = await lirePopulateDeLaListe();

    expect(populate).toContain('participationRequests.recruitmentAd');
  });

  test('R9 · temoin 3 — les trois relations d avant sont INTACTES des deux cotes', async () => {
    // 🔒 Le garde-fou du lot : ajouter une relation ne doit pas en emporter une
    // autre au passage. `user` porte le nom affiche, `user.avatar` la photo et
    // `sourceTeam` distingue un membre convie d un candidat externe.
    const populateFiche = await lirePopulateDeLaFiche();

    expect(populateFiche).toContain('participationRequests.user');
    expect(populateFiche).toContain('participationRequests.user.avatar');
    expect(populateFiche).toContain('participationRequests.sourceTeam');

    jest.clearAllMocks();
    const populateListe = await lirePopulateDeLaListe();

    expect(populateListe).toContain('participationRequests.user');
    expect(populateListe).toContain('participationRequests.user.avatar');
    expect(populateListe).toContain('participationRequests.sourceTeam');
  });
});
