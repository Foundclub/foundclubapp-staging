/**
 * @typedef {{ documentId?: string; name?: string; logo?: Avatar; admins?: User[] }} MultisportClubRef
 */

/**
 * Chat type definition based on Strapi schema
 * @typedef {object} Chat
 * @property {string} id - The unique identifier of the chat
 * @property {string} documentId
 * @property {'whisper' | 'club' | 'team' | 'league_match' | 'multisport' | string} type - Chat type
 * @property {User[]} participants - The users participating in the chat
 * @property {ChatMessage[]} [messages] - The messages in the chat
 * @property {Date} createdAt - When the chat was created
 * @property {Date} updatedAt - When the chat was last updated
 * @property {Club} [club] - The club this chat belongs to
 * @property {Team} [team] - The team this chat belongs to
 * @property {LeagueMatch} [league_match] - Linked league match
 * @property {MultisportClubRef} [multisportClub] - Linked multisport club
 * @property {User[]} [archivedBy] - Users who archived the chat
 * @property {User[]} [pinnedBy] - Users who pinned the chat
 * @property {User[]} [myTeamMembers] - Synthetic team members field for some endpoints
 */

/**
 * @typedef {{ url?: string; id?: string | number; documentId?: string; mime?: string; name?: string }} MessageAttachment
 * @typedef {{ date?: string; venue?: string; [key: string]: any }} MessageComposition
 */

/**
 * Chat message type definition based on Strapi schema
 * @typedef {object} ChatMessage
 * @property {string} id - The unique identifier of the message
 * @property {string} message - The content of the message
 * @property {User} sender - The user who sent the message
 * @property {Chat} chat - The chat this message belongs to
 * @property {string} documentId - The ID of the document this message belongs to
 * @property {Date} createdAt - When the message was sent
 * @property {Date} updatedAt - When the message was last updated
 * @property {boolean} [isRead] - Whether the message has been read
 * @property {MessageAttachment[]} [attachments] - Message attachments
 * @property {object} [event] - Event payload in message
 * @property {MessageComposition} [composition] - Composition/proposal payload
 * @property {boolean} [pending] - Optimistic message marker
 * @property {ChatMessage | null} [replyTo] - Reply target
 * @property {User[]} [readBy] - Users who read the message
 * @property {{ _id?: string | number; name?: string; avatar?: string }} [user] - GiftedChat compatible user
 * @property {string} [text] - GiftedChat compatible text
 */

/**
 * @typedef {object} ChatParticipantUpdate
 * @property {string} chatId - The chat id
 * @property {User[]} participants - The updated participants
 */

/**
 * Handle message deletion data type
 * @typedef {{
 *   chatDocumentId: string;
 *   messageId: string;
 * }} MessageDeletionData
 */

/**
 * Handle join data type
 * @typedef {{
 *   chatDocumentId: string;
 *   userId: string;
 *   timestamp: string;
 * }} JoinData
 */
