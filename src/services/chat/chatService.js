import Joi from 'joi';

import client from '../client';

const chatMessageSchema = Joi.object({
  createdAt: Joi.date().required(),
  documentId: Joi.string().required(),
  message: Joi.string().required(),
  sender: Joi.object().required(),
  updatedAt: Joi.date().required(),
}).required();

const chatSchema = Joi.object({
  createdAt: Joi.date().required(),
  documentId: Joi.string().required(),
  messages: Joi.alternatives().try(
    Joi.array().items(chatMessageSchema),
    Joi.array().length(0),
  ).optional(),
  participants: Joi.array().items(Joi.object()).required(),
  type: Joi.string().valid('whisper', 'club', 'team').required(),
  updatedAt: Joi.date().required(),
}).required();

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
  const response = await client.get('/chats', {
    params: {
      filters: {
        $or: [
          // Get whisper chats where current user is a participant
          filters.currentUserId ? {
            participants: {
              documentId: filters.currentUserId,
            },
            type: 'whisper',
          } : null,
          // Get whisper chats related to user's club
          filters.currentUserClubId ? {
            club: {
              documentId: filters.currentUserClubId,
            },
            type: 'whisper',
          } : null,
          // Get whisper chats related to user's teams' clubs
          ...(filters.currentUserTeamIds?.map((teamId) => ({
            team: {
              documentId: teamId,
            },
            type: 'whisper',
          })) || []),
          // Get team chats where user's teams are involved
          ...(filters.currentUserTeamIds?.map((teamId) => ({
            team: {
              documentId: teamId,
            },
            type: 'team',
          })) || []),
        ].filter(Boolean),
      },
      pagination: {
        page,
        pageSize,
      },
      populate: {
        club: {
          populate: '*',
        },
        messages: {
          populate: ['sender', 'sender.avatar'],
          sort: ['createdAt:desc'],
        },
        participants: {
          populate: ['avatar'],
        },
        team: {
          populate: '*',
        },
      },
      sort: [
        // Sort by type to get clubs first, then teams, then whispers
        'type:asc',
        // Then sort by most recent message
        'updatedAt:desc',
      ],
    },
  });

  try {
    const schema = Joi.object({
      data: Joi.array().items(chatSchema).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });
    return validationResult;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch chats: ${errorToDisplay}`);
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
        club: {
          populate: '*',
        },
        messages: {
          populate: ['sender', 'sender.avatar'],
          sort: ['createdAt:desc'],
        },
        participants: {
          populate: ['avatar'],
        },
        team: {
          populate: '*',
        },
      },
    },
  });

  try {
    const schema = Joi.object({
      data: chatSchema.required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
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
        chat: {
          populate: ['participants'],
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
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch messages: ${errorToDisplay}`);
  }
};

/**
 * Create a new chat message
 * @param {object} params - The chat id
 * @param {string} params.chatId - The chat id
 * @param {string} params.message - The message text
 * @returns {Promise<ChatMessage>}
 */
export const createChatMessage = async ({ chatId, message }) => {
  const response = await client.post('/chat-messages', {
    data: {
      chat: chatId,
      message,
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
