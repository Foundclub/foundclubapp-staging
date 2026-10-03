/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import * as affichage from '../seasonSlotDisplay';

// 📐 COLL-C2B-BIS (03/10) — planche 23, ordinateur : LA SEMAINE TYPE À L ÉCHELLE DES HEURES
// (design HY521H1, P4v2-creneaux-ordi, état A). La colonne des heures à gauche ; les heures où un
// créneau existe forment des BANDES à l échelle ; entre elles, une ligne repliée (« Aucun créneau
// de 12:00 à 17:30 »). Deux créneaux du même jour à la même heure se posent CÔTE À CÔTE (le jeudi
// complet de la planche).
// ROUGE avant le lot : ni `weekGridRows`, ni `weekGridLanes` n existaient.

const { weekGridLanes, weekGridRows } = affichage;

// La semaine de la planche (Gymnase des Tilleuls, recette Montrivage).
const SEMAINE = [
  { endTime: '19:30', startTime: '18:00', weekday: 1 },
  { endTime: '19:00', startTime: '17:30', weekday: 2 },
  { endTime: '20:30', startTime: '19:00', weekday: 2 },
  { endTime: '20:30', startTime: '19:00', weekday: 3 },
  { endTime: '19:30', startTime: '18:00', weekday: 4 },
  { endTime: '19:30', startTime: '18:00', weekday: 4 },
  { endTime: '19:30', startTime: '18:00', weekday: 5 },
  { endTime: '21:00', startTime: '19:30', weekday: 5 },
  { endTime: '12:00', startTime: '10:00', weekday: 6 },
];

describe('COLL-C2B-BIS — la semaine type à l échelle des heures', () => {
  it('les bandes et les creux de la planche : 08:00 → 10:00 replié, 10:00 – 12:00, replié, 17:30 – 21:00, replié', () => {
    expect(typeof weekGridRows).toBe('function');
    expect(weekGridRows(SEMAINE, { fermeture: 22 * 60, ouverture: 8 * 60 })).toEqual([
      { debut: 8 * 60, fin: 10 * 60, type: 'creux' },
      {
        debut: 10 * 60, fin: 12 * 60, reperes: [10 * 60, 11 * 60], type: 'bande',
      },
      { debut: 12 * 60, fin: 17 * 60 + 30, type: 'creux' },
      {
        debut: 17 * 60 + 30, fin: 21 * 60, reperes: [17 * 60 + 30, 18 * 60, 19 * 60, 20 * 60], type: 'bande',
      },
      { debut: 21 * 60, fin: 22 * 60, type: 'creux' },
    ]);
  });

  it('sans horaires connus : pas de creux d avant, un creux « après » ouvert', () => {
    expect(weekGridRows([{ endTime: '19:30', startTime: '18:00', weekday: 1 }])).toEqual([
      {
        debut: 18 * 60, fin: 19 * 60 + 30, reperes: [18 * 60, 19 * 60], type: 'bande',
      },
      { debut: 19 * 60 + 30, fin: null, type: 'creux' },
    ]);
    expect(weekGridRows([])).toEqual([]);
  });

  it('deux créneaux séparés de 30 minutes au plus restent dans la même bande', () => {
    const lignes = weekGridRows([
      { endTime: '18:00', startTime: '17:00', weekday: 1 },
      { endTime: '19:30', startTime: '18:30', weekday: 3 },
    ]);
    expect(lignes.filter((ligne) => ligne.type === 'bande')).toHaveLength(1);
  });

  it('le jeudi complet : deux créneaux à la même heure, côte à côte ; un créneau seul garde toute la largeur', () => {
    expect(typeof weekGridLanes).toBe('function');
    const jeudi = SEMAINE.filter((creneau) => creneau.weekday === 4);
    expect(weekGridLanes(jeudi).map(({ voie, voies }) => [voie, voies])).toEqual([[0, 2], [1, 2]]);
    const mardi = SEMAINE.filter((creneau) => creneau.weekday === 2);
    expect(weekGridLanes(mardi).map(({ voie, voies }) => [voie, voies])).toEqual([[0, 1], [0, 1]]);
    // Une grappe de trois où la 3e reprend la 1re voie.
    const grappe = weekGridLanes([
      { endTime: '19:00', startTime: '17:00' },
      { endTime: '20:00', startTime: '18:00' },
      { endTime: '21:00', startTime: '19:00' },
    ]);
    expect(grappe.map(({ voie, voies }) => [voie, voies])).toEqual([[0, 2], [1, 2], [0, 2]]);
  });
});
