// @ts-nocheck
import Joi from 'joi';

import client from '../client';

export const CLUB_INTEREST_RESPONSE_PRESETS = [
  {
    key: 'thanks',
    label: 'Merci, on revient vers toi',
    message: 'Merci pour ton interet, on revient vers toi rapidement.',
  },
  {
    key: 'trial',
    label: 'Proposer un essai',
    message: 'On peut te proposer un essai, envoie-nous tes disponibilites.',
  },
  {
    key: 'profile',
    label: 'Completer le profil',
    message: 'Peux-tu completer ton profil et preciser ton poste/niveau ?',
  },
  {
    key: 'full',
    label: 'Equipe complete',
    message: "L'equipe est complete pour le moment, on garde ton profil pour la suite.",
  },
];

const clubInterestRequestSchema = Joi.object({
  club: Joi.object().allow(null).optional(),
  createdAt: Joi.string().allow('', null).optional(),
  documentId: Joi.string().required(),
  presetKey: Joi.string().allow('', null).optional(),
  respondedAt: Joi.string().allow('', null).optional(),
  respondedBy: Joi.object().allow(null).optional(),
  responseChat: Joi.object().allow(null).optional(),
  responseText: Joi.string().allow('', null).optional(),
  responseType: Joi.string().valid('preset', 'chat').allow('', null).optional(),
  status: Joi.string().valid('pending', 'responded').required(),
  team: Joi.object().allow(null).optional(),
  user: Joi.object().allow(null).optional(),
}).required();

const paginatedClubInterestRequestsSchema = Joi.object({
  data: Joi.array().items(clubInterestRequestSchema).empty(Joi.array().length(0)),
  meta: Joi.object({
    pagination: Joi.object({
      page: Joi.number().required(),
      pageCount: Joi.number().required(),
      pageSize: Joi.number().required(),
      total: Joi.number().required(),
    }).required(),
  }).required(),
}).required();

const buildInterestRequestPopulate = () => ({
  club: {
    fields: ['documentId', 'name'],
  },
  respondedBy: {
    fields: ['documentId', 'firstname', 'lastname'],
    populate: {
      avatar: {
        fields: ['url'],
      },
    },
  },
  responseChat: {
    fields: ['documentId', 'type'],
  },
  team: {
    fields: ['documentId', 'name'],
    populate: {
      club: {
        fields: ['documentId', 'name'],
      },
      logo: {
        fields: ['url'],
      },
    },
  },
  user: {
    fields: ['documentId', 'firstname', 'lastname', 'username', 'phoneNumber'],
    populate: {
      avatar: {
        fields: ['url'],
      },
    },
  },
});

const validatePaginatedResponse = async (responseData) => {
  const validationResult = await paginatedClubInterestRequestsSchema.validateAsync(responseData, {
    allowUnknown: true,
  });
  return validationResult;
};

const normalizeListParams = ({
  clubId = '',
  includeHistory = false,
  page = 1,
  pageSize = 50,
  teamId = '',
  teamIds = [],
} = {}) => {
  const filters = {};
  const normalizedClubId = String(clubId || '').trim();
  const normalizedTeamId = String(teamId || '').trim();
  const normalizedTeamIds = Array.isArray(teamIds)
    ? [...new Set(teamIds.map((id) => String(id || '').trim()).filter(Boolean))]
    : [];

  if (normalizedClubId) {
    filters.club = { documentId: normalizedClubId };
  }

  if (normalizedTeamId) {
    filters.team = { documentId: normalizedTeamId };
  } else if (normalizedTeamIds.length > 0) {
    filters.team = {
      documentId: normalizedTeamIds.length === 1 ? normalizedTeamIds[0] : { $in: normalizedTeamIds },
    };
  }

  return {
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(includeHistory ? { includeHistory: true } : {}),
    pagination: {
      page,
      pageSize,
    },
    populate: buildInterestRequestPopulate(),
    sort: ['createdAt:desc'],
  };
};

export const createClubInterestRequest = async ({ team }) => {
  const response = await client.post('/club-interest-requests', {
    data: { team },
  });
  return response.data;
};

export const getClubInterestRequests = async (params = {}) => {
  const response = await client.get('/club-interest-requests', {
    params: normalizeListParams(params),
  });
  return validatePaginatedResponse(response.data);
};

export const getMyClubInterestRequests = async (params = {}) => {
  const {
    clubId = '',
    includeHistory = false,
    page = 1,
    pageSize = 100,
    teamId = '',
  } = params;

  const response = await client.get('/club-interest-requests/mine', {
    params: {
      clubId,
      includeHistory,
      pagination: {
        page,
        pageSize,
      },
      populate: buildInterestRequestPopulate(),
      teamId,
    },
  });
  return validatePaginatedResponse(response.data);
};

export const respondClubInterestRequest = async (requestId, responsePayload = {}) => {
  const response = await client.post(`/club-interest-requests/${requestId}/respond`, {
    data: responsePayload,
  });
  return response.data;
};
