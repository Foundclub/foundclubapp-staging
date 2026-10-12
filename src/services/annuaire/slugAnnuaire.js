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

/**
 * ANNONCE-PUBLIQUE (07/10/2026, décision d'Adel « annonce a ») — l'adresse PUBLIQUE d'une
 * annonce de recrutement, `/annuaire/annonces/<documentId>/<slug>/`, la MÊME que le serveur
 * (admin utils/cheminAnnuaireClub.ts, cheminAnnonceAnnuaire). Le slug dit le poste et la
 * catégorie : pour un entraîneur, la VALEUR de son rôle (« entraineur_adjoint »), jamais le
 * texte libre du rôle « autre » ; jamais la ville (le champ `city` d'une annonce peut porter la
 * rue). La page du site ne lit que l'identifiant : un slug qui différerait y mène quand même.
 * @param {any} annonce L'annonce (`documentId`, `audienceType`, `position`, `coachRole`,
 *   `category`).
 * @returns {string | null} L'adresse, ou null sans identifiant.
 */
export const cheminAnnonceAnnuaire = (annonce) => {
  const documentId = String(annonce?.documentId || '').trim();
  if (!documentId) return null;
  const role = String(annonce?.coachRole || '').trim();
  const roleEntraineur = role && role !== 'other' ? role : 'entraineur';
  const poste = annonce?.audienceType === 'coach'
    ? roleEntraineur
    : (String(annonce?.position || '').trim() || 'joueur');
  const categorie = annonce?.category && typeof annonce.category === 'object'
    ? annonce.category.name
    : annonce?.category;
  const slug = slugAnnuaire(`${poste} ${categorie || ''}`) || 'annonce';
  return `/annuaire/annonces/${encodeURIComponent(documentId)}/${encodeURIComponent(slug)}/`;
};
