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
  geohash: Joi.string().allow('', null).optional(),
  id: Joi.number().required(),
  isCustomer: Joi.boolean().required().default(false),
  maxTeamNumber: Joi.number().required().default(0),
  name: Joi.string().required(),
  phoneNumber: Joi.string().allow('', null).optional(),
  sponsor: Joi.array().items(sponsorSchema).optional(),
}).required();

const clubListSchema = Joi.object({
  activites: Joi.array().items(activitySchema).optional(),
  address: Joi.object().optional(), // Optional for multisport clubs
  documentId: Joi.string().optional(),
  email: Joi.string().allow('', null).optional(),
  geohash: Joi.string().allow('', null).optional(),
  id: Joi.number().required(),
  isCustomer: Joi.boolean().optional().default(false), // Optional for multisport
  maxTeamNumber: Joi.number().optional(), // Optional - multisport uses maxSectionNumber
  maxSectionNumber: Joi.number().optional(), // For multisport clubs
  name: Joi.string().required(),
  phoneNumber: Joi.string().allow('', null).optional(),
  _type: Joi.string().valid('club', 'multisport').optional(), // Type indicator
  sectionsCount: Joi.number().optional(), // For multisport clubs
}).required();

/**
 * Get the list of clubs
 * @param {{
 *   activity?: string;
 *   geohash?: string[];
 *   name?: string;
 *   page?: number;
 *   pageSize?: number;
 *   includeMultisport?: boolean;
 * }} params
 * @returns {Promise<{data: Club[], meta: {
 * pagination: { page: number; pageSize: number; pageCount: number; total: number; } }}>}
 */
