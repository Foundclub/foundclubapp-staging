import fs from 'fs';
import path from 'path';

// 🐞 BUGHUNT P7-11 (BH06) — feuille de match sans score : `Number(null)` vaut 0, fini,
// et l'écran écrivait « null - null ». Les deux fiches (téléphone, site) font des milliers de
// lignes : ce témoin lit l'expression `scoreDeLaFeuille` et la rejoue.

const expression = (/** @type {string} */ fichier) => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', fichier), 'utf8');
  const debut = source.indexOf('scoreDeLaFeuille={') + 'scoreDeLaFeuille={'.length;
  const fin = source.indexOf(": ''}", debut) + ": ''".length;
  // eslint-disable-next-line no-new-func
  return new Function('matchStatsReport', `return (${source.slice(debut, fin)});`);
};

describe.each(['EventDetails.js', 'EventDetails.web.js'])('P7-11 — %s', (fichier) => {
  test('score non saisi : rien, pas « null - null »', () => {
    expect(expression(fichier)({ scoreAgainst: null, scoreFor: null })).toBe('');
  });

  test('score saisi 0 - 2 : affiché', () => {
    expect(expression(fichier)({ scoreAgainst: 2, scoreFor: 0 })).toBe('0 - 2');
  });
});
