import { canOpenProposalRouteForMatch } from './proposalRouteIntent';

describe('canOpenProposalRouteForMatch', () => {
  it('allows reopening the proposal flow while the match is still negotiating', () => {
    expect(canOpenProposalRouteForMatch({
      status: 'negotiating',
    })).toBe(true);
  });

  it('blocks stale proposal intents once the match moved to score entry', () => {
    expect(canOpenProposalRouteForMatch({
      phase: 'waiting_score',
      status: 'scheduled',
      venueBooked: true,
    })).toBe(false);
  });

  it('blocks stale proposal intents once the match is already confirmed', () => {
    expect(canOpenProposalRouteForMatch({
      phase: 'confirmed_upcoming',
      status: 'scheduled',
      venueBooked: true,
    })).toBe(false);
  });
});
