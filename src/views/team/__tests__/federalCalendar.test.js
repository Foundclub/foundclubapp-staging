/* eslint-disable max-len */
import { federalMatchDeadlineTs, federalMatchResult } from '../federalCalendar';

describe('calendrier fédéral (BH12)', () => {
  it('P12-03 : un match joué sans score ne compte pas comme un nul', () => {
    expect(federalMatchResult(null, null)).toBe('');
    expect(federalMatchResult('', 2)).toBe('');
    expect(federalMatchResult(2, 1)).toBe('V');
    expect(federalMatchResult(1, 1)).toBe('N');
    expect(federalMatchResult('0', 3)).toBe('D');
  });

  it('P12-04 : une date sans heure reste « à venir » toute la journée', () => {
    const date = '2026-10-24';
    const midiLocal = new Date(2026, 9, 24, 12, 0, 0).getTime();
    const deadline = federalMatchDeadlineTs(date, new Date(date).getTime());
    expect(deadline >= midiLocal).toBe(true);
    const avecHeure = '2026-10-24T10:00:00Z';
    expect(federalMatchDeadlineTs(avecHeure, new Date(avecHeure).getTime())).toBe(new Date(avecHeure).getTime());
  });
});
