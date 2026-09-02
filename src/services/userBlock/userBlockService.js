import client from '../client';

/**
 * BLOQUER — les trois appels, et rien de plus.
 *
 * ⚠️ L APP NE FAIT QUE CACHER : c est le serveur qui REFUSE (garde-fou pose
 * dans `canAccessChat`, cote admin). Ces trois appels ne servent qu a poser la
 * decision et a la relire ; ils ne sont jamais la seule barriere.
 *
 * ♻️ Motif repris de `messageReportService` : un fichier, une fonction par
 * route, aucune logique.
 */

/**
 * Les personnes que J AI bloquees.
 * @returns {Promise<Array<{documentId: string, blockedAt: string|null,
 *   user: {documentId: string, firstname: string|null, lastname: string|null,
 *   avatar: {url: string}|null}}>>} La liste.
 */
export const getMyBlockedUsers = async () => {
  const response = await client.get('/user-blocks/mine');
  const rows = response?.data?.data;
  return Array.isArray(rows) ? rows : [];
};

/**
 * Bloquer une personne.
 * @param {string} userId - L identifiant de la personne a bloquer.
 * @returns {Promise<any>} La reponse du serveur.
 */
export const blockUser = async (userId) => {
  const response = await client.post('/user-blocks/block', { data: { userId } });
  return response?.data;
};

/**
 * Lever SON blocage. Seul celui qui a bloque peut lever.
 * @param {string} userId - L identifiant de la personne a debloquer.
 * @returns {Promise<any>} La reponse du serveur.
 */
export const unblockUser = async (userId) => {
  const response = await client.post('/user-blocks/unblock', { data: { userId } });
  return response?.data;
};
