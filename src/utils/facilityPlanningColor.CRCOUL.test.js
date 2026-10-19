import {
  assignClubPlanningColors,
  CLUB_PLANNING_PALETTE,
  FACILITY_PLANNING_PALETTE,
  legendeDesClubs,
} from './facilityPlanningColor';

const purple = FACILITY_PLANNING_PALETTE[5];
const invalid = `${String.fromCharCode(35)}123456`;
const a = { documentId: 'a', name: 'AS A', planningColor: purple.toLowerCase() };
const b = { documentId: 'b', name: 'US B' };
const bloc = (club) => ({ club });

describe('CRCOUL 2 — choix de la Ville avant automatique', () => {
  it('priorise le choix de la liste, sans changer le rang automatique des autres clubs', () => {
    const colors = assignClubPlanningColors([bloc(a), bloc(b)], [a, b]);
    expect(colors.map((x) => x.displayColor)).toEqual([purple, CLUB_PLANNING_PALETTE[1]]);
  });
  it('ancien serveur, null ou couleur invalide : automatique sans erreur', () => {
    const clubs = [b, { ...a, planningColor: invalid }];
    expect(assignClubPlanningColors([bloc(a)], clubs)[0].displayColor).toBe(
      CLUB_PLANNING_PALETTE[1],
    );
    expect(
      assignClubPlanningColors([bloc({ ...a, planningColor: null })], [b, a])[0]
        .displayColor,
    ).toBe(purple);
  });
  it('deux clubs de meme couleur restent tous deux dans la legende', () => {
    const clubs = [a, { ...b, planningColor: purple }];
    expect(legendeDesClubs(assignClubPlanningColors(clubs.map(bloc), clubs))).toEqual([
      { couleur: purple, nom: 'AS A' },
      { couleur: purple, nom: 'US B' },
    ]);
  });
});
