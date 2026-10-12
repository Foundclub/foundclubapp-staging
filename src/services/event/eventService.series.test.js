const mockPost = jest.fn();

// SERIES (08/10/2026, decision d'Adel « séries lot », point 3) — UNE SERIE « CHAQUE SEMAINE » EN
// UNE REQUETE. Avant : 36 dates = 36 POST /events (la 1re seule, puis 3 a la fois), 54 s en
// recette (T19). Le serveur neuf pose la serie entiere si la liste des dates voyage A LA RACINE
// du corps (`dates`, comme `announceSeriesLater`) ; un serveur d'avant ignore la racine et ne
// pose que la 1re date (`data`) : l'app le voit (une seance, pas une liste) et pose les suivantes
// date par date. Ce fichier fige `createEventSeries` : - serveur neuf : UN appel, la reponse
// rendue dans la forme de createEventsWithConcurrency (`created[].response.data.status`,
// `failed[]`), l'avancement 0 puis N sur N ; - serveur d'avant : la 1re date posee par l'appel,
// les autres date par date (3 a la fois) ; - serveur neuf qui REFUSE la serie (4xx : rien
// d'ecrit) : date par date, comme avant ; - reseau coupe ou 5xx : AUCUN renvoi date par date (la
// serie a pu etre posee : pas de doublon) ; - une date seule, ou des corps qui different
// autrement que par la date : date par date.

jest.mock('react-native-blob-util', () => ({ fs: {} }));
jest.mock('@/config/runtimeUrls', () => ({ getApiBaseUrl: jest.fn(() => 'http://localhost:1337') }));
jest.mock('@/domains/auth/authUseCases', () => ({ getAuthTokens: jest.fn(() => null) }));
jest.mock('@/domains/guidance/guidanceRuntime', () => ({ emitGuidanceAction: jest.fn() }));
jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));
jest.mock('@/services/client', () => ({ __esModule: true, default: { post: mockPost } }));
jest.mock('@/utils/logger/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn(),
  })),
}));

const { createEventSeries } = require('./eventService');

const jeudi = (/** @type {number} */ semaine) => {
  const jour = new Date(Date.UTC(2031, 0, 9 + 7 * semaine, 18, 0));
  const fin = new Date(jour.getTime() + 90 * 60000);
  return { date: jour.toISOString(), endDate: fin.toISOString() };
};
const corps = (/** @type {number} */ semaine) => ({
  club: 'club-A',
  facility: 'gym-ville',
  name: '',
  recurrenceGroupId: 'serie-1',
  sessionStatus: 'closed',
  startTime: '19:00:00.000',
  team: 'equipe-1',
  type: 'type-entr',
  ...jeudi(semaine),
});
const SERIE = [0, 1, 2, 3, 4].map(corps);

// Le serveur neuf : la serie posee, la 3e date refusee (complet).
// eslint-disable-next-line max-len
const serveurNeuf = () => mockPost.mockImplementation(async (/** @type {string} */ _url, /** @type {any} */ body) => {
  // eslint-disable-next-line max-len
  if (!Array.isArray(body?.dates)) return { data: { data: { documentId: 'ev-seule', status: 'confirmed' } } };
  const posees = body.dates.filter((/** @type {any} */ _d, /** @type {number} */ i) => i !== 2);
  return {
    data: {
      data: posees.map((/** @type {any} */ d, /** @type {number} */ i) => ({
        date: d.date,
        documentId: `ev-${i}`,
        endDate: d.endDate,
        id: i + 1,
        pendingReason: 'facility_overbooking',
        status: 'pending_validation',
      })),
      meta: {
        series: {
          // eslint-disable-next-line max-len
          awaitingCity: 4, awaitingClub: 0, created: 4, failed: [{ code: 'EVENT_SLOT_CONFLICT', date: body.dates[2].date }], total: 5,
        },
      },
    },
  };
});

/** Un serveur d'avant ce lot : il ignore `dates`, pose `data` et rend UNE seance. */
const serveurAvant = () => {
  let rang = 0;
  mockPost.mockImplementation(async () => {
    rang += 1;
    // eslint-disable-next-line max-len
    return { data: { data: { documentId: `ev-${rang}`, pendingReason: 'facility_overbooking', status: 'pending_validation' } } };
  });
};

beforeEach(() => {
  mockPost.mockReset();
});

