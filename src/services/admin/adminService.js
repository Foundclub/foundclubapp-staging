import client from '@/services/client';
import {
  getClubRequestById,
  getPendingAffiliationHelpRequests,
  processClubRequest,
  refuseClubRequest as refuseAffiliationClubRequest,
} from '@/services/clubRequest/clubRequestService';

/**
 * @typedef {{ q?: string; role?: string; page?: number; pageSize?: number }} AdminUsersParams
 * @typedef {{ q?: string; page?: number; pageSize?: number }} AdminClubsParams
 */

/**
 * Get admin dashboard stats
 * @returns {Promise<{revenue: number, reportsCount: number, eventsToday: number}>}
 */
export const getAdminStats = async () => {
  const result = await client.get('/admin-dashboard/stats');
  return result.data;
};

export const ADMIN_CLAIM_ITEM_TYPES = Object.freeze({
  CLAIM: 'claim',
  CLUB_NOT_FOUND: 'club_not_found',
  TEAM_NOT_FOUND: 'team_not_found',
});

const HELP_KINDS = [ADMIN_CLAIM_ITEM_TYPES.CLUB_NOT_FOUND, ADMIN_CLAIM_ITEM_TYPES.TEAM_NOT_FOUND];

const toBadgeLabel = (kind) => {
  if (kind === ADMIN_CLAIM_ITEM_TYPES.CLUB_NOT_FOUND) return 'CLUB INTROUVABLE';
  if (kind === ADMIN_CLAIM_ITEM_TYPES.TEAM_NOT_FOUND) return 'EQUIPE INTROUVABLE';
  return 'REVENDICATION';
};

const toTimestamp = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortByCreatedAtDesc = (a, b) => toTimestamp(b?.createdAt) - toTimestamp(a?.createdAt);

const normalizeHelpState = (state) => {
  const normalized = String(state || '').trim().toLowerCase();
  if (normalized === 'en attente' || normalized === 'pending') return 'pending';
  if (normalized === 'traitée' || normalized === 'traitee' || normalized === 'processed') return 'processed';
  if (normalized === 'refusée' || normalized === 'refusee' || normalized === 'refused') return 'refused';
  return normalized || 'pending';
};

const mapClaimRequestToAdminItem = (item = {}) => ({
  ...item,
  __isAffiliationHelp: false,
  __requestType: ADMIN_CLAIM_ITEM_TYPES.CLAIM,
  __typeLabel: toBadgeLabel(ADMIN_CLAIM_ITEM_TYPES.CLAIM),
});

const mapHelpRequestToAdminItem = (item = {}) => {
  const requestKind = HELP_KINDS.includes(item?.requestKind)
    ? item.requestKind
    : ADMIN_CLAIM_ITEM_TYPES.CLUB_NOT_FOUND;
  return {
    ...item,
    __isAffiliationHelp: true,
    __requestType: requestKind,
    __typeLabel: toBadgeLabel(requestKind),
    state: normalizeHelpState(item?.state),
  };
};

const fetchPendingClaimRequests = async (params = {}) => {
  const mergedParams = {
    ...params,
    filters: {
      state: 'pending',
      type: 'claim',
      ...(params.filters || {}),
    },
    pagination: {
      page: 1,
      pageSize: 100,
      ...(params.pagination || {}),
    },
    populate: params.populate || ['user', 'club', 'user.avatar', 'club.logo'],
    sort: params.sort || ['createdAt:desc'],
  };

  const result = await client.get('/club-membership-requests', {
    params: mergedParams,
  });
  return result.data;
};

/**
 * Get pending claim + affiliation help count.
 * @returns {Promise<any>}
 */
export const getPendingClubClaims = async () => {
  const [claimsResult, helpResult] = await Promise.all([
    fetchPendingClaimRequests({
      pagination: {
        page: 1,
        pageSize: 1,
      },
    }),
    getPendingAffiliationHelpRequests({
      pagination: {
        page: 1,
        pageSize: 1,
      },
    }),
  ]);

  const claimsCount = claimsResult?.meta?.pagination?.total || 0;
  const helpCount = helpResult?.meta?.pagination?.total || 0;
  const total = claimsCount + helpCount;

  return {
    data: [],
    meta: {
      counts: {
        affiliationHelp: helpCount,
        claims: claimsCount,
      },
      pagination: {
        page: 1,
        pageCount: total > 0 ? 1 : 0,
        pageSize: 1,
        total,
      },
    },
  };
};

