/**
 * LE COMPLEXE DE RÉSERVATION, CÔTÉ GÉRANT — RESA-L5A1 (13/10/2026), chantier Réservation.
 *
 * Les routes du serveur après RESA-L1A + RESA-L1B (contrat : dépôt méthode
 * `docs/RESERVATION_CONTRAT_API_L1.md` ; source qui fait foi : admin `origin/feat/RESAL1B-admin`,
 * `src/api/complexe/routes/*.ts`). Le serveur est le seul juge : la relation `gestionnaires`
 * garde chaque route du gérant, une LISTE BLANCHE choisit les champs écrits. L'app n'envoie que
 * ce que l'écran demande, et lit le code du refus dans `error.details.code`.
 *
 * ⚠️ NON LIVRÉ (ni recette ni production, 13/10) : tout ce qui appelle ce module est caché par
 * l'interrupteur `COMPLEXES_GERANT` (`src/config/fonctionsMasquees.js`).
 *
 * ⚠️ Le client HTTP est chargé À L'APPEL, comme collectiviteRattachementService : « Mon compte »
 * et l'accueil importent les composants du gérant sans doubler le client, qui exige l'adresse du
 * serveur dès son chargement (mémoire piege-env-absent-worktree-import-service). Par `require` et
 * non par `import()` : jest n'exécute pas un import dynamique (mémoire
 * piege-jest-import-dynamique), et ce service a son témoin.
 *
 * Témoin : `__tests__/complexeService.test.js`.
 */

/**
 * Le client HTTP de l'app, chargé à l'appel.
 * @returns {any} Le client axios.
 */
// eslint-disable-next-line global-require
const client = () => require('../client').default;

/**
 * Le corps d'une réponse.
 * @param {Promise<any>} reponse - La réponse axios.
 * @returns {Promise<any>} Son corps.
 */
const corps = async (reponse) => (await reponse).data;

const enc = (/** @type {unknown} */ valeur) => encodeURIComponent(String(valeur || ''));

/**
 * « Devenir gestionnaire » (E-G01) : crée SON complexe. 201 `{ data: complexe }` ; ou 200
 * `{ data: { duplicate: true, suggestions } }` (« C'est le tien ? », rien n'est créé) : renvoyer
 * avec `forceCreate: true` pour créer quand même.
 * @param {Record<string, any>} donnees - `{ acceptRules, name, address, phoneNumber, sports,
 *   minAge, cancellationDelayHours, siret?, forceCreate? }`.
 * @returns {Promise<any>} Le corps `{ data }`.
 */
export const creerMonComplexe = async (donnees) => corps(
  client().post('/complexes/self-onboard', { data: donnees }),
);

/**
 * MES complexes (AT-01) : non vide ⇒ la bascule « mode complexe / mode joueur ».
 * @returns {Promise<any>} `{ data: [{ documentId, name, slug, status, verified, city, logo }] }`.
 */
export const lireMesComplexes = async () => corps(client().get('/complexes/mine'));

/**
 * SON complexe, vu par son gestionnaire (E-G11, E-G16) : tout, règles comprises.
 * @param {string} complexeId - documentId du complexe.
 * @returns {Promise<any>} `{ data: complexe }`.
 */
export const lireComplexeGere = async (complexeId) => corps(
  client().get(`/complexes/${enc(complexeId)}/manage`),
);

/**
 * Modifier SON complexe (E-G16) : un champ absent reste inchangé.
 * @param {string} complexeId - documentId du complexe.
 * @param {Record<string, any>} donnees - Les champs modifiés.
 * @returns {Promise<any>} `{ data: complexe }`.
 */
export const modifierComplexeGere = async (complexeId, donnees) => corps(
  client().put(`/complexes/${enc(complexeId)}/manage`, { data: donnees }),
);

/**
 * « Mes installations » (E-G07) : les terrains de SON complexe, avec le résumé de leurs créneaux.
 * @param {string} complexeId - documentId du complexe.
 * @returns {Promise<any>} `{ data: [terrain] }`.
 */
export const lireTerrains = async (complexeId) => corps(
  client().get(`/complexes/${enc(complexeId)}/terrains`),
);

/**
 * « Nouveau terrain » (E-G08).
 * @param {string} complexeId - documentId du complexe.
 * @param {Record<string, any>} donnees - `{ name, sport, setting, capacity, bookingMode, … }`.
 * @returns {Promise<any>} `{ data: terrain }`.
 */
export const creerTerrain = async (complexeId, donnees) => corps(
  client().post(`/complexes/${enc(complexeId)}/terrains`, { data: donnees }),
);

/**
 * Modifier SON terrain (E-G08) : un champ absent reste inchangé.
 * @param {string} complexeId - documentId du complexe.
 * @param {string} terrainId - documentId du terrain.
 * @param {Record<string, any>} donnees - Les champs modifiés.
 * @returns {Promise<any>} `{ data: terrain }`.
 */
export const modifierTerrain = async (complexeId, terrainId, donnees) => corps(
  client().put(`/complexes/${enc(complexeId)}/terrains/${enc(terrainId)}`, { data: donnees }),
);

/**
 * Le modèle de créneaux et de tarifs d'un terrain (E-G09, RA4), jugé EN ENTIER par le serveur.
 * `apercu` : jugé et résumé SANS être écrit (`dryRun`). ⚠️ Le serveur lit `dryRun` dans le CORPS
 * (`terrain.ts`, `setCreneaux` : `payload.dryRun === true`), pas dans l'adresse comme l'écrit le
 * contrat.
 * @param {string} complexeId - documentId du complexe.
 * @param {string} terrainId - documentId du terrain.
 * @param {{ extraSlots: any[], period: any, ranges: any[], rates: any[] }} plan - Le modèle.
 * @param {{ apercu?: boolean }} [options] - Aperçu seulement.
 * @returns {Promise<any>} `{ data: terrain }`, ou `{ data: { creneaux, dryRun, slotPlan } }`.
 */
export const enregistrerCreneaux = async (
  complexeId,
  terrainId,
  plan,
  { apercu = false } = {},
) => corps(
  client().put(
    `/complexes/${enc(complexeId)}/terrains/${enc(terrainId)}/creneaux`,
    apercu ? { data: plan, dryRun: true } : { data: plan },
  ),
);

/**
 * Téléverse UNE photo (`POST /upload`, le chemin des actualités de la Ville) ; le serveur du
 * complexe vérifie ensuite qu'elle n'est liée à rien d'autre (COMPLEXE_FILE_NOT_ALLOWED).
 * @param {any} brut - Ce que rend le sélecteur d'image.
 * @returns {Promise<{ id: number, url?: string } | null>} Le fichier, ou null.
 */
export const televerserPhoto = async (brut) => {
  // eslint-disable-next-line global-require
  const { uploadActualiteFile } = require('../collectivite/collectiviteActualiteService');
  return uploadActualiteFile(brut);
};
