// RECHERCHE-UNIQUE (phase 3) — module PUR (aucun appel réseau) : la liste de clubs l'importe sans
// tirer le client HTTP.

// ANNUAIRE-E1 (29/09) — les apostrophes et tirets que le serveur change en espace AVANT de retirer
// les accents (admin search/services/normalize.ts, APOSTROPHE_AND_DASH_REGEX). L'accent aigu isolé
// (´) et l'accent grave (`) sont eux-mêmes des « diacritiques » : sans cette étape, ils seraient
// effacés et recolleraient les mots (« letoile » au lieu de « l-etoile »), donc une autre adresse.
const APOSTROPHES_ET_TIRETS = /['‘’‛ʼ´`‐‑‒–—―−-]+/g;

/**
 * Le slug d'un nom, par la même règle que le serveur (public-directory.ts, slugify) : c'est ainsi
 * que l'annuaire nomme un sport dans ses adresses (« Football » → « football »).
 * @param {unknown} valeur Le nom.
 * @returns {string} Le slug.
 */
export const slugAnnuaire = (valeur) => String(valeur || '')
  .replace(APOSTROPHES_ET_TIRETS, ' ')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 120);

/**
 * ANNUAIRE-E1 — l'adresse PUBLIQUE de la fiche d'un club, celle que Google connaît et que Caddy
 * sert (une coquille par club). Même construction que le serveur : `slugify(nom) || documentId`,
 * puis `/annuaire/clubs/<documentId>/<slug>/` (public-directory.ts, buildSeoClubPath).
 * Un club multisport n'a pas de fiche d'annuaire : pas de lien.
 * @param {any} club Un club d'une liste (au moins `documentId` et `name`).
 * @returns {string | null} L'adresse, ou null.
 */
export const cheminFicheAnnuaire = (club) => {
  const documentId = String(club?.documentId || '').trim();
  if (!documentId || Reflect.get(club || {}, '_type') === 'multisport') return null;
  const slug = slugAnnuaire(club?.name) || documentId;
  return `/annuaire/clubs/${encodeURIComponent(documentId)}/${encodeURIComponent(slug)}/`;
};
