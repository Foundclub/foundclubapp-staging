/* eslint-disable max-len -- des phrases et des dates entières, comparées telles quelles */
import { creneauDeLaSeance } from '../clubInstallations';
import { fullRangesOfSlots, slotOccurrences, slotOccursOn } from '../seasonSlotDisplay';

// 🧪 R17-QUAND-1, point 3 (REC17-007, 19/10/2026) — L'APP LIT LA MÊME RÈGLE QUE LE SERVEUR : un créneau
// de la Ville revient chaque semaine, toutes les 2 semaines (ancré sur `anchorDate`), ou à des dates
// choisies (`dates`, n'importe quels jours) ; `skippedDates` : les dates retirées une à une.
// Avant (ROUGE) : « chaque semaine » était recopié en dur dans `creneauDeLaSeance` (même jour de
// semaine, dans la période) et `fullRangesOfSlots` (deux créneaux se gênent si leurs périodes se
// croisent). Une séance posée une semaine « creuse » d'un créneau 1 sur 2 se croyait dans le
// créneau ; deux créneaux 1 sur 2 de parité contraire se lisaient « complet ».
// Règle du serveur : admin `utils/season-slot.ts` (`occursOn`), témoin R17Q1-3-regle-tombe-ce-jour-la.

const HEURES = { endTime: '19:00', startTime: '17:30' };
const hebdo = (extra = {}) => ({
  ...HEURES, validFrom: '2026-10-01', validUntil: '2026-11-30', weekday: 3, ...extra,
});
const unSurDeux = (extra = {}) => hebdo({
  anchorDate: '2026-10-21', everyWeeks: 2, recurrence: 'weekly', ...extra,
});
const choisies = (dates, extra = {}) => ({
  ...HEURES,
  dates,
  recurrence: 'dates',
  validFrom: dates[0],
  validUntil: dates[dates.length - 1],
  weekday: null,
  ...extra,
});

describe('R17Q1-3 — la règle « tombe ce jour-là », côté app', () => {
  it('chaque semaine : chaque mercredi, sauf une date retirée', () => {
    expect(slotOccurrences(hebdo({ skippedDates: ['2026-10-14'], validUntil: '2026-10-31' })))
      .toEqual(['2026-10-07', '2026-10-21', '2026-10-28']);
  });

  it('toutes les 2 semaines : la parité vient de l’ancrage, pas du début de période', () => {
    expect(slotOccurrences(unSurDeux())).toEqual(['2026-10-07', '2026-10-21', '2026-11-04', '2026-11-18']);
    expect(slotOccurrences(unSurDeux({ validFrom: '2026-11-11' }))).toEqual(['2026-11-18']);
    expect(slotOccursOn(unSurDeux(), '2026-10-28')).toBe(false);
  });

  it('des dates choisies : ces jours-là seulement, quel que soit le jour ; un créneau d’avant le lot reste « chaque semaine »', () => {
    expect(slotOccurrences(choisies(['2026-11-07', '2026-11-17']))).toEqual(['2026-11-07', '2026-11-17']);
    const ancien = {
      ...HEURES, validFrom: '2026-10-01', validUntil: '2026-10-31', weekday: 2,
    };
    expect(slotOccursOn(ancien, '2026-10-06')).toBe(true);
  });

  it('la séance posée une semaine « creuse » d’un créneau 1 sur 2 n’est pas dans le créneau', () => {
    const slot = unSurDeux();
    expect(creneauDeLaSeance([slot], { start: '2026-10-21T17:45:00' })).toBe(slot);
    expect(creneauDeLaSeance([slot], { start: '2026-10-28T17:45:00' })).toBeNull();
    const samedi = choisies(['2026-11-07']);
    expect(creneauDeLaSeance([samedi], { start: '2026-11-07T18:00:00' })).toBe(samedi);
  });

  it('deux créneaux 1 sur 2 de parité contraire ne s’additionnent pas dans la semaine type', () => {
    const creneaux = [hebdo(), unSurDeux(), unSurDeux({ anchorDate: '2026-10-14' })];
    // 3 places : jamais plus de 2 équipes le même mercredi (A + l'un des deux).
    expect(fullRangesOfSlots(creneaux, 3)).toEqual([]);
    expect(fullRangesOfSlots(creneaux, 2)).toEqual([{ end: 19 * 60, start: (17 * 60) + 30 }]);
  });
});
