import {
  JOURS_DE_LA_SUITE,
  plageDeLaSuite,
  vueInitiale,
} from '../vueInitiale';

// 🗓️ R17-VUE (19/10/2026, REC17-010) — « Quand on arrive sur le planning et que sur la vue jour il
// n'y a pas d'événement, il faut afficher la vue semaine ; et s'il n'y a rien sur la vue semaine
// mais qu'il y a un événement après, il faut afficher la vue mensuelle ; sinon garder la vue de
// base sans événement après. » (Adel, recette du 17/10.)
//
// Reglages du chef : la vue de base plus courte que la semaine (jour, 3 jours) compte comme
// « jour » ; le mois affiche est celui du PROCHAIN evenement ; rien plus tard : la vue de base.

// Mercredi 21 octobre 2026, midi (semaine du lundi 19 au dimanche 25).
const AUJOURDHUI = new Date(2026, 9, 21, 12, 0, 0);
const jour = (/** @type {number} */ mois, /** @type {number} */ quantieme, heure = 18) => (
  new Date(2026, mois, quantieme, heure, 0, 0)
);

describe('R17-VUE — vueInitiale : le planning s ouvre la ou il y a quelque chose', () => {
  test('1 — jour plein : la vue de base reste', () => {
    expect(vueInitiale({ aujourdhui: AUJOURDHUI, dates: [jour(9, 21)], vueDeBase: 'day' }))
      .toEqual({ date: AUJOURDHUI, vue: 'day' });
  });

  test('2 — jour vide, semaine pleine : la semaine', () => {
    expect(vueInitiale({ aujourdhui: AUJOURDHUI, dates: [jour(9, 24)], vueDeBase: 'day' }))
      .toEqual({ date: AUJOURDHUI, vue: 'week' });
    // Un evenement deja passe de la semaine compte aussi : la semaine n est pas vide.
    expect(vueInitiale({ aujourdhui: AUJOURDHUI, dates: [jour(9, 19)], vueDeBase: 'day' }).vue)
      .toBe('week');
  });

  test('3 — « 3 jours » (onglet perso) compte comme « jour »', () => {
    // Le 23 est dans les 3 jours (21, 22, 23) : la vue de base reste.
    expect(vueInitiale({ aujourdhui: AUJOURDHUI, dates: [jour(9, 23)], vueDeBase: '3days' }).vue)
      .toBe('3days');
    // Le 25 est hors des 3 jours mais dans la semaine : la semaine.
    expect(vueInitiale({ aujourdhui: AUJOURDHUI, dates: [jour(9, 25)], vueDeBase: '3days' }).vue)
      .toBe('week');
  });

  test('4 — semaine vide, un evenement plus tard : le MOIS de ce prochain evenement', () => {
    const decision = vueInitiale({
      aujourdhui: AUJOURDHUI,
      dates: [jour(11, 2), jour(10, 12)],
      vueDeBase: 'day',
    });
    expect(decision.vue).toBe('month');
    // Le plus proche (12 novembre), pas le premier de la liste (2 decembre).
    expect([decision.date.getFullYear(), decision.date.getMonth(), decision.date.getDate()])
      .toEqual([2026, 10, 12]);
  });

  test('4 bis — vue de base « semaine » (club, omnisport) : semaine vide, plus tard ⇒ mois', () => {
    expect(vueInitiale({ aujourdhui: AUJOURDHUI, dates: [jour(9, 22)], vueDeBase: 'week' }).vue)
      .toBe('week');
    const decision = vueInitiale({
      aujourdhui: AUJOURDHUI, dates: [], prochain: jour(9, 27), vueDeBase: 'week',
    });
    expect(decision.vue).toBe('month');
    expect(decision.date.getDate()).toBe(27);
  });

  test('5 — rien plus tard : vue de base (un evenement PASSE hors semaine ne compte pas)', () => {
    expect(vueInitiale({ aujourdhui: AUJOURDHUI, dates: [], vueDeBase: 'day' }))
      .toEqual({ date: AUJOURDHUI, vue: 'day' });
    expect(vueInitiale({
      aujourdhui: AUJOURDHUI, dates: [jour(9, 2), null], prochain: null, vueDeBase: '3days',
    })).toEqual({ date: AUJOURDHUI, vue: '3days' });
  });

  test('6 — la lecture de la suite est BORNEE : lendemain de la semaine, 31 jours', () => {
    expect(JOURS_DE_LA_SUITE).toBe(31);
    // Semaine du 19 au 25 octobre : la suite va du 26 octobre au 25 novembre (31 jours).
    expect(plageDeLaSuite('day', AUJOURDHUI)).toEqual({ from: '2026-10-26', to: '2026-11-25' });
    // « 3 jours » qui deborde sur la semaine suivante : la suite part apres les 3 jours.
    const samedi = new Date(2026, 9, 24, 12, 0, 0);
    expect(plageDeLaSuite('3days', samedi)).toEqual({ from: '2026-10-27', to: '2026-11-26' });
  });
});
