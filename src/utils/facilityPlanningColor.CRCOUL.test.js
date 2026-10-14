import { assignClubPlanningColors, CLUB_PLANNING_PALETTE, legendeDesClubs } from './facilityPlanningColor';

const a = { documentId: 'a', name: 'AS A', planningColor: '#9d4dff' };
const b = { documentId: 'b', name: 'US B' };
const bloc = (club) => ({ club });

describe('CRCOUL 2 — choix de la Ville avant automatique', () => {
  it('priorise le choix de la liste, sans changer le rang automatique des autres clubs', () => {
    const colors = assignClubPlanningColors([bloc(a), bloc(b)], [a, b]);
    expect(colors.map((x) => x.displayColor)).toEqual(['#9D4DFF', CLUB_PLANNING_PALETTE[1]]);
  });
  it('ancien serveur, null ou couleur invalide : automatique sans erreur', () => {
    const clubs = [b, { ...a, planningColor: '#123456' }];
    expect(assignClubPlanningColors([bloc(a)], clubs)[0].displayColor).toBe(CLUB_PLANNING_PALETTE[1]);
    expect(assignClubPlanningColors([bloc({ ...a, planningColor: null })], [b, a])[0].displayColor).toBe('#9D4DFF');
  });
  it('deux clubs de meme couleur restent tous deux dans la legende', () => {
    const clubs = [a, { ...b, planningColor: '#9D4DFF' }];
    expect(legendeDesClubs(assignClubPlanningColors(clubs.map(bloc), clubs))).toEqual([
      { couleur: '#9D4DFF', nom: 'AS A' }, { couleur: '#9D4DFF', nom: 'US B' },
    ]);
  });
});