/**
 * Get club claims request list
 * @param {object} params
 * @returns {Promise<any>}
 */
export const getClubClaimsRequestList = async (params = {}) => {
  const page = params?.pagination?.page || 1;
  const pageSize = params?.pagination?.pageSize || 25;

  const [claimsResult, helpResult] = await Promise.all([
    fetchPendingClaimRequests({
      pagination: {
        page: 1,
        pageSize: 200,
      },
    }),
    getPendingAffiliationHelpRequests({
      pagination: {
        page: 1,
        pageSize: 200,
      },
    }),
  ]);

  const claimItems = (claimsResult?.data || []).map(mapClaimRequestToAdminItem);
  const helpItems = (helpResult?.data || []).map(mapHelpRequestToAdminItem);

  const merged = [...claimItems, ...helpItems].sort(sortByCreatedAtDesc);
  const total = merged.length;
  const pageCount = total > 0 ? Math.ceil(total / pageSize) : 0;
  const start = (page - 1) * pageSize;
  const data = merged.slice(start, start + pageSize);

  return {
    data,
    meta: {
      counts: {
        affiliationHelp: helpItems.length,
        claims: claimItems.length,
      },
      pagination: {
        page,
        pageCount,
        pageSize,
        total,
      },
    },
  };
};

/**
 * Get single club claim request
 * @param {string} documentId
 * @param {'claim'|'club_not_found'|'team_not_found'} [requestType]
 * @returns {Promise<any>}
 */
export const getClubClaimRequest = async (documentId, requestType = undefined) => {
  const normalizedType = String(requestType || '').trim();
  const isHelpRequest = HELP_KINDS.includes(normalizedType);

  if (isHelpRequest) {
    const result = await getClubRequestById(documentId);
    return {
      ...result,
      data: mapHelpRequestToAdminItem(result?.data || {}),
    };
  }

  try {
    const result = await client.get(`/club-membership-requests/${documentId}`, {
      params: {
        populate: ['user', 'club', 'user.avatar', 'club.logo'],
      },
    });
    return {
      ...result.data,
      data: mapClaimRequestToAdminItem(result?.data?.data || result?.data?.attributes || result?.data),
    };
  } catch (error) {
    if (normalizedType) {
      throw error;
    }
    const fallback = await getClubRequestById(documentId);
    return {
      ...fallback,
      data: mapHelpRequestToAdminItem(fallback?.data || {}),
    };
  }
};

/**
 * Approve club claim
 * @param {string} documentId
 * @returns {Promise<any>}
 */
/**
 * Approve club claim
 * @param {string} documentId
 * @returns {Promise<any>}
 */
export const approveClubClaim = async (documentId) => {
  // Call the CUSTOM 'accept' endpoint which handles role logic
  // Route is POST /club-membership-requests/:id/accept
  const result = await client.post(`/club-membership-requests/${documentId}/accept`);
  return result.data;
};

/**
 * Refuse club claim
 * @param {string} documentId
 * @returns {Promise<any>}
 */
export const refuseClubClaim = async (documentId) => {
  // Call the CUSTOM 'refuse' endpoint
  // Route is POST /club-membership-requests/:id/refuse
  const result = await client.post(`/club-membership-requests/${documentId}/refuse`);
  return result.data;
};

/**
 * Process an affiliation help request (club/team not found).
 * @param {string} documentId
 * @param {{ adminNote?: string }} [payload]
 * @returns {Promise<any>}
 */
export const processAffiliationHelpRequest = async (documentId, payload = {}) => processClubRequest(documentId, payload);

/**
 * Refuse an affiliation help request (club/team not found).
 * @param {string} documentId
 * @param {{ adminNote?: string }} [payload]
 * @returns {Promise<any>}
 */
