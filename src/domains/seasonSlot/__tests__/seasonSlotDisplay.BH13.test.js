import { fullRangesOfSlots, seanceDeplacee } from '../seasonSlotDisplay';

describe('BH13 créneaux de saison', () => {
  it('P1-07 : un créneau retiré (effectiveUntil) ne compte plus comme occupé', () => {
    const a = { weekday: 1, startTime: '10:00', endTime: '11:00', validFrom: '2026-09-01', validUntil: '2027-06-30', effectiveUntil: '2026-09-30' };
    const b = { weekday: 1, startTime: '10:00', endTime: '11:00', validFrom: '2026-10-05', validUntil: '2027-06-30' };
    expect(fullRangesOfSlots([a, b], 2)).toEqual([]);
  });
  it('P1-19 : même jour = pas déplacée, quel que soit le fuseau', () => {
    const seance = { date: '2026-10-05', startTime: '10:00:00', endTime: '11:00:00', facility: { documentId: 'f' } };
    const saisie = { facilityId: 'f', jour: '2026-10-05', debut: '10:00', fin: '11:00' };
    const tz = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try { expect(seanceDeplacee(seance, saisie)).toBe(false); } finally { process.env.TZ = tz; }
  });
});
