import client from '@/services/client';

/**
 * COLL-C4B (02/10) — FERMER UNE INSTALLATION, BLOQUER UN CRENEAU, cote app. Contrat :
 * `docs/CONTRAT_CRENEAUX_SAISON.md` §13 du depot admin.
 *
 * Le serveur est le SEUL juge : droits (la Ville proprietaire), dates, heures, seances touchees.
 * D16 : une fermeture PREVIENT les clubs, elle n annule rien ; l app ne touche jamais une seance.
 * Aucune reponse ne porte de personne : qui a ferme ne sort par aucune route.
 */

/**
 * Les fermetures d une installation : ce qui dure ou vient (onglet « Fermetures », bandeau).
 * @param {string} facilityId - documentId de l installation.
 * @param {{ from?: string, status?: 'active' | 'all', to?: string }} [params] - `all` : la mairie.
 * @returns {Promise<any>} `{ data: fermetures, meta: { bandeau, canManage, facility } }`.
 */
export const listFacilityClosures = async (facilityId, { from, status = 'active', to } = {}) => {
  const response = await client.get(`/facilities/${facilityId}/closures`, {
    params: { from, status, to },
  });
  return response.data;
};

/**
 * La carte « n seances touchees, n clubs prevenus », PENDANT la saisie. Rien n est ecrit.
 * @param {string} facilityId - documentId de l installation.
 * @param {Record<string, string | undefined>} params - kind, startDate, endDate, startTime,
 *   endTime.
 * @returns {Promise<any>} `{ data: { sessions, sessionsCount, clubs, clubsCount } }`.
 */
export const previewFacilityClosure = async (facilityId, params) => {
  const response = await client.get(`/facilities/${facilityId}/closures/preview`, { params });
  return response.data;
};

/**
 * Fermer (des journees) ou bloquer (une plage d un jour).
 * @param {string} facilityId - documentId de l installation.
 * @param {Record<string, any>} data - kind, startDate, endDate, startTime?, endTime?, reason?,
 *   label?, message?, publishActualite?.
 * @returns {Promise<any>} `{ data: fermeture }` (avec `affected`).
 */
export const closeFacility = async (facilityId, data) => {
  const response = await client.post(`/facilities/${facilityId}/closures`, { data });
  return response.data;
};

/**
 * Modifier une fermeture (dates, heures, motif, mot).
 * @param {string} closureId - documentId de la fermeture.
 * @param {Record<string, any>} data - Les champs qui changent.
 * @returns {Promise<any>} `{ data: fermeture }`.
 */
export const modifyFacilityClosure = async (closureId, data) => {
  const response = await client.put(`/facility-closures/${closureId}`, { data });
  return response.data;
};

/**
 * Rouvrir : un ETAT, jamais une suppression. Previent les memes clubs.
 * @param {string} closureId - documentId de la fermeture.
 * @returns {Promise<any>} `{ data: fermeture }`.
 */
export const reopenFacilityClosure = async (closureId) => {
  const response = await client.post(`/facility-closures/${closureId}/reopen`);
  return response.data;
};

/**
 * « Fermeture a venir » de l accueil de la Ville : toutes ses installations.
 * @param {string} collectiviteId - documentId de la collectivite.
 * @returns {Promise<any>} `{ data: fermetures }`.
 */
export const listCollectiviteClosures = async (collectiviteId) => {
  const response = await client.get(`/collectivites/${collectiviteId}/closures`);
  return response.data;
};
