/**
 * 🏛️ VILLE-INVITER-CLUB (07/10/2026) — LE RATTACHEMENT DANS LES DEUX SENS, côté serveur
 * `api::collectivite-invitation` (admin feat/VILLE-INVITER-CLUB-admin).
 *
 * Les gestes de la VILLE (`/collectivites/:id/club-...`) sont gardés par la policy
 * `is-gestionnaire-collectivite` : la relation `gestionnaires`, jamais le rôle. Ceux du CLUB
 * (`/clubs/:id/collectivite-requests`, `/collectivite-proposals/:id/answer`) par le service, qui
 * exige un DIRIGEANT du club. L'app ne déduit rien : elle affiche ce que le serveur rend.
 *
 * ⚠️ Le client HTTP est chargé À L'APPEL (import dynamique), comme
 * collectiviteActualiteService : la fiche du club (ClubDetails, 12 fichiers de témoins) importe
 * la carte du club sans doubler le client, qui exige l'adresse du serveur dès son chargement
 * (piege-env-absent-worktree-import-service).
 */

/**
 * Le client HTTP de l'app, chargé à l'appel.
 * @returns {Promise<any>} Le client axios.
 */
const client = async () => (await import('../client')).default;

/**
 * Le corps d'une réponse.
 * @param {Promise<any>} reponse - La réponse axios.
 * @returns {Promise<any>} Son corps.
 */
const corps = async (reponse) => (await reponse).data;

const enc = (/** @type {unknown} */ valeur) => encodeURIComponent(String(valeur || ''));

/**
 * La Ville cherche un club déjà sur FoundClub (sans texte : les clubs de sa commune).
 * @param {string} collectiviteId - documentId de la collectivité.
 * @param {string} q - Le texte cherché.
 * @returns {Promise<any>} `{ data: [...] }`.
 */
export const searchCollectiviteClubs = async (collectiviteId, q) => corps(
  (await client()).get(`/collectivites/${enc(collectiviteId)}/club-search`, {
    params: { q: q || '' },
  }),
);

/**
 * Les demandes de rattachement de la Ville, dans les deux sens.
 * @param {string} collectiviteId - documentId.
 * @returns {Promise<any>} `{ data: [...] }`.
 */
export const getCollectiviteClubRequests = async (collectiviteId) => corps(
  (await client()).get(`/collectivites/${enc(collectiviteId)}/club-requests`),
);

/**
 * « Envoyer la demande » au club.
 * @param {{ clubId: string, collectiviteId: string }} params - La Ville et le club.
 * @returns {Promise<any>} `{ data: demande }`.
 */
export const proposeCollectiviteClub = async ({ clubId, collectiviteId }) => corps(
  (await client()).post(`/collectivites/${enc(collectiviteId)}/club-proposals`, {
    data: { clubDocumentId: clubId },
  }),
);

/**
 * « Relancer » la demande de la Ville (une fois par 24 heures).
 * @param {{ collectiviteId: string, invitationId: string }} params - La demande.
 * @returns {Promise<any>} `{ data: demande }`.
 */
export const remindCollectiviteProposal = async ({ collectiviteId, invitationId }) => corps(
  (await client()).post(
    `/collectivites/${enc(collectiviteId)}/club-proposals/${enc(invitationId)}/remind`,
  ),
);

/**
 * « Annuler » la demande de la Ville, tant qu'elle attend.
 * @param {{ collectiviteId: string, invitationId: string }} params - La demande.
 * @returns {Promise<any>} `{ data: { cancelled } }`.
 */
export const cancelCollectiviteProposal = async ({ collectiviteId, invitationId }) => corps(
  (await client()).delete(
    `/collectivites/${enc(collectiviteId)}/club-proposals/${enc(invitationId)}`,
  ),
);

/**
 * La Ville accepte ou refuse une demande venue de son lien (« lien A »).
 * @param {{ accept: boolean, collectiviteId: string, invitationId: string }} params - La réponse.
 * @returns {Promise<any>} `{ data: demande }`.
 */
export const answerCollectiviteAttachRequest = async ({
  accept, collectiviteId, invitationId,
}) => corps(
  (await client()).post(
    `/collectivites/${enc(collectiviteId)}/club-requests/${enc(invitationId)}/answer`,
    { data: { accept: accept === true } },
  ),
);

/**
 * Les demandes de rattachement du club, lues par ses dirigeants (les deux sens).
 * @param {string} clubId - documentId du club.
 * @returns {Promise<any>} `{ data: [...] }`.
 */
export const getClubCollectiviteRequests = async (clubId) => corps(
  (await client()).get(`/clubs/${enc(clubId)}/collectivite-requests`),
);

// ─── VOIE 3 (« collectivité A », 07/10) : « Ma collectivité », dans « Gérer mon club » ─────────

/**
 * La case du dirigeant : la collectivité qui tient le club, sa commune, la piste déjà signalée.
 * @param {string} clubId - documentId du club.
 * @returns {Promise<any>} `{ data: { attached, commune, lead } }`.
 */
export const getMaCollectivite = async (clubId) => corps(
  (await client()).get(`/clubs/${enc(clubId)}/ma-collectivite`),
);

/**
 * Le dirigeant cherche SA collectivité (sans texte : celle de la commune du club).
 * @param {string} clubId - documentId du club.
 * @param {string} q - Le texte cherché.
 * @returns {Promise<any>} `{ data: [...] }`.
 */
export const searchCollectivitesForClub = async (clubId, q) => corps(
  (await client()).get(`/clubs/${enc(clubId)}/collectivite-search`, { params: { q: q || '' } }),
);

/**
 * « Demander le rattachement » : la même demande que par le lien ; la Ville accepte ou refuse.
 * FINITIONS-VILLE (T20) : `cancel` retire la demande EN ATTENTE (« Annuler ma demande »).
 * @param {{ cancel?: boolean, clubId: string, collectiviteId: string }} params - Le club et la
 *   collectivité ; `cancel` pour retirer sa demande.
 * @returns {Promise<any>} `{ data: { state, outsideCommune } }`, ou `{ data: { cancelled } }`.
 */
export const requestClubAttach = async ({ cancel = false, clubId, collectiviteId }) => corps(
  (await client()).post(`/clubs/${enc(clubId)}/collectivite-requests`, {
    data: { collectiviteDocumentId: collectiviteId, ...(cancel === true ? { cancel: true } : {}) },
  }),
);

/**
 * « Prévenir ma mairie » : une piste pour l'équipe FoundClub (sa commune ; à défaut, celle donnée).
 * @param {{ clubId: string, communeName?: string | null }} params - Le club, et sa commune si
 *   sa fiche n'en a pas.
 * @returns {Promise<any>} `{ data: { communeName, createdAt } }`.
 */
export const notifyMairie = async ({ clubId, communeName = null }) => corps(
  (await client()).post(`/clubs/${enc(clubId)}/collectivite-leads`, {
    data: communeName ? { communeName } : {},
  }),
);

/**
 * Un dirigeant du club répond à la demande de la Ville (« club A » : accepter rattache).
 * @param {{ accept: boolean, invitationId: string }} params - La réponse.
 * @returns {Promise<any>} `{ data: demande }`.
 */
export const answerCollectiviteProposal = async ({ accept, invitationId }) => corps(
  (await client()).post(`/collectivite-proposals/${enc(invitationId)}/answer`, {
    data: { accept: accept === true },
  }),
);
