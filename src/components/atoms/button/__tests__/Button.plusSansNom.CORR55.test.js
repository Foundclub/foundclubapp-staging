const fs = require('fs');
const path = require('path');

// CORR-ROBUSTESSE point 55 (recette du site, 30/10, « A ») — le « + » des joueurs (et des
// entraîneurs, partenaires, dirigeants…) est un `Button` à icône seule : sans `title` ni
// `accessibilityLabel`, le lecteur d'écran n'annonce que « bouton ». Ce témoin lit les deux
// fiches où la recette l'a constaté et refuse un tel bouton sans nom.

const FICHES = ['src/views/team/TeamDetails.js', 'src/views/club/ClubDetails.js'];

/**
 * Les balises `<Button …/>` d'un fichier qui n'ont ni titre ni nom accessible.
 * @param {string} source - Le code du fichier.
 * @returns {string[]} Les balises fautives, sur une ligne.
 */
const boutonsSansNom = (source) => (source.match(/<Button\b[^>]*?\/>/gs) || [])
  .filter((balise) => /\bicon=/.test(balise))
  .filter((balise) => !/\btitle=/.test(balise) && !/\baccessibilityLabel=/.test(balise))
  .map((balise) => balise.replace(/\s+/g, ' '));

test.each(FICHES)('point 55 — %s : aucun bouton à icône seule sans nom', (fichier) => {
  const source = fs.readFileSync(path.join(__dirname, '../../../../..', fichier), 'utf8');
  expect(boutonsSansNom(source)).toEqual([]);
});

// Même constat pour les interrupteurs : un `Switch` sans `accessibilityLabel` s'annonce
// « interrupteur, activé » sans dire ce qu'il règle. Mesuré le 30/10 : 17 dans 12 fichiers.
test('point 55 — aucun interrupteur sans nom dans l app', () => {
  const racine = path.join(__dirname, '../../../../..');
  /** @type {string[]} */
  const fautifs = [];
  const parcourir = (/** @type {string} */ dossier) => {
    fs.readdirSync(dossier, { withFileTypes: true }).forEach((entree) => {
      const chemin = path.join(dossier, entree.name);
      if (entree.isDirectory()) {
        if (entree.name !== '__tests__' && entree.name !== 'node_modules') parcourir(chemin);
        return;
      }
      if (!/\.js$/.test(entree.name) || /\.test\.js$/.test(entree.name)) return;
      const source = fs.readFileSync(chemin, 'utf8');
      (source.match(/<Switch\b[\s\S]*?\/>/g) || [])
        .filter((balise) => !/\baccessibilityLabel=/.test(balise))
        .forEach(() => fautifs.push(path.relative(racine, chemin).split(path.sep).join('/')));
    });
  };
  parcourir(path.join(racine, 'src'));
  expect(fautifs).toEqual([]);
});
