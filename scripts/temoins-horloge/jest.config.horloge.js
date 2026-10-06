/**
 * La configuration Jest de `npm run temoins:horloge` (TEMOINS-DATES, 06/10/2026) : celle du dépôt,
 * plus l'horloge avancée chargée dans le monde du témoin (`setupFiles`). Jest donne à chaque
 * fichier son propre `Date` : `NODE_OPTIONS=--require` ne décale que le processus qui l'entoure
 * (là où `jest.useFakeTimers()` sans `now` lit l'heure), d'où les deux.
 */
const path = require('path');

const base = require('../../jest.config');

module.exports = {
  ...base,
  rootDir: path.join(__dirname, '..', '..'),
  setupFiles: [...(base.setupFiles || []), '<rootDir>/scripts/temoins-horloge/avancer-date.js'],
};
