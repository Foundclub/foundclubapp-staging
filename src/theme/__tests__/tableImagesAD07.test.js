const fs = require('fs');
const path = require('path');

const { images } = require('@/theme/images');

// AD07 (T1 + T2) — LA BOITE A IMAGES DU SITE PERDAIT DEUX FONDS DE CARTE.
//
// Constat du 2026-08-21 : `card-tournoi.png` (1 077 903 o) et `card-stage.png`
// (742 780 o) sont dans le depot depuis le 12/12/2025 et declares cote
// telephone (`images.js:15-16`), mais ABSENTS de `images.web.js`. Sur le site,
// la carte d'un tournoi et celle d'un stage sortaient donc sans aucun fond,
// alors que les deux dessins etaient deja embarques. `EventCardNew.js:59-60`
// les demande, `Images.eventCardTournament` / `Images.eventCardStage` rendaient
// `undefined`, et RIEN ne rougissait : aucune porte de `app` ne lit cette table.
//
// ⚠️ `images.web.js` est lu en TEXTE, jamais require : il utilise
// `import.meta.url`, que le transformeur CommonJS de jest ne sait pas analyser.
// (Meme raison que `illustrationsAccueil.test.js:24-25`.)
//
// ⚠️ Le controle compare des ENSEMBLES de clefs, jamais un NOMBRE de lignes :
// un `grep` naif sur `^  clef:` ramasse aussi `uri` (ligne 4, a l'interieur de
// `createAssetSource`) et annonce 57 clefs la ou il y en a 56.

const RACINE_SRC = path.resolve(__dirname, '..', '..');
const SOURCE_WEB = fs.readFileSync(path.join(RACINE_SRC, 'theme', 'images.web.js'), 'utf8');

/**
 * Les clefs de PREMIER NIVEAU du bloc `export const images = { … };`, lues en
 * texte. Lever si le bloc a disparu : une decoupe muette rendrait une liste
 * vide, donc un test vert sur une table cassee.
 * @param {string} source - Contenu du fichier.
 * @param {string} nomFichier - Pour nommer le fichier dans l'erreur.
 * @returns {string[]} - Les clefs declarees, dans l'ordre d'ecriture.
 */
const clefsDePremierNiveau = (source, nomFichier) => {
  const debut = source.indexOf('export const images = {');
  if (debut === -1) throw new Error(`${nomFichier} n'a plus de bloc « export const images »`);
  const bloc = source.slice(debut);
  const fin = bloc.indexOf('\n};');
  if (fin === -1) throw new Error(`Le bloc « images » de ${nomFichier} n'est pas ferme`);

  const clefs = [];
  let profondeur = 0;
  bloc.slice(0, fin).split('\n').slice(1).forEach((ligne) => {
    const trouvee = ligne.match(/^ {2}([A-Za-z0-9_]+):/);
    if (trouvee && profondeur === 0) clefs.push(trouvee[1]);
    profondeur += (ligne.match(/\{/g) || []).length - (ligne.match(/\}/g) || []).length;
  });
  return clefs;
};

const CLEFS_NATIVES = Object.keys(images);
const CLEFS_WEB = clefsDePremierNiveau(SOURCE_WEB, 'images.web.js');

/**
 * Les chemins d'asset portes par une table, quelle que soit la forme
 * (`require('…')` cote natif, `createAssetSource('…')` cote web).
 * @param {string} source - Contenu du fichier.
 * @returns {Record<string, string>} - Chemin relatif par clef de premier niveau.
 */
const cheminsDeclares = (source) => {
  /** @type {Record<string, string>} */
  const table = {};
  source.split(/\r?\n/).forEach((ligne) => {
    const trouve = ligne.match(/^ {2}([A-Za-z0-9_]+): [A-Za-z]+\('([^']+)'\)/);
    if (trouve) {
      const [, clef, chemin] = trouve;
      table[clef] = chemin;
    }
  });
  return table;
};

const SOURCE_NATIVE = fs.readFileSync(path.join(RACINE_SRC, 'theme', 'images.js'), 'utf8');

describe('AD07 — les deux tables d images', () => {
  it('T1 — les deux tables declarent EXACTEMENT les memes clefs', () => {
    // Garde-fou : si la decoupe rate, les deux listes seraient vides et le test
    // passerait au vert sur une table cassee.
    expect(CLEFS_NATIVES.length).toBeGreaterThan(50);
    expect(CLEFS_WEB.length).toBeGreaterThan(50);

    const absentesDuSite = CLEFS_NATIVES.filter((clef) => !CLEFS_WEB.includes(clef));
    const absentesDuTelephone = CLEFS_WEB.filter((clef) => !CLEFS_NATIVES.includes(clef));

    expect({ absentesDuSite, absentesDuTelephone }).toEqual({
      absentesDuSite: [], absentesDuTelephone: [],
    });
  });

  it('T2 — chaque fond eventCard* pointe sur un fichier present et non vide', () => {
    const fondsNatifs = CLEFS_NATIVES.filter((clef) => clef.startsWith('eventCard'));
    const fondsWeb = CLEFS_WEB.filter((clef) => clef.startsWith('eventCard'));

    // Les 7 familles d'evenement : autre, detection, entrainement, match,
    // reservation, stage, tournoi.
    expect(fondsNatifs).toHaveLength(7);
    expect(fondsWeb).toHaveLength(7);

    /** @type {string[]} */
    const introuvables = [];
    [
      { chemins: cheminsDeclares(SOURCE_NATIVE), clefs: fondsNatifs, nomFichier: 'images.js' },
      { chemins: cheminsDeclares(SOURCE_WEB), clefs: fondsWeb, nomFichier: 'images.web.js' },
    ].forEach(({ chemins, clefs, nomFichier }) => {
      clefs.forEach((clef) => {
        const chemin = chemins[clef];
        if (!chemin) {
          introuvables.push(`${nomFichier} · ${clef} · chemin illisible`);
          return;
        }
        const fichier = path.resolve(RACINE_SRC, 'theme', chemin);
        if (!fs.existsSync(fichier) || fs.statSync(fichier).size === 0) {
          introuvables.push(`${nomFichier} · ${clef} · ${chemin}`);
        }
      });
    });

    expect(introuvables).toEqual([]);
  });
});
