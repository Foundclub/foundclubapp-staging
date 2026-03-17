import { storage } from '@/store/appContext';

/**
 * Get the storage key for the last read message timestamp of a chat
 * @param {string} chatId - The chat ID
 * @returns {string} The storage key
 */
export const getLastReadMessageKey = (/** @type {string} */ chatId) => `chat_${chatId}_last_read`;

/**
 * Check if a chat has unread messages
 * @param {string} chatId - The chat ID
 * @param {string} lastMessageTimestamp - The timestamp of the last message
 * @returns {boolean} - Whether the chat has unread messages
 */
export const getUnreadStatus = (
  /** @type {string} */ chatId,
  /** @type {string} */ lastMessageTimestamp,
) => {
  const lastReadTimestamp = storage.getString(getLastReadMessageKey(chatId));
  if (!lastReadTimestamp) return true;
  return new Date(lastMessageTimestamp) > new Date(lastReadTimestamp);
};

/**
 * Conversation name generator
 * @param {object} params - Parameters for generating the conversation name
 * @param {Club} [params.chatClub] - The chat club object
 * @param {string} [params.chatGroupName] - Group chat display name
 * @param {MultisportClubRef} [params.chatMultisportClub] - The multisport club object
 * @param {User[]} [params.chatParticipants] - Array of chat participants
 * @param {Team} [params.chatTeam] - The chat team object
 * @param {LeagueMatch} [params.chatLeagueMatch] - League match linked to chat
 * @param {string} params.chatType - The type of chat (e.g., 'club', 'team', 'whisper')
 * @param {string} [params.meId] - The ID of the current user
 * @returns {string} The generated conversation name
 */
export const getConversationName = ({
  chatClub, chatGroupName, chatLeagueMatch, chatMultisportClub, chatParticipants, chatTeam, chatType, meId,
}) => {
  switch (chatType) {
    case 'club':
      return chatClub?.name || '';
    case 'group':
      return chatGroupName || 'Groupe';
    case 'league_match':
      if (chatLeagueMatch) {
        const date = chatLeagueMatch.date
          ? new Date(chatLeagueMatch.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
          : '';
        return date ? `Match du ${date}` : 'Match de Ligue';
      }
      return 'Match de Ligue';
    case 'multisport':
      return chatMultisportClub?.name || '';
    case 'team':
      return chatTeam?.name || '';
    case 'whisper': {
      const participant = chatParticipants?.find(
        (p) => p.documentId !== meId,
      ) || chatParticipants?.[0];
      return `${participant?.firstname || ''} ${participant?.lastname || ''}`.trim();
    }
    default:
      return '';
  }
};

/**
 * Returns a user-friendly preview for a chat message.
 * @param {ChatMessage | undefined | null} message
 * @returns {string}
 */
export const getChatMessagePreview = (message) => {
  if (!message) return '';

  const text = String(message?.message || '').trim();
  if (text) return text;

  const compositionType = String(message?.composition?.type || '').trim().toLowerCase();
  switch (compositionType) {
    case 'contact_share':
      return 'Contact partagé';
    case 'event_share':
      return 'Événement partage';
    case 'location_share':
      return 'Localisation';
    case 'poll':
      return 'Sondage';
    case 'proposal':
      return 'Proposition';
    case 'voice_note':
      return 'Note vocale';
    default:
      break;
  }

  if (Array.isArray(message?.attachments) && message.attachments.length > 0) {
    const firstMime = String(message.attachments?.[0]?.mime || '').toLowerCase();
    if (firstMime.startsWith('image/')) return 'Photo';
    if (firstMime.startsWith('audio/')) return 'Note vocale';
    return 'Pièce jointe';
  }

  return '';
};
