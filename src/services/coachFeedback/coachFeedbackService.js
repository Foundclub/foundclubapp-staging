import client from '@/services/client';

// Motif recopie de `matchStatsService.js:3` : la reponse arrive enveloppee une ou deux fois.
const unwrapResponse = (response) => response?.data?.data || response?.data;

/**
 * ST-RETOURS (02/10) — CE QUE J AI DEJA LU DES RETOURS DU COACH.
 *
 * Par joueur suivi : moi (« Nouveau » sur mes retours), ou mon enfant mineur (« 1 nouveau »
 * sur Mes enfants, et l alerte que j ai choisie). Le serveur le range sur MON compte.
 * @returns {Promise<Record<string, { notify?: boolean, seen: string[] }>>} - La carte.
 */
export const getCoachFeedbackFollow = async () => {
  const response = await client.get('/firebase-auth/me/coach-feedback-follow');
  return unwrapResponse(response) || {};
};

/**
 * Marque des retours comme lus et, pour un enfant, coupe ou rallume l alerte.
 * Le serveur refuse (403) tout autre joueur que moi ou mon enfant mineur declare.
 * @param {{ notify?: boolean, playerDocumentId: string, seenKeys?: string[] }} payload - Le geste.
 * @returns {Promise<Record<string, { notify?: boolean, seen: string[] }>>} - La carte rangee.
 */
export const updateCoachFeedbackFollow = async (payload) => {
  const response = await client.put('/firebase-auth/me/coach-feedback-follow', payload);
  return unwrapResponse(response) || {};
};
