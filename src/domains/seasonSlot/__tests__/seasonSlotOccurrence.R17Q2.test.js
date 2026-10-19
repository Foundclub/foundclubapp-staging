// 🗓️ R17-QUAND-2, point 2 (REC17-007 Q3) — LA RÈGLE DE L'APP, MIROIR DU SERVEUR : un créneau
// « sauf vacances scolaires » ne tombe pas un jour que le serveur a retiré pour vacances
// (`holidayDates`), comme un jour retiré une à une (`skippedDates`). Pas une 2e règle :
// `slotOccursOn` lit les deux listes. Avant (ROUGE) : `holidayDates` était ignoré.
// Exemple de la planche P11-quand-v2-tel : 2026-2027, zone B, mercredi : 37 mercredis, 8 retirés.

import {
  fullRangesOfSlots, slotOccurrences, slotOccursOn, slotShape,
} from '../seasonSlotDisplay';

const HUIT = [
  '2026-10-21', '2026-10-28', '2026-12-23', '2026-12-30',
  '2027-02-24', '2027-03-03', '2027-04-21', '2027-04-28',
];
const MERCREDI = {
  endTime: '19:00', startTime: '17:30', validFrom: '2026-10-21', validUntil: '2027-06-30', weekday: 3,
};
const SAUF = { ...MERCREDI, exceptHolidays: true, holidayDates: HUIT };

describe('R17-QUAND-2 — « sauf vacances » dans la règle de l’app', () => {
  it('la planche : 37 mercredis, 29 sauf vacances ; le 21 oct. tombe, le 4 nov. revient', () => {
    expect(slotOccurrences(MERCREDI)).toHaveLength(37);
    expect(slotOccurrences(SAUF)).toHaveLength(29);
    expect(slotOccursOn(SAUF, '2026-10-21')).toBe(false);
    expect(slotOccursOn(SAUF, '2026-11-04')).toBe(true);
  });

  it('la forme dit la case et ses jours ; un retrait « cette date seulement » reste à part', () => {
    const forme = slotShape({
      ...MERCREDI,
      exceptHolidays: true,
      holidayDates: ['2026-10-28', '2026-10-21'],
      skippedDates: ['2026-11-04'],
    });
    expect(forme.exceptHolidays).toBe(true);
    expect(forme.holidayDates).toEqual(['2026-10-21', '2026-10-28']);
    expect(forme.skippedDates).toEqual(['2026-11-04']);
    expect(slotShape(MERCREDI)).toMatchObject({ exceptHolidays: false, holidayDates: [] });
  });

  it('la place : « sauf vacances » et un créneau des mercredis de la Toussaint ne se croisent pas', () => {
    const toussaint = {
      ...MERCREDI, dates: ['2026-10-21', '2026-10-28'], recurrence: 'dates', weekday: null,
    };
    // Deux places : le « sauf vacances » n'est pas là les jours de la Toussaint, l'autre n'est
    // là qu'eux ; jamais deux équipes le même jour.
    expect(fullRangesOfSlots([SAUF, toussaint], 2)).toEqual([]);
    // Sans la case, ils se croisent les 21 et 28 oct. : plein.
    expect(fullRangesOfSlots([{ ...MERCREDI }, toussaint], 2)).toEqual([{ end: 1140, start: 1050 }]);
  });
});
