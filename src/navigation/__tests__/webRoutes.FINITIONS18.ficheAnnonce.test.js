import fs from 'fs';
import path from 'path';

import { RouteNames } from '../routeNames';
import { buildWebPath } from '../webRoutes';

// FINITIONS18 · POINT 5 (tournee T16, photo SITE_A7) — sur le site, la fiche d'une annonce ne
// s'ouvrait pas depuis « Opportunites » : l'adresse devenait `/recruitment/:adId?isOwner=false`
// ⇒ « Chargement impossible · Not Found ». L'adresse de la fiche porte `:adId` ; trois appelants
// passaient l'annonce ENTIERE (`{ ad }`), jamais `adId` : sur le telephone l'ecran la lit dans
// `ad`, sur le site un objet ne voyage pas dans une adresse et `:adId` restait en clair. Meme
// famille que `:matchId` (FINITIONS16 15). Ce temoin relit TOUS les appels de la fiche. ROUGE avant.

const RACINE = path.join(__dirname, '..', '..');

/**
 * Les fichiers sources de l'app (sans les temoins).
 * @param {string} dossier - Le dossier a parcourir.
 * @returns {string[]} Les chemins.
 */
const sources = (dossier) => fs.readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
  const chemin = path.join(dossier, entree.name);
  if (entree.isDirectory()) return entree.name === '__tests__' ? [] : sources(chemin);
  return /\.(js|jsx|ts|tsx)$/.test(entree.name) && !/\.test\./.test(entree.name) ? [chemin] : [];
});

/**
 * Chaque appel `RouteNames.RecruitmentAdDetails, { … }` et son objet de parametres.
 * @returns {{ ou: string, parametres: string }[]} Les appels.
 */
const appelsDeLaFiche = () => sources(RACINE).flatMap((fichier) => {
  const texte = fs.readFileSync(fichier, 'utf8');
  return Array.from(texte.matchAll(/RouteNames\.RecruitmentAdDetails,\s*\{/g)).map((trouve) => {
    let profondeur = 0;
    let fin = trouve.index + trouve[0].length - 1;
    for (; fin < texte.length; fin += 1) {
      if (texte[fin] === '{') profondeur += 1;
      if (texte[fin] === '}') profondeur -= 1;
      if (profondeur === 0) break;
    }
    const ligne = texte.slice(0, trouve.index).split('\n').length;
    return {
      ou: `${path.relative(RACINE, fichier).replace(/\\/g, '/')}:${ligne}`,
      parametres: texte.slice(trouve.index + trouve[0].length - 1, fin + 1),
    };
  });
});

test('🔴 chaque ouverture de la fiche d une annonce dit QUELLE annonce (adId)', () => {
  const appels = appelsDeLaFiche();
  expect(appels.length).toBeGreaterThanOrEqual(4);
  const sansAdId = appels.filter(({ parametres }) => !/\badId\b/.test(parametres)).map(({ ou }) => ou);
  expect(sansAdId).toEqual([]);
});

test('🔴 l adresse du site de la fiche, ouverte depuis « Opportunites » : plus de « :adId » en clair', () => {
  const ad = { documentId: 'annonce-ailier', title: 'Ailier fort' };
  const adresse = buildWebPath(RouteNames.RecruitmentAdDetails, { ad, adId: ad.documentId, isOwner: false });
  expect(adresse.startsWith('/recruitment/annonce-ailier?')).toBe(true);
  expect(adresse).not.toContain(':adId');
  // Le symptome de la T16, tel quel : sans `adId`, l'adresse garde le motif.
  expect(buildWebPath(RouteNames.RecruitmentAdDetails, { ad, isOwner: false })).toContain(':adId');
});
