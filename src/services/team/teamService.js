import Joi from 'joi';

import { celebrate } from '@/services/celebrations/celebrationRuntime';

import client from '../client';

const buildClubFilter = (clubId, useLegacyId = false) => {
  if (!clubId) return undefined;

  if (!useLegacyId) {
    return {
      documentId: clubId,
    };
  }

  const numericClubId = Number(clubId);
  return {
    id: Number.isFinite(numericClubId) ? numericClubId : clubId,
  };
};

const buildClubFilters = ({
  clubId,
  clubIds,
  parentMultisportId,
  useLegacyClubId = false,
}) => {
  const normalizedClubIds = Array.isArray(clubIds)
    ? clubIds.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  if (normalizedClubIds.length > 0) {
    return {
      documentId: {
        $in: normalizedClubIds,
      },
    };
  }

  const normalizedParentMultisportId = String(parentMultisportId || '').trim();
  if (normalizedParentMultisportId) {
    return {
      parentMultisport: {
        documentId: {
          $eq: normalizedParentMultisportId,
        },
      },
    };
  }

  return buildClubFilter(clubId, useLegacyClubId);
};

const normalizeTeamGovernanceSettings = (team) => {
  if (!team || typeof team !== 'object') {
    return team;
  }

  let teamMembershipApprovalEnabledForCoaches = true;
  if (typeof team.teamMembershipApprovalEnabledForCoaches === 'boolean') {
    teamMembershipApprovalEnabledForCoaches = team.teamMembershipApprovalEnabledForCoaches;
  } else if (typeof team.teamMembershipApprovalEnabledForCoaches === 'string') {
    const normalized = team.teamMembershipApprovalEnabledForCoaches.trim().toLowerCase();
    if (normalized === 'false') {
      teamMembershipApprovalEnabledForCoaches = false;
    }
  }

  return {
    ...team,
    authorizedMembershipManagers: Array.isArray(team.authorizedMembershipManagers)
      ? team.authorizedMembershipManagers
      : [],
    teamMembershipApprovalEnabledForCoaches,
  };
};

const teamSchema = Joi.object({
  activities: Joi.any().allow(null).optional(), // Relaxed validation for Strapi v5 connect syntax
  authorizedMembershipManagers: Joi.any().allow(null).optional(),
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
  teamMembershipApprovalEnabledForCoaches: Joi.boolean().optional(),
  trainers: Joi.any().allow(null).optional(),
}).required();

/**
 * Get teams
 * @param {{
 *   page?: number;
 *   pageSize?: number;
 *   clubId?: string;
 *   clubIds?: string[];
 *   parentMultisportId?: string;
 *   name?: string;
 *   level?: string[];
 *   section?: string;
 *   category?: string[];
 *   activities?: string;
 *   summary?: boolean;
 *   teamIds?: string[];
 * }} [params]
 * @returns {Promise<{data: Team[], meta: {
 * pagination: { page: number; pageSize: number; pageCount: number; total: number; } }}>}
 */
