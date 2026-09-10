// @ts-nocheck
/**
 * PARENT P2 — LES REGLES PURES DE LA FICHE ENFANT.
 *
 * Ce fichier ne touche NI le reseau NI un ecran : il ne repond qu a des
 * questions. C est EXACTEMENT le decoupage du serveur
 * (`admin/src/api/declared-child/services/declared-child-rules.js`), et pour la
 * meme raison de fond, verifiee ici a la premiere execution du temoin :
 *
 * 🧨 `services/client` APPELLE `assertRuntimeEndpointsReady()` AU CHARGEMENT.
 * `.env` est gitignore, donc absent de tout worktree : tout fichier qui remonte
 * jusqu au client fait mourir la SUITE ENTIERE avant le premier temoin. Un
 * ecran qui a besoin de fabriquer une charge n a aucune raison de tirer le
 * reseau derriere lui — il importe donc CE fichier, jamais le service.
 */

/**
 * Le numéro de maillot : un entier, ou RIEN.
 *
 * 🔢 `Number('')` vaut 0. Un champ laissé vide se transformerait en « maillot
 * n°0 » au lieu de « pas de numéro ». Même règle que côté serveur
 * (`declared-child-rules.js`, `toJerseyNumber`).
 * @param {unknown} value - La saisie brute.
 * @returns {number|null} Le numéro, ou `null`.
 */
const toJerseyNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

/**
 * Fabrique la charge envoyée au serveur.
 *
 * ⛔ CE QUI N'A PAS ÉTÉ SAISI N'EST PAS ENVOYÉ. C'est ce qui permet à une
 * modification de ne toucher QUE ce que le parent a changé : le serveur garde
 * la valeur en base pour toute clef absente (`pickWritableFields`).
 * @param {{ birthdate?: string, firstname?: string, lastname?: string,
 *   number?: unknown, position?: string }} champs - Les champs du formulaire.
 * @returns {object} La charge, réduite à ce qui a une valeur.
 */
export const buildChildPayload = ({
  birthdate, firstname, lastname, number, position,
} = {}) => {
  /** @type {Record<string, unknown>} */
  const payload = {};

  const prenom = String(firstname ?? '').trim();
  if (prenom) payload.firstname = prenom;

  const nom = String(lastname ?? '').trim();
  if (nom) payload.lastname = nom;

  const naissance = String(birthdate ?? '').trim();
  if (naissance) payload.birthdate = naissance;

  const maillot = toJerseyNumber(number);
  if (maillot !== null) payload.number = maillot;

  const poste = String(position ?? '').trim();
  if (poste) payload.position = poste;

  return payload;
};
