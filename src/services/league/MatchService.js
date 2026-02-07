import client from '@/services/client';

/**
 * Update a league match (e.g. proposal)
 * @param {string} matchId
 * @param {object} data
 */
export const updateMatch = async (matchId, data) => {
    const response = await client.put(`/league-matches/${matchId}`, { data });
    return response.data;
};

/**
 * Report the result of a league match.
 * @param {object} params
 * @param {string|number} params.matchId
 * @param {number} params.scoreA
 * @param {number} params.scoreB
 * @param {object} [params.photo] - Photo object { uri, type, name }
 */
export const reportMatchResult = async ({ matchId, scoreA, scoreB, photo }) => {
    const formData = new FormData();
    formData.append('score_a', scoreA.toString());
    formData.append('score_b', scoreB.toString());
    
    // Status update to trigger backend workflow
    formData.append('status', 'pending_validation');

    if (photo) {
        formData.append('files.proof', {
            uri: photo.uri,
            name: photo.name || 'proof.jpg',
            type: photo.type || 'image/jpeg',
        });
    }

    // We use a custom endpoint or the default update with files
    // Strapi default update doesn't handle files in the root payload easily usually
    // But let's try strict update 'api::league-match.league-match' wrapped in data
    // actually, for Strapi v4 upload + data, we need 'data' field as stringified JSON
    
    // Re-creating FormData for Strapi Structure
    const finalFormData = new FormData();
    finalFormData.append('data', JSON.stringify({
        score_a: scoreA,
        score_b: scoreB,
        status: 'pending_validation'
    }));

    if (photo) {
        finalFormData.append('files.proof', {
             uri: photo.uri,
             name: 'proof.jpg',
             type: 'image/jpeg'
        });
    }

    const response = await client.put(`/league-matches/${matchId}`, finalFormData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};


export const getMatchDetails = async (matchId) => {
    const response = await client.get(`/league-matches/${matchId}`, {
         params: {
             populate: ['team_a', 'team_a.captain', 'team_b', 'team_b.captain']
         }
    });
    return response.data;
};

export const confirmMatch = async (matchId) => {
    // We use PUT update with a flag to bypass custom route issues
    const response = await client.put(`/league-matches/${matchId}`, {
        data: { confirm: true }
    });
    return response.data;
};

export const disputeMatch = async (matchId) => {
    const response = await client.post(`/league-matches/${matchId}/dispute`);
    return response.data;
};

export const cancelMatch = async (matchId, teamId, reason) => {
    const response = await client.post(`/league-matches/${matchId}/cancel`, {
        teamId,
        reason
    });
    return response.data;
};
