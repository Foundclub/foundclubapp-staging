/* eslint-disable max-len -- phrases du texte légal recopiées mot pour mot */
// T-SANS-PLAFOND (18/11/2026, décision d'Adel D247 « 2- A ») — plus de limite de joueurs par équipe :
// le règlement et les conditions d'inscription ne disent plus « 8 joueurs au maximum » ni « 5 à 8 joueurs ».
// Mots exacts transmis par le chef d'orchestre. ROUGE sur l'ancien texte, vert après.
import { PARAGRAPHES_DES_CONDITIONS, VERSION_DES_CONDITIONS } from '../conditionsTournoi';
import { EN_TETE_DU_REGLEMENT, SECTIONS_DU_REGLEMENT } from '../reglementTournoi';

const REGLEMENT = SECTIONS_DU_REGLEMENT.flatMap((section) => section.paragraphes);

test('🔴 D247 : le règlement dit « Pas de limite de remplaçants », plus « 8 joueurs au maximum »', () => {
  expect(REGLEMENT).toContain('5 joueurs sur le terrain, gardien compris. Pas de limite de remplaçants : chaque joueur de l\'équipe doit avoir payé sa place.');
  expect(REGLEMENT.join('\n')).not.toMatch(/au maximum par équipe|Jusqu.à 3 remplaçants/);
});

test('🔴 D247 : les conditions disent « (5 joueurs ou plus) », plus « (5 à 8 joueurs) », le reste de la phrase inchangé', () => {
  const phrase = PARAGRAPHES_DES_CONDITIONS.find((paragraphe) => paragraphe.startsWith('On s\'inscrit avec son équipe'));
  expect(phrase.startsWith('On s\'inscrit avec son équipe (5 joueurs ou plus), seul, ou à 2, 3 ou 4. Chaque joueur reçoit son propre lien de paiement ;')).toBe(true);
  expect(phrase.endsWith('donc à celui qui a payé.')).toBe(true);
  expect(PARAGRAPHES_DES_CONDITIONS.join('\n')).not.toContain('5 à 8 joueurs');
});

test('🔴 D247 : les deux textes changés portent la date du 18/11 (« version oui » du chef)', () => {
  // Avant : 'Version du 18 novembre 2026' (D247) ; DEUX-EQUIPES-2 (19/11) : D282 et D63, nouvelle date (chef du tournoi).
  expect(VERSION_DES_CONDITIONS).toBe('Version du 20 novembre 2026'); // DEUX-EQUIPES-3 (20/11) : D65 = B, avant : 'Version du 19 novembre 2026'
  expect(EN_TETE_DU_REGLEMENT.endsWith('(v6, 20/11)')).toBe(true); // DEUX-EQUIPES-3 (20/11) : avant '(v4, 18/11)'
});