export const refuseAffiliationHelpRequest = async (documentId, payload = {}) => refuseAffiliationClubRequest(documentId, payload);

// ================== ADMIN USERS ==================

/**
 * Get admin users list with search and filters
 * @param {AdminUsersParams} params
 * @returns {Promise<any>}
 */
export const getAdminUsers = async (params = {}) => {
  const {
    page = 1, pageSize = 20, q, role,
  } = params;
  const filters = /** @type {any} */ ({
    filters: {},
    pagination: { page, pageSize },
    populate: ['avatar', 'role', 'club'],
    sort: ['createdAt:desc'],
  });

  if (q) {
    filters.filters.$or = [
      { firstname: { $containsi: q } },
      { lastname: { $containsi: q } },
      { email: { $containsi: q } },
    ];
  }
  if (role) {
    filters.filters.role = { type: role };
  }

  const response = await client.get('/users', { params: filters });
  return response.data;
};

/**
 * Get single user for admin
 * @param {string} documentId
 * @returns {Promise<any>}
 */
export const getAdminUser = async (documentId) => {
  const response = await client.get(`/users/${documentId}`, {
    params: {
      populate: ['avatar', 'role', 'club', 'club.logo'],
    },
  });
  return response.data;
};

/**
 * Update user (admin)
 * @param {string} documentId
 * @param {object} data
 * @returns {Promise<any>}
 */
export const updateAdminUser = async (documentId, data) => {
  const response = await client.put(`/users/${documentId}`, data);
  return response.data;
};

// ================== ADMIN CLUBS ==================

/**
 * Get admin clubs list with search
 * @param {AdminClubsParams} params
 * @returns {Promise<any>}
 */
export const getAdminClubs = async (params = {}) => {
  const { page = 1, pageSize = 20, q } = params;
  const filters = /** @type {any} */ ({
    filters: {},
    pagination: { page, pageSize },
    populate: ['logo', 'sport'],
    sort: ['createdAt:desc'],
  });

  if (q) {
    filters.filters.name = { $containsi: q };
  }

  const response = await client.get('/clubs', { params: filters });
  return response.data;
};

/**
 * Get single club for admin
 * @param {string} documentId
 * @returns {Promise<any>}
 */
export const getAdminClub = async (documentId) => {
  const response = await client.get(`/clubs/${documentId}`, {
    params: {
      populate: ['logo', 'members', 'members.avatar', 'sport', 'sponsor', 'sponsor.logo'],
    },
  });
  return response.data;
};

/**
 * Update club (admin)
 * @param {string} documentId
 * @param {object} data
 * @returns {Promise<any>}
 */
export const updateAdminClub = async (documentId, data) => {
  const response = await client.put(`/clubs/${documentId}`, { data });
  return response.data;
};

// ================== LEAGUE DISPUTES ==================

/**
 * Get League disputes list
 * @param {object} params
 * @returns {Promise<any>}
 */
export const getLeagueDisputes = async (params = {}) => {
  const defaultParams = {
    filters: {
      status: { $eq: 'disputed' },
    },
    pagination: {
      page: 1,
      pageSize: 25,
    },
    populate: [
      'team_a',
      'team_a.captain',
      'team_b',
      'team_b.captain',
      'chat',
    ],
    sort: ['updatedAt:desc'],
  };

  const response = await client.get('/league-matches', {
    params: {
      ...defaultParams,
      ...params,
    },
  });

  return response.data;
};

/**
 * Resolve a League dispute
 * @param {string} matchId
 * @param {{scoreA:number|string, scoreB:number|string, reason?:string}} payload
 * @returns {Promise<any>}
 */
export const resolveLeagueDispute = async (matchId, payload) => {
  const response = await client.post(`/league-matches/${matchId}/resolve-dispute`, {
    reason: payload.reason || 'Décision SuperAdmin',
    score_a: Number.parseInt(String(payload.scoreA), 10),
    score_b: Number.parseInt(String(payload.scoreB), 10),
  });
  return response.data;
};
