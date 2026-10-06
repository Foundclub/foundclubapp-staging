/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import i18n from '@/theme/strings';

// FINITIONS18 · POINT 13 (tournee T16) — les accents restants vus par la tournée : « Ouvrir l
// entraînement » (site), « A l'instant » (cloche), le tunnel d'annonce entraîneur (« Définis le
// rôle encadrement recherche… », « Nombre de profils recherches »), « ouverts a un club »
// (Recrutement › Profils), « Invitations d équipes avancées » (site), « Evenement » (canal du
// site, colonne de droite). ROUGE avant.

const TEXTES = {
  'adWizardCoachProfile.quantityLabel': 'Nombre de profils recherchés',
  'adWizardCoachProfile.subtitle': 'Définis le rôle d’encadrement recherché et le cadre de la mission.',
  'eventDetails.closeTheTrainingSession': 'Fermer l’entraînement',
  'eventDetails.openTheTrainingSession': 'Ouvrir l’entraînement',
  'eventEdit.advancedTeamInvitations': 'Invitations d’équipes avancées',
  'notificationPresentation.relative.now': 'À l’instant',
  'recruitmentAdEdit.form.quantityCoach': 'Nombre de profils recherchés',
  'recruitmentProfilesList.empty.later': 'Les profils ouverts à un club apparaîtront ici dès qu’ils seront disponibles.',
  'recruitmentProfilesList.header.default': 'Retrouve ici les joueurs et joueuses ouverts à un club pour construire ton recrutement.',
};

const SRC = join(__dirname, '..', '..', '..');

/**
 * Les sources de l'app, sans les temoins ni les dictionnaires.
 * @param {string} dossier - Le dossier a parcourir.
 * @returns {string[]} Les chemins.
 */
const sources = (dossier) => readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
  const chemin = join(dossier, entree.name);
  if (entree.isDirectory()) return ['__tests__', 'translations'].includes(entree.name) ? [] : sources(chemin);
  return /\.(js|jsx)$/.test(entree.name) && !/\.test\./.test(entree.name) ? [chemin] : [];
});

afterAll(async () => {
  await i18n.changeLanguage('fr');
});

describe('FINITIONS18 13 — les accents vus par la T16', () => {
  it.each(Object.entries(TEXTES))('🔴 %s', async (clef, francais) => {
    await i18n.changeLanguage('fr');
    expect(i18n.t(clef)).toBe(francais);
  });

  it('🔴 aucun texte de repli « Evenement » sans accent dans les sources (canal du site compris)', () => {
    const fautifs = sources(SRC).filter((fichier) => /'Evenement'/.test(readFileSync(fichier, 'utf8')))
      .map((fichier) => fichier.slice(SRC.length + 1).replace(/\\/g, '/'));
    // services/admin/adminService.js : fichier-carrefour (E4) ; son repli ne s'affiche jamais, la
    // cle « adminService.reports.eventTargetFallback » vaut deja « Événement » en francais.
    expect(fautifs).toEqual(['services/admin/adminService.js']);
  });
});
