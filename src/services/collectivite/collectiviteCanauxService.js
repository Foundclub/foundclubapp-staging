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
 * L'adresse de la conversation privée de la Ville avec CE club.
 * @param {{ clubId: string, collectiviteId: string }} args - La Ville et le club (documentId).
 * @returns {string} Le chemin.
 */
const cheminDeLaConversation = ({ clubId, collectiviteId }) => (
  `/collectivites/${collectiviteId}/clubs/${clubId}/conversation`
);

/**
 * 🧯 COLL-FIX-DEMANDES (02/10) — « Écrire aux dirigeants » RETROUVE la conversation sans jamais
 * la créer (GET) : un appui sans message ne pose plus de conversation vide chez les deux.
 * @param {{ clubId: string, collectiviteId: string }} args - La Ville et le club (documentId).
 * @returns {Promise<any>} `{ data: { club, collectivite, documentId } }`, documentId null si
 *   elle n'existe pas encore.
 */
export const trouverConversationAvecLeClub = async (args) => (
  (await (await client()).get(cheminDeLaConversation(args))).data
);

/**
 * « Écrire aux dirigeants » (D73) : la conversation privée de la Ville avec CE club, créée ou
 * retrouvée (deux appuis rendent la même). Appelée au PREMIER message seulement.
 * @param {{ clubId: string, collectiviteId: string }} args - La Ville et le club (documentId).
 * @returns {Promise<any>} `{ data: { club, collectivite, documentId } }`.
 */
export const ouvrirConversationAvecLeClub = async (args) => (
  (await (await client()).post(cheminDeLaConversation(args))).data
);

/**
 * Le premier message de la Ville à CE club : la conversation naît, puis le message y part au
 * nom de la Ville, par le chemin de tous les messages (POST /chat-messages).
 * ponytail: deux appels, pas une transaction. Si le second échoue juste après le premier, la
 * conversation existe vide ; l'appui suivant la retrouve et l'ouvre. Voie de sortie : un POST
 * de la conversation qui porte le message, si le cas se voit.
 * @param {{ clubId: string, collectiviteId: string, message: string }} args - La Ville, le
 *   club (documentId) et le texte.
 * @returns {Promise<any>} `{ data: { club, collectivite, documentId } }`.
 */
export const ecrireLePremierMessageAuClub = async ({ clubId, collectiviteId, message }) => {
  const ouverte = await ouvrirConversationAvecLeClub({ clubId, collectiviteId });
  const chatId = ouverte?.data?.documentId;
  if (!chatId) return ouverte;
  const { createChatMessage } = await import('../chat/chatService');
  await createChatMessage({ chatId, message, senderSignature: { voix: 'ville' } });
  return ouverte;
};
