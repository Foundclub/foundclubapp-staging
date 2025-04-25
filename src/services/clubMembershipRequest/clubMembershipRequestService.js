import Joi from 'joi';

import client from '../client';

const clubMembershipRequestSchema = Joi.object({
  club: Joi.string().required(),
  documentId: Joi.string().required(),
  state: Joi.string().valid('processed', 'refused', 'pending').required(),
  user: Joi.object().required(),
}).required();
/**
 * Create a new club membership request
 * @param {{user: string, club: string}} clubMembershipRequestData
 * @returns {Promise<ClubMembershipRequest>} - The created request
 */
export const createClubMembershipRequest = async (clubMembershipRequestData) => {
  const response = await client.post('/club-membership-requests', {
    data: clubMembershipRequestData,
  });
  return response.data;
};

/**
 * Get club membership requests
 * @param {string} clubId
 * @param {{
 *   page?: number;
 *   pageSize?: number;
 * }} [params]
 * @returns {Promise<{data: ClubMembershipRequest[], meta: {
 * pagination: { page: number; pageSize: number; pageCount: number; total: number; } }}>}
 */
export const getClubMembershipRequests = async (clubId, params = {}) => {
  const {
    page,
    pageSize,
  } = params;

  const filters = {
    filters: {
      club: {
        documentId: clubId,
      },
    },
    pagination: {
      page: page || 1,
      pageSize: pageSize || 10,
    },
    populate: ['user'],
  };

  const response = await client.get('/club-membership-requests', { params: filters });
  try {
    const schema = Joi.object({
      data: Joi.array().items(clubMembershipRequestSchema).empty(Joi.array().length(0)),
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
    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch club membership requests: ${errorToDisplay}`);
  }
};

/**
 * Accept a club membership request
 * @param {string} requestId - The ID of the request to accept
 * @returns {Promise<ClubMembershipRequest>} - The updated request
 */
export const acceptClubMembershipRequest = async (requestId) => {
  const response = await client.post(`/club-membership-requests/${requestId}/accept`);
  return response.data;
};

/**
 * Reject a club membership request
 * @param {string} requestId - The ID of the request to reject
 * @returns {Promise<ClubMembershipRequest>} - The updated request
 */
export const rejectClubMembershipRequest = async (requestId) => {
  const response = await client.post(`/club-membership-requests/${requestId}/refuse`);
  return response.data;
};
