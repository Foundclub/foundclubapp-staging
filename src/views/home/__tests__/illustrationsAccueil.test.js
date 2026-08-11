const fs = require('fs');
const path = require('path');

const { images } = require('@/theme/images');

// D75 — LES CARTES D'ACCUEIL RETROUVENT LEUR ILLUSTRATION DE FOND.
//
// Trois choses qu'aucune porte existante ne sait voir, et qui se cassent en
// silence :
//   1. une carte dont la famille d'icone n'a AUCUNE illustration : elle retombe
//      sur le halo sans que rien ne rougisse ;
//   2. une famille declaree d'un seul cote — `images.js` sans `images.web.js`.
//      Le site compile physiquement les sources de `app`, donc l'oubli casse le
//      WEB et aucune porte de `app` ne le voit (piege paye avec PlayerCardScreen) ;
//   3. le branchement du hub retire : les 39 cartes redeviennent des halos, et
//      les 13 fichiers restent embarques sans que personne ne s'en apercoive.
//
// Le controle se fait sur la SOURCE pour la meme raison que ses voisins
// (`accueilParRole.test.js`, `myActivitiesEntryPoint.test.js`) : HomeHub fait
// 2 500 lignes et depend d'une vingtaine de contextes React. Un test de rendu
// couterait plus cher que l'ecran et ne dirait rien des branches NON PRISES —
// or les 39 cartes se repartissent sur 4 accueils dont un rendu ne montre qu'un.
//
// ⚠️ `images.web.js` est lu en TEXTE, jamais require : il utilise `import.meta.url`,
// que le transformeur CommonJS de jest ne sait pas analyser.

const RACINE_SRC = path.resolve(__dirname, '..', '..', '..');
const DOSSIER_ILLUSTRATIONS = path.join(RACINE_SRC, 'assets', 'background-card-home');
const SOURCE_HUB = fs.readFileSync(path.join(RACINE_SRC, 'views', 'home', 'HomeHub.js'), 'utf8');
const SOURCE_WEB = fs.readFileSync(path.join(RACINE_SRC, 'theme', 'images.web.js'), 'utf8');

/**
 * Les clefs du bloc `homeIllustrations` d'un fichier de table d'images, lu en texte.
 * Lever si le bloc a disparu : une decoupe muette rendrait une liste vide, donc
 * un test vert sur une table cassee.
 * @param {string} source - Contenu du fichier.
 * @param {string} nomFichier - Pour nommer le fichier dans l'erreur.
 * @returns {string[]} - Les clefs declarees, dans l'ordre d'ecriture.
 */
const familiesDeclarees = (source, nomFichier) => {
  const debut = source.indexOf('homeIllustrations: {');
  if (debut === -1) throw new Error(`${nomFichier} n'a plus de bloc « homeIllustrations »`);
  const fin = source.indexOf('},', debut);
  if (fin === -1) throw new Error(`Le bloc « homeIllustrations » de ${nomFichier} n'est pas ferme`);
  return (source.slice(debut, fin).match(/^ {4}([A-Za-z0-9_]+):/gm) || [])
    .map((ligne) => ligne.trim().slice(0, -1));
};

// Chaque carte du hub porte `icon: '<famille>'` (une CHAINE). Le typedef, lui,
// ecrit `icon?: any` sans quotes : il ne peut donc pas etre compte par erreur.
const FAMILLES_UTILISEES = (SOURCE_HUB.match(/icon: '([^']+)'/g) || [])
  .map((occurrence) => occurrence.slice(7, -1));

const FAMILLES_NATIVES = Object.keys(images.homeIllustrations || {});
const FAMILLES_WEB = familiesDeclarees(SOURCE_WEB, 'images.web.js');

describe('D75 — l illustration de fond des cartes d accueil', () => {
  it('chaque carte du hub a une illustration pour sa famille d icone', () => {
    // Mesure du 2026-08-12 : 39 cartes, 13 familles. Le nombre de cartes n'est
    // PAS fige ici — c'est la couverture qui compte. Ce test rougit le jour ou
    // une carte arrive avec une famille qui n'a pas son dessin.
    expect(FAMILLES_UTILISEES.length).toBeGreaterThan(0);

    const orphelines = [...new Set(FAMILLES_UTILISEES)]
      .filter((famille) => !FAMILLES_NATIVES.includes(famille));

    expect(orphelines).toEqual([]);
  });

  it('les deux tables d images declarent EXACTEMENT les memes familles', () => {
    // Le controle qui vaut : comparer les ENSEMBLES de clefs. Compter les lignes
    // ne dirait rien — une clef renommee sort a la fois en ajout et en retrait.
    expect([...FAMILLES_NATIVES].sort()).toEqual([...FAMILLES_WEB].sort());
  });

  it('chaque famille declaree pointe sur un fichier reellement present', () => {
    expect(FAMILLES_NATIVES.length).toBeGreaterThan(0);

    const manquantes = FAMILLES_NATIVES.filter((famille) => {
      const fichier = path.join(DOSSIER_ILLUSTRATIONS, `${famille}.png`);
      return !fs.existsSync(fichier) || fs.statSync(fichier).size === 0;
    });

    expect(manquantes).toEqual([]);
  });

  it('le hub branche l illustration sur la famille de la carte', () => {
    // La ligne unique qui sert les 39 cartes. La retirer les rendrait toutes au
    // halo — sans casser ni le rendu, ni le type, ni le lint.
    expect(SOURCE_HUB).toContain('illustrationsParFamille[card.icon]');
  });

  it('laisse une illustration explicite gagner sur celle de la famille', () => {
    // `card.illustration` reste prioritaire : une carte peut porter son propre
    // dessin sans que la table de familles le remplace.
    expect(SOURCE_HUB).toContain('card.illustration || illustrationsParFamille[card.icon]');
  });
});
