import { RouteNames } from '../routeNames';
import { buildWebPath, getWebRoutePattern } from '../webRoutes';

it('P4-03 : un paramètre déjà dans le chemin ne se répète pas dans la requête', () => {
  expect(getWebRoutePattern(RouteNames.Club)).toContain(':');
  expect(buildWebPath(RouteNames.Club, { clubId: 'abc' })).not.toContain('?');
});
