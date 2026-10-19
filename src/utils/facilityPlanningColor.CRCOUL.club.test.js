import {
  assignClubPlanningColors,
  CLUB_PLANNING_PALETTE,
  FACILITY_PLANNING_PALETTE,
} from './facilityPlanningColor';
import { normalizePlanningItems } from './planning/planningSlots';

const purple = FACILITY_PLANNING_PALETTE[5];
const club = { documentId: 'b', name: 'US B', planningColor: purple };
const event = (id, value) => ({
  club: value,
  documentId: id,
  endAt: '2026-10-14T17:00:00.000Z',
  startAt: '2026-10-14T16:00:00.000Z',
});
it(
  [
    'CRCOUL 3 : planning membre normalise, la couleur du serveur prime',
    'et reste stable selon la semaine',
  ].join(' '),
  () => {
    const alone = assignClubPlanningColors(normalizePlanningItems([event('b', club)]));
    const withOther = assignClubPlanningColors(
      normalizePlanningItems([
        event('a', {
          documentId: 'a',
          name: 'AS A',
          planningColor: CLUB_PLANNING_PALETTE[0],
        }),
        event('b', club),
      ]),
    );
    expect(alone[0].displayColor).toBe(purple);
    expect(withOther[1].displayColor).toBe(alone[0].displayColor);
  },
);
it('CRCOUL 3 : ancien serveur ou champ abime : repli automatique sans erreur', () => {
  const colors = assignClubPlanningColors(
    normalizePlanningItems([
      event('a', {
        documentId: 'a',
        name: 'AS A',
        planningColor: `${String.fromCharCode(35)}123456`,
      }),
      event('b', { documentId: 'b', name: 'US B' }),
    ]),
  );
  expect(colors.map((x) => x.displayColor)).toEqual(CLUB_PLANNING_PALETTE.slice(0, 2));
});
it('CRCOUL 3 : la liste Ville relue en automatique prime sur les blocs encore en cache', () => {
  const [value] = assignClubPlanningColors(normalizePlanningItems([event('b', club)]), [
    { documentId: 'b', name: 'US B', planningColor: null },
  ]);
  expect(value.displayColor).toBe(CLUB_PLANNING_PALETTE[0]);
});
