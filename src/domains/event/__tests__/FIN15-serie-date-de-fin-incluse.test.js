import { format } from 'date-fns';

import { createReccurrentEventPayload, getDateFromDateInput } from '../eventUseCases';

// 🐞 FINITIONS15 point 2 (tournée T14, 05/10, planche 43) — LA DATE DE FIN D'UNE RÉPÉTITION EST
// INCLUSE. Vu 2 fois sur 2 : fin « jeu. 29 oct. » ⇒ 3 séances (8, 15, 22) ; fin « mer. 28 oct. »
// ⇒ 2 séances (14, 21). La dernière date choisie manquait.
//
// LA CAUSE : `getDateFromDateInput('29/10/2026')` construisait `new Date('2026-10-29')`. Une date
// ISO SANS heure est lue en UTC : minuit UTC = 1 h du matin à Paris en hiver, 2 h en été. Le
// début de la série (8 oct., heure d'été) partait donc à 2 h, et chaque semaine gardait 2 h
// d'horloge locale ; après le passage à l'heure d'hiver (25 oct. 2026), la séance du 29 tombait
// à 2 h (= 1 h UTC), APRÈS la borne de fin (1 h à Paris = minuit UTC) : exclue. Une série qui ne
// traverse pas de changement d'heure gardait sa dernière date — c'est pour ça que le témoin
// d'avant (mai 2025, `eventUseCases.test.js`) était vert.
//
// 🕰️ LE FUSEAU (mémoire piege-fuseau-serveur-utc-invisible-en-local) : jest ne relit pas
// `process.env.TZ` en cours de route. Ce fichier se lance donc DEUX fois :
//   TZ=UTC          npx jest src/domains/event/__tests__/FIN15-serie-date-de-fin-incluse.test.js
//   TZ=Europe/Paris npx jest src/domains/event/__tests__/FIN15-serie-date-de-fin-incluse.test.js
// Sous UTC il n'y a pas de changement d'heure : le défaut ne s'y voyait pas. Sous Paris il était
// ROUGE. Le titre du bloc dit dans quel fuseau le témoin a tourné.
// Le serveur ne recalcule rien : l'app envoie une séance par date (`admin/src` ne lit
// `recurrenceEndDate` nulle part, constaté le 05/10).

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

jest.mock('@/theme/strings', () => ({
  t: (/** @type {string} */ key) => key,
}));

const FUSEAU = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Les jours (calendrier de l'appareil) des séances qu'une série produit.
 * @param {Record<string, any>} serie Les champs de l'assistant, tels que le récap les envoie.
 * @returns {string[]} Les jours `yyyy-MM-dd`, dans l'ordre.
 */
const joursDeLaSerie = (serie) => createReccurrentEventPayload({
  capacity: 10,
  endTime: '21:00',
  isRecurrent: true,
  recurrenceFrequency: 'week',
  recurrenceInterval: 1,
  sessionStatus: 'closed',
  startTime: '19:30',
  time: '19:30',
  ...serie,
}).map((/** @type {any} */ seance) => format(new Date(seance.date), 'yyyy-MM-dd'));

describe(`FINITIONS15 point 2 — la date de fin choisie est INCLUSE (fuseau ${FUSEAU})`, () => {
  test('T14 : jeudi 8 oct. ⇒ fin jeu. 29 oct. : 4 séances, la dernière le 29', () => {
    expect(joursDeLaSerie({
      date: '08/10/2026',
      recurrenceDays: [4],
      recurrenceEndDate: '29/10/2026',
      recurrenceStartDate: '08/10/2026',
    })).toEqual(['2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']);
  });

  test('T14 : mercredi 14 oct. ⇒ fin mer. 28 oct. : 3 séances, la dernière le 28', () => {
    expect(joursDeLaSerie({
      date: '14/10/2026',
      recurrenceDays: [3],
      recurrenceEndDate: '28/10/2026',
      recurrenceStartDate: '14/10/2026',
    })).toEqual(['2026-10-14', '2026-10-21', '2026-10-28']);
  });

  test('passage à l heure d ÉTÉ (28 mars 2027) : la fin reste incluse', () => {
    expect(joursDeLaSerie({
      date: '18/03/2027',
      recurrenceDays: [4],
      recurrenceEndDate: '01/04/2027',
      recurrenceStartDate: '18/03/2027',
    })).toEqual(['2027-03-18', '2027-03-25', '2027-04-01']);
  });

  test('sans changement d heure : la fin incluse, comme avant', () => {
    expect(joursDeLaSerie({
      date: '05/11/2026',
      recurrenceDays: [4],
      recurrenceEndDate: '19/11/2026',
      recurrenceStartDate: '05/11/2026',
    })).toEqual(['2026-11-05', '2026-11-12', '2026-11-19']);
  });

  test('cadence mensuelle à cheval sur le changement d heure : la fin incluse', () => {
    expect(joursDeLaSerie({
      date: '15/10/2026',
      recurrenceDays: [],
      recurrenceEndDate: '15/12/2026',
      recurrenceFrequency: 'month',
      recurrenceStartDate: '15/10/2026',
    })).toEqual(['2026-10-15', '2026-11-15', '2026-12-15']);
  });

  test('« JJ/MM/AAAA » se lit au MINUIT de l appareil, jamais en UTC', () => {
    const jour = getDateFromDateInput('29/10/2026');
    expect(jour && [jour.getFullYear(), jour.getMonth(), jour.getDate(), jour.getHours()])
      .toEqual([2026, 9, 29, 0]);
    // Ce qui n'est pas une date reste refusé, comme avant.
    expect(getDateFromDateInput('pas une date')).toBeUndefined();
    expect(getDateFromDateInput('')).toBeUndefined();
  });
});
