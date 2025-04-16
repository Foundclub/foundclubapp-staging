import client from '../client';

/**
 * Search for places
 * @param {string} search - The search query
 * @returns {Promise<Place[]>} - The promise with the response
 */
export const searchPlaces = async (search) => {
  const response = await client.get('/search', {
    baseURL: 'https://api-adresse.data.gouv.fr',
    params: { limit: 10, q: search, type: 'municipality' },
  });
  return response?.data?.features;
};

// TODO: add joi schema
