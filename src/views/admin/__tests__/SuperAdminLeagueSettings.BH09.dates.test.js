process.env.TZ = 'Europe/Paris';

jest.mock('@/services/admin/superadminLeagueQueries', () => ({}));
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/views/admin/components/AdminStateView', () => () => null);
jest.mock('@/views/admin/components/SuperAdminLeagueCard', () => () => null);
jest.mock('@/views/admin/components/SuperAdminLeagueLayout', () => () => null);
jest.mock('@/navigation/routeNames', () => ({ RouteNames: {} }));

const { formatInputDate, parseInputDate } = require('../SuperAdminLeagueSettings');

// BH09 P9-01 : afficher puis relire une date ne doit pas la décaler (heure de Paris).
test('aller-retour sans décalage', () => {
  const iso = '2026-11-02T16:00:00.000Z';
  expect(parseInputDate(formatInputDate(iso))).toBe(iso);
});
