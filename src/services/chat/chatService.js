import Joi from 'joi';

import { emitGuidanceAction } from '@/domains/guidance/guidanceRuntime';

import { createLogger } from '@/utils/logger/logger';

import client from '../client';

const chatServiceLogger = createLogger('chat-service');

const chatMessageSchema = Joi.object({
  attachments: Joi.array().items(Joi.object().unknown(true)).optional(),
  composition: Joi.object().allow(null).optional(),
  createdAt: Joi.date().required(),
  documentId: Joi.string().required(),
  event: Joi.object().optional().allow(null),
  // Some chat entries (attachments/polls/compositions) can carry an empty textual message.
  message: Joi.string().allow('').allow(null).required(),
  replyTo: Joi.object().allow(null).optional(),
  // 🧾 S10-C / D4 — UN MESSAGE SYSTEME N'A PAS D'EXPEDITEUR.
  // Le serveur en poste deja (`sender: null` — matchmaking-engine.js:1343,
  // post-slot-resolution.js:159) et S10-A (D8bis) va en poster dans le fil de
  // chaque equipe invitee. Sans `.allow(null)`, UNE ligne systeme faisait
  // basculer la PAGE ENTIERE dans le repli non valide (:203 ci-dessous) : les
  // bulles restaient a l'ecran, mais plus rien n'etait verifie et un
  // avertissement partait a chaque ouverture. `.required()` est CONSERVE : la
  // clef doit etre presente, c'est sa VALEUR nulle qui devient legitime.
  sender: Joi.object().allow(null).required(),
  updatedAt: Joi.date().required(),
}).required();

const chatSchema = Joi.object({
  archivedBy: Joi.array().items(Joi.object()).optional(),
  createdAt: Joi.date().required(),
  documentId: Joi.string().required(),
  messages: Joi.alternatives().try(
    Joi.array().items(chatMessageSchema),
    Joi.array().items(Joi.object().unknown(true)),
    Joi.array().length(0),
  ).optional(),
  participants: Joi.array().items(Joi.object()).optional(),
  pinnedBy: Joi.array().items(Joi.object()).optional(),
  // `friendly_match` fait partie de l enumeration serveur depuis le socle des
  // matchs amicaux (chat/schema.json). Sans lui, TOUTE liste de discussions
  // contenant un fil d amical tombait dans le repli non valide de getChats() —
  // silencieux, mais la liste entiere perdait sa validation au passage.
  type: Joi.string()
    .valid('whisper', 'club', 'team', 'multisport', 'league_match', 'friendly_match', 'group')
    .required(),
  updatedAt: Joi.date().required(),
}).required();

/**
 * Get all chats for the current user
 * @param {number} [page] - The page number
 * @param {number} [pageSize] - The page size
 * @returns {Promise<{data: Chat[],
 * meta: { pagination: { page: number, pageCount: number, total: number }}}>}
 */
