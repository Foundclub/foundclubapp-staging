import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 🐞 BUGHUNT P3-07 (BH06) — une date « YYYY-MM-DD » était lue comme minuit UTC : à l'ouest
// de l'heure UTC (Antilles, Guyane), « 2026-10-24 » s'affichait « ven 23/10/2026 ».
// 🕰️ jest isole `process.env` et ne change pas de fuseau en route ; sous Windows la variable
// TZ passée en ligne de commande n'est pas lue. Le témoin rejoue donc la fonction dans un
// Node à part, où le fuseau est posé avant tout calcul de date.

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'date.js'), 'utf8');
const debut = SOURCE.indexOf('const WEEKDAY_PREFIX_FR');
const fin = SOURCE.indexOf('\n};', SOURCE.indexOf('export const formatDateWithDayPrefix')) + 3;
const FONCTION = SOURCE.slice(debut, fin).replace('export const', 'const');

const enMartinique = (/** @type {string} */ valeur) => execFileSync(process.execPath, ['-e', `
  process.env.TZ = 'America/Martinique';
  ${FONCTION}
  process.stdout.write(formatDateWithDayPrefix(${JSON.stringify(valeur)}));
`]).toString();

test('P3-07 — en Martinique, « 2026-10-24 » reste le samedi 24', () => {
  expect(enMartinique('2026-10-24')).toBe('sam 24/10/2026');
});

test('P3-07 — une date avec heure garde sa lecture d avant (jour de l appareil)', () => {
  expect(enMartinique('2026-10-24T02:00:00.000Z')).toBe('ven 23/10/2026');
});
