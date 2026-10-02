/**
 * 🏛️ COLL-C4A2 (02/10/2026) — LES CANAUX DE LA VILLE DANS LA MESSAGERIE, côté serveur
 * `api::chat.collectivite-channels` (admin fix/COLL-C4A2-admin).
 *
 * Le serveur CALCULE qui est dans chaque fil (la Ville, les dirigeants des clubs rattachés) et
 * l'app affiche ce qu'il rend. Le canal des dirigeants est créé à la première demande.
 *
 * ⚠️ Le client HTTP est chargé À L'APPEL (import dynamique), comme collectiviteActualiteService :
 * la messagerie, les accueils et le site importent ce module sans doubler le client, qui exige
 * l'adresse du serveur dès son chargement (mémoire piege-env-absent-worktree-import-service).
 */

/**
 * Le client HTTP de l'app, chargé à l'appel.
 * @returns {Promise<any>} Le client axios.
 */
const client = async () => (await import('../client')).default;

/**
 * Les canaux des dirigeants de CE compte : un par Ville dont il est gestionnaire, ou dirigeant
 * d'un club rattaché. Rien pour un entraîneur, un joueur, un parent.
 * @returns {Promise<any>} `{ data: [{ canal, clubsCount, collectivite, fonctions }] }`.
 */
export const getMesCanauxDeLaVille = async () => (
  (await (await client()).get('/collectivite-canaux/mine')).data
);

/**
 * « Qui est dans ce canal » : la Ville et ses gestionnaires, puis chaque club et ses dirigeants.
 * @param {string} chatId - Le fil (documentId).
 * @returns {Promise<any>} `{ data: { chat, club, clubsCount, collectivite, groupes } }`.
 */
export const getMembresDuFil = async (chatId) => (
  (await (await client()).get(`/chats/${chatId}/collectivite-membres`)).data
);

/**
 * « Écrire aux dirigeants » (D73) : la conversation privée de la Ville avec CE club, ouverte ou
 * retrouvée (deux appuis rendent la même).
 * @param {{ clubId: string, collectiviteId: string }} args - La Ville et le club (documentId).
 * @returns {Promise<any>} `{ data: { club, collectivite, documentId } }`.
 */
export const ouvrirConversationAvecLeClub = async ({ clubId, collectiviteId }) => {
  const chemin = `/collectivites/${collectiviteId}/clubs/${clubId}/conversation`;
  return (await (await client()).post(chemin)).data;
};
