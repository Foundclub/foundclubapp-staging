import { canAttachReportPhoto } from '../facilityReportDisplay';

it('P3-19 : une date de naissance illisible n’ouvre pas la photo', () => {
  expect(canAttachReportPhoto('pas-une-date')).toBe(false);
  expect(canAttachReportPhoto('1990-01-01')).toBe(true);
});
