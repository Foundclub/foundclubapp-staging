import Joi from 'joi';

import client from '../client';

/**
 * Joi schema for Place validation
 */
export const placeSchema = Joi.object({
  geometry: Joi.object({
    coordinates: Joi.array().items(Joi.string()).required(),
  }).unknown(true).optional(),
  properties: Joi.object({
    city: Joi.string().allow('', null).optional(),
    label: Joi.string().required(),
    postcode: Joi.string().allow('', null).optional(),
  }).unknown(true).required(),
}).unknown(true);

/**
 * Joi schema for array of places wrapped in features
 */
export const placesResponseSchema = Joi.object({
  features: Joi.array().items(placeSchema),
}).unknown(true);

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
  try {
    const validationResult = await placesResponseSchema.validateAsync(response.data);
    return validationResult?.features;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch places: ${errorToDisplay}`);
  }
};

/**
 * Get municipality from coordinates
 * @param {object} param - The search query
 * @param {number} param.lat - The latitude
 * @param {number} param.lon - The longitude
 * @returns {Promise<Place>} - The promise with the response
 */
export const getPlacesFromCoordinates = async ({ lat, lon }) => {
  const response = await client.get('/reverse/', {
    baseURL: 'https://api-adresse.data.gouv.fr',
    params: { lat, lon, type: 'street' },
  });
  try {
    const validationResult = await placesResponseSchema.validateAsync(response.data?.features?.[0]);
    return validationResult;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch places: ${errorToDisplay}`);
  }
};
