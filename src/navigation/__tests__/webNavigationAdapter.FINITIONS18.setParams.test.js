import { RouteNames } from '../routeNames';
import { createWebNavigationAdapter } from '../webNavigationAdapter';

// FINITIONS18 · POINT 12 (tournee T16, SITE_S15) — `/teams/<U15>/stats` mene bien a l'onglet
// Stats de l'equipe, mais l'adresse garde `initialTab=undefined` : TeamDetails EFFACE le
// parametre (`setParams({ ...params, initialTab: undefined })`) et le `setParams` du site
// passait l'objet tel quel a `setSearchParams`, qui ecrit « undefined ». La regle de
// `buildQueryString` (ni vide, ni objet) vaut aussi ici, pour tous les ecrans. ROUGE avant.

const fabriquer = (/** @type {any} */ params) => {
  const setSearchParams = jest.fn();
  const adapter = createWebNavigationAdapter({
    currentPath: '/teams/u15?initialTab=stats',
    currentRouteName: RouteNames.TeamDetails,
    goBack: jest.fn(),
    params,
    push: jest.fn(),
    replace: jest.fn(),
    setSearchParams,
  });
  return { adapter, setSearchParams };
};

test('🔴 un parametre efface (undefined) disparait de l adresse, sans « undefined »', () => {
  const { adapter, setSearchParams } = fabriquer({ initialTab: 'stats', teamId: 'u15' });
  adapter.setParams({ initialTab: undefined });
  expect(setSearchParams).toHaveBeenCalledTimes(1);
  const ecrit = setSearchParams.mock.calls[0][0];
  // react-router ecrit CHAQUE cle recue (`createSearchParams`) : « undefined » compris.
  expect(Object.keys(ecrit)).toEqual(['teamId']);
  expect(new URLSearchParams(Object.entries(ecrit)).toString()).toBe('teamId=u15');
});

test('🔒 un faux explicite reste ecrit (un parametre « vrai par defaut » y tient)', () => {
  const { adapter, setSearchParams } = fabriquer({ teamId: 'u15' });
  adapter.setParams({ enableMapMode: false, filtre: null, vide: '' });
  expect(setSearchParams.mock.calls[0][0]).toStrictEqual({ enableMapMode: 'false', teamId: 'u15' });
});
