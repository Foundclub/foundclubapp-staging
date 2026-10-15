import { createEventParticipation } from '../eventParticipationService';

const mockPost = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { post: (...args) => mockPost(...args) },
}));
jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));
jest.mock('@/domains/guidance/guidanceRuntime', () => ({ emitGuidanceAction: jest.fn() }));

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue({ data: { documentId: 'request-test' } });
});

test.each([true, false])(
  'transmet le consentement reel %s hors des attributs Strapi',
  async (accepted) => {
    await createEventParticipation({
      acceptRiskDeclaration: accepted, event: 'event-1', user: 'user-1',
    });
    expect(mockPost).toHaveBeenCalledWith('/event-participations', {
      acceptRiskDeclaration: accepted,
      data: { event: 'event-1', user: 'user-1' },
    });
  },
);

test('une ancienne demande sans consentement garde son enveloppe', async () => {
  await createEventParticipation({ event: 'event-1', user: 'user-1' });
  expect(mockPost).toHaveBeenCalledWith('/event-participations', {
    data: { event: 'event-1', user: 'user-1' },
  });
});
