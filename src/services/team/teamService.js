import Joi from 'joi';

import client from '../client';

const teamSchema = Joi.object({
  activities: Joi.any().allow(null).optional(), // Relaxed validation for Strapi v5 connect syntax
  category: Joi.any().allow(null).optional(),
  club: Joi.any().allow(null).optional(),
  description: Joi.string().allow('', null).optional(),
  documentId: Joi.string().allow('', null).optional(),
  externalCalendarData: Joi.array().allow(null).optional(),
  externalDataLastUpdate: Joi.string().allow('', null).optional(),
  externalLastSyncReport: Joi.object().allow(null).optional(),
  externalStandingData: Joi.array().allow(null).optional(),
  externalStandingUrl: Joi.string().allow('', null).optional(),
  level: Joi.any().allow(null).optional(),
  name: Joi.string().required(),
  players: Joi.any().allow(null).optional(),
  section: Joi.any().allow(null).optional(),
  trainers: Joi.any().allow(null).optional(),
}).required();

/**
 * Get teams
 * @param {{
 *   page?: number;
 *   pageSize?: number;
 *   clubId?: string;
 *   playerId?: string;
 *   name?: string;
 *   level?: string[];
 *   section?: string;
 *   category?: string[];
 *   activities?: string;
 * }} [params]
 * @returns {Promise<{data: Team[], meta: {
 * pagination: { page: number; pageSize: number; pageCount: number; total: number; } }}>}
 */
