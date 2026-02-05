
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
                    cover: true
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
