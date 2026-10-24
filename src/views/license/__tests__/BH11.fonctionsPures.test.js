import { euroToCents } from '../CMLicensesDashboard';
import { isoDateFromEventValue } from '../eventCampaignDefaults';
import { canValidateAssignmentPayment } from '../licenseDesignSystem';
import { lastReceiptOf } from '../MyLicensesArchive';

jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => function SkeletonLoaderMock() { return null; });
jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock() { return null; });
jest.mock('react-native-linear-gradient', () => function GradientMock() { return null; });
jest.mock('@/services/license/licenseQueries', () => ({}));
jest.mock('@/services/license/licenseService', () => ({}));

/**
 * BH11 (BUGHUNT 24/10) — témoins des fonctions pures des licences.
 */
describe('BH11 — licences, fonctions pures', () => {
  test('P5-14 — un minuit local du 01/07 reste le 01/07', () => {
    expect(isoDateFromEventValue(new Date(2026, 6, 1).toString())).toBe('2026-07-01');
  });

  test('P5-09 — un refus explicite du serveur l emporte sur le rôle', () => {
    expect(canValidateAssignmentPayment({ canValidatePayments: false }, true)).toBe(false);
    expect(canValidateAssignmentPayment({}, true)).toBe(true);
    expect(canValidateAssignmentPayment({ canValidatePayments: true }, false)).toBe(true);
  });

  test('P5-22 — le dernier reçu, pas le premier', () => {
    const assignment = { receipts: [{ id: 1, pdfFile: { url: 'a' } }, { id: 2, pdfFile: { url: 'b' } }] };
    expect(lastReceiptOf(assignment).id).toBe(2);
  });

  test('P5-03 — montants avec espaces / séparateurs de milliers', () => {
    expect(euroToCents('1 000')).toBe(100000);
    expect(euroToCents('1.234,50')).toBe(123450);
    expect(Number.isFinite(euroToCents('abc'))).toBe(false);
  });
});
