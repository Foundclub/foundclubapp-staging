import Joi from 'joi';
import { Platform } from 'react-native';

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
    url: Joi.string().optional(),
  }).allow(null).required(),
  title: Joi.string().required(),
});

const clubSchema = Joi.object({
  activites: Joi.array().items(activitySchema).optional(),
  address: Joi.object().required(),
  email: Joi.string().allow('', null).optional(),
  geohash: Joi.string().optional(),
  id: Joi.number().required(),
  isCustomer: Joi.boolean().required().default(false),
  maxTeamNumber: Joi.number().required().default(0),
  name: Joi.string().required(),
  phoneNumber: Joi.string().allow('', null).optional(),
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
  try {
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
  const response = await client.get(`/clubs/${id}`, {
    params: {
      populate: {
        activites: {
          populate: '*',
        },
        members: {
          populate: '*',
        },
        sponsor: {
          populate: 'logo',
        },
      },
    },
  });
  try {
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

/**
 * Update a club with form data
 * @param {Club} clubData - The club data to update
 * @returns {Promise<Club>} - The updated club data
 */
export const updateClub = async (clubData) => {
  try {
    const formData = new FormData();
    const clubDataCopy = {
      ...clubData,
      activites: clubData.activites?.map(({ documentId }) => documentId) || undefined,
      members: clubData.members?.map(({ documentId }) => documentId) || undefined,
    };

    Object.keys(clubDataCopy).forEach((key) => {
      // @ts-expect-error because keys are defined just above
      if (clubDataCopy[key] === undefined || clubDataCopy[key] === null || clubDataCopy[key] === '') {
        // @ts-expect-error because keys are defined just above
        delete clubDataCopy[key];
      }
    });

    // Handle sponsor data
    if (clubDataCopy.sponsor && Array.isArray(clubDataCopy.sponsor)) {
      // Process each sponsor separately
      clubDataCopy.sponsor.forEach((sponsor, index) => {
      // Handle logo file
        if (sponsor.logo && sponsor.logo.path) {
          const fileToUpload = {
            name: sponsor.logo.path.split('/').pop(),
            type: sponsor.logo.mime,
            uri: Platform.OS === 'ios' ? sponsor.logo.path.replace('file://', '') : sponsor.logo.path,
          };
          // @ts-expect-error because of react native image type
          formData.append(`sponsor[${index}][logo]`, fileToUpload);
        }
        if (sponsor.logo && sponsor.logo.id) {
          formData.append(`sponsor[${index}][logo]`, sponsor.logo.id);
        }

        // Append other sponsor fields
        if (sponsor.title) {
          formData.append(`sponsor[${index}][title]`, sponsor.title);
        }

        if (sponsor.link) {
          formData.append(`sponsor[${index}][link]`, sponsor.link);
        }
      });

      // Remove the sponsor from clubDataCopy as we've handled it separately
      delete clubDataCopy.sponsor;
    }

    // Handle activities data
    if (clubDataCopy.activites && Array.isArray(clubDataCopy.activites)) {
      clubDataCopy.activites.forEach((activity, index) => {
        formData.append(`activites[${index}]`, activity);
      });

      // Remove the activities from clubDataCopy as we've handled them separately
      delete clubDataCopy.activites;
    }

    // Handle members data
    if (clubDataCopy.members && Array.isArray(clubDataCopy.members)) {
      clubDataCopy.members.forEach((member, index) => {
        formData.append(`members[${index}]`, member || '');
      });

      // Remove the members from clubDataCopy as we've handled them separately
      delete clubDataCopy.members;
    }
    // Handle address data
    if (clubDataCopy.address && typeof clubDataCopy.address === 'object') {
      Object.entries(clubDataCopy.address).forEach(([addressKey, addressValue]) => {
        if (addressValue !== null && addressValue !== undefined) {
          formData.append(
            `address[${addressKey}]`,
            typeof addressValue === 'object'
              ? JSON.stringify(addressValue)
              : addressValue.toString(),
          );
        }
      });

      // Remove the address from clubDataCopy as we've handled it separately
      delete clubDataCopy.address;
    }

    // Append all club data
    Object.entries(clubDataCopy).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
      }
    });

    const response = await client.put(`/clubs/${clubData?.documentId}/custom`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
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
    throw new Error(`Failed to update club: ${errorToDisplay}`);
  }
};
