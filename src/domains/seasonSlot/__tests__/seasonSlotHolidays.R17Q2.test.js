// 🌴 R17-QUAND-2, point 3 (REC17-007 Q3, planches P11-quand-v2-tel / -ordi) — LES VACANCES DANS
// « QUAND ? » : les séances d'une forme qui tombent pendant les vacances de la zone, période par
// période (la liste « Vacances retirées · zone B », décochable) ; les périodes qu'un créneau
// existant garde ; les mots (« 8 retirés pendant les vacances : Toussaint, Noël, hiver,
// printemps »). Les périodes viennent du serveur (aperçu `holidays.periods`).
// Avant (ROUGE) : le module n'existe pas.

import {
  creneauxEnVacances, nomDeVacances, periodesGardeesDuCreneau, vacancesDesSeances,
} from '../seasonSlotHolidays';

const PERIODES = [
  {
    end: '2026-11-01', key: '2026-2027:toussaint', name: 'Toussaint', start: '2026-10-17',
  },
  {
    end: '2027-01-03', key: '2026-2027:noel', name: 'Noël', start: '2026-12-19',
  },
  {
    end: '2027-03-07', key: '2026-2027:hiver', name: 'Hiver', start: '2027-02-20',
  },
  {
    end: '2027-05-02', key: '2026-2027:printemps', name: 'Printemps', start: '2027-04-17',
  },
];
const MERCREDIS = [
  '2026-10-21', '2026-10-28', '2026-11-04', '2026-12-23', '2026-12-30', '2027-01-06',
  '2027-02-24', '2027-03-03', '2027-03-10', '2027-04-21', '2027-04-28', '2027-05-05',
];

describe('R17-QUAND-2 — les séances retirées pour vacances', () => {
  it('R17Q2B : le retour garde la parité et les exceptions, sans inventer de séance', () => {
    const creneau = {
      anchorDate: '2026-10-20',
      everyWeeks: 2,
      exceptHolidays: true,
      holidayDates: ['2026-10-20'],
      skippedDates: ['2026-11-03'],
      validFrom: '2026-09-01',
      validUntil: '2026-12-31',
      weekday: 2,
    };
    expect(creneauxEnVacances([creneau], '2026-10-20')).toEqual([
      { creneau, retour: '2026-11-17' },
    ]);
    expect(creneauxEnVacances([creneau], '2026-10-27')).toEqual([]);
    expect(creneauxEnVacances([{ ...creneau, holidayDates: [] }], '2026-10-20')).toEqual([]);
    expect(creneauxEnVacances([{ ...creneau, validUntil: '2026-10-20' }], '2026-10-20')[0].retour)
      .toBeNull();
    expect(creneauxEnVacances([{ ...creneau, skippedDates: ['2026-10-20'] }], '2026-10-20'))
      .toEqual([]);
  });
  it('par période, dans l’ordre ; une période gardée ne retire rien', () => {
    const tout = vacancesDesSeances(MERCREDIS, PERIODES, []);
    expect(tout.retirees).toEqual([
      '2026-10-21', '2026-10-28', '2026-12-23', '2026-12-30',
      '2027-02-24', '2027-03-03', '2027-04-21', '2027-04-28',
    ]);
    expect(tout.parPeriode.map((ligne) => [ligne.periode.key, ligne.jours.length, ligne.gardee]))
      .toEqual([
        ['2026-2027:toussaint', 2, false],
        ['2026-2027:noel', 2, false],
        ['2026-2027:hiver', 2, false],
        ['2026-2027:printemps', 2, false],
      ]);
    const garde = vacancesDesSeances(MERCREDIS, PERIODES, ['2026-2027:toussaint']);
    expect(garde.retirees).toHaveLength(6);
    expect(garde.parPeriode[0]).toMatchObject({
      gardee: true, jours: ['2026-10-21', '2026-10-28'],
    });
  });

  it('une période sans séance de la forme n’est pas listée', () => {
    const { parPeriode } = vacancesDesSeances(['2026-11-04', '2026-12-23'], PERIODES, []);
    expect(parPeriode.map((ligne) => ligne.periode.name)).toEqual(['Noël']);
  });

  it('un créneau « sauf vacances » existant : les périodes sans jour retiré sont gardées', () => {
    const creneau = {
      exceptHolidays: true,
      holidayDates: [
        '2026-10-21', '2026-10-28', '2027-02-24', '2027-03-03', '2027-04-21', '2027-04-28',
      ],
      validFrom: '2026-10-21',
      validUntil: '2027-06-30',
      weekday: 3,
    };
    expect(periodesGardeesDuCreneau(creneau, PERIODES)).toEqual(['2026-2027:noel']);
    expect(periodesGardeesDuCreneau({ ...creneau, exceptHolidays: false }, PERIODES)).toEqual([]);
  });

  it('les noms dans une phrase : les saisons en minuscule, les fêtes avec leur capitale', () => {
    expect(PERIODES.map((p) => nomDeVacances(p.name)))
      .toEqual(['Toussaint', 'Noël', 'hiver', 'printemps']);
    expect(nomDeVacances('Été')).toBe('été');
  });
});
