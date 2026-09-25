// RECHERCHE-UNIQUE (phase 3) — module PUR (aucun appel réseau) : la liste de clubs l'importe sans
// tirer le client HTTP.
/**
 * Le slug d'un nom, par la même règle que le serveur (public-directory.ts, slugify) : c'est ainsi
 * que l'annuaire nomme un sport dans ses adresses (« Football » → « football »).
 * @param {unknown} valeur Le nom.
 * @returns {string} Le slug.
 */
export const slugAnnuaire = (valeur) => String(valeur || '')
  .replace(/['’-]/g, ' ')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 120);
