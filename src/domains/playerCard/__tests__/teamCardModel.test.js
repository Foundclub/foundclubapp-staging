// Tests jest de la logique pure de la carte equipe.
// A executer dans le projet app : `yarn jest teamCardModel`.
import {
  buildRecruitingNeeds, buildTeamBacks, buildTeamCardModel, resolveMemberNumber,
} from '../teamCardModel';

const NOW = new Date('2026-07-11T12:00:00Z');

describe('teamCardModel - carte equipe', () => {
  test('resolveMemberNumber deterministe + explicite', () => {
    const a = resolveMemberNumber({ documentId: 'p1' }, 0);
    expect(a).toBe(resolveMemberNumber({ documentId: 'p1' }, 0));
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThanOrEqual(99);
    expect(resolveMemberNumber({ jerseyNumber: 7 }, 3)).toBe(7);
  });

  test('buildTeamBacks : dos floques, limite 6', () => {
    const players = Array.from({ length: 9 }, (_, i) => ({ documentId: `p${i}`, lastname: `nom${i}` }));
    const backs = buildTeamBacks(players);
    expect(backs).toHaveLength(6);
    expect(backs[0].name).toBe('NOM0');
    expect(backs[0].number).toBeGreaterThanOrEqual(1);
  });

  test('buildRecruitingNeeds : agrege par poste, exclut expirees/inactives', () => {
    const ads = [
      { audienceType: 'player', position: 'Gardien', quantity: 1 },
      { audienceType: 'player', position: 'Gardien', quantity: 2 },
      { audienceType: 'coach', coachRole: 'entraineur_adjoint', quantity: 1 },
      {
        audienceType: 'coach', coachRole: 'other', coachRoleOther: 'Kine', quantity: 1,
      },
      {
        audienceType: 'player', expirationDate: '2020-01-01', position: 'Ailier', quantity: 1,
      },
      {
        audienceType: 'player', isActive: false, position: 'Avant', quantity: 1,
      },
    ];
    const needs = buildRecruitingNeeds(ads, NOW);
    expect(needs.find((n) => n.label === 'Gardien').quantity).toBe(3);
    expect(needs.find((n) => n.audienceType === 'coach' && n.label === 'Entraineur adjoint')).toBeTruthy();
    expect(needs.find((n) => n.label === 'Kine')).toBeTruthy();
    expect(needs.find((n) => n.label === 'Ailier')).toBeFalsy();
    expect(needs.find((n) => n.label === 'Avant')).toBeFalsy();
  });

  test('buildTeamCardModel : modele complet', () => {
    const model = buildTeamCardModel({
      now: NOW,
      qrUrl: 'https://foundclub.app/install.html',
      recruitmentAds: [{ audienceType: 'player', position: 'Gardienne', quantity: 1 }],
      team: {
        activities: [{ name: 'Football' }],
        club: { city: 'Lyon', name: 'OL' },
        name: 'U17 Feminines',
        players: [{ documentId: 'p1', lastname: 'Durand' }, { documentId: 'p2', lastname: 'Bernard' }],
      },
    });
    expect(model.audience).toBe('team');
    expect(model.teamName).toBe('U17 FEMININES');
    expect(model.hasClub).toBe(true);
    expect(model.sport).toBe('Football');
    expect(model.rosterCount).toBe(2);
    expect(model.backs).toHaveLength(2);
    expect(model.isRecruiting).toBe(true);
    expect(model.recruitingNeeds[0].label).toBe('Gardienne');
  });
});
