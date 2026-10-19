import Joi from 'joi';

import client from '../client';

/** @typedef {import('./types').Place} Place */

// api-adresse.data.gouv.fr est décommissionnée (sunset 31/01/2026) :
// la BAN est servie par la Géoplateforme IGN.
const BAN_BASE_URL = 'https://data.geopf.fr/geocodage';
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

/**
 * ADRESSE-CARTE (07/10) — POSER sur la carte un lieu que la recherche ne trouve pas (une épingle et
 * un nom). Il rejoint la base de lieux du serveur : la recherche d'adresse suivante, par n'importe
 * qui, le propose avant le géocodeur. Le serveur rend le lieu à la forme d'une proposition de
 * `/geo/search` : il devient une adresse comme une autre pour le formulaire.
 * @param {{
 *   name: string, lat: number, lng: number,
 *   addressLine?: string, city?: string, postcode?: string,
 * }} lieu - Le lieu : son nom, son point, son adresse approchée.
 * @returns {Promise<{ existing: boolean, place: Place }>} `existing` : le même lieu était
 *   déjà posé.
 */
export const createLieu = async (lieu) => {
  const response = await client.post('/lieux', { data: lieu });
  const location = await geoLocationSchema.validateAsync(response.data?.data);
  return {
    existing: Boolean(response.data?.meta?.existing),
    place: mapGeoLocationToPlace(location),
  };
};

const sansAccents = (/** @type {string} */ texte) => (texte || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/**
 * Essaie les textes un par un ; s'arrête à la première commune ÉCRITE dans le texte tapé.
 * @param {string[]} essais - Les textes à chercher, dans l'ordre.
 * @param {(commune: Place) => boolean} retenue - La garde.
 * @returns {Promise<Place | null>}
 */
const premiereCommuneRetenue = async (essais, retenue) => {
  if (essais.length === 0) return null;
  const communes = await fetchPlacesByType(essais[0], 'municipality');
  return communes.find(retenue) || premiereCommuneRetenue(essais.slice(1), retenue);
};

/**
 * R17-ADRESSE (REC17-008, 19/10) — la commune que le texte tapé NOMME (« Gymnase Toto
 * Aix-en-Provence », « … 13008 »), pour ouvrir la carte dessus quand la liste ne trouve pas le
 * lieu. La recherche de commune de la BAN rend RIEN quand la commune est noyée dans le nom du
 * lieu : on l'interroge sur le code postal tapé, le texte entier, puis les 3, 2 et 1 derniers
 * (et premiers) mots — 8 requêtes au plus. Une commune n'est retenue que si son code postal ou son
 * nom est ÉCRIT dans le texte : la recherche approchée rend toujours une commune, souvent fausse.
 * @param {string} texte - Le texte tapé (ou la ville connue de l'objet).
 * @returns {Promise<{ label: string, lat: number, lng: number } | null>} null : rien de reconnu,
 *   ou la BAN injoignable (la carte s'ouvre alors ailleurs).
 */
export const chercherCommune = async (texte) => {
  const propre = normalizeSearchQuery(texte);
  if (!propre) return null;
  const codePostal = propre.match(/\b\d{5}\b/)?.[0];
  const ecrit = ` ${sansAccents(propre)} `;
  const mots = propre.split(/[\s,]+/).filter(Boolean);
  const essais = [...new Set([
    codePostal,
    propre,
    ...[3, 2, 1].flatMap((n) => [mots.slice(-n).join(' '), mots.slice(0, n).join(' ')]),
  ].filter((essai) => essai && essai.length >= 3))];
  const retenue = (/** @type {Place} */ commune) => {
    const { city, label, postcode } = commune?.properties || {};
    if (codePostal && postcode === codePostal) return true;
    const nom = sansAccents(city || label);
    return Boolean(nom) && ecrit.includes(` ${nom} `);
  };
  try {
    const commune = await premiereCommuneRetenue(essais, retenue);
    const [lng, lat] = commune?.geometry?.coordinates || [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { label: commune?.properties?.label || '', lat, lng };
  } catch (_panne) {
    return null;
  }
};

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
 * @param {number} [index]
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
