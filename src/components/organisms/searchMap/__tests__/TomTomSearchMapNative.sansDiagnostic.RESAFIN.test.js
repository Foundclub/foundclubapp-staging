const fs = require('fs');
const path = require('path');

// RESA-FIN-APP (20/10/2026) — tournée 1, vue Carte de E-P01 : la carte en erreur montrait au joueur un texte
// technique, « Diagnostic: focus_results_single » (tranché : jamais montré à l'utilisateur). Il n'était écrit
// qu'en développement (`__DEV__`), mais c'est là que les recettes regardent l'app : il n'est plus écrit du tout
// (le journal de la carte le garde, `searchMapRuntime`). Témoin de STRUCTURE : la carte native ne dessine
// aucun « Diagnostic: ».
describe('RESA-FIN-APP (3) — la carte native ne montre aucun texte technique', () => {
  it('aucun « Diagnostic: » dans ce que la carte dessine', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'TomTomSearchMapNative.js'), 'utf8');
    expect(source).not.toMatch(/`Diagnostic: /);
  });
});
