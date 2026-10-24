import renderer, { act } from 'react-test-renderer';

const mockQuery = { data: null, isLoading: false, error: null, refetch: jest.fn() };

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_k, fallback) => fallback }) }));
jest.mock('@/theme/themeContext', () => () => ({
  Fonts: new Proxy({}, { get: () => ({}) }),
  Spaces: { gap: new Proxy({}, { get: () => ({}) }) },
}));
jest.mock('@/views/admin/components/AdminStateView', () => () => null);
jest.mock('@/views/admin/components/SuperAdminLeagueCard', () => ({ children }) => children);
jest.mock('@/views/admin/components/SuperAdminLeagueLayout', () => ({ children }) => children);
jest.mock('@/navigation/routeNames', () => ({ RouteNames: {} }));
jest.mock('@/services/admin/superadminLeagueQueries', () => ({
  useGetSuperadminLeagueDivisions: () => mockQuery,
}));
jest.mock('@/utils/errors/displayError', () => ({ getErrorMessage: () => '' }));

const SuperAdminLeagueDivisions = require('../SuperAdminLeagueDivisions').default;

// BH09 P9-04 : le service rend déjà le tableau ; l'écran ne doit pas le dire vide.
test('affiche les divisions quand le service rend un tableau', () => {
  mockQuery.data = [{ division: 2, sport: 'padel', squads: [] }];
  let tree;
  act(() => { tree = renderer.create(<SuperAdminLeagueDivisions />); });
  const text = JSON.stringify(tree.toJSON());
  expect(text).not.toContain('Aucune donnée de division disponible.');
  expect(text).toContain('padel');
});
