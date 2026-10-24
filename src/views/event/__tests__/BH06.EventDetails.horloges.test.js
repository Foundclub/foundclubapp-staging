import fs from 'fs';
import path from 'path';

import { transformSync } from '@babel/core';

import { toUtcFromZonedLocal } from '@/utils/parisTime';

// 🐞 BUGHUNT P7-04 et P7-05 (BH06) — les deux horloges de SECOURS de la fiche événement.
// P7-04 : sans heure du serveur, le début « 2025-06-01 + 18:00 » était posé à 18:00 UTC
//         (20:00 à Paris) : fenêtre d'arrivée et compte à rebours décalés de 1 à 2 h.
// P7-05 : sans heure du serveur, `Date.now() + écoulé` comptait deux fois le temps passé.
// EventDetails fait 10 000 lignes : comme ANDROIDBAR-4, ce témoin LIT le code et le rejoue.

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'EventDetails.js'), 'utf8');

/**
 * Compile un morceau du code de l'écran et le rend exécutable.
 * @param {string} morceau Le code (expression).
 * @param {Record<string, any>} portee Les noms dont il a besoin.
 * @returns {any} La valeur de l'expression.
 */
const rejouer = (morceau, portee) => {
  const { code } = transformSync(`(${morceau})`, { babelrc: false, configFile: false });
  // eslint-disable-next-line no-new-func
  return new Function(...Object.keys(portee), `return ${code.replace(/;\s*$/, '')}`)(...Object.values(portee));
};

const extraire = (/** @type {RegExp} */ debut, /** @type {string} */ fin) => {
  const i = SOURCE.search(debut);
  expect(i).toBeGreaterThan(-1);
  const j = SOURCE.indexOf(fin, i);
  return SOURCE.slice(i, j + fin.length);
};

test('P7-04 — 2025-06-01 à 18:00 (heure de Paris) = 16:00 UTC', () => {
  const corps = extraire(/\(event\) => \{\n {2}const eventDate = event\?\.date/, '\n};');
  const resolveEventStartAt = rejouer(corps.replace(/;$/, ''), {
    START_TIME_RE: /^(\d{1,2}):(\d{2})/,
    toUtcFromZonedLocal,
  });
  expect(resolveEventStartAt({ date: '2025-06-01', startTime: '18:00' }).toISOString())
    .toBe('2025-06-01T16:00:00.000Z');
  // Une date qui porte déjà son heure ne bouge pas.
  expect(resolveEventStartAt({ date: '2025-06-01T16:30:00.000Z', startTime: '18:00' }).toISOString())
    .toBe('2025-06-01T16:30:00.000Z');
});

test('P7-05 — sans heure du serveur, 10 min sur l écran = 10 min d horloge, pas 20', () => {
  const corps = extraire(/\(\) => \(serverClockMs === null \?/, 'serverClockMs)');
  const debut = 1_000_000;
  const spy = jest.spyOn(Date, 'now').mockReturnValue(debut + 600_000);
  const maintenant = rejouer(corps, { elapsedSinceServerNowMs: 600_000, serverClockMs: null });
  const valeur = maintenant();
  spy.mockRestore();
  expect(valeur).toBe(debut + 600_000);
});
