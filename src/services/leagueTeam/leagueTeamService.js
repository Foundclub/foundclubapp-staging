
import client from '@/services/client';
import { Platform } from 'react-native';

/**
 * @typedef {object} LeagueTeamData
 * @property {string} name
 * @property {string} captain - User ID
 * @property {object} home_base
 * @property {number} [elo]
 */

/**
 * Create a new league team
 * @param {LeagueTeamData} teamData
 * @returns {Promise<object>}
 */
export const createLeagueTeam = async (teamData) => {
  const { logo, cover, ...data } = teamData;

  try {
      // 1. Handle File Uploads first
      if (logo) {
          console.log('[LeagueTeam] Uploading Logo...');
          const logoId = await uploadFile(logo);
          data.crest = logoId; // Set ID
      }

      if (cover) {
          console.log('[LeagueTeam] Uploading Cover...');
          const coverId = await uploadFile(cover);
          data.cover = coverId; // Set ID
      }

    const response = await client.post('/league-teams', {
      data: data,
    });
    console.log('[DEBUG] createLeagueTeam response:', JSON.stringify(response.data, null, 2));
    return response.data?.data;
  } catch (error) {
    console.error('Error creating league team:', error);
    throw error;
  }
};

/**
 * Get league teams for a user (Captain)
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export const getMyLeagueTeam = async (userId) => {
  try {
    const response = await client.get('/league-teams', {
      params: {
        filters: {
            $or: [
                {
                    captain: {
                        documentId: {
                            $eq: userId
                        }
                    }
                },
                {
                    roster: {
                        documentId: {
                            $eq: userId
                        }
                    }
                }
            ]
        },
        populate: '*',
      },
    });
    return response.data?.data || [];
  } catch (error) {
    console.error('Error fetching league team:', error);
    throw error;
  }
};

/**
 * Check if team name is unique
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export const checkTeamNameUnique = async (name) => {
    try {
        const response = await client.get('/league-teams', {
            params: {
                filters: {
                    name: {
                        $eq: name
                    }
                }
            }
        });
        return response.data?.data?.length === 0;
    } catch (error) {
        return false;
    }
}

/**
 * Upload a file to Strapi using native fetch to avoid Axios/Android issues
 * @param {object} file 
 * @returns {Promise<number>} - The uploaded file ID
 */
const uploadFile = async (file) => {
    try {
        const formData = new FormData();
        
        const uri = Platform.OS === 'android' ? file.uri : file.uri.replace('file://', '');
        
        formData.append('files', {
            uri: uri,
            name: file.filename || 'upload.jpg',
            type: file.mime || 'image/jpeg',
        });

        // Get token for upload
        const { getAuthTokens } = require('../../domains/auth/authUseCases');
        const token = getAuthTokens()?.token;

        const response = await fetch(`${process.env.API_URL}/upload`, {
            method: 'POST',
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                'Accept': 'application/json',
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        if (data && data[0] && data[0].id) {
            return data[0].id;
        }
        throw new Error('No ID received from upload');

    } catch (e) {
        console.error('File upload error:', e);
        throw e;
    }
};

/**
 * Update a league team
 * @param {object} teamData 
 * @returns {Promise<object>}
 */
export const updateLeagueTeam = async (teamData) => {
    const { documentId, logo, cover, ...data } = teamData;

    try {
        // 1. Handle File Uploads first
        if (logo) {
            console.log('[LeagueTeam] Uploading Logo...');
            const logoId = await uploadFile(logo);
            data.crest = logoId; // Set ID
        }

        if (cover) {
            console.log('[LeagueTeam] Uploading Cover...');
            const coverId = await uploadFile(cover);
            data.cover = coverId; // Set ID
        }

        // 2. Update Team Data
        // Now we just send a standard JSON update with IDs
        const response = await client.put(`/league-teams/${documentId}`, {
            data: data
        });

        return response.data?.data;

    } catch (error) {
        console.error('Error updating league team:', error);
        throw error;
    }
};

/**
 * Get a single league team by ID
 * @param {string} id 
 * @returns {Promise<object>}
 */
export const getLeagueTeamById = async (id) => {
    try {
        const response = await client.get(`/league-teams/${id}`, {
            params: {
                populate: {
                    captain: { populate: ['avatar'] },
                    roster: { populate: ['avatar'] },
                    slots: { populate: ['participants'] },
                    crest: true,
                    cover: true,
                    join_requests: true
                }
            }
        });
        return response.data?.data;
    } catch (error) {
        console.error('Error fetching league team by id:', error);
        throw error;
    }
};
/**
 * Get ranking for a specific division
 * @param {number} division 
 * @returns {Promise<object[]>}
 */
export const getRanking = async (division = 10) => {
    try {
        const response = await client.get('/league-teams', {
            params: {
                filters: {
                    division: { $eq: division }
                },
                sort: ['elo:desc', 'wins:desc'], // Sort by ELO, then Wins
                populate: ['crest']
            }
        });
        return response.data?.data || [];
    } catch (error) {
        console.error('Error fetching ranking:', error);
        throw error;
    }
};
/**
 * Delete a league team
 * @param {string} documentId
 * @returns {Promise<void>}
 */
// ... existing exports ...

export const deleteLeagueTeam = async (documentId) => {
    try {
        await client.delete(`/league-teams/${documentId}`);
    } catch (error) {
        console.error('Error deleting league team:', error);
        throw error;
    }
};

/**
 * Search squads with filters
 * @param {object} filters
 * @param {string} [filters.city]
 * @param {number} [filters.radius]
 * @param {string} [filters.category]
 * @param {number} [filters.division]
 * @returns {Promise<any[]>}
 */
export const searchSquads = async (filters) => {
    try {
        const query = {
            populate: ['logo', 'home_base'],
            filters: {},
        };

        if (filters.city) {
            query.filters.home_base = {
                city: { $containsi: filters.city }
            };
        }

        if (filters.category) {
            query.filters.category = { $eq: filters.category };
        }

        if (filters.division) {
            query.filters.division = { $eq: filters.division };
        }

        // Note: Radius filtering would typically require a geospatial query or post-filtering.
        // For now, we'll rely on city matching. Use a specialized endpoint for radius if needed.

        const response = await client.get('/league-teams', { params: query });
        return response.data.data;
    } catch (error) {
        console.error('Error searching squads:', error);
        throw error;
    }
};

/**
 * Request to join a squad
 * @param {string} teamId
 * @param {string} userId
 */
export const requestToJoinSquad = async (teamId, userId) => {
    try {
       // We need to fetch the current requests first to append the new one, 
       // OR use a custom endpoint if Strapi's default update replaces the relation.
       // Here we assume we can just 'connect' via update/PUT if using Document Service API under the hood,
       // but with standard REST populate, we often need to be careful. 
       // However, Strapi v4/v5 'connect' syntax in update usually works.
       
       await client.put(`/league-teams/${teamId}`, {
           data: {
               join_requests: {
                   connect: [userId]
               }
           }
       });
    } catch (error) {
        console.error('Error requesting to join squad:', error);
        throw error;
    }
};

/**
 * Respond to a join request
 * @param {string} teamId
 * @param {string} userId
 * @param {boolean} accept
 */
export const respondToJoinRequest = async (teamId, userId, accept) => {
    try {
        const updateData = {
            join_requests: {
                disconnect: [userId]
            }
        };

        if (accept) {
            updateData.roster = {
                connect: [userId]
            };
        }

        await client.put(`/league-teams/${teamId}`, {
            data: updateData
        });
    } catch (error) {
        console.error('Error responding to join request:', error);
        throw error;
    }
};
