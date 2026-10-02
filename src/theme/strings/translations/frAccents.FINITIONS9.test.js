/* eslint-disable max-len -- les phrases de fr.js sont citées en entier */
import fs from 'fs';
import path from 'path';

import fr from '@/theme/strings/translations/fr';

// FINITIONS9 (03/10) — LES DERNIERS TEXTES SANS ACCENTS.
//
// Fiche : SUIVI_AUDIT_V1.md, « Les restes du même défaut ». Valeurs seulement : aucune clef n'est
// renommée (ensembles de clefs comparés avant / après dans le compte rendu du lot).
// Même forme que frAccents.FINITIONS8.test.js. Les replis `t(…, '…')` du code sont relus aussi :
// une clef absente ou mal chargée les montre tels quels.

const SRC = path.resolve(__dirname, '..', '..', '..');
const DOSSIERS_EXCLUS = ['__mocks__', '__tests__', 'testSupport', 'translations'];

/**
 * La valeur d'une clef.
 * @param {string} chemin
 * @returns {any}
 */
const lire = (chemin) => chemin.split('.').reduce(
  (/** @type {any} */ noeud, part) => (noeud == null ? undefined : noeud[part]),
  fr,
);

/**
 * Les fichiers de production sous src/ (témoins, doublures et dictionnaires exclus).
 * @param {string} dossier
 * @returns {string[]}
 */
const fichiersDeProduction = (dossier) => fs.readdirSync(dossier, { withFileTypes: true })
  .flatMap((entree) => {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) return DOSSIERS_EXCLUS.includes(entree.name) ? [] : fichiersDeProduction(chemin);
    return /\.(js|ts|tsx)$/.test(entree.name) && !/\.test\./.test(entree.name) ? [chemin] : [];
  });

/**
 * Les textes du code (replis compris) qui valent EXACTEMENT une des formes fautives.
 * @param {string[]} formes
 * @returns {string[]}
 */
const textesDuCodeEgauxA = (formes) => {
  const motif = new RegExp(`(['"\`])(${formes.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\1`);
  return fichiersDeProduction(SRC).flatMap((fichier) => fs.readFileSync(fichier, 'utf8')
    .split('\n')
    .map((ligne, index) => (motif.test(ligne) ? `${path.relative(SRC, fichier)}:${index + 1}` : null))
    .filter((/** @type {string | null} */ trouve) => trouve !== null));
};

describe('FINITIONS9 · point 1 — « À définir », avec sa capitale accentuée', () => {
  it.each([
    ['adWizardCoachProfile.engagement.toBeDefined'],
    ['recruitmentAdEdit.engagement.toBeDefined'],
    ['tournamentCompetitionComponents.toBeDecided'],
    ['venueProposalModal.toBeDecided'],
  ])('%s vaut « À définir »', (chemin) => {
    expect(lire(chemin)).toBe('À définir');
  });

  it('aucun texte du code (repli compris) ne vaut plus « A définir »', () => {
    expect(textesDuCodeEgauxA(['A définir'])).toEqual([]);
  });
});

// « Confirme » est dans la MÊME liste d'options (l'expérience attendue d'un entraîneur) : même
// défaut, corrigé avec ses deux voisins.
describe('FINITIONS9 · point 2 — « Confirmé », « Expérimenté », « Diplômé »', () => {
  it.each([
    ['adWizardCoachProfile.experience.confirmed', 'Confirmé'],
    ['adWizardCoachProfile.experience.expert', 'Expérimenté'],
    ['adWizardCoachProfile.experience.qualified', 'Diplômé'],
    ['recruitmentAdEdit.coachExperience.confirmed', 'Confirmé'],
    ['recruitmentAdEdit.coachExperience.expert', 'Expérimenté'],
    ['recruitmentAdEdit.coachExperience.qualified', 'Diplômé'],
  ])('%s vaut « %s »', (chemin, attendu) => {
    expect(lire(chemin)).toBe(attendu);
  });

  it('aucun texte du code (repli compris) ne vaut plus « Experimente » ni « Diplome »', () => {
    expect(textesDuCodeEgauxA(['Experimente', 'Diplome'])).toEqual([]);
  });
});
