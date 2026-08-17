import Joi from 'joi';

import { celebrate } from '@/services/celebrations/celebrationRuntime';

import { createLogger } from '@/utils/logger/logger';

import client from '../client';

const clubMembershipRequestLogger = createLogger('club-membership-request');

const clubMembershipRequestSchema = Joi.object({
  club: Joi.object().required(),
  documentId: Joi.string().required(),
  requester: Joi.object().unknown(true).optional(),
  requesterDisplayName: Joi.string().allow('', null).optional(),
  requesterFirstname: Joi.string().allow('', null).optional(),
  requesterLastname: Joi.string().allow('', null).optional(),
  state: Joi.string().valid('processed', 'refused', 'pending').required(),
  type: Joi.string().valid('join', 'claim').allow('', null).optional(),
  user: Joi.alternatives().try(
    Joi.object().unknown(true),
    Joi.string(),
    Joi.number(),
    Joi.valid(null),
  ).optional(),
}).required();

const toFlatUser = (user) => {
  if (!user) return null;

  if (typeof user === 'object' && user?.data && typeof user.data === 'object') {
    const nested = user.data;
    const attrs = nested.attributes && typeof nested.attributes === 'object'
      ? nested.attributes
      : {};

    return {
      ...attrs,
      ...nested,
      avatar: nested.avatar || attrs.avatar || null,
      documentId: nested.documentId || attrs.documentId,
      id: nested.id || attrs.id,
    };
  }

  if (typeof user === 'object') {
    return user;
  }

  return null;
};

const clubMembershipRequestsMetaSchema = Joi.object({
  pagination: Joi.object({
    page: Joi.number().required(),
    pageCount: Joi.number().required(),
    pageSize: Joi.number().required(),
    total: Joi.number().required(),
  }).required(),
}).required();

/**
 * S01 — la validation se fait LIGNE PAR LIGNE, jamais sur le lot entier.
 *
 * `club` est nullable cote serveur : une demande dont le club a disparu faisait
 * tomber TOUTE la section « Club » de l'ecran « Demandes », avec un 200 cote
 * serveur — donc sans trace dans son journal. Meme defaut, meme correctif que
 * `teamMembershipRequestService`.
 * @param {any} responseData
 * @returns {Promise<{ data: any[], meta: any }>}
 */
const selectValidClubMembershipRequests = async (responseData) => {
  const meta = await clubMembershipRequestsMetaSchema.validateAsync(responseData?.meta, {
    allowUnknown: true,
  });

  const entries = Array.isArray(responseData?.data) ? responseData.data : [];
  /** @type {any[]} */
  const data = [];
  /** @type {string[]} */
  const rejectedIds = [];

  await Promise.all(entries.map(async (/** @type {any} */ entry) => {
    try {
      data.push(await clubMembershipRequestSchema.validateAsync(entry, { allowUnknown: true }));
    } catch {
      rejectedIds.push(String(entry?.documentId || 'sans-identifiant'));
    }
  }));

  if (rejectedIds.length) {
    clubMembershipRequestLogger.warn('demande(s) illisible(s) ecartee(s)', {
      documentIds: rejectedIds,
      rejected: rejectedIds.length,
    });
  }

  return { data, meta };
};

/**
 * Traduit une erreur HTTP en erreur lisible QUI GARDE SON STATUT — sans lui,
 * l'ecran ne peut plus distinguer un refus (403) d'un incident (500).
 * @param {any} error
 * @param {string} fallbackMessage
 * @returns {Error & { status: number | null }}
 */
const toReadableError = (error, fallbackMessage) => {
  const requestError = /** @type {any} */ (error);
  const responseError = requestError?.response?.data?.error;
  const nextError = /** @type {any} */ (new Error(
    responseError?.message
    || requestError?.response?.data?.message
    || requestError?.message
    || fallbackMessage,
  ));
  nextError.status = Number(requestError?.response?.status || requestError?.status || 0) || null;
  return nextError;
};

/**
 * Create a new club membership request
 * @param {{user: string, club: string}} clubMembershipRequestData
 * @returns {Promise<ClubMembershipRequest>} - The created request
 */
export const createClubMembershipRequest = async (clubMembershipRequestData) => {
  const response = await client.post('/club-membership-requests', {
    data: clubMembershipRequestData,
  });
  celebrate('club_membership_request_sent', {
    clubId: clubMembershipRequestData?.club,
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
    // ⛔ AUCUN `populate` ici, et c'est deliberé : le controleur serveur
    // (club-membership-request.ts:466-474) appelle `validateQuery(ctx)` — donc il
    // VALIDE ce que l'app demande — puis impose son propre populate ET son propre
    // filtre de club. Nommer `user` exigeait
    // `plugin::users-permissions.user.find`, action qu'AUCUN role ne declare :
    // Strapi 5 rend alors 400 « Invalid key user ». Voir S01.
  };

  let response;
  try {
    response = await client.get('/club-membership-requests', { params: filters });
  } catch (error) {
    throw toReadableError(error, 'Failed to fetch club membership requests');
  }

  try {
    const validationResult = await selectValidClubMembershipRequests(response.data);

    const normalizedData = (validationResult?.data || []).map((item) => {
      const rawRequester = item?.requester && typeof item.requester === 'object'
        ? item.requester
        : {};
      const flatRequester = toFlatUser(rawRequester) || rawRequester;
      const requester = {
        ...flatRequester,
        displayName: flatRequester?.displayName || item?.requesterDisplayName || '',
        firstname: flatRequester?.firstname
          || flatRequester?.firstName
          || item?.requesterFirstname
          || '',
        lastname: flatRequester?.lastname
          || flatRequester?.lastName
          || item?.requesterLastname
          || '',
        phoneNumber: flatRequester?.phoneNumber || flatRequester?.phone || '',
        username: flatRequester?.username || '',
      };
      const flatUser = toFlatUser(item?.user);

      return {
        ...item,
        requester,
        user: {
          avatar: flatUser?.avatar || requester?.avatar || null,
          documentId: flatUser?.documentId
            || (typeof item?.user === 'string' ? item.user : undefined),
          firstname: flatUser?.firstname || flatUser?.firstName || requester?.firstname || '',
          lastname: flatUser?.lastname || flatUser?.lastName || requester?.lastname || '',
          phoneNumber: flatUser?.phoneNumber || requester?.phoneNumber || item?.phoneNumber || '',
          username: flatUser?.username || requester?.username || '',
        },
      };
    });

    return {
      ...validationResult,
      data: normalizedData,
    };
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error
      ? error.message
      : error;
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
