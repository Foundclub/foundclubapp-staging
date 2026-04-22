import { buildPadelScorePayload } from './leagueScoreDetails';

describe('leagueScoreDetails', () => {
  it('derives a padel match score from two won sets', () => {
    const result = buildPadelScorePayload([
      { a: '6', b: '4' },
      { a: '7', b: '6' },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.scoreA).toBe(2);
    expect(result.scoreB).toBe(0);
    expect(result.scoreDetails.scoreLabel).toBe('6-4 7-6');
  });

  it('rejects padel scores without a 2-set winner', () => {
    const result = buildPadelScorePayload([
      { a: '6', b: '4' },
      { a: '4', b: '6' },
    ]);

    expect(result.error).toBe('Le vainqueur doit gagner 2 sets.');
  });
});
