const fs = require('fs');
const path = require('path');

const genererImages = require('../../theme/images').default;

// D46 — une MAISON sur « Accueil », et la loupe qui reste sur « Rechercher ».
//
// Les deux barres d'onglets portaient la MEME icone, `Images.search`, sur deux
// onglets qui ne disent pas la meme chose : « Accueil » cote connecte
// (PrivateTabNavigator) et « Rechercher » cote visiteur (PublicTabNavigator).
// Seul le premier change. Deux lignes identiques, une seule a modifier : un
// remplacement global mettrait une maison sur la recherche.
//
// Le controle porte sur la SOURCE plutot que sur un rendu, pour deux raisons.
// Monter `PrivateTabNavigator` tire tout `SearchStack` derriere lui. Et surtout
// un test de rendu ne charge JAMAIS `images.web.js` : or c'est cette table-la
// que Vite compile pour le site. L'y oublier ne casse aucune porte de `app`,
// et casse le site.

const racineSources = path.resolve(__dirname, '..', '..');

/**
 * Lit un fichier source du projet.
 * @param {string} cheminRelatif - Chemin depuis `src/`.
 * @returns {string} Le contenu du fichier.
 */
const lireSource = (cheminRelatif) => fs.readFileSync(
  path.join(racineSources, cheminRelatif),
  'utf8',
);

/**
 * Icone posee sur l'onglet dont le libelle cite la cle de traduction donnee.
 * Chaque onglet declare exactement un `getTabScreenCommonOptions`, donc
 * decouper la source sur cet appel isole un onglet par morceau.
 * @param {string} cheminRelatif - Chemin du navigateur depuis `src/`.
 * @param {string} cleDuLibelle - Cle de traduction du libelle, ex. `menu.home`.
 * @returns {string|undefined} L'expression posee sur `icon:`.
 */
const iconeDeLOngletIntitule = (cheminRelatif, cleDuLibelle) => lireSource(cheminRelatif)
  .split('getTabScreenCommonOptions')
  .slice(1)
  .map((onglet) => ({
    icone: (/^\s*icon:\s*(.+),$/m.exec(onglet) || [])[1],
    libelle: (/^\s*label:\s*(.+),$/m.exec(onglet) || [])[1],
  }))
  .filter(({ libelle }) => libelle && libelle.includes(`'${cleDuLibelle}'`))
  .map(({ icone }) => icone)[0];

describe('D46 — les icones de la barre d\'onglets', () => {
  it('l\'onglet « Accueil » porte la maison, plus la loupe', () => {
    expect(iconeDeLOngletIntitule('navigation/private/PrivateTabNavigator.js', 'menu.home'))
      .toBe('Images.home');
  });

  // LE test du lot. `Images.search` vit dans les deux barres ; celle-ci est a sa
  // place et doit y rester.
  it('l\'onglet « Rechercher » porte TOUJOURS la loupe', () => {
    expect(iconeDeLOngletIntitule('navigation/public/PublicTabNavigator.js', 'menu.search'))
      .toBe('Images.search');
  });

  it('la table NATIVE declare la maison, et le fichier est bien sur le disque', () => {
    // Le `require` d'une image ECHOUE si le fichier n'existe pas : charger la
    // table est donc la preuve que `home.png` est pose.
    const Images = genererImages();
    expect(Images.home).toBeDefined();
    expect(Images.home).not.toEqual(Images.search);
    expect(lireSource('theme/images.js'))
      .toContain('home: require(\'../assets/icons/home.png\')');
  });

  it('la table WEB declare la maison, sinon le site casse sans qu\'une porte le voie', () => {
    expect(lireSource('theme/images.web.js'))
      .toContain('home: createAssetSource(\'../assets/icons/home.png\')');
  });
});
