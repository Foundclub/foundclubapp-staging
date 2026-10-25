import {
  getMaskedLeagueSide,
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

// C07 / P10-05 — en ligue anonyme, on masque l ADVERSAIRE du lecteur, pas
// toujours l equipe B : un joueur de l equipe B voyait sa propre composition
// masquee, et le nom et l effectif complets de son adversaire.
describe('getMaskedLeagueSide', () => {
  const avantMatch = {
    phase: 'opponent_found',
    status: 'scheduled',
    team_a: { sport: 'Futsal' },
    team_b: { sport: 'Futsal' },
  };

  test('masque l equipe A pour un joueur de l equipe B', () => {
    expect(getMaskedLeagueSide(avantMatch, 'b')).toBe('a');
  });

  test('masque l equipe B pour un joueur de l equipe A, ou pour un tiers', () => {
    expect(getMaskedLeagueSide(avantMatch, 'a')).toBe('b');
    expect(getMaskedLeagueSide(avantMatch, null)).toBe('b');
  });

  test('ne masque rien quand l anonymat ne s applique pas', () => {
    expect(getMaskedLeagueSide({ ...avantMatch, phase: 'valid', status: 'valid' }, 'b')).toBeNull();
    expect(getMaskedLeagueSide({
      ...avantMatch,
      team_a: { sport: 'Football a 11' },
      team_b: { sport: 'Football a 11' },
    }, 'b')).toBeNull();
  });
});
