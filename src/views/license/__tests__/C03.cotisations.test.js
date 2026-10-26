import { currentSeason, euroToCents } from '../CMLicensesDashboard';
import { isoDateFromEventValue } from '../eventCampaignDefaults';

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);
jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock() { return null; });
jest.mock('react-native-linear-gradient', () => function GradientMock() { return null; });
jest.mock('@/services/license/licenseQueries', () => ({}));
jest.mock('@/services/license/licenseService', () => ({}));

/**
 * BUGHUNT phase 2, lot C03 (25/10) — cotisations : saison, montant, date.
 */
describe('C03 — cotisations, fonctions pures', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('Q4-09 — de janvier à juillet, la saison en cours est celle commencée l été d avant', () => {
    jest.useFakeTimers().setSystemTime(new Date(2027, 2, 15, 12, 0, 0));
    expect(currentSeason()).toBe('2026-2027');
    jest.setSystemTime(new Date(2026, 8, 1, 12, 0, 0));
    expect(currentSeason()).toBe('2026-2027');
    jest.setSystemTime(new Date(2027, 6, 31, 12, 0, 0));
    expect(currentSeason()).toBe('2026-2027');
  });

  test('Q4-23 — « 1.000 » est mille euros, « 12.50 » reste douze cinquante', () => {
    expect(euroToCents('1.000')).toBe(100000);
    expect(euroToCents('12.000.000')).toBe(1200000000);
    expect(euroToCents('12.50')).toBe(1250);
    expect(euroToCents('1.5')).toBe(150);
    // Les cas deja couverts par BH11 P5-03 ne bougent pas.
    expect(euroToCents('1 000')).toBe(100000);
    expect(euroToCents('1.234,50')).toBe(123450);
  });

  test('Q4-13 — un événement à 00:30 ou 23:30 heure locale garde son jour local', () => {
    // Construites en heure LOCALE puis passees en UTC, comme le serveur les rend :
    // l une des deux change de jour en UTC quel que soit le fuseau (hors UTC).
    expect(isoDateFromEventValue(new Date(2026, 10, 2, 0, 30).toISOString())).toBe('2026-11-02');
    expect(isoDateFromEventValue(new Date(2026, 10, 1, 23, 30).toISOString())).toBe('2026-11-01');
    // Un jour seul reste tel quel.
    expect(isoDateFromEventValue('2026-11-02')).toBe('2026-11-02');
  });
});