export const getClubs = async (params = {}) => {
  const {
    activity,
    geohash,
    isCustomer,
    name,
    page,
    pageSize,
    includeMultisport = true, // By default, include multisport clubs
  } = params;

  const filters = {
    filters: {},
    pagination: {
      page: page || 1,
      pageSize: pageSize || 7,
    },
    sort: {
      isCustomer: 'desc',
      name: 'asc',
    },
    populate: {
      logo: true,
      sponsor: {
        populate: ['logo'],
      },
    },
  };

  if (isCustomer !== undefined) {
    filters.filters = {
      ...filters.filters,
      isCustomer,
    };
  }

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

  // Fetch regular clubs
  const clubsResponse = await client.get('/clubs', { params: filters });
  
  // Add type marker to regular clubs
  const clubsWithType = (clubsResponse.data?.data || []).map(club => ({
    ...club,
    _type: 'club',
  }));

  let allData = clubsWithType;
  let totalFromCM = 0;

  // Fetch multisport clubs if requested and on first page
  if (includeMultisport && (page || 1) === 1) {
    try {
      const cmFilters = {
        pagination: { page: 1, pageSize: 10 },
        populate: {
          logo: true,
          sections: { fields: ['documentId', 'name'] },
          sponsor: { populate: ['logo'] },
        },
      };

      if (name) {
        cmFilters.filters = { name: { $containsi: name } };
      }

      if (geohash && geohash.length) {
        cmFilters.filters = {
          ...cmFilters.filters,
          geohash: { $contains: geohash },
        };
      }

      const cmResponse = await client.get('/multisport-clubs', { params: cmFilters });
      const cmWithType = (cmResponse.data?.data || []).map(cm => ({
        ...cm,
        _type: 'multisport',
        sectionsCount: cm.sections?.length || 0,
      }));

      // Prepend multisport clubs at the top
      allData = [...cmWithType, ...clubsWithType];
      totalFromCM = cmResponse.data?.meta?.pagination?.total || 0;
    } catch (error) {
      // If CM fetch fails, just use regular clubs
      console.warn('Failed to fetch multisport clubs:', error.message);
    }
  }

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

    // Update pagination total to include CM count
    const originalMeta = clubsResponse.data?.meta || {};
    const updatedMeta = {
      ...originalMeta,
      pagination: {
        ...originalMeta.pagination,
        total: (originalMeta.pagination?.total || 0) + totalFromCM,
      },
    };

    const validationResult = await schema.validateAsync(
      { data: allData, meta: updatedMeta },
      { allowUnknown: true }
    );
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
        logo: true,
        members: {
          populate: ['avatar', 'role'],
        },
        sponsor: {
          populate: 'logo',
        },
        teams: {
          populate: '*',
        },
        parentMultisport: {
          fields: ['documentId', 'name'],
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
    console.log('[DEBUG - FRONTEND] ========== UPDATE CLUB START ==========');
    console.log('[DEBUG - FRONTEND] Input clubData:', JSON.stringify(clubData, null, 2));

    const formData = new FormData();
    const clubDataCopy = {
      ...clubData,
      activites: clubData.activites?.map(({ documentId }) => documentId) || undefined,
      members: clubData.members?.map(({ documentId }) => documentId) || undefined,
    };

    // Log club logo info
    if (clubData.logo) {
      console.log('[DEBUG - FRONTEND] Club Logo:', {
        hasDocumentId: !!clubData.logo.documentId,
        hasId: !!clubData.logo.id,
        documentId: clubData.logo.documentId,
        id: clubData.logo.id,
        url: clubData.logo.url,
      });
    }

    // Log sponsors info
    if (clubData.sponsor && Array.isArray(clubData.sponsor)) {
      console.log('[DEBUG - FRONTEND] Sponsors count:', clubData.sponsor.length);
      clubData.sponsor.forEach((sponsor, index) => {
        console.log(`[DEBUG - FRONTEND] Sponsor[${index}]:`, {
          title: sponsor.title,
          hasLogo: !!sponsor.logo,
          logoHasDocumentId: sponsor.logo?.documentId ? true : false,
          logoHasId: sponsor.logo?.id ? true : false,
          logoDocumentId: sponsor.logo?.documentId,
          logoId: sponsor.logo?.id,
          logoUrl: sponsor.logo?.url,
        });
      });
    }

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
      for (let i = 0; i < clubDataCopy.sponsor.length; i++) {
        const sponsor = clubDataCopy.sponsor[i];
        console.warn('Processing sponsor', i, sponsor.logo);

        // Only append if this is a NEW file to upload (has .path property)
        if (sponsor.logo && sponsor.logo.path) {
          // NEW FILE UPLOAD
          console.warn('Appended file for sponsor', i);
          formData.append(`sponsor[${i}][logo]`, {
            name: sponsor.logo.filename,
            type: sponsor.logo.mime,
            uri: Platform.OS === 'android' ? sponsor.logo.path : sponsor.logo.path.replace('file://', ''),
          });
        } else {
          // EXISTING LOGO - DO NOT SEND ANYTHING
          // This prevents sending invalid documentIds that don't exist
          console.warn(`Sponsor ${i} - skipping logo (no new file to upload)`);
        }

        formData.append(`sponsor[${i}][title]`, sponsor.title);
        if (sponsor.link) {
          formData.append(`sponsor[${i}][link]`, sponsor.link);
        }
        if (sponsor.id) {
          formData.append(`sponsor[${i}][id]`, sponsor.id.toString());
        }
      }

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

    // Handle teams data
    if (clubDataCopy.teams && Array.isArray(clubDataCopy.teams)) {
      clubDataCopy.teams.forEach((team, index) => {
        formData.append(`teams[${index}]`, team?.documentId || '');
      });

      // Remove the teams from clubDataCopy as we've handled them separately
      delete clubDataCopy.teams;
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

    }

    // Handle club logo
    if (clubDataCopy.logo) {
      if (clubDataCopy.logo.documentId) {
        formData.append('logo', clubDataCopy.logo.documentId);
      } else if (clubDataCopy.logo.id) {
        formData.append('logo', clubDataCopy.logo.id);
      }
      delete clubDataCopy.logo;
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
    console.error('updateClub error full:', JSON.stringify(error.response?.data || error, null, 2));
    const errorToDisplay = error?.response?.data?.error?.message || error?.message || JSON.stringify(error);
    throw new Error(`Failed to update club: ${errorToDisplay}`);
  }
};
/**
 * Update club info (name, email, phone, address, logo)
 * @param {Club} clubData - The club data to update
 * @returns {Promise<Club>} - The updated club data
 */
/**
 * Upload a file to Strapi
 * @param {object} file - The file object (from image picker)
 * @returns {Promise<number>} - The uploaded file ID
 */
export const uploadFile = async (file) => {
  try {
    const formData = new FormData();
    const fileToUpload = {
      name: file.filename || `image.${file.path.split('.').pop()}`,
      type: file.mime,
      uri: Platform.OS === 'ios' ? file.path.replace('file://', '') : file.path,
    };
    // @ts-expect-error because of react native image type
    formData.append('files', fileToUpload);

    const response = await client.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data && response.data.length > 0) {
      return response.data[0].documentId || response.data[0].id;
    }
    throw new Error('Upload failed: No data received');
  } catch (error) {

    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : 'Unknown error';
    throw new Error(`Failed to upload file: ${errorToDisplay}`);
  }
};

/**
 * Update club info (name, email, phone, address, logo)
 * @param {Club} clubData - The club data to update
 * @returns {Promise<Club>} - The updated club data
 */
export const updateClubInfo = async (clubData) => {
  try {
    const clubDataCopy = { ...clubData };
    let logoId = null;

    // Handle logo file upload if it's a new file (has path)
    if (clubDataCopy.logo && clubDataCopy.logo.path) {
      logoId = await uploadFile(clubDataCopy.logo);
    } else if (clubDataCopy.logo && clubDataCopy.logo.id) {
      // Keep existing logo if not changed
      logoId = clubDataCopy.logo.id;
    }

    // Remove logo object from payload
    delete clubDataCopy.logo;

    // Remove empty properties
    Object.keys(clubDataCopy).forEach((key) => {
      // @ts-expect-error because keys are defined just above
      if (clubDataCopy[key] === undefined || clubDataCopy[key] === null || clubDataCopy[key] === '') {
        // @ts-expect-error because keys are defined just above
        delete clubDataCopy[key];
      }
    });

    // Prepare payload
    const payload = {
      ...clubDataCopy,
      ...(logoId && { logo: logoId }),
    };

    // Send as JSON
    const response = await client.put(`/clubs/${clubData.documentId}/update-info`, payload);

    const schema = Joi.object({
      data: clubSchema.required(),
    }).required();

    const validationResult = await schema.validateAsync(response.data, {
      allowUnknown: true,
    });

    return validationResult.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to update club info: ${errorToDisplay}`);
  }
};
