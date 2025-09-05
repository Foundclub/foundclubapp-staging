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
