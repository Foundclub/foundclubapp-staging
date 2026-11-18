import { buildPublicAuthStackParams, openPublicAuthFlow } from '../public/publicAuthNavigation';
import { RouteNames } from '../routeNames';
import { createWebNavigationAdapter } from '../webNavigationAdapter';

// T-PAGES-3b (18/11/2026, point 3) — LE VISITEUR VA DROIT À LA CRÉATION DU COMPTE, ET REVIENT AU
// TOURNOI. Le tunnel public ne savait ouvrir que la connexion ; il ouvre aussi l'inscription, et
// l'adresse de la fiche (`state.from`) part avec elle comme avec la connexion (T-FICHE-2).

const fabriquer = () => {
  /** @type {any[]} */
  const appels = [];
  const adapter = createWebNavigationAdapter({
    currentPath: '/events/evt-tournoi',
    currentRouteName: RouteNames.EventDetails,
    goBack: jest.fn(),
    params: {},
    push: (/** @type {string} */ chemin, /** @type {any} */ etat) => appels.push([chemin, etat]),
    replace: jest.fn(),
    setSearchParams: jest.fn(),
  });
  return { adapter, appels };
};

test('🔴 l inscription demandée avec le retour porte l adresse de la fiche (state.from)', () => {
  const { adapter, appels } = fabriquer();
  openPublicAuthFlow(adapter, { origin: RouteNames.EventDetails, retourApresConnexion: true }, RouteNames.Register);
  expect(appels).toHaveLength(1);
  expect(appels[0][0].split('?')[0]).toBe('/register');
  expect(appels[0][1]).toEqual({ from: '/events/evt-tournoi' });
});

test('🔒 sans écran demandé, le tunnel ouvre la connexion, comme avant', () => {
  expect(buildPublicAuthStackParams({ a: 1 })).toEqual({ params: { a: 1 }, screen: RouteNames.Login });
});

test('🔒 l inscription sans la demande de retour ne pose aucun état', () => {
  const { adapter, appels } = fabriquer();
  openPublicAuthFlow(adapter, { origin: RouteNames.EventDetails }, RouteNames.Register);
  expect(appels[0][0].split('?')[0]).toBe('/register');
  expect(appels[0][1]).toBeUndefined();
});
