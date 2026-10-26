import { format } from 'date-fns';

import { createReccurrentEventPayload } from '../eventUseCases';

// 🗓️ DATESDABORD (26/10/2026, Adel sur la v2 : « rajouter dans Répéter la possibilité de
// sélectionner "sauf vacances" sur la récurrence ») — UNE SÉRIE « SAUF VACANCES SCOLAIRES » :
// l'app déplie la série en séances (le serveur ne recalcule rien, voir FIN15) ; les séances qui
// tombent dans une période de vacances de la zone ne partent pas. Les périodes viennent du serveur
// (le planning de l'installation, `meta.holidays`), comme pour les créneaux de la Ville (R17Q2).
// ROUGE avant : la série gardait les séances des vacances.

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('@/theme/strings', () => ({
  t: (/** @type {string} */ key) => key,
}));

// La Toussaint de la zone B (2026), telle que le serveur l'envoie.
const TOUSSAINT = {
  end: '2026-11-01', key: '2026-2027:toussaint', name: 'Toussaint', start: '2026-10-17',
};

const seancesDe = (/** @type {Record<string, any>} */ serie) => createReccurrentEventPayload({
  capacity: 10,
  date: '08/10/2026',
  endTime: '21:00',
  isRecurrent: true,
  recurrenceDays: [4, 5],
  recurrenceEndDate: '13/11/2026',
  recurrenceFrequency: 'week',
  recurrenceInterval: 1,
  recurrenceStartDate: '08/10/2026',
  sessionStatus: 'closed',
  startTime: '19:30',
  time: '19:30',
  ...serie,
});
const jours = (/** @type {any[]} */ seances) => seances
  .map((seance) => format(new Date(seance.date), 'yyyy-MM-dd'));

describe('DATESDABORD — une série « chaque jeudi et vendredi » à travers la Toussaint', () => {
  test('sans la case : toutes les séances, vacances comprises', () => {
    expect(jours(seancesDe({}))).toEqual([
      '2026-10-08', '2026-10-09', '2026-10-15', '2026-10-16', '2026-10-22', '2026-10-23',
      '2026-10-29', '2026-10-30', '2026-11-05', '2026-11-06', '2026-11-12', '2026-11-13',
    ]);
  });

  test('« Sauf vacances scolaires » : les séances de la Toussaint sont absentes', () => {
    expect(jours(seancesDe({ exceptHolidays: true, holidayPeriods: [TOUSSAINT] }))).toEqual([
      '2026-10-08', '2026-10-09', '2026-10-15', '2026-10-16',
      '2026-11-05', '2026-11-06', '2026-11-12', '2026-11-13',
    ]);
  });

  test('la case et les périodes ne partent pas au serveur (aucun champ neuf)', () => {
    seancesDe({ exceptHolidays: true, holidayPeriods: [TOUSSAINT] }).forEach((seance) => {
      expect(seance).not.toHaveProperty('exceptHolidays');
      expect(seance).not.toHaveProperty('holidayPeriods');
    });
  });

  test('cochée sans périodes connues : rien n est retiré (pas de séance perdue en silence)', () => {
    expect(seancesDe({ exceptHolidays: true, holidayPeriods: [] })).toHaveLength(12);
  });
});
