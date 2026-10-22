import {
  normalizeActualiteFile,
  reduirePhotoDuNavigateur,
} from '@/services/collectivite/collectiviteActualiteService';

/**
 * R17-CONTROLES (20/10, REC17-011 lot 2, decision d Adel Q6 B) — LE CARNET DES CONTROLES d une
 * installation de la Ville, cote app. Le serveur est le SEUL juge (admin
 * `src/api/facility-check`) : la Ville qui gere l installation lit et ecrit, tout autre compte
 * recoit « introuvable » ; le
 * rapport part AVEC le controle, jamais par un identifiant ; le rappel part du serveur.
 * Le client se charge a l appel (meme motif que les signalements) : importer ce module ne charge
 * pas la configuration reseau.
 */

const client = async () => (await import('../client')).default;

/**
 * Envoie un controle : en JSON, ou en formulaire quand un rapport est joint (le serveur le
 * televerse lui-meme).
 * @param {string} chemin - L adresse.
 * @param {Record<string, any>} data - Les champs.
 * @param {any} document - Ce que rend le selecteur de document, ou null.
 * @returns {Promise<any>} La reponse.
 */
const envoyer = async (chemin, data, document) => {
  const http = await client();
  if (!document) return (await http.post(chemin, { data })).data;
  const fichier = normalizeActualiteFile(await reduirePhotoDuNavigateur(document));
  const formData = new FormData();
  formData.append('data', JSON.stringify(data));
  if (typeof File !== 'undefined' && fichier instanceof File) {
    formData.append('document', fichier, fichier.name || 'rapport.pdf');
  } else {
    formData.append('document', /** @type {any} */ (fichier));
  }
  // Sans en-tete impose : le navigateur et React Native posent eux-memes la frontiere.
  return (await http.post(chemin, formData, { timeout: 45000 })).data;
};

/**
 * Le carnet d une installation : toutes les lignes (en cours et historique).
 * @param {string} facilityId - documentId.
 * @returns {Promise<any>} `{ data: lignes, meta: { facility, today } }`.
 */
export const listFacilityChecks = async (facilityId) => {
  const http = await client();
  return (await http.get(`/facilities/${facilityId}/checks`)).data;
};

/**
 * « Noter un contrôle » (planche Q6 ecran 1).
 * @param {string} facilityId - documentId.
 * @param {{ label: string, doneOn: string, doneBy?: string | null, nextDue: string,
 *   document?: any }} input - Dates AAAA-MM-JJ.
 * @returns {Promise<any>} `{ data: ligne }`.
 */
export const createFacilityCheck = async (facilityId, {
  document = null, doneBy = null, doneOn, label, nextDue, result,
}) => envoyer(`/facilities/${facilityId}/checks`, {
  doneBy, doneOn, label, nextDue, result,
}, document);

/**
 * « Noter le contrôle fait » (planche Q6 ecran 4) : la ligne est reprise par le serveur.
 * @param {string} checkId - documentId de la ligne en cours.
 * @param {{ doneOn: string, doneBy?: string | null, nextDue: string, document?: any }} input -
 *   Dates AAAA-MM-JJ.
 * @returns {Promise<any>} `{ data: ligne neuve }`.
 */
export const markFacilityCheckDone = async (checkId, {
  document = null, doneBy = null, doneOn, nextDue, result,
}) => envoyer(`/facility-checks/${checkId}/done`, {
  doneBy, doneOn, nextDue, result,
}, document);

/**
 * « Ce qui vous attend » (accueil de la Ville) : les controles a refaire dans les 30 jours, ou en
 * retard.
 * @param {string} collectiviteId - documentId.
 * @returns {Promise<any>} `{ data: lignes, meta: { dueCount } }`.
 */
export const getCollectiviteFacilityChecksSummary = async (collectiviteId) => {
  const http = await client();
  return (await http.get(`/collectivites/${collectiviteId}/facility-checks/summary`)).data;
};