export const getChats = async (page = 1, pageSize = 20) => {
  const response = await client.get('/chats', {
    params: {
      latestMessageOnly: true,
      pagination: {
        page,
        pageSize,
      },
    },
  });

  try {
    const schema = Joi.object({
      data: Joi.array().items(chatSchema).empty(Joi.array().length(0)),
      meta: Joi.object({
        pagination: Joi.object({
          page: Joi.number().required(),
          pageCount: Joi.number().required(),
          total: Joi.number().required(),
        }).required(),
      }).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult;
  } catch (error) {
    const rawData = Array.isArray(response?.data?.data) ? response.data.data : [];
    const rawPagination = response?.data?.meta?.pagination || {};
    chatServiceLogger.warn('Chat list schema mismatch, using fallback payload', {
      error: error?.message || error,
      length: rawData.length,
    });
    // AE06 — le repli reconstruisait `meta` de zero : le total de non-lus
    // disparaissait ici en SILENCE, sans erreur nulle part, des qu un seul fil
    // de la page avait une forme inattendue. On le recopie.
    const rawUnreadTotal = Number(response?.data?.meta?.unreadTotal);

    return {
      data: rawData,
      meta: {
        pagination: {
          page: Number(rawPagination.page || page || 1),
          pageCount: Number(rawPagination.pageCount || 1),
          total: Number(rawPagination.total || rawData.length),
        },
        ...(Number.isFinite(rawUnreadTotal) ? { unreadTotal: rawUnreadTotal } : {}),
      },
    };
  }
};

/**
 * Get a chat by id
 * @param {string} chatId - The chat id
 * @param {{ includeMessages?: boolean }} [options] - Optional payload shape controls
 * @returns {Promise<Chat>}
 */
export const getChatById = async (chatId, options = {}) => {
  const response = await client.get(`/chats/${chatId}`, {
    params: {
      chat: chatId,
      ...(options?.includeMessages === true ? { includeMessages: true } : {}),
    },
  });

  const chatData = response.data.data;

  // Fallback for league_match if relation is missing in one direction (legacy data)
  if (chatData?.type === 'league_match' && !chatData?.league_match) {
    try {
      // Attempt to find the match that links to this chat
      const matchResponse = await client.get('/league-matches', {
        params: {
          filters: {
            chat: {
              documentId: chatId,
            },
          },
          populate: {
            team_a: { populate: ['captain', 'roster'] },
            team_b: { populate: ['captain', 'roster'] },
            winner: true,
          },
        },
      });

      if (matchResponse.data?.data?.length > 0) {
        chatServiceLogger.info('Recovered missing league_match relation');
        const [recoveredMatch] = matchResponse.data.data;
        chatData.league_match = recoveredMatch;
      }
    } catch (err) {
      chatServiceLogger.warn('Failed to fetch fallback league_match', err?.message || err);
    }
  }

  try {
    const schema = Joi.object({
      data: chatSchema.required(),
    }).required();

    // Validate the modified data
    const validationResult = await schema.validateAsync({ data: chatData }, {
      allowUnknown: true,
    });
    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch chat: ${errorToDisplay}`);
  }
};

/**
 * Get messages for a chat
 * @param {string} [chatId] - The chat id
 * @param {number} page - The page number
 * @param {number} pageSize - The page size
 * @returns {Promise<{data: ChatMessage[],
 *  meta: { pagination: { page: number, pageCount: number, total: number }}}>}
 */
export const getChatMessages = async (chatId = '', page = 1, pageSize = 20) => {
  const response = await client.get('/chat-messages', {
    params: {
      chat: chatId,
      pagination: {
        page,
        pageSize,
      },
      payload: 'light',
    },
  });

  try {
    const schema = Joi.object({
      data: Joi.array().items(chatMessageSchema).required(),
      meta: Joi.object({
        pagination: Joi.object({
          page: Joi.number().required(),
          pageCount: Joi.number().required(),
          pageSize: Joi.number().required(),
          total: Joi.number().required(),
        }).required(),
      }).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult;
  } catch (error) {
    const rawData = Array.isArray(response?.data?.data) ? response.data.data : [];
    const rawPagination = response?.data?.meta?.pagination || {};
    chatServiceLogger.warn('Chat messages schema mismatch, using fallback payload', {
      chatId,
      error: error?.message || error,
      length: rawData.length,
      page,
    });
    return {
      data: rawData,
      meta: {
        pagination: {
          page: Number(rawPagination.page || page || 1),
          pageCount: Number(rawPagination.pageCount || 1),
          pageSize: Number(rawPagination.pageSize || pageSize || rawData.length || 0),
          total: Number(rawPagination.total || rawData.length),
        },
      },
    };
  }
};

/**
 * Create a new chat message
 * @param {object} params
 * @param {string} params.chatId - The chat id
 * @param {string} [params.message] - The message text
 * @param {object} [params.event] - The event object (optional)
 * @param {object} [params.composition] - The composition object (optional)
 * @param {Array<{ id?: number; documentId?: string }>} [params.attachments] - Attachments relation payload
 * @param {{ documentId?: string; id?: string | number } | null} [params.replyTo] - Reply target
 * @returns {Promise<ChatMessage>}
 */
export const createChatMessage = async ({
  attachments,
  chatId,
  composition,
  event,
  message,
  replyTo,
}) => {
  const response = await client.post('/chat-messages', {
    data: {
      attachments,
      chat: chatId,
      composition,
      event,
      message: message || '',
      replyTo,
    },
  });

  emitGuidanceAction('message.sent', {
    chatId,
  });
  return response.data;
};

/**
 * Create a new whisper chat (1to1)
 * @param {string[]} participants - The participant ids
 * @returns {Promise<Chat>}
 */
export const createWhisperChat = async (participants) => {
  const response = await client.post('/chats/whisper', {
    data: {
      participants,
      type: 'whisper',
    },
  });

  try {
    const schema = Joi.object({
      data: Joi.object({ documentId: Joi.string().required() }).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to create chat: ${errorToDisplay}`);
  }
};

/**
 * Create a new club chat (with all trainers and presidents)
 * @param {string} club - The club id
 * @returns {Promise<Chat>}
 */
export const createClubChat = async (club) => {
  const response = await client.post('/chats/club', {
    data: {
      club,
    },
  });

  try {
    const schema = Joi.object({
      data: Joi.object({ documentId: Joi.string().required() }).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to create chat: ${errorToDisplay}`);
  }
};

/**
 * Create a new team chat (with all team members and trainers)
 * @param {string} team - The team id
 * @returns {Promise<Chat>}
 */
export const createTeamChat = async (team) => {
  const response = await client.post('/chats/team', {
    data: {
      team,
    },
  });

  try {
    const schema = Joi.object({
      data: Joi.object({ documentId: Joi.string().required() }).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to create chat: ${errorToDisplay}`);
  }
};

/**
 * Create a new group chat
 * @param {{ groupName: string; participants: string[] }} params
 * @returns {Promise<Chat>}
 */
export const createGroupChat = async ({ groupName, participants }) => {
  const response = await client.post('/chats/group', {
    data: {
      groupName,
      participants,
    },
  });

  try {
    const schema = Joi.object({
      data: Joi.object({ documentId: Joi.string().required() }).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to create group chat: ${errorToDisplay}`);
  }
};

/**
 * Add members to group chat
 * @param {string} chatId
 * @param {string[]} memberIds
 * @returns {Promise<Chat>}
 */
export const addGroupMembers = async (chatId, memberIds) => {
  const response = await client.post(`/chats/${chatId}/group-members`, {
    data: {
      members: memberIds,
    },
  });
  return response.data.data;
};

/**
 * Remove member from group chat
 * @param {string} chatId
 * @param {string} userId
 * @returns {Promise<Chat>}
 */
export const removeGroupMember = async (chatId, userId) => {
  const response = await client.delete(`/chats/${chatId}/group-members/${userId}`);
  return response.data.data;
};

/**
 * Update group metadata
 * @param {string} chatId
 * @param {{ groupName?: string; addAdminIds?: string[]; removeAdminIds?: string[] }} data
 * @returns {Promise<Chat>}
 */
export const updateGroupMeta = async (chatId, data) => {
  const response = await client.patch(`/chats/${chatId}/group-meta`, {
    data,
  });
  return response.data.data;
};

/**
 * Delete a message
 * @param {string} messageId - The message id
 * @returns {Promise<void>}
 */
export const deleteMessage = async (messageId) => {
  await client.delete(`/chat-messages/${messageId}`);
};

/**
 * Pin a chat
 * @param {string} chatId - The chat id
 * @returns {Promise<Chat>}
 */
export const pinChat = async (chatId) => {
  const response = await client.post(`/chats/${chatId}/pin`);
  return response.data;
};

/**
 * Unpin a chat
 * @param {string} chatId - The chat id
 * @returns {Promise<Chat>}
 */
export const unpinChat = async (chatId) => {
  const response = await client.post(`/chats/${chatId}/unpin`);
  return response.data;
};

/**
 * Archive a chat
 * @param {string} chatId - The chat id
 * @returns {Promise<Chat>}
 */
export const archiveChat = async (chatId) => {
  const response = await client.post(`/chats/${chatId}/archive`);
  return response.data;
};

/**
 * Unarchive a chat
 * @param {string} chatId - The chat id
 * @returns {Promise<Chat>}
 */
export const unarchiveChat = async (chatId) => {
  const response = await client.post(`/chats/${chatId}/unarchive`);
  return response.data;
};

/**
 * Edit a chat message with a strict server-side whitelist.
 * @param {string} messageId - The message id
 * @param {{ message?: string; attachments?: Array<{ id?: number; documentId?: string }> }} data
 * @returns {Promise<ChatMessage>} The updated message
 */
export const editMessage = async (messageId, data) => {
  const response = await client.patch(`/chat-messages/${messageId}/edit`, {
    data,
  });
  return response.data.data;
};

/**
 * Vote on a poll message
 * @param {string} messageId
 * @param {string} optionId
 * @returns {Promise<{ success: boolean; chatDocumentId?: string; changed: boolean; composition: any; messageDocumentId: string; updatedAt: string }>}
 */
export const votePollMessage = async (messageId, optionId) => {
  const response = await client.post(`/chat-messages/${messageId}/poll-vote`, {
    optionId,
  });
  return response.data;
};

/**
 * Respond to a proposal message
 * @param {string} messageId
 * @param {'accepted' | 'declined'} status
 * @returns {Promise<{ success: boolean; chatDocumentId?: string; changed: boolean; composition: any; messageDocumentId: string; updatedAt: string }>}
 */
export const respondProposalMessage = async (messageId, status) => {
  const response = await client.post(`/chat-messages/${messageId}/proposal-response`, {
    status,
  });
  return response.data;
};
