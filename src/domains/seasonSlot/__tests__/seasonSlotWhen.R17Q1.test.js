/* eslint-disable max-len -- des dates et des corps entiers, comparés tels quels */
import {
  corpsDuQuand,
  creneauDuQuand,
  fermeturesTouchees,
  formeCourte,
  quandDuCreneau,
  seancesDuQuand,
} from '../seasonSlotWhen';

// 🧪 R17-QUAND-1, point 4 (REC17-007, planches P10-quand-tel / P11-quand-v2-tel validées par Adel le
// 19/10) — L'ÉTAPE « QUAND ? » : quatre formes (toute la saison, une période, toutes les 2 semaines,
// des dates choisies), chacune dit son nombre de séances et celles qui tombent dans une fermeture.
// Avant (ROUGE) : le tunnel n'envoyait aucune période (SeasonSlotForm.js, création) ; ces règles
// n'existaient pas.

const SAISON = { validFrom: '2026-09-01', validUntil: '2027-06-30' };
const BASE = {
  aujourdhui: '2026-10-19', debut: '17:30', fin: '19:00', jour: 3, saison: SAISON,
};

describe('R17Q1-4 — l’étape « Quand ? » : ce qu’elle envoie et ce qu’elle compte', () => {
  it('toute la saison (par défaut) : rien de plus n’est envoyé, les mercredis à venir se comptent', () => {
    expect(corpsDuQuand({ ...BASE, forme: 'saison' })).toEqual({});
    const seances = seancesDuQuand(creneauDuQuand({ ...BASE, forme: 'saison' }), BASE.aujourdhui);
    expect(seances[0]).toBe('2026-10-21');
    expect(seances[seances.length - 1]).toBe('2027-06-30');
    expect(seances).toHaveLength(37);
  });

  it('une période : Du / Au, envoyés', () => {
    const quand = {
      ...BASE, forme: 'periode', periodeAu: '2026-12-18', periodeDu: '2026-10-21',
    };
    expect(corpsDuQuand(quand)).toEqual({ validFrom: '2026-10-21', validUntil: '2026-12-18' });
    expect(seancesDuQuand(creneauDuQuand(quand), BASE.aujourdhui)).toHaveLength(9);
  });

  it('toutes les 2 semaines : à partir du 1er mercredi, jusqu’à la fin de saison', () => {
    const quand = { ...BASE, deuxDu: '2026-10-21', forme: 'deuxSemaines' };
    expect(corpsDuQuand(quand)).toEqual({
      anchorDate: '2026-10-21', everyWeeks: 2, recurrence: 'weekly', validFrom: '2026-10-21', validUntil: '2027-06-30',
    });
    const seances = seancesDuQuand(creneauDuQuand(quand), BASE.aujourdhui);
    expect(seances.slice(0, 5)).toEqual(['2026-10-21', '2026-11-04', '2026-11-18', '2026-12-02', '2026-12-16']);
    expect(seances).toHaveLength(19);
  });

  it('des dates choisies : la liste, sans jour, triée', () => {
    const quand = {
      ...BASE, dates: ['2026-11-25', '2026-11-07', '2026-11-17'], forme: 'dates', jour: null,
    };
    expect(corpsDuQuand(quand)).toEqual({ dates: ['2026-11-07', '2026-11-17', '2026-11-25'], recurrence: 'dates' });
    expect(seancesDuQuand(creneauDuQuand(quand), BASE.aujourdhui)).toEqual(['2026-11-07', '2026-11-17', '2026-11-25']);
  });

  it('les séances qui tombent dans une fermeture (jour entier, ou heures qui se croisent)', () => {
    const fermetures = [
      { endDate: '2027-01-03', label: 'Vacances de Noël', startDate: '2026-12-19' },
      {
        endDate: '2026-11-04', endTime: '12:00', kind: 'block', label: 'Matinée', startDate: '2026-11-04', startTime: '08:00',
      },
    ];
    expect(fermeturesTouchees(['2026-11-04', '2026-12-23', '2026-12-30', '2027-01-06'], fermetures, '17:30', '19:00'))
      .toEqual([{ date: '2026-12-23', label: 'Vacances de Noël' }, { date: '2026-12-30', label: 'Vacances de Noël' }]);
  });

  it('un créneau qu’on modifie rouvre sa forme ; sa forme courte se lit', () => {
    expect(quandDuCreneau({ validFrom: '2026-09-01', validUntil: '2027-06-30', weekday: 3 }, SAISON).forme).toBe('saison');
    expect(quandDuCreneau({ validFrom: '2026-10-01', validUntil: '2026-12-18', weekday: 3 }, SAISON).forme).toBe('periode');
    expect(quandDuCreneau({
      anchorDate: '2026-10-21', everyWeeks: 2, validFrom: '2026-10-21', validUntil: '2027-06-30', weekday: 3,
    }, SAISON))
      .toMatchObject({ deuxDu: '2026-10-21', forme: 'deuxSemaines' });
    expect(quandDuCreneau({
      dates: ['2026-11-07'], recurrence: 'dates', validFrom: '2026-11-07', validUntil: '2026-11-07',
    }, SAISON))
      .toMatchObject({ dates: ['2026-11-07'], forme: 'dates' });
    expect(formeCourte({ everyWeeks: 2, weekday: 3 })).toEqual({ count: 2, kind: 'deuxSemaines' });
    expect(formeCourte({ dates: ['2026-11-07', '2026-11-17', '2026-11-25'], recurrence: 'dates' })).toEqual({ count: 3, kind: 'dates' });
    expect(formeCourte({ weekday: 3 })).toEqual({ count: 1, kind: 'chaqueSemaine' });
  });
});
