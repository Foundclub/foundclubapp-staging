import { buildSearchMapSyncScript, buildSearchMapCommandScript } from '../searchMapRuntime';
import { getSearchMapDetailTarget } from '../searchMapDetailNavigation';

describe('BH13 carte de recherche', () => {
  it('P4-01 : une apostrophe ne casse pas le script injecté', () => {
    const items = [{ id: 1, name: "Club de l'Estaque" }];
    expect(() => new Function(buildSearchMapSyncScript('m', { items }))).not.toThrow();
    expect(() => new Function(buildSearchMapCommandScript('m', { type: 'x', name: "l'Estaque" }))).not.toThrow();
  });
  it('P4-02 : épingle multisport hors connexion → connexion', () => {
    const t = getSearchMapDetailTarget({ scope: 'clubs', rawItem: { documentId: 'c', _type: 'multisport' }, isAuthenticated: false });
    expect(t).toEqual({ name: 'PublicAuthStack', params: { screen: 'Login' } });
  });
});
