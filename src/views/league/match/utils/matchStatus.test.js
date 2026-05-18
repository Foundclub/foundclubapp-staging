import {
  getMatchDerivedPhase,
  shouldMaskOpponentIdentity,
} from '@/views/league/match/utils/matchStatus';

describe('matchStatus football11', () => {
  test('scheduled football11 matches are confirmed without venue booking', () => {
    const phase = getMatchDerivedPhase({
      status: 'scheduled',
      team_a: { sport: 'Football a 11' },
      team_b: { sport: 'Football a 11' },
      venueBooked: false,
    });

    expect(phase).toBe('confirmed_upcoming');
  });

  test('football11 opponents are never anonymized', () => {
    const masked = shouldMaskOpponentIdentity({
      phase: 'opponent_found',
      status: 'scheduled',
      team_a: { sport: 'Football a 11' },
      team_b: { sport: 'Football a 11' },
    });

    expect(masked).toBe(false);
  });
});
