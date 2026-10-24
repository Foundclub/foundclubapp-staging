/* eslint-disable max-len -- entrées du rapport BUGHUNT, gardées telles quelles */
import { fullRangesOfSlots, seanceDeplacee } from '../seasonSlotDisplay';

describe('BH13 créneaux de saison', () => {
  it('P1-07 : un créneau retiré (effectiveUntil) ne compte plus comme occupé', () => {
    const a = {
      effectiveUntil: '2026-09-30', endTime: '11:00', startTime: '10:00', validFrom: '2026-09-01', validUntil: '2027-06-30', weekday: 1,
    };
    const b = {
      endTime: '11:00', startTime: '10:00', validFrom: '2026-10-05', validUntil: '2027-06-30', weekday: 1,
    };
    expect(fullRangesOfSlots([a, b], 2)).toEqual([]);
  });
  it('P1-19 : même jour = pas déplacée, quel que soit le fuseau', () => {
    const seance = {
      date: '2026-10-05', endTime: '11:00:00', facility: { documentId: 'f' }, startTime: '10:00:00',
    };
    const saisie = {
      debut: '10:00', facilityId: 'f', fin: '11:00', jour: '2026-10-05',
    };
    const tz = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try { expect(seanceDeplacee(seance, saisie)).toBe(false); } finally { process.env.TZ = tz; }
  });
});
