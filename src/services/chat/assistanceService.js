/**
 * MSG-SUPPORT (20/10/2026) — LA CONVERSATION « ASSISTANCE FOUNDCLUB », côté serveur
 * `api::chat.assistance` (admin feat/MSGSUP-admin).
 *
 * ⚠️ Le client HTTP est chargé À L'APPEL (import dynamique), comme collectiviteCanauxService : la
 * messagerie, le profil et le site importent ce module sans doubler le client, qui exige
 * l'adresse du serveur dès son chargement (mémoire piege-env-absent-worktree-import-service).
 */

/**
 * Le client HTTP de l'app, chargé à l'appel.
 * @returns {Promise<any>} Le client axios.
 */
const client = async () => (await import('../client')).default;

/**
 * MA conversation avec l'équipe : retrouvée, ou créée à la première ouverture (deux appuis
 * rendent la même).
 * @returns {Promise<{ documentId: string }>} Le fil.
 */
export const ouvrirMaConversationAssistance = async () => (
  (await (await client()).post('/assistance/ma-conversation')).data?.data
);

/**
 * La boîte commune de la console (super-admins) : les conversations écrites, non lues d'abord.
 * @returns {Promise<{ conversations: any[], enAttenteTotal: number, nonLusTotal: number }>}
 *   La boîte.
 */
export const getBoiteAssistance = async () => (
  (await (await client()).get('/assistance/conversations')).data?.data
);

/**
 * Côté console, qui de l'équipe a écrit chaque réponse de cette conversation (super-admins).
 * @param {string} chatId - Le fil (documentId).
 * @returns {Promise<Record<string, { firstname: string, lastname: string }>>} Par message.
 */
export const getRepondantsAssistance = async (chatId) => (
  (await (await client()).get(`/assistance/conversations/${chatId}/repondants`)).data?.data || {}
);