describe('SERIES — une série en une requête (createEventSeries)', () => {
  // eslint-disable-next-line max-len
  test('serveur neuf : UN appel, `dates` à la racine, la réponse dans la forme d’avant, l’avancement juste', async () => {
    serveurNeuf();
    const avancement = jest.fn();
    const rendu = await createEventSeries(SERIE, {
      announceSeriesLater: true, concurrency: 3, onProgress: avancement, suppressCelebration: true,
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, envoye] = mockPost.mock.calls[0];
    expect(url).toBe('/events');
    expect(envoye.announceSeriesLater).toBe(true);
    expect(envoye.data).toEqual(SERIE[0]);
    expect(envoye.dates).toEqual(SERIE.map(({ date, endDate }) => ({ date, endDate })));
    expect(rendu.created).toHaveLength(4);
    // eslint-disable-next-line max-len
    expect(rendu.created[0].response.data).toEqual(expect.objectContaining({ documentId: 'ev-0', status: 'pending_validation' }));
    // eslint-disable-next-line max-len
    expect(rendu.created.map((/** @type {any} */ c) => c.payload)).toEqual([SERIE[0], SERIE[1], SERIE[3], SERIE[4]]);
    expect(rendu.failed).toHaveLength(1);
    expect(rendu.failed[0].payload).toBe(SERIE[2]);
    expect(rendu.failed[0].error.response.data.error.details.code).toBe('EVENT_SLOT_CONFLICT');
    expect(rendu.series).toEqual(expect.objectContaining({ awaitingCity: 4, total: 5 }));
    expect(avancement.mock.calls.map(([p]) => `${p.completed}/${p.total}`)).toEqual(['0/5', '5/5']);
  });

  // eslint-disable-next-line max-len
  test('serveur d’avant : la 1re date posée par l’appel, les suivantes date par date, trois à la fois', async () => {
    serveurAvant();
    const avancement = jest.fn();
    // eslint-disable-next-line max-len
    const rendu = await createEventSeries(SERIE, { concurrency: 3, onProgress: avancement, suppressCelebration: true });
    expect(mockPost).toHaveBeenCalledTimes(5);
    expect(mockPost.mock.calls[0][1].dates).toHaveLength(5);
    mockPost.mock.calls.slice(1).forEach(([, body], i) => {
      expect(body).not.toHaveProperty('dates');
      expect(body.data).toEqual(SERIE[i + 1]);
    });
    expect(rendu.created).toHaveLength(5);
    expect(rendu.created[0].payload).toBe(SERIE[0]);
    expect(rendu.series).toBeNull();
    // eslint-disable-next-line max-len
    expect(avancement.mock.calls.at(-1)[0]).toEqual(expect.objectContaining({ completed: 5, total: 5 }));
  });

  // eslint-disable-next-line max-len
  test('serveur neuf qui refuse la série (400, rien d’écrit) : date par date, comme avant', async () => {
    let premier = true;
    mockPost.mockImplementation(async (/** @type {string} */ _u, /** @type {any} */ body) => {
      if (premier && Array.isArray(body?.dates)) {
        premier = false;
        // eslint-disable-next-line max-len
        throw Object.assign(new Error('400'), { response: { data: { error: { details: { code: 'EVENT_SERIES_JUDGE_UNAVAILABLE' } } }, status: 400 } });
      }
      return { data: { data: { documentId: `ev-${body.data.date}`, status: 'confirmed' } } };
    });
    const rendu = await createEventSeries(SERIE, { concurrency: 3, suppressCelebration: true });
    expect(mockPost).toHaveBeenCalledTimes(6);
    expect(rendu.created).toHaveLength(5);
    expect(rendu.failed).toHaveLength(0);
  });

  test('réseau coupé ou 5xx : AUCUN renvoi date par date (la série a pu être posée)', async () => {
    mockPost.mockRejectedValue(Object.assign(new Error('Network Error'), { response: undefined }));
    const rendu = await createEventSeries(SERIE, { concurrency: 3, suppressCelebration: true });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(rendu.created).toHaveLength(0);
    expect(rendu.failed).toHaveLength(5);
    mockPost.mockReset();
    mockPost.mockRejectedValue(Object.assign(new Error('502'), { response: { status: 502 } }));
    await createEventSeries(SERIE, { concurrency: 3, suppressCelebration: true });
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  // eslint-disable-next-line max-len
  test('une date seule, ou des corps qui diffèrent autrement que par la date : date par date', async () => {
    serveurAvant();
    await createEventSeries([SERIE[0]], { suppressCelebration: true });
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('dates');
    mockPost.mockReset();
    serveurAvant();
    // eslint-disable-next-line max-len
    await createEventSeries([SERIE[0], { ...SERIE[1], name: 'Autre' }], { suppressCelebration: true });
    expect(mockPost).toHaveBeenCalledTimes(2);
    mockPost.mock.calls.forEach(([, body]) => expect(body).not.toHaveProperty('dates'));
  });
});
