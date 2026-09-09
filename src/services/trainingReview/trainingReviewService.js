import client from '@/services/client';

// Motif recopie de `matchStatsService.js:3` — la reponse Strapi arrive enveloppee
// une ou deux fois selon la route, et ce depot deballe au meme endroit partout.
const unwrapResponse = (response) => response?.data?.data || response?.data;

/**
 * LOT AVIS — les trois appels de l avis anonyme sur un entrainement.
 *
 * ⛔ Il n existe AUCUNE route de collection sur `training-review` : la lire
 * directement exposerait son auteur. Ces trois-la sont les seules portes.
 */

/**
 * Les entrainements que le porteur du jeton peut encore noter.
 *
 * ⚠️ Le chemin porte le prefixe `/firebase-auth` comme sa jumelle
 * `pending-match-stats` : aucune route de ce depot ne commence par `/me/`.
 * @returns {Promise<any>} - `{ items, nextPrompt, totalPending }`.
 */
export const getPendingTrainingReviews = async () => {
  const response = await client.get('/firebase-auth/me/pending-training-reviews');
  return unwrapResponse(response);
};

/**
 * Envoie l avis d un participant. La note est le seul champ obligatoire.
 * @param {string} eventId - L entrainement.
 * @param {{ comment?: string | null, rating: number }} payload - L avis.
 * @returns {Promise<any>} - `{ ok: true }`.
 */
export const submitTrainingReview = async (eventId, payload) => {
  const response = await client.post(`/events/${eventId}/training-review`, {
    comment: payload?.comment || null,
    rating: payload?.rating,
  });
  return unwrapResponse(response);
};

/**
 * Ce que l entraineur a le droit de voir.
 *
 * ⛔ La reponse ne porte AUCUN identifiant de personne, et sous deux avis elle
 * ne porte meme pas la liste : c est le serveur qui tranche, pas l app.
 * @param {string} eventId - L entrainement.
 * @returns {Promise<any>} - `{ average, count, thresholdReached, reviews? }`.
 */
export const getTrainingReviews = async (eventId) => {
  const response = await client.get(`/events/${eventId}/training-reviews`);
  return unwrapResponse(response);
};
