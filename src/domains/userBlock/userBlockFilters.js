// @ts-nocheck
/**
 * BLOQUER — K4 : LE BLOCAGE CACHE, IL NE SUPPRIME PAS.
 *
 * Les anciens messages restent en base (ils peuvent servir a un signalement).
 * C est l app qui les retire A L AFFICHAGE, et c est tout ce que fait ce
 * fichier : il rend de NOUVELLES listes, il n en modifie aucune.
 *
 * ⚠️ CE N EST PAS LA BARRIERE. La vraie porte est au serveur
 * (`canAccessChat`, cote admin) : elle refuse d ecrire et de lire. Ce filtre-ci
 * n existe que pour que l ecran soit propre — pas d erreur affichee, pas de fil
 * mort dans la liste.
 *
 * 🧒 K5 — LE BLOCAGE NE FERME QU UNE DISCUSSION STRICTEMENT A DEUX. La regle
 * est ecrite ici comme au serveur, au meme endroit et de la meme facon : un fil
 * de club, d equipe, de groupe, et la discussion a trois d un mineur avec son
 * parent ne disparaissent JAMAIS de la liste.
 */

/** Le type de fil qui peut etre un tete-a-tete. */
const ONE_TO_ONE_CHAT_TYPE = 'whisper';

/** Le nombre de participants d un tete-a-tete. Trois, c est deja un groupe. */
const ONE_TO_ONE_PARTICIPANT_COUNT = 2;

/**
 * Ramene une valeur a son identifiant de personne.
 * @param {unknown} value - La valeur.
 * @returns {string} L identifiant, ou une chaine vide.
 */
export const toUserId = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value && typeof value === 'object') {
    return String(value.documentId || value.id || '').trim();
  }
  return '';
};

/**
 * Les identifiants des participants d un fil, sans doublon ni vide.
 * @param {any} chat - Le fil.
 * @returns {string[]} Les identifiants.
 */
export const listParticipantIds = (chat) => {
  const participants = Array.isArray(chat?.participants) ? chat.participants : [];
  return Array.from(new Set(participants.map(toUserId).filter(Boolean)));
};

/**
 * Dans un tete-a-tete, qui est EN FACE de moi ?
 * @param {any} chat - Le fil.
 * @param {unknown} currentUserId - Moi.
 * @returns {string} L identifiant de l autre, ou une chaine vide si ce n est pas un tete-a-tete.
 */
export const resolveOtherParticipantId = (chat, currentUserId) => {
  if (String(chat?.type || '').trim() !== ONE_TO_ONE_CHAT_TYPE) return '';
  const participantIds = listParticipantIds(chat);
  if (participantIds.length !== ONE_TO_ONE_PARTICIPANT_COUNT) return '';
  const me = toUserId(currentUserId);
  if (!me || !participantIds.includes(me)) return '';
  return participantIds.find((participantId) => participantId !== me) || '';
};

/**
 * Ce fil est-il un tete-a-tete avec une personne bloquee ?
 * @param {any} chat - Le fil.
 * @param {unknown} currentUserId - Moi.
 * @param {Set<string>|string[]} blockedUserIds - Les personnes bloquees.
 * @returns {boolean} Vrai si le fil doit disparaitre de la liste.
 */
export const isOneToOneChatWithBlockedUser = (chat, currentUserId, blockedUserIds) => {
  const blocked = blockedUserIds instanceof Set ? blockedUserIds : new Set(blockedUserIds || []);
  if (blocked.size === 0) return false;
  const otherUserId = resolveOtherParticipantId(chat, currentUserId);
  if (!otherUserId) return false;
  return blocked.has(otherUserId);
};

/**
 * La liste des discussions, sans les tete-a-tete bloques.
 * @param {any[]} chats - Les fils.
 * @param {unknown} currentUserId - Moi.
 * @param {Set<string>|string[]} blockedUserIds - Les personnes bloquees.
 * @returns {any[]} Une NOUVELLE liste.
 */
export const hideBlockedChats = (chats, currentUserId, blockedUserIds) => {
  const safeChats = Array.isArray(chats) ? chats : [];
  const blocked = blockedUserIds instanceof Set ? blockedUserIds : new Set(blockedUserIds || []);
  if (blocked.size === 0) return safeChats;
  return safeChats.filter(
    (chat) => !isOneToOneChatWithBlockedUser(chat, currentUserId, blocked),
  );
};

/**
 * Les messages d un fil, sans ceux des personnes bloquees.
 *
 * Utile dans un fil COLLECTIF : un groupe ou un fil de club reste ouvert, mais
 * je ne veux plus lire la personne que j ai bloquee.
 * @param {any[]} messages - Les messages, dans n importe quelle forme portant un expediteur.
 * @param {Set<string>|string[]} blockedUserIds - Les personnes bloquees.
 * @returns {any[]} Une NOUVELLE liste. La source n est jamais modifiee.
 */
export const hideBlockedMessages = (messages, blockedUserIds) => {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const blocked = blockedUserIds instanceof Set ? blockedUserIds : new Set(blockedUserIds || []);
  if (blocked.size === 0) return safeMessages;

  return safeMessages.filter((message) => {
    // Un message SYSTEME n a pas d expediteur : il ne se cache jamais.
    // `sender` = la forme du serveur ; `user._id` = celle de gifted-chat.
    const senderId = toUserId(message?.sender)
      || toUserId(message?.user)
      // eslint-disable-next-line no-underscore-dangle -- forme imposee par gifted-chat
      || String(message?.user?._id || '').trim();
    if (!senderId) return true;
    return !blocked.has(senderId);
  });
};

/**
 * L'ensemble des identifiants bloques, tel qu'un ecran l'interroge.
 *
 * Il vit ICI et pas dans `userBlockQueries` pour une raison mesuree : ce
 * fichier-la importe le client HTTP, qui refuse de se charger sans `.env` --
 * absent de TOUT worktree. Un ecran qui n'a besoin que de la conversion ne doit
 * pas tirer le client avec lui.
 * @param {Array<{user?: {documentId?: string}}>} rows - Les lignes rendues par le serveur.
 * @returns {Set<string>} Les identifiants.
 */
export const toBlockedUserIdSet = (rows) => new Set(
  (Array.isArray(rows) ? rows : [])
    .map((row) => String(row?.user?.documentId || '').trim())
    .filter(Boolean),
);
