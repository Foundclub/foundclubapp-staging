import {
  normalizeActualiteFile,
  reduirePhotoDuNavigateur,
} from '@/services/collectivite/collectiviteActualiteService';

/**
 * R17-SIGNALER-1 (19/10, REC17-011) — SIGNALER UN PROBLEME SUR UNE INSTALLATION DE LA VILLE, cote
 * app. Planches validees par Adel le 19/10 : P10-securite-ordi, P10-securite-tel, P10-signaler-tel,
 * P11-q4-exemple-tel, P11-mineur-photo-tel, P11-securite-ou-ca-vit.
 *
 * Le serveur est le SEUL juge (admin `src/api/facility-report`) : qui peut signaler (les membres
 * des
 * clubs qui utilisent l installation, Q1 A), la photo (a partir de 15 ans, Q7 B), qui lit quoi
 * (Q2 A), qui traite (la Ville). L app envoie, puis dit le refus s il y en a un.
 * Le client se charge a l appel (meme motif que les actualites de la Ville) : importer ce module ne
 * charge pas la configuration reseau.
 */

const client = async () => (await import('../client')).default;

/**
 * Signaler. La photo (facultative) part AVEC le signalement, dans le meme formulaire : le serveur
 * la televerse lui-meme et ne l accepte jamais par un identifiant.
 * @param {string} facilityId - documentId de l installation.
 * @param {{ category: string, description: string, event?: string | null, photo?: any }} input -
 *   `photo` : ce que rend le selecteur d image.
 * @returns {Promise<any>} `{ data: signalement }` (la lecture de l auteur).
 */
export const submitFacilityReport = async (
  facilityId,
  {
    category, description, event = null, photo = null,
  },
) => {
  const data = { category, description, ...(event ? { event } : {}) };
  const http = await client();
  if (!photo) {
    const response = await http.post(`/facilities/${facilityId}/reports`, { data });
    return response.data;
  }
  const fichier = normalizeActualiteFile(await reduirePhotoDuNavigateur(photo));
  const formData = new FormData();
  formData.append('data', JSON.stringify(data));
  if (typeof File !== 'undefined' && fichier instanceof File) {
    formData.append('photo', fichier, fichier.name || 'photo.jpg');
  } else {
    formData.append('photo', /** @type {any} */ (fichier));
  }
  // Sans en-tete impose : le navigateur et React Native posent eux-memes la frontiere du
  // formulaire.
  const response = await http.post(`/facilities/${facilityId}/reports`, formData, {
    timeout: 45000,
  });
  return response.data;
};

/**
 * « Deja signale » : les signalements OUVERTS de l installation, sans auteur ni photo.
 * @param {string} facilityId - documentId.
 * @returns {Promise<any>} `{ data: signalements }`.
 */
export const getOpenFacilityReports = async (facilityId) => {
  const http = await client();
  return (await http.get(`/facilities/${facilityId}/reports/open`)).data;
};

/**
 * « Mes signalements » : les miens, et combien sont encore ouverts.
 * @returns {Promise<any>} `{ data: signalements, meta: { openCount } }`.
 */
export const getMyFacilityReports = async () => {
  const http = await client();
  return (await http.get('/facility-reports/mine')).data;
};

/**
 * Un signalement : la lecture de la Ville (et de quoi fermer, pre-rempli) ou celle de l auteur.
 * @param {string} reportId - documentId.
 * @returns {Promise<any>} `{ data, meta: { canManage, closurePrefill? } }`.
 */
export const getFacilityReport = async (reportId) => {
  const http = await client();
  return (await http.get(`/facility-reports/${reportId}`)).data;
};

/**
 * L onglet « Sécurité et suivi » (la Ville) : l etat deduit, les signalements, les fermetures.
 * @param {string} facilityId - documentId.
 * @returns {Promise<any>} `{ data: signalements, meta: { state, closures, facility, today } }`.
 */
export const listFacilityReports = async (facilityId) => {
  const http = await client();
  return (await http.get(`/facilities/${facilityId}/reports`)).data;
};

/**
 * La Ville change le statut : `pris_en_charge`, `resolu` (un mot possible), `sans_suite` (un mot).
 * @param {string} reportId - documentId.
 * @param {{ note?: string | null, status: string }} data - Le geste.
 * @returns {Promise<any>} `{ data: signalement }`.
 */
export const setFacilityReportStatus = async (reportId, data) => {
  const http = await client();
  return (await http.put(`/facility-reports/${reportId}/status`, { data })).data;
};

/**
 * « Fermer l installation… » depuis un signalement : le formulaire de fermeture (COL-008) part ici
 * ;
 * le serveur le juge par le circuit des fermetures, lie la fermeture et prend en charge.
 * @param {string} reportId - documentId.
 * @param {Record<string, any>} data - Le corps du formulaire de fermeture.
 * @returns {Promise<any>} `{ data: { closure, report } }`.
 */
export const closeFacilityFromReport = async (reportId, data) => {
  const http = await client();
  return (await http.post(`/facility-reports/${reportId}/closure`, { data })).data;
};

/**
 * La carte de chaque installation (« 1 signalement ouvert ») et « Ce qui vous attend ».
 * @param {string} collectiviteId - documentId.
 * @returns {Promise<any>} `{ data: [{ facilityDocumentId, openCount, securityOpenCount,
 *   toHandleCount }], meta: { toHandle, toHandleCount } }`.
 */
export const getCollectiviteFacilityReportsSummary = async (collectiviteId) => {
  const http = await client();
  return (await http.get(`/collectivites/${collectiviteId}/facility-reports/summary`)).data;
};
