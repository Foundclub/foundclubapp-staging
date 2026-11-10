// GERANT-INSCRIPTION (10/11/2026, décisions 1 et 4 A) — l'arrivée d'un compte sans rôle sportif
// vient de la règle PARTAGÉE avec le site (`domains/complexe/arriveeSansRole.js`, témoins rendus
// dans son propre fichier) ; un gérant de complexe sans identité ouvre « Qui es-tu ? », puis son
// complexe. Le navigateur privé n'est rendu par aucun test : le témoin lit la source, comme BH02.
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'PrivateNavigator.js'), 'utf8');

it('l’arrivée sans rôle sportif est calculée par la règle partagée avec le site', () => {
  expect(source).toMatch(/import \{ arriveeSansRoleSportif \} from '@\/domains\/complexe\/arriveeSansRole'/);
  expect(source).toMatch(/arriveeSansRoleSportif\(\{/);
});

it('un gérant sans identité arrive sur « Qui es-tu ? », sinon sur son complexe', () => {
  const debut = source.indexOf('const initialRouteName = useMemo(');
  const calcul = source.slice(debut, source.indexOf('const firstPendingOnboardingRoute'));
  expect(calcul).toMatch(/arrivee === 'identite'\s*\?\s*RouteNames\.UserName\s*:\s*RouteNames\.ComplexeEspace/);
  // La Ville d'abord, comme avant.
  expect(calcul.indexOf('villeSeule')).toBeLessThan(calcul.indexOf('complexeSeul'));
});