export const getTeams = async (params = {}) => {
  const {
    activities,
    category,
    clubId,
    level,
    name,
    page,
    pageSize,
    section,
  } = params;

  const filters = {
    filters: {
      activities: activities ? {
        documentId: activities,
      } : undefined,
      category: category?.length ? {
        documentId: {
          $in: category,
        },
      } : undefined,
      club: clubId ? {
        documentId: clubId,
      } : undefined,
      level: level?.length ? {
        documentId: {
          $in: level,
        },
      } : undefined,
      name: name ? {
        $containsi: name,
      } : undefined,
      players: params.playerId ? {
        documentId: {
          $eq: params.playerId,
        },
      } : undefined,
      section: section ? {
        documentId: section,
      } : undefined,
    },
    pagination: {
      page: page || 1,
      pageSize: pageSize || 10,
    },
    populate: {
      activities: true,
      category: true,
      club: {
        populate: {
          logo: true,
          sponsor: {
            populate: {
              logo: true,
            },
          },
        },
      },
      level: true,
      players: true,
      section: true,
      trainers: true,
    },
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
          populate: {
            logo: true,
            sponsor: {
              populate: 'logo',
            },
          },
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
        slots: {
          populate: {
            participants: true,
          },
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
 * Get the default composition template for a team.
 * @param {string} teamId
 * @returns {Promise<{composition: Record<string, any> | null, team?: {documentId?: string, name?: string}}>}
 */
export const getTeamDefaultComposition = async (teamId) => {
  const response = await client.get(`/teams/${teamId}/default-composition`);
  return response?.data?.data || response?.data;
};

/**
 * Save the default composition template for a team.
 * @param {string} teamId
 * @param {{ composition: Record<string, any> }} payload
 * @returns {Promise<{composition: Record<string, any> | null, team?: {documentId?: string, name?: string}}>}
 */
export const saveTeamDefaultComposition = async (teamId, payload) => {
  const response = await client.put(`/teams/${teamId}/default-composition`, {
    data: {
      composition: payload?.composition || {},
    },
  });
  return response?.data?.data || response?.data;
};

/**
 * Delete the default composition template for a team.
 * @param {string} teamId
 * @returns {Promise<{composition: null, team?: {documentId?: string, name?: string}}>}
 */
export const deleteTeamDefaultComposition = async (teamId) => {
  const response = await client.delete(`/teams/${teamId}/default-composition`);
  return response?.data?.data || response?.data;
};

/**
 * @typedef {object} StrapiRelationConnect
 * @property {{ documentId: string }[]} connect - Array of document IDs to connect
 */

/**
 * @typedef {object} TeamPayload
 * @property {string} name - Team name (required)
 * @property {string[]|StrapiRelationConnect} [activities] - Activity document IDs (array or connect format)
 * @property {string|StrapiRelationConnect} [level] - Level document ID (string or connect format)
 * @property {string|StrapiRelationConnect} [section] - Section document ID
 * @property {string|StrapiRelationConnect} [category] - Category document ID
 * @property {string} [club] - Club document ID
 * @property {string} [city] - City name
 * @property {object} [address] - Address object
 * @property {boolean} [isLeague] - Whether this is a League team
 * @property {string[]|StrapiRelationConnect} [trainers] - Trainer IDs (array or connect format)
 * @property {string[]|StrapiRelationConnect} [players] - Player IDs (array or connect format)
 * @property {string} [description] - Team description
 * @property {string} [documentId] - Document ID (for updates)
 * @property {object} [logo] - Logo file object
 * @property {object} [cover] - Cover file object
 */

/**
 * Create a new team
 * @param {TeamPayload} teamData - The team data to create
 * @returns {Promise<{data: object}>} The created team data
 */
export const createTeam = async (teamData) => {
  // Check if we need to upload files (logo or cover)
  const hasFiles = teamData.logo || teamData.cover;

  let response;

  if (hasFiles) {
    const formData = new FormData();

    // Separate files from data
    const { cover, logo, ...data } = teamData;

    // Append data as JSON string
    formData.append('data', JSON.stringify(data));

    // Append files if they exist
    if (logo) {
      const logoFile = /** @type {{ uri?: string; filename?: string; mime?: string }} */ (logo);
      // @ts-expect-error - React Native FormData accepts file descriptor objects.
      formData.append('files.logo', {
        name: logoFile.filename || 'logo.jpg',
        type: logoFile.mime || 'image/jpeg',
        uri: logoFile.uri || '',
      });
    }

    if (cover) {
      const coverFile = /** @type {{ uri?: string; filename?: string; mime?: string }} */ (cover);
      // @ts-expect-error - React Native FormData accepts file descriptor objects.
      formData.append('files.cover', {
        name: coverFile.filename || 'cover.jpg',
        type: coverFile.mime || 'image/jpeg',
        uri: coverFile.uri || '',
      });
    }

    response = await client.post('/teams', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  } else {
    // Standard JSON request
    response = await client.post('/teams', {
      data: teamData,
    });
  }

  try {
    // Note: When using FormData, response structure might differ slightly or validation needs to be loose
    // The returned structure from Strapi is usually the same { data: ... }
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

  // Check if we need to upload files (logo or cover)
  const hasFiles = teamData.logo || teamData.cover;

  let response;

  if (hasFiles) {
    const formData = new FormData();

    // Separate files and documentId from data
    const {
      cover, documentId, logo, ...data
    } = teamData;

    // Append data as JSON string
    formData.append('data', JSON.stringify(data));

    // Append files if they exist
    if (logo) {
      const logoFile = /** @type {{ uri?: string; filename?: string; mime?: string }} */ (logo);
      // @ts-expect-error - React Native FormData accepts file descriptor objects.
      formData.append('files.logo', {
        name: logoFile.filename || 'logo.jpg',
        type: logoFile.mime || 'image/jpeg',
        uri: logoFile.uri || '',
      });
    }

    if (cover) {
      const coverFile = /** @type {{ uri?: string; filename?: string; mime?: string }} */ (cover);
      // @ts-expect-error - React Native FormData accepts file descriptor objects.
      formData.append('files.cover', {
        name: coverFile.filename || 'cover.jpg',
        type: coverFile.mime || 'image/jpeg',
        uri: coverFile.uri || '',
      });
    }

    response = await client.put(`/teams/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  } else {
    // Standard JSON request
    const dataToSend = { ...teamData };
    delete dataToSend.documentId;

    response = await client.put(`/teams/${id}`, {
      data: dataToSend,
    });
  }

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

/**
 * Delete a team
 * @param {string} teamId
 * @returns {Promise<object>}
 */
export const deleteTeam = async (teamId) => {
  const response = await client.delete(`/teams/${teamId}`);
  return response.data;
};

/**
 * Leave a team
 * @param {string} teamId
 * @returns {Promise<object>}
 */
export const leaveTeam = async (teamId) => {
  const response = await client.post(`/teams/${teamId}/quit`);
  return response.data;
};

/**
 * Remove a player from a team
 * @param {string} teamId
 * @param {string} playerId
 * @returns {Promise<object>}
 */
export const removePlayerFromTeam = async (teamId, playerId) => {
  const response = await client.put(`/teams/${teamId}/remove-player`, {
    data: { playerId },
  });
  return response.data;
};

/**
 * Preview external competition data (provider auto-detection: FFF/FFBB)
 * @param {string} teamId
 * @param {string} url
 * @returns {Promise<object>}
 */
export const previewExternalCompetition = async (teamId, url) => {
  const response = await client.post(
    `/teams/${teamId}/external-competition/preview`,
    { url },
    { timeout: 45000 },
  );
  return response.data;
};

/**
 * Connect external competition source to a team.
 * @param {string} teamId
 * @param {string} url
 * @param {{ externalTeamId?: string | null, externalTeamName?: string | null }} [selectedTeam]
 * @returns {Promise<object>}
 */
export const connectExternalCompetition = async (teamId, url, selectedTeam) => {
  const payload = {
    url,
    ...(selectedTeam ? { selectedTeam } : {}),
  };
  const response = await client.post(
    `/teams/${teamId}/external-competition/connect`,
    payload,
    { timeout: 45000 },
  );
  return response.data;
};

/**
 * Refresh external competition data for a team.
 * @param {string} teamId
 * @returns {Promise<object>}
 */
export const refreshExternalCompetition = async (teamId) => {
  const response = await client.post(
    `/teams/${teamId}/external-competition/refresh`,
    null,
    { timeout: 45000 },
  );
  return response.data;
};

/**
 * Get external competition sync status for a team.
 * @param {string} teamId
 * @returns {Promise<object>}
 */
export const getExternalCompetitionStatus = async (teamId) => {
  const response = await client.get(`/teams/${teamId}/external-competition/status`);
  return response.data;
};

/**
 * Legacy wrapper.
 * @param {string} url
 * @returns {Promise<object>}
 */
export const previewScraping = async (url) => {
  const response = await client.post('/teams/preview-scraping', { url });
  return response.data;
};

/**
 * Legacy wrapper.
 * @param {string} teamId
 * @returns {Promise<object>}
 */
export const refreshTeamScraping = async (teamId) => refreshExternalCompetition(teamId);

/**
 * Set FFBB URL for a team and get list of teams in poule
 * @param {string} teamId
 * @param {string} url
 * @returns {Promise<{success: boolean, pouleName: string, teams: Array<{teamId: string, teamName: string}>}>}
 */
export const setTeamFFBBUrl = async (teamId, url) => {
  const response = await client.post(`/teams/${teamId}/set-ffbb-url`, { url });
  return response.data;
};

/**
 * Select which FFBB team corresponds to this FoundClub team
 * @param {string} teamId
 * @param {string} ffbbTeamId
 * @param {string} ffbbTeamName
 * @returns {Promise<{success: boolean}>}
 */
export const selectTeamFFBBTeam = async (teamId, ffbbTeamId, ffbbTeamName) => {
  const response = await client.post(`/teams/${teamId}/select-ffbb-team`, {
    teamId: ffbbTeamId,
    teamName: ffbbTeamName,
  });
  return response.data;
};

/**
 * Create an FFBB error report
 * @param {{teamId: string, problemType: string, description?: string}} data
 * @returns {Promise<{success: boolean}>}
 */
export const createFFBBErrorReport = async ({ description, problemType, teamId }) => {
  const response = await client.post('/ffbb-error-reports', {
    data: {
      description: description || '',
      problemType,
      team: teamId,
    },
  });
  return response.data;
};
