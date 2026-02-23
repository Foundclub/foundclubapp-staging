import Joi from 'joi';

import client from '../client';

const teamMembershipRequestSchema = Joi.object({
  documentId: Joi.string().required(),
  state: Joi.string().valid('processed', 'refused', 'pending').required(),
  team: Joi.object().required(),
  user: Joi.object().required(),
}).required();

/**
 * Create a new team membership request
 * @param {{user: string, team: string}} teamMembershipRequestData
 * @returns {Promise<TeamMembershipRequest>} - The created request
 */
export const createTeamMembershipRequest = async (teamMembershipRequestData) => {
  const response = await client.post('/team-membership-requests', {
    data: teamMembershipRequestData,
  });
  return response.data;
};

/**
 * Get team membership requests
 * @param {string|string[]} teamIds - Single teamId or array of teamIds
 * @param {{
 *   page?: number;
 *   pageSize?: number;
 * }} [params]
 * @returns {Promise<{data: TeamMembershipRequest[], meta: {
 * pagination: { page: number; pageSize: number; pageCount: number; total: number; } }}>}
 */
export const getTeamMembershipRequests = async (teamIds, params = {}) => {
  const {
    page,
    pageSize,
  } = params;

  const filters = {
    filters: {
      team: {
        documentId: Array.isArray(teamIds) ? { $in: teamIds } : teamIds,
      },
    },
    pagination: {
      page: page || 1,
      pageSize: pageSize || 10,
    },
    populate: ['user', 'user.avatar', 'team'],
  };

  const response = await client.get('/team-membership-requests', { params: filters });
  try {
    const schema = Joi.object({
      data: Joi.array().items(teamMembershipRequestSchema).empty(Joi.array().length(0)),
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
    throw new Error(`Failed to fetch team membership requests: ${errorToDisplay}`);
  }
};

/**
 * Accept a team membership request
 * @param {string} requestId - The ID of the request to accept
 * @returns {Promise<TeamMembershipRequest>} - The updated request
 */
export const acceptTeamMembershipRequest = async (requestId) => {
  const response = await client.post(`/team-membership-requests/${requestId}/accept`);
  return response.data;
};

/**
 * Reject a team membership request
 * @param {string} requestId - The ID of the request to reject
 * @returns {Promise<TeamMembershipRequest>} - The updated request
 */
export const rejectTeamMembershipRequest = async (requestId) => {
  const response = await client.post(`/team-membership-requests/${requestId}/refuse`);
  return response.data;
};

/**
 * Delete a team membership request
 * @param {string} requestId - The ID of the request to delete
 * @returns {Promise<any>} - The response
 */
export const deleteTeamMembershipRequest = async (requestId) => {
  const response = await client.post(`/team-membership-requests/${requestId}/cancel`);
  return response.data;
};
