import Joi from 'joi';

import client from '../client';

/**
 * Joi schema for Place validation
 */
export const placeSchema = Joi.object({
  geometry: Joi.object({
    coordinates: Joi.array().items(Joi.string()).required(),
  }).unknown(true).required(),
  properties: Joi.object({
    label: Joi.string().required(),
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
