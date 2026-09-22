/**
 * MSGREACT — les regles PURES des reactions emoji, cote telephone et site.
 *
 * 🧱 Aucun import de service ici, et ce n est pas un detail de style : un module
 * de `src/services` charge le client HTTP au chargement, et tout ecran qui
 * l importe fait virer au rouge TOUTES ses suites de temoins dans une copie de
 * travail (`.env` absent). Les fonctions pures vivent donc dans `src/domains`.
 */

/**
 * Le jeu FERME des reactions.
 *
 * ⛔ IL EST RECOPIE DU SERVEUR, qui refuse tout ce qui n y est pas :
 * `admin/src/api/chat-message/services/chat-message-reactions.js`
 * (`ALLOWED_REACTION_EMOJIS`). Les deux listes sont gardees identiques par
 * `reactionUseCases.test.js` — si elles divergent, l app propose un emoji que le
 * serveur refuse, et l appui ne fait rien sans rien dire.
 */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/**
 * Coupe une valeur quelconque en identifiant sur.
 * @param {unknown} value Une valeur quelconque.
 * @returns {string} La meme, en chaine coupee.
 */
const toSafeId = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

/**
 * Range la charge du serveur par message.
 * @param {any} data Le tableau `data` de GET /chat-message-reactions.
 * @returns {Record<string, any[]>} messageDocumentId -> blocs de reactions.
 */
export const indexReactionsByMessage = (data) => {
  const index = {};

  (Array.isArray(data) ? data : []).forEach((entry) => {
    const messageDocumentId = toSafeId(entry?.messageDocumentId);
    if (!messageDocumentId) return;

    const reactions = Array.isArray(entry?.reactions) ? entry.reactions : [];
    if (reactions.length === 0) return;

    index[messageDocumentId] = reactions;
  });

  return index;
};

/**
 * Les blocs de reactions d un message donne.
 * @param {any} index L index rendu par {@link indexReactionsByMessage}.
 * @param {unknown} messageDocumentId Le message cherche.
 * @returns {any[]} Ses blocs de reactions, ou un tableau vide.
 */
export const getReactionsForMessage = (index, messageDocumentId) => {
  const key = toSafeId(messageDocumentId);
  if (!key || !index || typeof index !== 'object') return [];
  return Array.isArray(index[key]) ? index[key] : [];
};

/**
 * MA reaction sur ce message, s il y en a une.
 *
 * 🔑 LE SERVEUR NE DIT PAS « c est la mienne », et c est voulu : la charge part
 * a TOUT le fil par la socket, donc un tel drapeau serait vrai pour une seule
 * personne et faux pour toutes les autres. Chaque telephone se reconnait donc
 * lui-meme dans la liste des personnes.
 * @param {any[]} reactions Les blocs de reactions d un message.
 * @param {unknown} myUserId Mon identifiant de compte.
 * @returns {string} L emoji que j ai pose, ou une chaine vide.
 */
export const getMyReactionEmoji = (reactions, myUserId) => {
  const safeMyUserId = toSafeId(myUserId);
  if (!safeMyUserId || !Array.isArray(reactions)) return '';

  const mine = reactions.find((reaction) => (
    Array.isArray(reaction?.users)
    && reaction.users.some((user) => toSafeId(user?.documentId) === safeMyUserId)
  ));

  return toSafeId(mine?.emoji);
};

/**
 * Remplace les reactions d UN message, sans muter l index d origine.
 *
 * 🧊 LA COPIE N EST PAS UNE COQUETTERIE : react-query compare les references
 * pour decider s il redessine. Muter l index en place ferait un ecran qui ne
 * bouge pas alors que la donnee a change.
 * @param {any} index L index courant.
 * @param {unknown} messageDocumentId Le message vise.
 * @param {any[]} reactions Ses nouveaux blocs (vide = plus aucune reaction).
 * @returns {Record<string, any[]>} Un index NEUF.
 */
export const withMessageReactions = (index, messageDocumentId, reactions) => {
  const key = toSafeId(messageDocumentId);
  const base = index && typeof index === 'object' ? index : {};
  if (!key) return { ...base };

  const next = { ...base };
  const safeReactions = Array.isArray(reactions) ? reactions : [];

  if (safeReactions.length === 0) {
    delete next[key];
    return next;
  }

  next[key] = safeReactions;
  return next;
};

/**
 * La liste « qui a reagi », une ligne par personne.
 *
 * 🧟 UN COMPTE SUPPRIME GARDE SA PLACE. Le serveur compte les lignes mais ne
 * sort aucune identite pour un compte parti : l ecart entre `count` et la
 * longueur de `users` est donc comble par des lignes « Compte supprime ». Sans
 * ca, la liste dirait « 3 » en haut et n afficherait que deux noms.
 * @param {any[]} reactions Les blocs de reactions d un message.
 * @param {{deletedLabel: string, myLabel: string, myUserId: unknown}} labels Les libelles traduits.
 * @returns {{emoji: string, key: string, name: string}[]} Une ligne par personne.
 */
export const summarizeReactionPeople = (reactions, labels) => {
  const safeMyUserId = toSafeId(labels?.myUserId);
  const lignes = [];

  (Array.isArray(reactions) ? reactions : []).forEach((reaction) => {
    const emoji = toSafeId(reaction?.emoji);
    const users = Array.isArray(reaction?.users) ? reaction.users : [];

    users.forEach((user) => {
      const documentId = toSafeId(user?.documentId);
      if (!documentId) return;

      const name = documentId === safeMyUserId
        ? String(labels?.myLabel || '')
        : [toSafeId(user?.firstname), toSafeId(user?.lastname)].filter(Boolean).join(' ');

      lignes.push({
        emoji,
        key: `${emoji}-${documentId}`,
        name: name || String(labels?.deletedLabel || ''),
      });
    });

    const count = Number(reaction?.count);
    const manquants = Number.isFinite(count) ? Math.max(0, count - users.length) : 0;
    for (let index = 0; index < manquants; index += 1) {
      lignes.push({
        emoji,
        key: `${emoji}-supprime-${index}`,
        name: String(labels?.deletedLabel || ''),
      });
    }
  });

  return lignes;
};
