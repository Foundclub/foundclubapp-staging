/* eslint-disable max-len -- phrases et doublures recopiées telles quelles */
/**
 * T-PAGES-6b (18/11/2026, points 5 et 6 de T-PAGES-6) — LA FICHE DU TOURNOI RANGE LE TOURNOI POUR
 * LE TUNNEL. Le visiteur qui touche le bouton d'inscription de la fiche (téléphone : « Se connecter
 * pour s'inscrire » ; site : « Inscrire mon équipe ») part créer son compte : la fiche range le
 * tournoi (domains/tournoi/inscriptionEnCours.js), que l'écran du numéro et celui du rôle
 * rappellent. Témoin de SOURCE : les deux fiches sont trop lourdes à monter pour un seul appel, le
 * rendu du rappel est prouvé par Register.TPAGES6b et UserRole.TPAGES6b.
 * ROUGE avant le lot : aucune fiche ne rangeait le tournoi.
 */
const fs = require('fs');
const path = require('path');

const lire = (/** @type {string} */ nom) => fs.readFileSync(path.join(__dirname, '..', nom), 'utf8');
const IMPORT = "import { retenirLInscriptionAuTournoi } from '@/domains/tournoi/inscriptionEnCours';";

/**
 * Les appels à la connexion d'un visiteur de tournoi, chacun avec les lignes qui le précèdent.
 * @param {string} source - Le fichier.
 * @param {RegExp} marque - Ce qui désigne l'inscription au tournoi dans l'appel.
 * @returns {string[]} Les quatre lignes avant chaque appel marqué.
 */
const avantLesAppels = (source, marque) => {
  const lignes = source.split(/\r?\n/);
  return lignes.flatMap((ligne, i) => {
    if (!/openPublicAuthFlow\(navigation, \{/.test(ligne)) return [];
    const appel = lignes.slice(i, i + 5).join('\n');
    return marque.test(appel) ? [lignes.slice(Math.max(0, i - 4), i + 1).join('\n')] : [];
  });
};

test('🔴 téléphone : « Se connecter pour s inscrire » range le tournoi avant la connexion', () => {
  const source = lire('EventDetails.js');
  expect(source).toContain(IMPORT);
  const appels = avantLesAppels(source, /event-details-tournament-register/);
  expect(appels).toHaveLength(1);
  expect(appels[0]).toMatch(/retenirLInscriptionAuTournoi\(\{ event \}\);/);
});

test('🔴 site : « Inscrire mon équipe » du visiteur range le tournoi, aux deux endroits', () => {
  const source = lire('EventDetails.web.js');
  expect(source).toContain(IMPORT);
  const appels = avantLesAppels(source, /event-details-register-team/);
  expect(appels).toHaveLength(2);
  appels.forEach((appel) => expect(appel).toMatch(/retenirLInscriptionAuTournoi\(\{ event \}\);/));
});
