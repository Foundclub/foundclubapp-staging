import Joi from 'joi';

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
  sender: Joi.object().required(),
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
  participants: Joi.array().items(Joi.object()).required(),
  pinnedBy: Joi.array().items(Joi.object()).optional(),
  type: Joi.string().valid('whisper', 'club', 'team', 'multisport', 'league_match', 'group').required(),
  updatedAt: Joi.date().required(),
}).required();

const chatListPopulate = {
  archivedBy: {
    fields: ['documentId'],
  },
  club: {
    fields: ['documentId', 'name'],
    populate: {
      logo: {
        fields: ['url'],
      },
    },
  },
  league_match: {
    fields: ['documentId', 'date'],
  },
  messages: {
    fields: ['documentId', 'message', 'createdAt', 'updatedAt', 'composition'],
    populate: {
      attachments: {
        fields: ['documentId', 'mime', 'name'],
      },
      sender: {
        fields: ['documentId', 'firstname', 'lastname'],
        populate: {
          avatar: {
            fields: ['url'],
          },
        },
      },
    },
    sort: ['createdAt:desc'],
  },
  multisportClub: {
    fields: ['documentId', 'name'],
    populate: {
      admins: {
        fields: ['documentId'],
      },
      logo: {
        fields: ['url'],
      },
    },
  },
  participants: {
    fields: ['documentId', 'firstname', 'lastname'],
    populate: {
      avatar: {
        fields: ['url'],
      },
    },
  },
  pinnedBy: {
    fields: ['documentId'],
  },
  team: {
    fields: ['documentId', 'name'],
    populate: {
      logo: {
        fields: ['url'],
      },
    },
  },
};

/**
 * Get all chats for the current user
 * @param {number} [page] - The page number
 * @param {number} [pageSize] - The page size
 * @param {{
 *   currentUserId?: string;
 *   currentUserClubId?: string;
 *   currentUserTeamIds?: string[];
 * }} [filters] - Optional filters for the chats
 * @returns {Promise<{data: Chat[],
 * meta: { pagination: { page: number, pageCount: number, total: number }}}>}
 */
export const getChats = async (page = 1, pageSize = 20, filters = {}) => {
  const safeTeamIds = Array.isArray(filters.currentUserTeamIds)
    ? Array.from(
      new Set(
        filters.currentUserTeamIds
          .map((teamId) => String(teamId || '').trim())
          .filter(Boolean),
      ),
    )
    : [];

  /** @type {Array<Record<string, any>>} */
  const chatOrFilters = [];

  if (filters.currentUserId) {
    chatOrFilters.push({
      participants: {
        documentId: filters.currentUserId,
      },
      type: 'whisper',
    });
  }

  if (filters.currentUserClubId) {
    chatOrFilters.push({
      club: {
        documentId: filters.currentUserClubId,
      },
      type: 'whisper',
    });
  }

  if (safeTeamIds.length > 0) {
    // Compact form: one filter for both whisper and team chats tied to any of my teams.
    chatOrFilters.push({
      team: {
        documentId: {
          $in: safeTeamIds,
        },
      },
      type: {
        $in: ['whisper', 'team'],
      },
    });
  }

  if (filters.currentUserId) {
    chatOrFilters.push({
      participants: {
        documentId: filters.currentUserId,
      },
      type: 'league_match',
    });
  }

  const response = await client.get('/chats', {
    params: {
      filters: {
        $or: chatOrFilters,
      },
      pagination: {
        page,
        pageSize,
      },
      populate: chatListPopulate,
      sort: [
        // Sort by type: league_match(l) > ...
        // We will rely on updatedAt primarily, but could prioritize types if needed.
        // For now sticking to simple sort, frontend does the grouping/sorting.
        'updatedAt:desc',
      ],
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
    return {
      data: rawData,
      meta: {
        pagination: {
          page: Number(rawPagination.page || page || 1),
          pageCount: Number(rawPagination.pageCount || 1),
          total: Number(rawPagination.total || rawData.length),
        },
      },
    };
  }
};

/**
 * Get a chat by id
 * @param {string} chatId - The chat id
 * @returns {Promise<Chat>}
 */
export const getChatById = async (chatId) => {
  const response = await client.get(`/chats/${chatId}`, {
    params: {
      chat: chatId,
      populate: {
        archivedBy: {
          populate: ['avatar'],
        },
        club: {
          populate: {
            logo: true,
          },
        },
        groupAdmins: {
          populate: ['avatar'],
        },
        league_match: {
          populate: {
            team_a: { populate: ['captain'] },
            team_b: { populate: ['captain'] },
            winner: true,
          },
        },
        messages: {
          populate: ['sender', 'sender.avatar', 'attachments', 'replyTo', 'replyTo.sender', 'replyTo.sender.avatar', 'event'],
          sort: ['createdAt:desc'],
        },
        multisportClub: {
          populate: {
            admins: true,
            logo: true,
          },
        },
        participants: {
          populate: ['avatar'],
        },
        pinnedBy: {
          populate: ['avatar'],
        },
        team: {
          populate: true,
        },
      },
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
            team_a: { populate: ['captain'] },
            team_b: { populate: ['captain'] },
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
      filters: {
        chat: {
          documentId: {
            $eq: chatId,
          },
        },
      },
      pagination: {
        page,
        pageSize,
      },
      populate: {
        attachments: true,
        chat: {
          populate: ['participants'],
        },
        event: {
          populate: ['facility', 'league_match', 'league_match.team_a', 'league_match.team_b'],
        },
        replyTo: {
          populate: ['sender', 'sender.avatar'],
        },
        sender: {
          populate: ['avatar'],
        },
      },
      sort: ['createdAt:desc'],
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
 * @returns {Promise<{ success: boolean; changed: boolean; composition: any; messageDocumentId: string; updatedAt: string }>}
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
 * @returns {Promise<{ success: boolean; changed: boolean; composition: any; messageDocumentId: string; updatedAt: string }>}
 */
export const respondProposalMessage = async (messageId, status) => {
  const response = await client.post(`/chat-messages/${messageId}/proposal-response`, {
    status,
  });
  return response.data;
};
