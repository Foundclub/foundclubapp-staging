import client from '@/services/client';

/**
 * Creates a new matchmaking request for the team.
 * @param {object} params
 * @param {string|number} params.teamId
 * @param {number} params.radius
 * @param {number} params.min_elo
 * @param {number} params.max_elo
 * @param {object} params.location - { lat, lng }
 */
export const createMatchmakingRequest = async ({ teamId, radius, min_elo, max_elo, location }) => {
    const response = await client.post('/matchmaking-requests', {
        data: {
            team: teamId,
            radius,
            min_elo,
            max_elo,
            location,
            status: 'searching'
        }
    });
    return response.data;
};

/**
 * Cancels (deletes) a matchmaking request.
 * @param {string|number} requestId
 */
export const cancelMatchmakingRequest = async (requestId) => {
    const response = await client.delete(`/matchmaking-requests/${requestId}`);
    return response.data;
};

/**
 * Checks if the team has an active request.
 * @param {string|number} teamId
 */
export const getActiveMatchmakingRequest = async (teamId) => {
    const response = await client.get('/matchmaking-requests', {
        params: {
            filters: {
                team: { id: { $eq: teamId } },
                status: { $eq: 'searching' }
            }
        }
    });
    return response.data?.data?.[0] || null;
};
