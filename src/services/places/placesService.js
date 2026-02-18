import Joi from 'joi';

import client from '../client';

/** @typedef {import('./types').Place} Place */

const BAN_BASE_URL = 'https://api-adresse.data.gouv.fr';
const DEFAULT_SEARCH_LIMIT = 20;
const GEO_SEARCH_PATH = '/geo/search';
const POI_HINT_KEYWORDS = ['stade', 'complexe', 'gymnase', 'arena', 'club', 'terrain', 'urban', 'soccer', 'padel', 'five'];

/**
 * Joi schema for Place validation
 */
export const placeSchema = Joi.object({
  geometry: Joi.object({
    coordinates: Joi.array().length(2).items(Joi.number()).required(),
  }).unknown(true).optional(),
  properties: Joi.object({
    city: Joi.string().allow('', null).optional(),
    context: Joi.string().allow('', null).optional(),
    id: Joi.string().allow('', null).optional(),
    label: Joi.string().required(),
    postcode: Joi.string().allow('', null).optional(),
  }).unknown(true).required(),
}).unknown(true);

/**
 * Joi schema for array of places wrapped in features
 */
export const placesResponseSchema = Joi.object({
  features: Joi.array().items(placeSchema).default([]),
}).unknown(true);

export const geoLocationSchema = Joi.object({
  address_line: Joi.string().allow('', null).optional(),
  city: Joi.string().allow('', null).optional(),
  confidence: Joi.number().min(0).max(1).optional(),
  country: Joi.string().allow('', null).optional(),
  label: Joi.string().required(),
  lat: Joi.number().required(),
  lng: Joi.number().required(),
  postcode: Joi.string().allow('', null).optional(),
  provider: Joi.string().allow('', null).optional(),
  provider_id: Joi.string().allow('', null).optional(),
  source: Joi.string().allow('', null).optional(),
}).unknown(true);

export const geoSearchResponseSchema = Joi.object({
  data: Joi.array().items(geoLocationSchema).default([]),
  meta: Joi.object().unknown(true).optional(),
}).unknown(true);

const normalizeSearchQuery = (/** @type {string} */ search) => (search || '')
  .replace(/\s*,\s*/g, ', ')
  .replace(/\s+/g, ' ')
  .trim();

const inferSearchType = (/** @type {string} */ search, /** @type {string | undefined} */ explicitType) => {
  if (explicitType) return explicitType;

  const normalized = normalizeSearchQuery(search).toLowerCase();
  if (!normalized) return undefined;

  if (POI_HINT_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    // Let backend providers decide best type for place-like searches.
    return undefined;
  }

  if (/\d/.test(normalized)) {
    return 'housenumber';
  }

  return undefined;
};

const getSearchTypes = (/** @type {string | undefined} */ type, /** @type {string} */ query) => {
  const hasHouseNumber = /\d/.test(query);
  const prioritizedTypes = [];

  if (type) prioritizedTypes.push(type);
  if (hasHouseNumber) prioritizedTypes.push('housenumber');
  prioritizedTypes.push('street');
  prioritizedTypes.push('municipality');

  return [...new Set(prioritizedTypes.filter(Boolean))];
};

const fetchPlacesByType = async (/** @type {string} */ search, /** @type {string | undefined} */ type) => {
  /** @type {{ autocomplete: number; limit: number; q: string; type?: string }} */
  const params = {
    autocomplete: 1,
    limit: DEFAULT_SEARCH_LIMIT,
    q: search,
  };

  if (type) {
    params.type = type;
  }

  const response = await client.get('/search', {
    baseURL: BAN_BASE_URL,
    params,
  });

  const validationResult = await placesResponseSchema.validateAsync(response.data);
  return validationResult.features || [];
};

const mapGeoLocationToPlace = (/** @type {any} */ location) => ({
  geometry: {
    coordinates: [location.lng, location.lat],
  },
  properties: {
    city: location.city || '',
    confidence: location.confidence ?? null,
    context: location.country || '',
    id: location.provider_id || null,
    label: location.label,
    postcode: location.postcode || '',
    provider: location.provider || null,
    source: location.source || null,
    street: location.address_line || '',
  },
});

const fetchPlacesFromGeoSearch = async (/** @type {string} */ search, /** @type {string | undefined} */ type) => {
  /** @type {{ limit: number; q: string; type?: string }} */
  const params = {
    limit: DEFAULT_SEARCH_LIMIT,
    q: search,
  };

  if (type) {
    params.type = type;
  }

  const response = await client.get(GEO_SEARCH_PATH, { params });
  const validationResult = await geoSearchResponseSchema.validateAsync(response.data);
  const locations = Array.isArray(validationResult.data) ? validationResult.data : [];
  return locations.map(mapGeoLocationToPlace);
};

/**
 * @param {string} search
 * @param {string[]} types
 * @param {number} [index=0]
 * @returns {Promise<Place[]>}
 */
const searchByTypeWithFallback = async (search, types, index = 0) => {
  if (index >= types.length) {
    return [];
  }

  const typedResults = await fetchPlacesByType(search, types[index]);
  if (typedResults.length > 0) {
    return typedResults;
  }

  return searchByTypeWithFallback(search, types, index + 1);
};

/**
 * Search for places
 * @param {string} search - The search query
 * @param {string} [type] - The type of place to search for
 * @returns {Promise<Place[]>} - The promise with the response
 */
export const searchPlaces = async (search, type) => {
  const normalizedSearch = normalizeSearchQuery(search);
  const resolvedType = inferSearchType(normalizedSearch, type);

  if (!normalizedSearch) {
    return [];
  }

  try {
    try {
      const geoResults = await fetchPlacesFromGeoSearch(normalizedSearch, resolvedType);
      if (geoResults.length > 0) {
        return geoResults;
      }
    } catch (_geoError) {
      // Fallback handled below with direct BAN call.
    }

    const searchTypes = getSearchTypes(resolvedType, normalizedSearch);
    const typedResults = await searchByTypeWithFallback(normalizedSearch, searchTypes);
    if (typedResults.length > 0) {
      return typedResults;
    }

    return fetchPlacesByType(normalizedSearch, undefined);
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : String(error);
    throw new Error(`Failed to fetch places for "${normalizedSearch}": ${errorToDisplay}`);
  }
};

/**
 * Get municipality from coordinates
 * @param {object} param - The search query
 * @param {number} param.lat - The latitude
 * @param {number} param.lon - The longitude
 * @returns {Promise<Place | null>} - The promise with the response
 */
export const getPlacesFromCoordinates = async ({ lat, lon }) => {
  try {
    const response = await client.get('/reverse/', {
      baseURL: BAN_BASE_URL,
      params: {
        lat,
        limit: 1,
        lon,
        type: 'street',
      },
    });
    const validationResult = await placesResponseSchema.validateAsync(response.data);
    return validationResult.features?.[0] || null;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : String(error);
    throw new Error(`Failed to fetch places: ${errorToDisplay}`);
  }
};
