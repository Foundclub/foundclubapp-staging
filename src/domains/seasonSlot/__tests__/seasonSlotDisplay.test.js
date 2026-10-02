import {
  formatPeriod,
  freeRanges,
  fullRanges,
  fullRangesOfSlots,
  groupSlotsByWeekday,
  momentLabel,
  overCapacityPreviewOf,
  seasonSlotErrorMessage,
  seasonYears,
  slotWho,
  summarizeInstallationWeek,
  toMinutes,
  weekdayName,
} from '../seasonSlotDisplay';

// COLL-C2B (02/10) — ce que l ecran DIT d un creneau de saison : fonctions pures, temoin direct.

const t = (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle;

describe('seasonSlotDisplay — jours, heures, periodes', () => {
  it('les jours ISO : 1 = lundi, 7 = dimanche, en long et en court', () => {
    expect(weekdayName(1)).toBe('Lundi');
    expect(weekdayName(4)).toBe('Jeudi');
    expect(weekdayName(7)).toBe('Dimanche');
    expect(weekdayName(3, { short: true })).toBe('Mer.');
    expect(weekdayName(0)).toBe('');
    expect(weekdayName(8)).toBe('');
  });

  it('les heures en minutes, et la periode lisible', () => {
    expect(toMinutes('17:30')).toBe(1050);
    expect(toMinutes('18:00:00.000')).toBe(1080);
    expect(toMinutes('dix-huit heures')).toBeNull();
    expect(formatPeriod('2026-09-01', '2027-06-30')).toBe('1 sept. 2026 – 30 juin 2027');
    expect(formatPeriod('2026-09-01', '2027-06-30', { withYear: false })).toBe('1 sept. – 30 juin');
    expect(seasonYears({ validFrom: '2026-09-01', validUntil: '2027-06-30' }))
      .toEqual({ debut: '2026', fin: '2027' });
  });

  it('« club · equipe », ou le club seul (creneau pour tout le club, D5)', () => {
    expect(slotWho({ club: { name: 'AS Montrivage' }, team: { name: 'U15' } }))
      .toBe('AS Montrivage · U15');
    expect(slotWho({ club: { name: 'AS Montrivage' }, team: null })).toBe('AS Montrivage');
  });

  it('les creneaux ranges par jour puis par heure, les jours vides omis', () => {
    const jours = groupSlotsByWeekday([
      { documentId: 'b', startTime: '19:00', weekday: 2 },
      { documentId: 'a', startTime: '17:30', weekday: 2 },
      { documentId: 'c', startTime: '10:00', weekday: 6 },
    ]);
    expect(jours.map((jour) => jour.weekday)).toEqual([2, 6]);
    expect(jours[0].slots.map((creneau) => creneau.documentId)).toEqual(['a', 'b']);
  });
});

describe('seasonSlotDisplay — complet, libre', () => {
  it('le complet : la ou les places sont toutes prises en meme temps', () => {
    // 2 places : 18:00-19:30 et 18:00-19:30 se chevauchent, 17:30-19:00 ajoute une 3e equipe.
    expect(fullRanges([{ end: 10, start: 0 }, { end: 20, start: 5 }], 2))
      .toEqual([{ end: 10, start: 5 }]);
    expect(fullRanges([{ end: 10, start: 0 }, { end: 20, start: 10 }], 2)).toEqual([]);
    expect(fullRangesOfSlots([
      { endTime: '19:30', startTime: '18:00' },
      { endTime: '19:30', startTime: '18:00' },
    ], 2)).toEqual([{ end: 1170, start: 1080 }]);
  });

  it('le libre : l ouverture moins ce qui est occupe', () => {
    expect(freeRanges([{ end: 1170, start: 1080 }], 480, 1320))
      .toEqual([{ end: 1080, start: 480 }, { end: 1320, start: 1170 }]);
    expect(freeRanges([], 480, 1320)).toEqual([{ end: 1320, start: 480 }]);
    expect(freeRanges([{ end: 1400, start: 400 }], 480, 1320)).toEqual([]);
  });

  it('la semaine d une installation : combien de seances, et le premier moment complet', () => {
    const bloc = (/** @type {string} */ debut, /** @type {string} */ fin) => ({
      endTime: `${fin}:00.000`,
      hasExplicitTime: true,
      startAt: `2026-10-01T${debut}:00.000+02:00`,
      startTime: `${debut}:00.000`,
    });
    const deux = { data: [bloc('18:00', '19:30'), bloc('18:00', '19:30')] };
    const resume = summarizeInstallationWeek(deux, 2);
    expect(resume.count).toBe(2);
    expect(momentLabel(/** @type {any} */ (resume.full))).toBe('jeu. 18:00 – 19:30');
    expect(summarizeInstallationWeek({ data: [bloc('18:00', '19:30')] }, 2))
      .toEqual({ count: 1, full: null });
    expect(summarizeInstallationWeek({ data: [] }, 2)).toEqual({ count: 0, full: null });
  });
});

describe('seasonSlotDisplay — les refus du serveur', () => {
  it('un 409 de capacite porte son apercu ; un autre refus, non', () => {
    const apercu = { capacity: 2, teamsAfter: 3 };
    const refus = { details: { code: 'SEASON_SLOT_OVER_CAPACITY', preview: apercu } };
    expect(overCapacityPreviewOf(refus))
      .toBe(apercu);
    expect(overCapacityPreviewOf({ details: { code: 'SEASON_SLOT_TEAM_NOT_IN_CLUB' } })).toBeNull();
  });

  it('chaque code connu se dit a la mairie ; un code inconnu laisse la main', () => {
    expect(seasonSlotErrorMessage(t, { details: { code: 'SEASON_SLOT_OUTSIDE_OPENING_HOURS' } }))
      .toBe('Ce créneau sort des horaires d’ouverture de l’installation.');
    expect(seasonSlotErrorMessage(t, { details: { code: 'FACILITY_PLATEAUX_INVALID' } }))
      .toMatch(/plateau/);
    expect(seasonSlotErrorMessage(t, { details: { code: 'AUTRE' } })).toBeNull();
  });
});
