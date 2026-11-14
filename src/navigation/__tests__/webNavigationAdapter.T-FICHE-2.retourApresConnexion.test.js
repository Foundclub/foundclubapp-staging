import { buildPublicAuthStackParams } from '../public/publicAuthNavigation';
import { RouteNames } from '../routeNames';
import { createWebNavigationAdapter } from '../webNavigationAdapter';

// T-FICHE-2 (14/11, tournoi du 19/12) — LE RETOUR SUR LA FICHE APRÈS LA CONNEXION, SUR LE SITE.
// La page de connexion du site (web/src/routes/SharedLoginRoute.tsx) ramène à `state.from` une
// fois le compte ouvert ; le tunnel du site (`openPublicAuthFlow` → cet adaptateur) ne le posait
// jamais : le visiteur retombait sur l'accueil. Une entrée qui demande `retourApresConnexion`
// porte maintenant l'adresse courante ; les autres entrées du tunnel ne changent pas.

const fabriquer = () => {
  /** @type {any[]} */
  const appels = [];
  const adapter = createWebNavigationAdapter({
    currentPath: '/events/evt-tournoi?vitrine=1',
    currentRouteName: RouteNames.EventDetails,
    goBack: jest.fn(),
    params: {},
    push: (/** @type {string} */ chemin, /** @type {any} */ etat) => appels.push([chemin, etat]),
    replace: jest.fn(),
    setSearchParams: jest.fn(),
  });
  return { adapter, appels };
};

test('🔴 une connexion qui demande le retour porte l adresse de la fiche (state.from)', () => {
  const { adapter, appels } = fabriquer();
  adapter.navigate(RouteNames.PublicAuthStack, buildPublicAuthStackParams({
    origin: RouteNames.EventDetails, retourApresConnexion: true,
  }));
  expect(appels).toHaveLength(1);
  expect(appels[0][0].split('?')[0]).toBe('/login');
  expect(appels[0][1]).toEqual({ from: '/events/evt-tournoi?vitrine=1' });
});

test('🔒 sans la demande, rien ne change : aucun état posé (les autres entrées du tunnel)', () => {
  const { adapter, appels } = fabriquer();
  adapter.navigate(
    RouteNames.PublicAuthStack,
    buildPublicAuthStackParams({ origin: RouteNames.EventDetails }),
  );
  expect(appels[0][1]).toBeUndefined();
});

test('🔒 la demande ne vaut que vers la connexion : aucun autre écran ne porte de retour', () => {
  const { adapter, appels } = fabriquer();
  adapter.navigate(RouteNames.EventDetails, { eventId: 'e2', retourApresConnexion: true });
  expect(appels[0][1]).toBeUndefined();
});
