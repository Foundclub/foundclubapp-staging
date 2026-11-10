// CARTEFIN (27/10/2026) — la « prochaine marche » de la fin du parcours (planche v2, partie 8,
// écran 7) : la marche suivante la plus simple, calculée avec le barème de la carte.
// RATTRAPAGE (10/11/2026) : barème « 150 A » (cases 40, carte complète +15, parcours 15 dès
// 1 club, équipe 15, matchs 10 + 5 ; paliers 40 / 65 / 85).
import { computeNextRarityStep, RARITY } from '../cardModel';

describe('CARTEFIN — la prochaine marche de rareté', () => {
  test('une case de la carte suffit : c est la marche la plus simple', () => {
    // 12 cases (37) + 1 club (15) + équipe (15) = 67, épique ; la 13e case (+3 et +15) : 85.
    expect(computeNextRarityStep({
      clubCount: 1, fill: 12, isTeamMember: true, matchCount: 0,
    })).toEqual({
      actions: [{ count: 1, kind: 'fill' }],
      next: RARITY.LEGENDARY,
      rarity: RARITY.EPIC,
      score: 67,
    });
  });

  test('carte pleine : un seul club du parcours suffit', () => {
    // carte pleine (55), rare ; épique à 65 : 1 club (70).
    expect(computeNextRarityStep({
      clubCount: 0, fill: 13, isTeamMember: false, matchCount: 0,
    }).actions).toEqual([{ count: 1, kind: 'clubs' }]);
  });

  test('à égalité de gestes, la carte avant le parcours', () => {
    // 12 cases (37) : rare à 40. 1 case (55) ou 1 club (52) : 1 geste, la carte d abord.
    expect(computeNextRarityStep({
      clubCount: 0, fill: 12, isTeamMember: false, matchCount: 0,
    }).actions).toEqual([{ count: 1, kind: 'fill' }]);
  });

  test('ce que l on fait seul passe avant l équipe et les matchs', () => {
    // 10 cases (31) + équipe (15) = 46 ; épique à 65 : 3 cases (70), pas de match.
    expect(computeNextRarityStep({
      clubCount: 0, fill: 10, isTeamMember: true, matchCount: 0,
    }).actions).toEqual([{ count: 3, kind: 'fill' }]);
  });

  test('carte pleine et parcours, sans équipe : une équipe suffit pour Légendaire', () => {
    // 55 + 15 = 70, épique ; légendaire à 85 : équipe (+15), aucun match.
    expect(computeNextRarityStep({
      clubCount: 1, fill: 13, isTeamMember: false, matchCount: 0,
    })).toEqual({
      actions: [{ count: 1, kind: 'team' }],
      next: RARITY.LEGENDARY,
      rarity: RARITY.EPIC,
      score: 70,
    });
  });

  test('légendaire sans aucun match : plus de marche', () => {
    expect(computeNextRarityStep({
      clubCount: 1, fill: 13, isTeamMember: true, matchCount: 0,
    })).toEqual({
      actions: [], next: null, rarity: RARITY.LEGENDARY, score: 85,
    });
  });

  test('tout : 100', () => {
    expect(computeNextRarityStep({
      clubCount: 3, fill: 13, isTeamMember: true, matchCount: 20,
    })).toEqual({
      actions: [], next: null, rarity: RARITY.LEGENDARY, score: 100,
    });
  });
});
