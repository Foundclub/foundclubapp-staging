import client from '@/services/client';

/**
 * OFFRIR-ABONNEMENT (07/10/2026) — l offre Club OFFERTE PAR FOUNDCLUB, depuis la console
 * SuperAdmin. Quatre routes du serveur (`/admin-dashboard/subscription-ops/...`), toutes gardees
 * par `global::is-superadmin` : le serveur est le seul juge (club qui paie deja, duree, motif).
 */

/** Les durees acceptees par le serveur, dans l ordre de la feuille (1 mois … sans fin). */
export const FOUNDCLUB_OFFER_DURATIONS = ['1m', '3m', '1y', 'none'];

const idSur = (/** @type {unknown} */ value) => encodeURIComponent(String(value || '').trim());
const routeDuClub = (/** @type {string} */ clubId) => (
  `/admin-dashboard/subscription-ops/clubs/${idSur(clubId)}/foundclub-offer`
);

/**
 * L etat de l offre d un club : `{ kind: 'foundclub' | 'paid' | 'none', since, until, reason,
 * collectivite, subscriptionDocumentId }`.
 * @param {string} clubId - documentId du club.
 * @returns {Promise<any>} `{ data: etat }`.
 */
export const getFoundclubClubOffer = async (clubId) => {
  const response = await client.get(routeDuClub(clubId));
  return response.data;
};

/** « Jusqu au… » une date choisie (decision d Adel du 07/10) : la fin part avec la demande. */
export const FOUNDCLUB_OFFER_CUSTOM_DURATION = 'until';

/**
 * Offrir (ou reoffrir) l abonnement Club.
 * @param {{ clubId: string, duration: string, endsAt?: string | null, reason: string }} params -
 *   Le club, la duree, la fin choisie (ISO, avec `until` seulement), le motif.
 * @returns {Promise<any>} `{ data: { offer: 'granted' | 'already-paid', currentPeriodEnd,
 *   subscriptionDocumentId } }`.
 */
export const grantFoundclubClubOffer = async ({
  clubId, duration, endsAt = null, reason,
}) => {
  const data = endsAt ? { duration, endsAt, reason } : { duration, reason };
  const response = await client.post(routeDuClub(clubId), { data });
  return response.data;
};

/**
 * Retirer l offre de FoundClub (jamais celle de la Ville, jamais un abonnement paye).
 * @param {{ clubId: string, reason?: string }} params - Le club, le motif du retrait.
 * @returns {Promise<any>} `{ data: { offer: 'revoked' | 'none' } }`.
 */
export const revokeFoundclubClubOffer = async ({ clubId, reason = '' }) => {
  const response = await client.post(`${routeDuClub(clubId)}/revoke`, { data: { reason } });
  return response.data;
};

/**
 * « Abonnements offerts » : les offres de FoundClub en cours.
 * @returns {Promise<any>} `{ data: [{ clubDocumentId, clubName, since, until, reason, ... }] }`.
 */
export const getFoundclubOffers = async () => {
  const response = await client.get('/admin-dashboard/subscription-ops/foundclub-offers');
  return response.data;
};
