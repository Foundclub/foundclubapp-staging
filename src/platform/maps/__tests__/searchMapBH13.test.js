/* eslint-disable max-len -- entrées du rapport BUGHUNT, gardées telles quelles */
import { getSearchMapDetailTarget } from '../searchMapDetailNavigation';
import { buildSearchMapCommandScript, buildSearchMapSyncScript } from '../searchMapRuntime';

describe('BH13 carte de recherche', () => {
  it('P4-01 : une apostrophe ne casse pas le script injecté', () => {
    // Le témoin compile le script injecté, comme la WebView : c'est le but du test.
    /* eslint-disable no-new-func -- témoin de syntaxe */
    const items = [{ id: 1, name: "Club de l'Estaque" }];
    expect(() => new Function(buildSearchMapSyncScript('m', { items }))).not.toThrow();
    expect(() => new Function(buildSearchMapCommandScript('m', { name: "l'Estaque", type: 'x' }))).not.toThrow();
    /* eslint-enable no-new-func */
  });
  it('P4-02 : épingle multisport hors connexion → connexion', () => {
    const t = getSearchMapDetailTarget({ isAuthenticated: false, rawItem: { _type: 'multisport', documentId: 'c' }, scope: 'clubs' });
    expect(t).toEqual({ name: 'PublicAuthStack', params: { screen: 'Login' } });
  });
});