export const getTeams = async (params = {}) => {
  const {
    activities,
    category,
    clubId,
    clubIds,
    level,
    name,
    page,
    pageSize,
    parentMultisportId,
    section,
    summary = false,
    teamIds,
  } = params;

  // Strapi rejects relation filters on `players` / `trainers` here.
  // We keep "Mes équipes" filtering client-side from the populated team payload.

  // U03 — demander SES equipes nommement, par leurs identifiants. C'est la seule
  // forme que le serveur accepte sans modification : Strapi garde explicitement
  // `documentId` dans les filtres d'une liste (verifie dans le paquet installe,
  // `@strapi/utils/dist/sanitize/sanitizers.js:44-49`), la ou il jette toute
  // clef qui n'est pas un attribut.
  const normalizedTeamIds = Array.isArray(teamIds)
    ? teamIds.map((value) => String(value || '').trim()).filter(Boolean)
    : null;

  // 🚨 Une selection VIDE est une REPONSE, pas une absence : elle veut dire
  // « ce compte n'a aucune equipe ». La laisser tomber dans `buildRequestParams`
  // produirait une requete SANS AUCUN filtre — c'est-a-dire la table entiere,
  // dix lignes par page. On rend donc la page vide sur place, sans reseau.
  if (normalizedTeamIds && normalizedTeamIds.length === 0) {
    return {
      data: [],
      meta: {
        pagination: {
          page: page || 1,
          pageCount: 0,
          pageSize: pageSize || 10,
          total: 0,
        },
      },
    };
  }

  try {
    const populate = summary ? {
      activities: {
        fields: ['documentId', 'name'],
      },
      category: {
        fields: ['documentId', 'name'],
      },
      club: {
        fields: ['documentId', 'name'],
        populate: {
          logo: {
            fields: ['url'],
          },
          sponsor: {
            fields: ['link', 'title'],
            populate: {
              logo: {
                fields: ['url'],
              },
            },
          },
        },
      },
      level: {
        fields: ['documentId', 'name'],
      },
      players: {
        fields: ['documentId'],
      },
      section: {
        fields: ['documentId', 'name'],
      },
      trainers: {
        fields: ['documentId'],
      },
    } : {
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
    };

    const buildRequestParams = (useLegacyClubId = false) => ({
      filters: {
        activities: activities ? {
          documentId: activities,
        } : undefined,
        category: category?.length ? {
          documentId: {
            $in: category,
          },
        } : undefined,
        club: buildClubFilters({
          clubId,
          clubIds,
          parentMultisportId,
          useLegacyClubId,
        }),
        documentId: normalizedTeamIds ? {
          $in: normalizedTeamIds,
        } : undefined,
        level: level?.length ? {
          documentId: {
            $in: level,
          },
        } : undefined,
        name: name ? {
          $containsi: name,
        } : undefined,
        section: section ? {
          documentId: section,
        } : undefined,
      },
      pagination: {
        page: page || 1,
        pageSize: pageSize || 10,
      },
      populate,
    });

    const validateResponse = async (response) => {
      const normalizedData = Array.isArray(response.data?.data)
        ? response.data.data.map(normalizeTeamGovernanceSettings)
        : response.data?.data;
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

      return schema.validateAsync({
        ...response.data,
        data: normalizedData,
      }, {
        allowUnknown: true,
      });
    };

    const primaryResponse = await client.get('/teams', { params: buildRequestParams(false) });
    let validationResult = await validateResponse(primaryResponse);

    if (
      clubId
      && Array.isArray(validationResult?.data)
      && validationResult.data.length === 0
    ) {
      const legacyResponse = await client.get('/teams', { params: buildRequestParams(true) });
      validationResult = await validateResponse(legacyResponse);
    }

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
        authorizedMembershipManagers: {
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
        externalConfigUpdatedBy: {
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
    const normalizedData = normalizeTeamGovernanceSettings(response.data?.data);
    const schema = Joi.object({
      data: teamSchema.required(),
    }).required();

    const validationResult = await schema.validateAsync({
      ...response.data,
      data: normalizedData,
    }, {
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

    celebrate('team_created', {
      teamId: validationResult?.data?.documentId,
      teamName: validationResult?.data?.name || teamData?.name,
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
 * Reprendre une équipe orpheline (sans entraîneur actif) en tant que coach.
 * @param {string} teamId
 * @returns {Promise<object>}
 */
export const claimTeamAsCoach = async (teamId) => {
  const response = await client.post(`/teams/${teamId}/claim-coach`);
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
 * @param {'team-candidates' | 'full'} [mode]
 * @returns {Promise<object>}
 */
export const previewExternalCompetition = async (teamId, url, mode = 'team-candidates') => {
  const response = await client.post(
    `/teams/${teamId}/external-competition/preview`,
    { mode, url },
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
