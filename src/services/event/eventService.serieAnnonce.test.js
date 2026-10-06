const mockPost = jest.fn();

// SERIE-ANNONCE (06/10/2026, decision du chef « serie A ») — l'app pose les dates d'une serie
// en disant « j'annoncerai » (`announceSeriesLater: true`, A LA RACINE du corps de POST /events :
// un serveur d'avant ce lot refuse en 400 une cle inconnue de `data`, il ignore la racine), puis
// appelle UNE fois POST /events/:id/announce-series. Ce fichier fige le SERVICE : la forme des
// deux appels, et le drapeau transmis par les deux poseurs en lot (l'assistant, la demande de
// creneau a la Ville).

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
    post: mockPost,
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

const {
  announceEventSeries,
  createEvent,
  createEventsSequentially,
  createEventsWithConcurrency,
} = require('./eventService');

const DATE = { name: '', recurrenceGroupId: 'serie-1', team: 'equipe-1' };

beforeEach(() => {
  mockPost.mockReset();
  let numero = 0;
  mockPost.mockImplementation(async () => {
    numero += 1;
    return { data: { data: { documentId: `ev-${numero}` } } };
  });
});

describe('SERIE-ANNONCE — le service d\'evenements', () => {
  test('createEvent « j\'annoncerai » : le drapeau est A LA RACINE, jamais dans data', async () => {
    await createEvent(DATE, { announceSeriesLater: true, suppressCelebration: true });
    expect(mockPost).toHaveBeenCalledWith('/events', { announceSeriesLater: true, data: DATE });
    expect(mockPost.mock.calls[0][1].data).not.toHaveProperty('announceSeriesLater');
  });

  test('createEvent sans l\'option : le corps d\'avant, au caractere pres', async () => {
    await createEvent(DATE, { suppressCelebration: true });
    expect(mockPost).toHaveBeenCalledWith('/events', { data: DATE });
  });

  test('announceEventSeries : POST /events/:id/announce-series, UNE fois, sa reponse', async () => {
    mockPost.mockResolvedValueOnce({ data: { data: { announced: true, count: 3 } } });
    const reponse = await announceEventSeries('ev-1');
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith('/events/ev-1/announce-series');
    expect(reponse).toEqual({ data: { announced: true, count: 3 } });
  });

  test('announceEventSeries sans identifiant : aucun appel', async () => {
    await expect(announceEventSeries('')).resolves.toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  test('l\'assistant (3 de front) transmet le drapeau a CHAQUE date', async () => {
    const dates = [DATE, { ...DATE, name: 'b' }, { ...DATE, name: 'c' }];
    const { created } = await createEventsWithConcurrency(dates, {
      announceSeriesLater: true, concurrency: 3, suppressCelebration: true,
    });
    expect(created).toHaveLength(3);
    expect(mockPost).toHaveBeenCalledTimes(3);
    mockPost.mock.calls.forEach(([, corps]) => expect(corps.announceSeriesLater).toBe(true));
  });

  test('la demande de creneau (date apres date) le transmet ; rien sans l\'option', async () => {
    await createEventsSequentially([DATE, DATE], {
      announceSeriesLater: true, suppressCelebration: true,
    });
    await createEventsSequentially([DATE], { suppressCelebration: true });
    expect(mockPost.mock.calls.map(([, corps]) => corps.announceSeriesLater))
      .toEqual([true, true, undefined]);
  });
});
