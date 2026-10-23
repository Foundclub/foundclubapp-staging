import { quandDeLaRepetition } from '../seasonSlotWhen';

// 🗓️ DATESDABORD (23/10/2026, recette iPhone d'Adel, point 9) — « ATTRIBUER UN CRÉNEAU » PREND LE
// MODÈLE DE LA CRÉATION D'ÉVÉNEMENT : une date, des heures, « Répéter » (semaine ou mois, tous les N,
// les jours, du … au …). Le serveur ne change pas : la répétition devient une forme qu'il connaît.
//   - un seul jour, toutes les semaines → `periode` (chaque semaine du … au …), ou `saison` quand
//     elle part de la prochaine date et va à la fin de saison (le corps d'avant le lot) ;
//   - un seul jour, toutes les 2 semaines → `deuxSemaines` (garde la parité et « sauf vacances ») ;
//   - le reste (une seule fois, plusieurs jours, tous les 3 et plus, tous les mois) → des `dates`.
// Les dates vont d'aujourd'hui à la fin de saison, jamais au-delà.

const SAISON = '2027-06-30';
const AUJOURDHUI = '2026-10-24';
// Le mardi 3 novembre 2026 (JS : mardi = 2).
const MARDI = '2026-11-03';
const repeter = (/** @type {any} */ suite = {}) => ({
  actif: true, au: null, du: null, frequence: 'week', intervalleTexte: '1', jours: [2], ...suite,
});
const traduire = (/** @type {any} */ repetition, date = MARDI) => quandDeLaRepetition({
  aujourdhui: AUJOURDHUI, date, finDeSaison: SAISON, repetition,
});

describe('DATESDABORD — la répétition d un événement devient la forme d un créneau', () => {
  test('« Une seule fois » : la seule date', () => {
    expect(traduire(repeter({ actif: false }))).toEqual({
      dates: [MARDI], forme: 'dates', jour: 2, joursDifferents: true,
    });
  });

  test('chaque semaine dès le prochain mardi jusqu à la fin de saison : « toute la saison »', () => {
    expect(traduire(repeter(), '2026-10-27')).toEqual({ forme: 'saison', jour: 2, joursDifferents: false });
  });

  test('chaque semaine, un seul jour : « chaque mardi du … au … », la fin de saison par défaut', () => {
    expect(traduire(repeter())).toEqual({
      forme: 'periode', jour: 2, joursDifferents: false, periodeAu: SAISON, periodeDu: MARDI,
    });
    expect(traduire(repeter({ au: '2026-12-15', du: '2026-11-10' }))).toEqual({
      forme: 'periode', jour: 2, joursDifferents: false, periodeAu: '2026-12-15', periodeDu: '2026-11-10',
    });
  });

  test('une fin après la saison s arrête à la fin de saison', () => {
    expect(traduire(repeter({ au: '2027-08-31' })).periodeAu).toBe(SAISON);
  });

  test('toutes les 2 semaines, un seul jour : « un mardi sur deux »', () => {
    expect(traduire(repeter({ au: '2027-01-26', intervalleTexte: '2' }))).toEqual({
      deuxAu: '2027-01-26', deuxDu: MARDI, forme: 'deuxSemaines', jour: 2, joursDifferents: false,
    });
    expect(traduire(repeter({ intervalleTexte: '2' })).deuxAu).toBeNull();
  });

  test('plusieurs jours : des dates, le jour de la date toujours compris', () => {
    // Mardi et jeudi, du mardi 3 au jeudi 12 novembre.
    expect(traduire(repeter({ au: '2026-11-12', jours: [4] }))).toEqual({
      dates: ['2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12'],
      forme: 'dates',
      jour: 2,
      joursDifferents: true,
    });
  });

  test('toutes les 3 semaines : des dates, une semaine sur trois', () => {
    expect(traduire(repeter({ au: '2026-12-31', intervalleTexte: '3' })).dates)
      .toEqual(['2026-11-03', '2026-11-24', '2026-12-15']);
  });

  test('tous les mois : le même quantième, un mois sur N', () => {
    expect(traduire(repeter({ au: '2027-03-31', frequence: 'month' })).dates)
      .toEqual(['2026-11-03', '2026-12-03', '2027-01-03', '2027-02-03', '2027-03-03']);
    expect(traduire(repeter({ au: '2027-03-31', frequence: 'month', intervalleTexte: '2' })).dates)
      .toEqual(['2026-11-03', '2027-01-03', '2027-03-03']);
    // Un 31 saute les mois qui n en ont pas.
    expect(traduire(repeter({ au: '2027-01-31', frequence: 'month' }), '2026-10-31').dates)
      .toEqual(['2026-10-31', '2026-12-31', '2027-01-31']);
  });

  test('rien avant aujourd hui', () => {
    expect(traduire(repeter({ au: '2026-11-05', du: '2026-10-20', jours: [2, 4] }), '2026-10-20').dates)
      .toEqual(['2026-10-27', '2026-10-29', '2026-11-03', '2026-11-05']);
  });
});
