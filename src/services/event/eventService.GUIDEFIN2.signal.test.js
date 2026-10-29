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
// GUIDE-FINITIONS-2 N11 (rejeu du guide Entraîneur, capture 39) : B1 visait la 1re séance
// créée en M3 même déjà passée. Le signal `event.created` porte désormais toutes les dates
// posées, pour que le guide vise la prochaine. Témoin aussi de ce qu'il portait déjà.
const mockPost = jest.fn();
const { emitGuidanceAction } = require('@/domains/guidance/guidanceRuntime');

const { createEvent, createEventSeries } = require('./eventService');

const corps = (jour) => ({
  date: `2031-01-${jour}T18:00:00.000Z`,
  endDate: `2031-01-${jour}T19:30:00.000Z`,
  recurrenceGroupId: 'serie-1',
  team: 'equipe-1',
  type: 'type-entr',
});

beforeEach(() => {
  mockPost.mockReset();
  emitGuidanceAction.mockClear();
});

it('une séance : documentId, type (témoin) et sa date', async () => {
  mockPost.mockResolvedValue({ data: { data: { documentId: 'ev-1' } } });
  await createEvent(corps('09'));
  expect(emitGuidanceAction).toHaveBeenCalledWith('event.created', expect.objectContaining({
    documentId: 'ev-1',
    eventType: 'type-entr',
  }));
  expect(emitGuidanceAction.mock.calls[0][1].dates).toEqual([
    { date: '2031-01-09T18:00:00.000Z', documentId: 'ev-1', endDate: '2031-01-09T19:30:00.000Z' },
  ]);
});

it('une série : la 1re (témoin), le nombre, et chaque date posée', async () => {
  mockPost.mockImplementation(async (_url, body) => ({
    data: {
      data: body.dates.map((d, i) => ({ date: d.date, documentId: `ev-${i}`, endDate: d.endDate })),
    },
  }));
  await createEventSeries([corps('09'), corps('16')], { suppressCelebration: true });
  const meta = emitGuidanceAction.mock.calls.find((call) => call[0] === 'event.created')[1];
  expect(meta).toEqual(expect.objectContaining({ documentId: 'ev-0', occurrences: 2 }));
  expect(meta.dates).toEqual([
    { date: '2031-01-09T18:00:00.000Z', documentId: 'ev-0', endDate: '2031-01-09T19:30:00.000Z' },
    { date: '2031-01-16T18:00:00.000Z', documentId: 'ev-1', endDate: '2031-01-16T19:30:00.000Z' },
  ]);
});
