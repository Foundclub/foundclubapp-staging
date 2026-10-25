// BH10 P3-03 : l heure d un creneau est une heure LOCALE, pas UTC.
import { getCandidateSlotInstant } from './friendlyMatchFlow';

test('P3-03 : un creneau finit a son heure locale', () => {
  expect(getCandidateSlotInstant({ date: '2027-05-01', end: '18:00' }))
    .toBe(new Date(2027, 4, 1, 18, 0, 59, 999).getTime());
  expect(getCandidateSlotInstant({ date: '2027-05-01' }))
    .toBe(new Date(2027, 4, 1, 23, 59, 59, 999).getTime());
});
