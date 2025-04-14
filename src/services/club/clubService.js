import Joi from 'joi';

import client from '../client';

/**
 * Club validation schema
 */
const activitySchema = Joi.object({
  name: Joi.string().required(),
});

const sponsorSchema = Joi.object({
  link: Joi.string().optional(),
  logo: Joi.object({
    url: Joi.string().required(),
  }).unknown(true).required(),
  title: Joi.string().required(),
});

const clubSchema = Joi.object({
  activites: Joi.array().items(activitySchema).optional(),
  address: Joi.object().required(),
  email: Joi.string().optional(),
  geohash: Joi.string().optional(),
  id: Joi.number().required(),
  isCustomer: Joi.boolean().required().default(false),
  maxTeamNumber: Joi.number().required().default(0),
  name: Joi.string().required(),
  phoneNumber: Joi.string().optional(),
  sponsor: Joi.array().items(sponsorSchema).optional(),
}).required();

const clubListSchema = Joi.object({
  activites: Joi.array().items(activitySchema).optional(),
  address: Joi.object().required(),
  email: Joi.string().optional(),
  geohash: Joi.string().optional(),
  id: Joi.number().required(),
  isCustomer: Joi.boolean().required().default(false),
  maxTeamNumber: Joi.number().required().default(0),
  name: Joi.string().required(),
  phoneNumber: Joi.string().optional(),
}).required();

/**
 * Convert geographic coordinates to a real address using OpenStreetMap (Nominatim)
 * @param {number | undefined} lat - Latitude
 * @param {number | undefined} lng - Longitude
 * @returns {Promise<string>} - The address information
 */
export const getAddressFromCoordinates = async (lat, lng) => {
  if (!lat || !lng) {
    throw new Error('Latitude and longitude are required');
  }

  try {
    const response = await client.get('https://nominatim.openstreetmap.org/reverse', {
      headers: {
        'Accept-Language': 'fr',
        'User-Agent': 'FoundClubApp',
      },
      params: {
        addressdetails: 1,
        format: 'json',
        lat,
        lon: lng,
        zoom: 18,
      },
    });

    const { address } = response.data;
    const houseNumber = address.house_number || '';
    const road = address.road || '';
    const postcode = address.postcode || '';
    const city = address.city || address.town || address.village || '';

    // Format: house_number road, postcode city
    const formattedAddressString = [
      [houseNumber, road].filter(Boolean).join(' '),
      [postcode, city].filter(Boolean).join(' '),
    ].filter(Boolean).join(', ');

    return formattedAddressString;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to get address from coordinates: ${errorToDisplay}`);
  }
};

/**
 * Get the list of clubs
 * @param {{
 *   activity?: string;
 *   geohash?: string[];
 *   name?: string;
 *   page?: number;
 *   pageSize?: number;
 * }} params
 * @returns {Promise<{data: Club[], meta: {
 * pagination: { page: number; pageSize: number; pageCount: number; total: number; } }}>}
 */
export const getClubs = async (params = {}) => {
  try {
    const {
      activity,
      geohash,
      name,
      page,
      pageSize,
    } = params;

    const filters = {
      filters: {},
      pagination: {
        page: page || 1,
        pageSize: pageSize || 7,
      },
    };

    if (activity) {
      filters.filters = {
        ...filters.filters,
        activites: {
          documentId: activity,
        },
      };
    }

    if (name) {
      filters.filters = {
        ...filters.filters,
        name: {
          $containsi: name,
        },
      };
    }

    if (geohash && geohash.length) {
      filters.filters = Object.assign(filters.filters, {
        geohash: {
          $contains: geohash,
        },
      });
    }

    const response = await client.get('/clubs', { params: filters });

    const schema = Joi.object({
      data: Joi.array().items(clubListSchema).empty(Joi.array().length(0)),
      meta: Joi.object({
        pagination: Joi.object({
          page: Joi.number().required(),
          pageCount: Joi.number().required(),
          pageSize: Joi.number().required(),
          total: Joi.number().required(),
        }).required(),
      }).required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });

    // Add city information to each club from coordinates
    if (validationResult.data && Array.isArray(validationResult.data)) {
      const clubsWithCity = await Promise.all(validationResult.data.map(
        async (/** @type {Club} */ club) => {
          if (club.address?.lat && club.address?.lng) {
            const address = await getAddressFromCoordinates(
              club.address.lat,
              club.address.lng,
            );
            // Extract city from the address (assuming it's after the comma and space)
            const city = address.split(', ')[1];
            return {
              ...club,
              city,
            };
          }
          return club;
        },
      ));
      validationResult.data = clubsWithCity;
    }
    return validationResult;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch clubs: ${errorToDisplay}`);
  }
};

/**
 * Get a single club by ID
 * @param {string|number} id - The club ID
 * @returns {Promise<Club>} - The club data
 */
export const getClubById = async (id) => {
  try {
    const response = await client.get(`/clubs/${id}`, {
      params: {
        populate: {
          activites: {
            populate: '*',
          },
          sponsor: {
            populate: 'logo',
          },
          users: {
            populate: '*',
          },
        },
      },
    });

    const schema = Joi.object({
      data: clubSchema.required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });

    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch club: ${errorToDisplay}`);
  }
};
