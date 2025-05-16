/**
 * Chat type definition based on Strapi schema
 * @typedef {object} Chat
 * @property {string} id - The unique identifier of the chat
 * @property {string} documentId
 * @property {string} type - The type of chat ('whisper' | 'group')
 * @property {User[]} participants - The users participating in the chat
 * @property {ChatMessage[]} [messages] - The messages in the chat
 * @property {Date} createdAt - When the chat was created
 * @property {Date} updatedAt - When the chat was last updated
 * @property {Club} [club] - The club this chat belongs to
 * @property {Team} [team] - The team this chat belongs to
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
