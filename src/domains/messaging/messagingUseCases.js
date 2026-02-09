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
 * @param {User[]} [params.chatParticipants] - Array of chat participants
 * @param {Team} [params.chatTeam] - The chat team object
 * @param {string} params.chatType - The type of chat (e.g., 'club', 'team', 'whisper')
 * @param {string} [params.meId] - The ID of the current user
 * @returns {string} The generated conversation name
 */
export const getConversationName = ({
  chatClub, chatMultisportClub, chatParticipants, chatTeam, chatType, meId, chatLeagueMatch,
}) => {
  switch (chatType) {
    case 'club':
      return chatClub?.name || '';
    case 'multisport':
      return chatMultisportClub?.name || '';
    case 'team':
      return chatTeam?.name || '';
    case 'league_match':
       // Logic: "Match vs [Opponent]"
       // We need to identify the opponent team name.
       // We assume the user is part of one of the teams.
       // However, we might not have the full team list here easily.
       // We rely on chatLeagueMatch being passed.
       if (chatLeagueMatch) {
            const teamA = chatLeagueMatch.team_a;
            const teamB = chatLeagueMatch.team_b;
            const date = chatLeagueMatch.date ? new Date(chatLeagueMatch.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '';
            
            // If we can't determine "my" team easily (complicated logic), just show "Match [Date]"
            // Or "Team A vs Team B"
            // User requested to avoid opponent name and use "Match X" or "Match [Date]"
            // Since we don't have match number easily, we use date.
            return `Match du ${date}`;
            return `Match ${date}`;
       }
       return 'Match de Ligue';
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
