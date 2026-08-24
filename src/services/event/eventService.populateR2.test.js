const mockGet = jest.fn();

// Lot R2 (vague R du 24/08) — LE TROU DE POPULATE QUI VOLAIT LE NOM DE
// L'EVENEMENT.
//
// 🧨 LE DEFAUT MESURE : inviter une equipe de SON PROPRE club sur un evenement
// faisait que l'evenement PRENAIT LE NOM de cette equipe (« Match vs U15 B ») et
// se comportait comme un match CONTRE elle. La regle qui designe l'adversaire
// (`eventDisplayName.js`) ne regarde que les EQUIPES ; pour regarder aussi leur
// CLUB, encore faut-il que le club ARRIVE. Il n'etait demande dans AUCUN des
// trois populate de ce service.
//
// 🪤 POURQUOI AUCUN TEST NE L'AVAIT VU : les fixtures des suites d'ecran posent
// `club` a la main sur les equipes invitees quand elles en ont besoin. Elles
// decrivent donc un serveur plus genereux que le vrai. Ce filet-ci regarde la
// REQUETE REELLEMENT ENVOYEE — c'est le seul endroit ou le trou se voit.
//
// ⛔ LA MOITIE SERVEUR VOYAGE AVEC : `admin/src/api/event/utils/find-one-populate.ts`
// est un ALLOWLIST. Ce qui n'y figure pas est RETIRE, meme quand l'app le
// demande. Ces trois temoins sont donc necessaires, jamais suffisants.

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
 * @returns {Promise<any>} Le populate envoye au serveur.
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
 * @returns {Promise<any>} Le populate envoye au serveur.
 */
const lirePopulateDeLaListe = async () => {
  mockGet.mockResolvedValueOnce(emptyList);
  await getEvents({});

  expect(mockGet).toHaveBeenCalledTimes(1);
  const [url, config] = mockGet.mock.calls[0];
  expect(url).toBe('/events');
  return config?.params?.populate;
};

/**
 * Declenche la lecture de la vue REDUITE des cartes et rend le `populate` envoye.
 * @returns {Promise<any>} Le populate envoye au serveur.
 */
const lirePopulateCompact = async () => {
  mockGet.mockResolvedValueOnce(emptyList);
  await getEvents({ compact: true });

  expect(mockGet).toHaveBeenCalledTimes(1);
  const [, config] = mockGet.mock.calls[0];
  return config?.params?.populate;
};

describe('R2 - le club des equipes invitees voyage jusqu a l ecran', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('R2 · temoin 1 — la FICHE demande invitedTeams.club', async () => {
    const populate = await lirePopulateDeLaFiche();

    expect(populate).toContain('invitedTeams.club');
  });

  test('R2 · temoin 2 — la LISTE complete le demande aussi', async () => {
    const populate = await lirePopulateDeLaListe();

    expect(populate).toContain('invitedTeams.club');
  });

  test('R2 · temoin 3 — la vue REDUITE des cartes le demande aussi', async () => {
    // Les cartes affichent le nom de l'evenement comme la fiche : sans le club,
    // une carte continuerait d'annoncer « Match vs <notre propre equipe> ».
    const populate = await lirePopulateCompact();

    expect(populate?.invitedTeams?.populate?.club).toBeTruthy();
  });

  test('R2 · temoin 4 — ce qui voyageait deja est INTACT des trois cotes', async () => {
    // 🔒 Le garde-fou du lot : ajouter une relation ne doit pas en emporter une
    // autre au passage. `name` est ce qui s'affiche, `documentId` ce qui
    // distingue notre equipe de l'invitee.
    const populateFiche = await lirePopulateDeLaFiche();
    expect(populateFiche).toContain('invitedTeams');
    expect(populateFiche).toContain('invitedTeams.players');
    expect(populateFiche).toContain('team.club');

    jest.clearAllMocks();
    const populateListe = await lirePopulateDeLaListe();
    expect(populateListe).toContain('invitedTeams');
    expect(populateListe).toContain('team.club');

    jest.clearAllMocks();
    const populateCompact = await lirePopulateCompact();
    expect(populateCompact?.invitedTeams?.fields).toContain('documentId');
    expect(populateCompact?.invitedTeams?.fields).toContain('name');
  });
});
