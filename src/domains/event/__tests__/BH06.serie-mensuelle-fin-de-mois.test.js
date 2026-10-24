import { format } from 'date-fns';

import { createReccurrentEventPayload } from '../eventUseCases';

// 🐞 BUGHUNT P1-04 (BH06) — une série MENSUELLE partie un 29, 30 ou 31 dérivait :
// `setMonth(+1)` sur le 31 janvier tombe le 3 mars, puis toute la série reste au 3.

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

jest.mock('@/theme/strings', () => ({
  t: (/** @type {string} */ key) => key,
}));

const joursDeLaSerie = (/** @type {Record<string, any>} */ serie) => createReccurrentEventPayload({
  capacity: 10,
  isRecurrent: true,
  recurrenceFrequency: 'month',
  sessionStatus: 'closed',
  time: '19:30',
  ...serie,
}).map((/** @type {any} */ seance) => format(new Date(seance.date), 'yyyy-MM-dd'));

describe('BH06 P1-04 — série mensuelle partie un 31', () => {
  test('31/01 → 30/06 : une séance par mois, au dernier jour quand le 31 manque', () => {
    expect(joursDeLaSerie({
      date: '31/01/2025',
      recurrenceEndDate: '30/06/2025',
      recurrenceStartDate: '31/01/2025',
    })).toEqual([
      '2025-01-31', '2025-02-28', '2025-03-31', '2025-04-30', '2025-05-31', '2025-06-30',
    ]);
  });
});
