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
  if (value === null || value === undefined || String(value).trim() === '') return null;
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

/**
 * PAR-L5L6 (13/10, design parent E09) — LA CHARGE D UNE MODIFICATION : vider un champ
 * facultatif l'EFFACE vraiment.
 *
 * `buildChildPayload` n'envoie pas un champ vide ; en modification, le serveur gardait donc
 * l'ancien maillot du parent qui venait de l'effacer. Ici, un champ facultatif (maillot,
 * poste) VIDE alors que l'écran MONTRAIT une valeur part à `null`. Vérifié en lecture côté
 * serveur (`declared-child-rules.js`, `pickWritableFields`) : une clé présente est écrite,
 * `null` efface le maillot, et le poste devient vide.
 *
 * 🔒 Ce que l'écran n'a pas montré n'est jamais effacé : sans valeur affichée, un champ vide
 * ne part pas — une fiche ouverte avant d'être lue ne perd rien.
 * @param {{ birthdate?: string, firstname?: string, lastname?: string,
 *   number?: unknown, position?: string }} champs - Les champs du formulaire.
 * @param {{ number?: unknown, position?: unknown }} [affiche] - Ce que l'écran montrait à
 *   l'ouverture.
 * @returns {object} La charge : celle de `buildChildPayload`, plus les effacements.
 */
export const buildChildEditPayload = (champs = {}, affiche = {}) => {
  /** @type {Record<string, unknown>} */
  const payload = buildChildPayload(champs);

  const maillotVide = String(champs?.number ?? '').trim() === '';
  if (maillotVide && toJerseyNumber(affiche?.number) !== null) payload.number = null;

  const posteVide = String(champs?.position ?? '').trim() === '';
  if (posteVide && String(affiche?.position ?? '').trim()) payload.position = null;

  return payload;
};

/** Les champs texte de la carte, dans l'ordre de l'écran. */
const CHAMPS_TEXTE_DE_LA_CARTE = ['position', 'city', 'nationality'];

/**
 * PAR-L13 (13/10, design parent E28) — LA CHARGE DE LA CARTE D'UN ENFANT : maillot, poste, ville
 * et nationalité (ces deux-là ouvertes par la décision d'Adel du 12/10, registre des mineurs
 * ligne 23).
 *
 * Même règle que la modification (E09) : ce qui n'est pas saisi ne part pas ; vider un champ
 * que l'écran MONTRAIT l'efface (`null`). Une carte où rien n'a changé donne une charge vide.
 * @param {{ city?: string, nationality?: string, number?: unknown, position?: string }} champs
 *   - Les champs de la carte.
 * @param {Record<string, unknown>} [affiche] - Ce que l'écran montrait à l'ouverture (mêmes
 *   clés).
 * @returns {object} La charge.
 */
export const buildChildCardPayload = (champs = {}, affiche = {}) => {
  /** @type {Record<string, unknown>} */
  const payload = {};

  const maillot = toJerseyNumber(champs?.number);
  if (maillot !== null) payload.number = maillot;
  // Seul un champ vide efface : une saisie invalide (« abc ») laisse le numero affiche.
  else if (String(champs?.number ?? '').trim() === '' && toJerseyNumber(affiche?.number) !== null) {
    payload.number = null;
  }

  CHAMPS_TEXTE_DE_LA_CARTE.forEach((cle) => {
    const valeur = String(champs?.[cle] ?? '').trim();
    if (valeur) payload[cle] = valeur;
    else if (String(affiche?.[cle] ?? '').trim()) payload[cle] = null;
  });

  return payload;
};
