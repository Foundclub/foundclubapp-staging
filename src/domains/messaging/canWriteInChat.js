import { getManagedMultisportIds, getUserRoleKey } from '@/domains/auth/authUseCases';
import { estFilDeLaVille } from '@/domains/collectivite/collectiviteCanaux';
import { isFriendlyMatchChat } from '@/domains/messaging/messagingUseCases';

/**
 * MSG1W (07/10) — QUI PEUT ECRIRE DANS CE FIL ? (README §3.11, « Canal d annonce (lecture seule) »)
 *
 * 🧱 LA REGLE DU TELEPHONE, SORTIE DE L ECRAN. Elle vivait en ligne dans `Conversation.js`
 * (`canWrite`) ; le site n en avait AUCUNE : sa saisie etait offerte partout, et le serveur
 * refusait ensuite l envoi dans un canal de club. Elle est recopiee ici telle quelle, AVEC la
 * correction de MESSAGERIE-1A (`7babb7c6`, G1 : un groupe n est pas un canal d annonce).
 * ponytail: tant que `Conversation.js` garde sa copie en ligne, il y a DEUX regles ; sortie :
 * que le telephone importe celle-ci (lot MESSAGERIE-1A), une regle pour deux ecrans.
 *
 * Le serveur fait foi (`chat-message.ts`, `ensureUserCanWriteInChat`) : il ne restreint que les
 * fils `club` et `multisport`. Partout ailleurs, les participants ecrivent.
 * @param {{ chat: any, user: any, hasClubAccess?: (clubId: string) => boolean }} faits - Le fil,
 *   la personne, et la question « a-t-elle acces a ce club ? » (`useAuth`).
 * @returns {boolean} Vrai si la saisie doit etre offerte.
 */
const canWriteInChat = ({ chat, hasClubAccess, user }) => {
  if (!chat || !user) return false;
  const isManagerRole = getUserRoleKey(user?.role?.type || user?.role?.name) === 'president';

  // COLL-C4A2 — un fil de la Ville : ses membres (calcules par le serveur) ecrivent tous.
  if (estFilDeLaVille(chat)) return true;

  // Tete-a-tete, groupe, equipe, match League ou amical : tous les participants ecrivent.
  if (
    chat.type === 'whisper'
    || chat.type === 'group'
    || chat.type === 'team'
    || chat.type === 'league_match'
    || Boolean(chat.league_match)
    || isFriendlyMatchChat(chat)
  ) return true;

  // Canal de club : les dirigeants de la section (et du club omnisport parent) seulement.
  if (chat.type === 'club') {
    const chatClubId = String(chat?.club?.documentId || chat?.club?.id || '').trim();
    return Boolean(chatClubId) && isManagerRole && Boolean(hasClubAccess?.(chatClubId));
  }

  // Canal omnisport : ses administrateurs seulement.
  if (chat.type === 'multisport') {
    const chatMultisportId = String(
      chat?.multisportClub?.documentId || chat?.multisportClub?.id || '',
    ).trim();
    const admins = Array.isArray(chat.multisportClub?.admins) ? chat.multisportClub.admins : [];
    const isChatDeclaredAdmin = admins.some(
      (/** @type {any} */ admin) => admin?.documentId === user.documentId,
    );
    const isManagedMultisportChat = Boolean(
      chatMultisportId && getManagedMultisportIds(user).has(chatMultisportId),
    );
    return isManagerRole && (isChatDeclaredAdmin || isManagedMultisportChat);
  }

  return false;
};

export default canWriteInChat;
