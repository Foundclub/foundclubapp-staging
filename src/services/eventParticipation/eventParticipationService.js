import Joi from 'joi';

import client from '../client';

export const eventParticipationSchema = Joi.object({
  documentId: Joi.string().required(),
  event: Joi.object().required(),
  participationStatus: Joi.string().valid('pending', 'accepted', 'declined', 'missing').required(),
  isActive: Joi.boolean().allow(null).optional(),
  reason: Joi.string().allow('', null),
  sourceTeam: Joi.object({
    documentId: Joi.string().allow(null).optional(),
    name: Joi.string().allow('', null).optional(),
  }).allow(null).optional(),
  user: Joi.object().required(),
}).required();

/**
 * Create a new event participation request
 * @param {{user: string, event: string, reason?: string}} eventParticipationData
 * @returns {Promise<EventParticipation>} - The created request
 */
export const createEventParticipation = async (eventParticipationData) => {
  const response = await client.post('/event-participations', {
    data: eventParticipationData,
  });
  return response.data;
};

/**
 * Get event participation requests
 * @param {string} eventId
 * @param {string} [userId]
 * @param {{
 *   page?: number;
 *   pageSize?: number;
 * }} [params]
 * @returns {Promise<{data: EventParticipation[], meta: {
 * pagination: { page: number; pageSize: number; pageCount: number; total: number; } }}>}
 */
export const getEventParticipations = async (eventId, userId, params = {}) => {
  const {
    page,
    pageSize,
  } = params;

  const filters = {
    filters: {
      event: {
        documentId: eventId,
      },
      user: userId ? {
        documentId: { $eq: userId },
      } : undefined,
      $or: [
        { isActive: true },
        { isActive: { $null: true } },
      ],
    },
    pagination: {
      page: page || 1,
      pageSize: pageSize || 10,
    },
    populate: ['user', 'event', 'sourceTeam'],
  };

  const response = await client.get('/event-participations', { params: filters });
  try {
    const schema = Joi.object({
      data: Joi.array().items(eventParticipationSchema).empty(Joi.array().length(0)),
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
    throw new Error(`Failed to fetch event participation requests: ${errorToDisplay}`);
  }
};

/**
 * Accept an event participation request
 * @param {string} requestId - The ID of the request to accept
 * @returns {Promise<EventParticipation>} - The updated request
 */
export const acceptEventParticipation = async (requestId) => {
  const response = await client.post(`/event-participations/${requestId}/accept`);
  return response.data;
};

/**
 * Decline an event participation request
 * @param {object} param - The ID of the request to decline
 * @param {string} param.requestId - The ID of the request to decline
 * @param {string} [param.reason] - The reason for declining the request
 * @returns {Promise<EventParticipation>} - The updated request
 */
export const declineEventParticipation = async ({ reason, requestId }) => {
  const response = await client.post(`/event-participations/${requestId}/refuse`, { data: { reason } });
  return response.data;
};

/**
 * Delete an event participation
 * @param {string} requestId - The ID of the participation to delete
 * @returns {Promise<void>}
 */
export const deleteEventParticipation = async (requestId) => {
  await client.delete(`/event-participations/${requestId}`);
};
