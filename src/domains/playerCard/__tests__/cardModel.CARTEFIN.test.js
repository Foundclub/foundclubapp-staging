// CARTEFIN (27/10/2026) — la « prochaine marche » de la fin du parcours (planche v2, partie 8,
// écran 7) : la marche suivante la plus simple, calculée avec le barème de CARTECODE
// (remplissage 50, parcours 15, vie dans FoundClub 35 ; paliers 40 / 65 / 85).
import { computeNextRarityStep, RARITY } from '../cardModel';

describe('CARTEFIN — la prochaine marche de rareté', () => {
  test('une case de la carte suffit : c est la marche la plus simple', () => {
    // 12 cases (46) + 1 club (5) + équipe (10) = 61, rare ; épique à 65.
    expect(computeNextRarityStep({
      clubCount: 1, fill: 12, isTeamMember: true, matchCount: 0,
    })).toEqual({
      actions: [{ count: 1, kind: 'fill' }],
      next: RARITY.EPIC,
      rarity: RARITY.RARE,
      score: 61,
    });
  });

  test('carte pleine : le moins de clubs qui suffit', () => {
    // carte pleine (50) + 1 club (5) = 55, rare ; épique à 65 : 2 clubs.
    expect(computeNextRarityStep({
      clubCount: 1, fill: 13, isTeamMember: false, matchCount: 0,
    }).actions).toEqual([{ count: 2, kind: 'clubs' }]);
  });

  test('à égalité de gestes, la carte avant le parcours', () => {
    // 8 cases (31) : rare à 40. 1 case + 1 club (40) ou 2 clubs (41) : 2 gestes, la carte d abord.
    expect(computeNextRarityStep({
      clubCount: 0, fill: 8, isTeamMember: false, matchCount: 0,
    }).actions).toEqual([{ count: 1, kind: 'fill' }, { count: 1, kind: 'clubs' }]);
  });

  test('ce que l on fait seul passe avant l équipe et les matchs, même en cumulant', () => {
    // 10 cases (38) + équipe (10) = 48 ; épique à 65 : 3 cases + 1 club (65), pas 20 matchs.
    expect(computeNextRarityStep({
      clubCount: 0, fill: 10, isTeamMember: true, matchCount: 0,
    }).actions).toEqual([{ count: 3, kind: 'fill' }, { count: 1, kind: 'clubs' }]);
  });

  test('tout est rempli : les matchs, comptés depuis ceux déjà joués', () => {
    // 50 + 15 + 10 = 75, épique ; légendaire à 85 : 5 matchs (+10), il en a joué 2.
    expect(computeNextRarityStep({
      clubCount: 3, fill: 13, isTeamMember: true, matchCount: 2,
    })).toEqual({
      actions: [{ count: 3, kind: 'matches' }],
      next: RARITY.LEGENDARY,
      rarity: RARITY.EPIC,
      score: 75,
    });
  });

  test('sans équipe : rejoindre une équipe, puis jouer', () => {
    // 50 + 15 = 65, épique ; légendaire à 85 : équipe (75) ne suffit pas, + 5 matchs (85).
    expect(computeNextRarityStep({
      clubCount: 3, fill: 13, isTeamMember: false, matchCount: 0,
    }).actions).toEqual([{ count: 1, kind: 'team' }, { count: 5, kind: 'matches' }]);
  });

  test('légendaire : plus de marche', () => {
    expect(computeNextRarityStep({
      clubCount: 3, fill: 13, isTeamMember: true, matchCount: 20,
    })).toEqual({
      actions: [], next: null, rarity: RARITY.LEGENDARY, score: 100,
    });
  });
});
