import client from '../client';

/**
 * Create a new club request
 * @param {ClubRequest} clubRequestData
 * @returns {Promise<ClubRequest>} - The created request
 */
export const createClubRequest = async (clubRequestData) => {
  const response = await client.post('/club-requests', {
    data: clubRequestData,
  });
  return response.data;
};

/**
 * Get pending affiliation help requests.
 * @param {object} [params]
 * @returns {Promise<any>}
 */
export const getPendingAffiliationHelpRequests = async (params = {}) => {
  const response = await client.get('/club-requests', {
    params: {
      filters: {
        $or: [
          { state: 'En attente' },
          { state: 'pending' },
        ],
        requestKind: {
          $in: ['club_not_found', 'team_not_found', 'club_creation'],
        },
      },
      pagination: {
        page: 1,
        pageSize: 100,
      },
      populate: ['user', 'user.avatar', 'processedBy'],
      sort: ['createdAt:desc'],
      ...params,
    },
  });
  return response.data;
};

/**
 * Get pending club onboarding requests created by the current user.
 * @param {string} userDocumentId
 * @param {object} [params]
 * @param {'club_creation'|'club_not_found'|'team_not_found'} [requestKind]
 *   D95 — le defaut garde le comportement d'origine (aucun appelant a changer) ;
 *   la fiche club s'en sert avec `team_not_found` pour afficher « Demande en attente ».
 * @returns {Promise<any>}
 */
export const getPendingClubCreationRequests = async (
  userDocumentId,
  params = {},
  requestKind = 'club_creation',
) => {
  if (!userDocumentId) {
    return {
      data: [],
      meta: {
        pagination: {
          page: 1,
          pageCount: 0,
          pageSize: 100,
          total: 0,
        },
      },
    };
  }

  const response = await client.get('/club-requests', {
    params: {
      filters: {
        $or: [
          { state: 'En attente' },
          { state: 'pending' },
        ],
        requestKind,
        user: {
          documentId: {
            $eq: userDocumentId,
          },
        },
      },
      pagination: {
        page: 1,
        pageSize: 100,
      },
      populate: ['user', 'processedBy'],
      sort: ['createdAt:desc'],
      ...params,
    },
  });
  return response.data;
};

/**
 * Get one club-request by document id.
 * @param {string} documentId
 * @returns {Promise<any>}
 */
export const getClubRequestById = async (documentId) => {
  const response = await client.get(`/club-requests/${documentId}`, {
    params: {
      populate: ['user', 'user.avatar', 'processedBy'],
    },
  });
  return response.data;
};

/**
 * Mark a club-request as processed.
 * @param {string} documentId
 * @param {{ adminNote?: string }} [payload]
 * @returns {Promise<any>}
 */
export const processClubRequest = async (documentId, payload = {}) => {
  const response = await client.post(`/club-requests/${documentId}/process`, payload);
  return response.data;
};

/**
 * Refuse a club-request.
 * @param {string} documentId
 * @param {{ adminNote?: string }} [payload]
 * @returns {Promise<any>}
 */
export const refuseClubRequest = async (documentId, payload = {}) => {
  const response = await client.post(`/club-requests/${documentId}/refuse`, payload);
  return response.data;
};
