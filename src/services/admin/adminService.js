import client from '@/services/client';

/**
 * Get admin dashboard stats
 * @returns {Promise<{revenue: number, reportsCount: number, eventsToday: number}>}
 */
export const getAdminStats = async () => {
    const result = await client.get('/admin-dashboard/stats');
    return result.data;
};
/**
 * Get pending club claims
 * @returns {Promise<any>}
 */
export const getPendingClubClaims = async () => {
    const result = await client.get('/club-membership-requests', {
        params: {
            filters: {
                type: 'claim',
                state: 'pending',
            },
            pagination: {
                pageSize: 1, // We just need the count
            },
        },
    });
    return result.data;
};

/**
 * Get club claims request list
 * @param {object} params
 * @returns {Promise<any>}
 */
export const getClubClaimsRequestList = async (params = {}) => {
    const defaultParams = {
        filters: {
            type: 'claim',
            state: 'pending',
        },
        populate: ['user', 'club', 'user.avatar', 'club.logo'],
        sort: ['createdAt:desc'],
        ...params,
    };
    
    const result = await client.get('/club-membership-requests', {
        params: defaultParams,
    });
    return result.data;
};

/**
 * Get single club claim request
 * @param {string} documentId
 * @returns {Promise<any>}
 */
export const getClubClaimRequest = async (documentId) => {
    const result = await client.get(`/club-membership-requests/${documentId}`, {
        params: {
            populate: ['user', 'club', 'user.avatar', 'club.logo'],
        },
    });
    return result.data;
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

// ================== ADMIN USERS ==================

/**
 * Get admin users list with search and filters
 * @param {object} params
 * @returns {Promise<any>}
 */
export const getAdminUsers = async (params = {}) => {
    const { q, role, page = 1, pageSize = 20 } = params;
    const filters = { 
        filters: {}, 
        pagination: { page, pageSize },
        populate: ['avatar', 'role', 'club'],
        sort: ['createdAt:desc'],
    };
    
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
 * @param {object} params
 * @returns {Promise<any>}
 */
export const getAdminClubs = async (params = {}) => {
    const { q, page = 1, pageSize = 20 } = params;
    const filters = { 
        filters: {}, 
        pagination: { page, pageSize },
        populate: ['logo', 'sport'],
        sort: ['createdAt:desc'],
    };
    
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
        populate: [
            'team_a',
            'team_a.captain',
            'team_b',
            'team_b.captain',
            'chat',
        ],
        sort: ['updatedAt:desc'],
        pagination: {
            page: 1,
            pageSize: 25,
        },
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
        score_a: Number.parseInt(payload.scoreA, 10),
        score_b: Number.parseInt(payload.scoreB, 10),
        reason: payload.reason || 'Décision SuperAdmin',
    });
    return response.data;
};
