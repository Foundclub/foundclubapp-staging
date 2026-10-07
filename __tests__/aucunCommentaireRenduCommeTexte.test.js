const fs = require('fs');
const path = require('path');

const { parse } = require('@babel/parser');

// TEXTE-PARASITE (07/10/2026) — le commit 99ad995b du 07/05 a posé 13 lignes
// `// @ts-ignore: FIXME: Baseline TS regression` AU MILIEU du JSX (10 dans
// SuperAdminEntryForm.js, 3 dans Conversation.web.js). Dans du JSX, `// …` n'est
// pas un commentaire : c'est du TEXTE. Dans une View il fait planter l'écran sur
// téléphone (« Text strings must be rendered within a <Text> component ») ; dans
// un <Text> ou sur le site, il s'affiche. Ni le contrôle de types, ni le lint, ni
// aucun témoin ne l'ont vu pendant cinq mois.
//
// Ce témoin lit TOUT src/ avec @babel/parser et rougit dès qu'un texte JSX
// (nœud JSXText) contient une directive `@ts-ignore` / `@ts-expect-error` ou
// commence par `//` ou `/*`. Un commentaire dans du JSX s'écrit `{/* … */}`.

const RACINE = path.resolve(__dirname, '..');
const CHAMPS_IGNORES = ['extra', 'innerComments', 'leadingComments', 'loc', 'trailingComments'];
const SRC = path.join(RACINE, 'src');

// Exceptions DATÉES, à retirer dès qu'elles ne servent plus (le dernier cas le vérifie).
const EXCEPTIONS = {};

/**
 * Les textes JSX d'une source qui ressemblent à un commentaire.
 * @param {string} code
 * @param {string} nomDeFichier
 * @returns {Array<{ ligne: number; texte: string }>}
 */
const commentairesRendus = (code, nomDeFichier) => {
  const plugins = [];
  if (!/\.ts$/.test(nomDeFichier)) plugins.push('jsx');
  if (/\.tsx?$/.test(nomDeFichier)) plugins.push('typescript');
  const ast = parse(code, { plugins, sourceType: 'module' });
  /** @type {Array<{ ligne: number; texte: string }>} */
  const trouves = [];
  /**
   * Parcourt l arbre et relève les textes JSX fautifs.
   * @param {any} noeud
   */
  const visiter = (noeud) => {
    if (!noeud || typeof noeud.type !== 'string') return;
    if (noeud.type === 'JSXText') {
      const texte = noeud.value.trim();
      if (/@ts-(ignore|expect-error)/.test(texte) || /^(\/\/|\/\*)/.test(texte)) {
        const sautsAvant = noeud.value.slice(0, noeud.value.indexOf(texte)).split('\n').length - 1;
        trouves.push({ ligne: noeud.loc.start.line + sautsAvant, texte: texte.split('\n')[0] });
      }
    }
    Object.entries(noeud).forEach(([champ, valeur]) => {
      if (CHAMPS_IGNORES.includes(champ)) return;
      if (Array.isArray(valeur)) valeur.forEach(visiter);
      else if (valeur && typeof valeur.type === 'string') visiter(valeur);
    });
  };
  visiter(ast.program);
  return trouves;
};

/**
 * Les sources de src/, tests compris.
 * @param {string} dossier
 * @param {string[]} acc
 * @returns {string[]}
 */
const sources = (dossier, acc = []) => {
  fs.readdirSync(dossier, { withFileTypes: true }).forEach((entree) => {
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      if (entree.name !== 'node_modules') sources(complet, acc);
    } else if (/\.(js|jsx|ts|tsx)$/.test(entree.name) && !/\.d\.ts$/.test(entree.name)) {
      acc.push(complet);
    }
  });
  return acc;
};

/**
 * Les commentaires rendus de src/, par fichier.
 * @returns {Record<string, string[]>} fichier relatif ⇒ ['ligne  texte']
 */
const relever = () => {
  /** @type {Record<string, string[]>} */
  const parFichier = {};
  sources(SRC).forEach((fichier) => {
    const relatif = path.relative(RACINE, fichier).split(path.sep).join('/');
    const trouves = commentairesRendus(fs.readFileSync(fichier, 'utf8'), fichier);
    if (trouves.length > 0) {
      parFichier[relatif] = trouves.map(({ ligne, texte }) => `${ligne}  ${texte}`);
    }
  });
  return parFichier;
};

describe('TEXTE-PARASITE — aucun commentaire de code n est rendu comme du texte JSX', () => {
  jest.setTimeout(120000);

  /** @type {Record<string, string[]>} */
  let releve;

  beforeAll(() => {
    releve = relever();
  });

  it('reconnaît le défaut, et seulement lui (sinon il serait toujours vert)', () => {
    const fautif = [
      'const A = () => (',
      '  <View>',
      '    // @ts-ignore: FIXME',
      '    {liste.map((x) => <Text key={x}>{x}</Text>)}',
      '    <Text>',
      '      /* note */',
      '    </Text>',
      '  </View>',
      ');',
    ].join('\n');
    expect(commentairesRendus(fautif, 'a.js')).toEqual([
      { ligne: 3, texte: '// @ts-ignore: FIXME' },
      { ligne: 6, texte: '/* note */' },
    ]);
    const sain = [
      '// @ts-ignore: au-dessus d une expression, c est un vrai commentaire',
      'const A = () => (',
      '  <View>',
      '    {/* @ts-ignore */}',
      '    <Text>http://foundclub.app — 1 / 2</Text>',
      '  </View>',
      ');',
      'const generique = <T,>(x: T) => x;',
    ].join('\n');
    expect(commentairesRendus(sain, 'a.tsx')).toEqual([]);
  });

  it('a bien lu tout src/', () => {
    expect(sources(SRC).length).toBeGreaterThan(800);
  });

  it('aucun texte JSX de src/ ne porte de directive @ts- ni ne commence par // ou /*', () => {
    const fautifs = Object.entries(releve)
      .filter(([fichier]) => !(fichier in EXCEPTIONS))
      .flatMap(([fichier, lignes]) => lignes.map((ligne) => `${fichier}:${ligne}`));
    expect(fautifs).toEqual([]);
  });

  it('chaque exception datée sert encore, et n a pas grossi', () => {
    // Une exception qui ne sert plus doit sortir de la liste : sinon elle
    // couvrirait demain un nouveau commentaire rendu dans le même fichier.
    Object.entries(EXCEPTIONS).forEach(([fichier, nombre]) => {
      expect({ fichier, nombre: (releve[fichier] || []).length }).toEqual({ fichier, nombre });
    });
  });
});
