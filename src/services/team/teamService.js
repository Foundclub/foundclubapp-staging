import Joi from 'joi';

import { categorySchema } from '../category/categoryService';
import client from '../client';
import { levelSchema } from '../level/levelService';
import { sectionSchema } from '../section/sectionService';

const teamSchema = Joi.object({
  activities: Joi.array().allow(null).optional(),
  category: categorySchema.allow(null).optional(),
  club: Joi.object().allow(null).optional(),
  description: Joi.string().allow('', null).optional(),
  documentId: Joi.string().allow('', null).optional(),
  level: levelSchema.allow(null).optional(),
  name: Joi.string().required(),
  players: Joi.array().allow(null).optional(),
  section: sectionSchema.allow(null).optional(),
  trainers: Joi.array().allow(null).optional(),
}).required();

/**
 * Get teams
 * @param {string} clubId
 * @param {{
 *   page?: number;
 *   pageSize?: number;
 * }} [params]
 * @returns {Promise<{data: Team[], meta: {
 * pagination: { page: number; pageSize: number; pageCount: number; total: number; } }}>}
 */
export const getTeams = async (clubId, params = {}) => {
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
    populate: ['club', 'players', 'trainers', 'activities', 'section', 'category', 'level'],
  };

  const response = await client.get('/teams', { params: filters });
  try {
    const schema = Joi.object({
      data: Joi.array().items(teamSchema).empty(Joi.array().length(0)),
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
    throw new Error(`Failed to fetch teams: ${errorToDisplay}`);
  }
};

/**
 * Get a single team by ID
 * @param {string} teamId
 * @returns {Promise<Team>}
 */
export const getTeamById = async (teamId) => {
  const response = await client.get(`/teams/${teamId}`, {
    params: {
      populate: {
        activities: {
          populate: '*',
        },
        category: {
          populate: '*',
        },
        club: {
          populate: '*',
        },
        level: {
          populate: '*',
        },
        players: {
          populate: '*',
        },
        section: {
          populate: '*',
        },
        trainers: {
          populate: '*',
        },
      },
    },
  });
  try {
    const schema = Joi.object({
      data: teamSchema.required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });

    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch team: ${errorToDisplay}`);
  }
};

/**
 * Create a new team
 * @param {TeamPayload} teamData - The team data to create
 * @returns {Promise<Team>} The created team data
 */
export const createTeam = async (teamData) => {
  const response = await client.post('/teams', {
    data: teamData,
  });
  try {
    const schema = Joi.object({
      data: teamSchema.required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });

    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to create team: ${errorToDisplay}`);
  }
};

/**
 * Update an existing team
 * @param {TeamPayload} teamData - The team data to update
 * @returns {Promise<Team>} The updated team data
 */
export const updateTeam = async (teamData) => {
  const id = teamData.documentId;
  const dataToSend = teamData;
  delete dataToSend.documentId;
  const response = await client.put(`/teams/${id}`, {
    data: dataToSend,
  });
  try {
    const schema = Joi.object({
      data: teamSchema.required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });

    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to update team: ${errorToDisplay}`);
  }
};
