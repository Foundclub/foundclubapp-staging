/* eslint-disable perfectionist/sort-imports */
import Joi from 'joi';
import { Platform } from 'react-native';

import { getAuthTokens } from '@/domains/auth/authUseCases';
import { getUploadEndpoint } from '@/config/runtimeUrls';

import client from '../client';
/* eslint-enable perfectionist/sort-imports */

/**
 * Club validation schema
 * @param value
 */
const extractRelationDocumentId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'object') {
    if (typeof value.documentId === 'string' && value.documentId.trim()) return value.documentId.trim();
    if (typeof value.id === 'string' && value.id.trim()) return value.id.trim();
    if (typeof value.id === 'number' && Number.isFinite(value.id)) return String(value.id);
  }
  return null;
};

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

const normalizeClubGovernanceSettings = (club) => {
  if (!club || typeof club !== 'object') {
    return club;
  }

  let clubMembersPublicVisibility = true;
  if (typeof club.clubMembersPublicVisibility === 'boolean') {
    clubMembersPublicVisibility = club.clubMembersPublicVisibility;
  } else if (typeof club.clubMembersPublicVisibility === 'string') {
    const normalized = club.clubMembersPublicVisibility.trim().toLowerCase();
    if (normalized === 'false') {
      clubMembersPublicVisibility = false;
    } else {
      clubMembersPublicVisibility = true;
    }
  }

  const membershipRequestManagementMode = [
    'CLUB_OWNER_ONLY',
    'COACH_ALLOWED_BY_TEAM',
  ].includes(club.membershipRequestManagementMode)
    ? club.membershipRequestManagementMode
    : 'COACH_ALLOWED_BY_TEAM';

  return {
    ...club,
    clubMembersPublicVisibility,
    membershipRequestManagementMode,
  };
};

const clubSchema = Joi.object({
  activites: Joi.array().items(activitySchema).optional(),
  address: Joi.object().required(),
  clubMembersPublicVisibility: Joi.boolean().optional(),
  clubPartner: Joi.boolean().allow(null).optional().default(false),
  clubVerified: Joi.boolean().allow(null).optional().default(false),
  email: Joi.string().allow('', null).optional(),
  geohash: Joi.string().allow('', null).optional(),
  id: Joi.number().required(),
  isCustomer: Joi.boolean().allow(null).optional().default(false),
  maxTeamNumber: Joi.number().allow(null).optional().default(0),
  members: Joi.array().items(Joi.object().unknown(true)).optional(),
  membersAreHidden: Joi.boolean().optional(),
  membersCount: Joi.number().optional(),
  membershipRequestManagementMode: Joi.string().valid('CLUB_OWNER_ONLY', 'COACH_ALLOWED_BY_TEAM').optional(),
  name: Joi.string().required(),
  phoneNumber: Joi.string().allow('', null).optional(),
  sponsor: Joi.array().items(sponsorSchema).optional(),
}).required();

const clubListSchema = Joi.object({
  _type: Joi.string().valid('club', 'multisport').optional(), // Type indicator
  activites: Joi.array().items(activitySchema).optional(),
  address: Joi.object().optional(), // Optional for multisport clubs
  clubPartner: Joi.boolean().allow(null).optional().default(false),
  clubVerified: Joi.boolean().allow(null).optional().default(false),
  documentId: Joi.string().optional(),
  email: Joi.string().allow('', null).optional(),
  geohash: Joi.string().allow('', null).optional(),
  id: Joi.number().required(),
  isCustomer: Joi.boolean().allow(null).optional().default(false), // Optional for multisport
  maxSectionNumber: Joi.number().optional(), // For multisport clubs
  maxTeamNumber: Joi.number().optional(), // Optional - multisport uses maxSectionNumber
  name: Joi.string().required(),
  phoneNumber: Joi.string().allow('', null).optional(),
  sectionsCount: Joi.number().optional(), // For multisport clubs
}).required();

const validateClubListPayload = async (data, meta) => {
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

  return schema.validateAsync(
    { data, meta },
    { allowUnknown: true },
  );
};

const buildClubListParams = (params = {}) => {
  const {
    activity,
    clubPartner,
    geohash,
    isCustomer,
    name,
    page,
    pageSize,
  } = params;

  /** @type {Record<string, any>} */
  const filters = {
    filters: {},
    pagination: {
      page: page || 1,
      pageSize: pageSize || 7,
    },
    populate: {
      logo: true,
      sponsor: {
        populate: ['logo'],
      },
    },
    sort: {
      clubPartner: 'desc',
      name: 'asc',
    },
  };

  if (clubPartner !== undefined) {
    filters.filters = {
      ...filters.filters,
      clubPartner,
    };
  } else if (isCustomer !== undefined) {
    filters.filters = {
      ...filters.filters,
      clubPartner: isCustomer,
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

  return filters;
};

const buildMultisportClubListParams = (params = {}) => {
  const {
    geohash,
    name,
    page,
    pageSize,
  } = params;

  /** @type {Record<string, any>} */
  const filters = {
    pagination: {
      page: page || 1,
      pageSize: pageSize || 10,
    },
    populate: {
      logo: true,
      sections: { fields: ['documentId', 'name'] },
      sponsor: { populate: ['logo'] },
    },
    sort: {
      name: 'asc',
    },
  };

  if (name) {
    filters.filters = {
      ...(filters.filters || {}),
      name: {
        $containsi: name,
      },
    };
  }

  if (geohash && geohash.length) {
    filters.filters = {
      ...(filters.filters || {}),
      geohash: {
        $contains: geohash,
      },
    };
  }

  return filters;
};

/**
 * Get the list of clubs
 * @param {{
 *   activity?: string;
 *   geohash?: string[];
 *   isCustomer?: boolean;
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
    includeMultisport = true, // By default, include multisport clubs
    page,
  } = params;
  const filters = buildClubListParams(params);

  // Fetch regular clubs
  const clubsResponse = await client.get('/clubs', { params: filters });

  // Add type marker to regular clubs
  const clubsWithType = (clubsResponse.data?.data || []).map((/** @type {Club} */ club) => ({
    ...club,
    _type: 'club',
  }));

  let allData = clubsWithType;
  let totalFromCM = 0;

  // Fetch multisport clubs if requested and on first page
  if (includeMultisport && (page || 1) === 1) {
    try {
      const cmResponse = await getMultisportClubs({ ...params, page: 1, pageSize: 10 });
      const cmWithType = cmResponse?.data || [];

      // Prepend multisport clubs at the top
      allData = [...cmWithType, ...clubsWithType];
      totalFromCM = cmResponse.meta?.pagination?.total || 0;
    } catch (error) {
      // If CM fetch fails, just use regular clubs
      const message = error && typeof error === 'object' && 'message' in error ? error.message : error;
      console.warn('Failed to fetch multisport clubs:', message);
    }
  }

  try {
    // Update pagination total to include CM count
    const originalMeta = clubsResponse.data?.meta || {};
    const updatedMeta = {
      ...originalMeta,
      pagination: {
        ...originalMeta.pagination,
        total: (originalMeta.pagination?.total || 0) + totalFromCM,
      },
    };

    return validateClubListPayload(allData, updatedMeta);
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch clubs: ${errorToDisplay}`);
  }
};

/**
 * Get the list of multisport clubs
 * @param {{
 *   geohash?: string[];
 *   name?: string;
 *   page?: number;
 *   pageSize?: number;
 * }} params
 * @returns {Promise<{data: Club[], meta: {
 * pagination: { page: number; pageSize: number; pageCount: number; total: number; } }}>}
 */
export const getMultisportClubs = async (params = {}) => {
  const filters = buildMultisportClubListParams(params);
  const response = await client.get('/multisport-clubs', { params: filters });

  const multisportClubsWithType = (response.data?.data || []).map((/** @type {any} */ cm) => ({
    ...cm,
    _type: 'multisport',
    sectionsCount: cm.sections?.length || 0,
  }));

  try {
    return await validateClubListPayload(multisportClubsWithType, response.data?.meta || {
      pagination: {
        page: filters.pagination.page,
        pageCount: 1,
        pageSize: filters.pagination.pageSize,
        total: multisportClubsWithType.length,
      },
    });
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to fetch multisport clubs: ${errorToDisplay}`);
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
        parentMultisport: {
          fields: ['documentId', 'name'],
        },
        sponsor: {
          populate: 'logo',
        },
        teams: {
          populate: '*',
        },
      },
    },
  });
  try {
    const normalizedData = normalizeClubGovernanceSettings(response.data?.data);
    const schema = Joi.object({
      data: clubSchema.required(),
    }).required();

    const validationResult = await schema.validateAsync({
      ...response.data,
      data: normalizedData,
    }, {
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
      activites: Array.isArray(clubData.activites)
        ? clubData.activites.map(extractRelationDocumentId).filter(Boolean)
        : undefined,
      members: Array.isArray(clubData.members)
        ? clubData.members.map(extractRelationDocumentId).filter(Boolean)
        : undefined,
    };

    // Log club logo info
    if (clubData.logo) {
      console.log('[DEBUG - FRONTEND] Club Logo:', {
        documentId: clubData.logo.documentId,
        hasDocumentId: !!clubData.logo.documentId,
        hasId: !!clubData.logo.id,
        id: clubData.logo.id,
        url: clubData.logo.url,
      });
    }

    // Log sponsors info
    if (clubData.sponsor && Array.isArray(clubData.sponsor)) {
      console.log('[DEBUG - FRONTEND] Sponsors count:', clubData.sponsor.length);
      clubData.sponsor.forEach((sponsor, index) => {
        console.log(`[DEBUG - FRONTEND] Sponsor[${index}]:`, {
          hasLogo: !!sponsor.logo,
          logoDocumentId: sponsor.logo?.documentId,
          logoHasDocumentId: !!sponsor.logo?.documentId,
          logoHasId: !!sponsor.logo?.id,
          logoId: sponsor.logo?.id,
          logoUrl: sponsor.logo?.url,
          title: sponsor.title,
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
      for (let i = 0; i < clubDataCopy.sponsor.length; i += 1) {
        const sponsor = clubDataCopy.sponsor[i];
        console.warn('Processing sponsor', i, sponsor.logo);

        // Only append if this is a NEW file to upload (has .path property)
        if (sponsor.logo && sponsor.logo.path) {
          // NEW FILE UPLOAD
          console.warn('Appended file for sponsor', i);
          const sponsorLogoPath = sponsor.logo.path || '';
          // @ts-expect-error - React Native FormData supports file descriptor objects.
          formData.append(`sponsor[${i}][logo]`, {
            name: sponsor.logo.filename || `sponsor_${i}.jpg`,
            type: sponsor.logo.mime || 'image/jpeg',
            uri: Platform.OS === 'android' ? sponsorLogoPath : sponsorLogoPath.replace('file://', ''),
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
        formData.append(`teams[${index}]`, extractRelationDocumentId(team) || '');
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
      // If it's a new file (has path/uri), append it as a file
      if (clubDataCopy.logo.path || clubDataCopy.logo.uri) {
        const logoFileUri = clubDataCopy.logo.path || clubDataCopy.logo.uri || '';
        const fileToUpload = {
          name: clubDataCopy.logo.filename || 'club_logo.jpg',
          type: clubDataCopy.logo.mime || 'image/jpeg',
          uri: Platform.OS === 'android'
            ? logoFileUri
            : logoFileUri.replace('file://', ''),
        };
        // Use 'files.logo' if Strapi controller expects files.field
        // OR just 'logo' if using standard upload middleware.
        // Usually for custom controllers, we might need to handle 'files' manually or use 'files.logo'.
        // Based on sponsor logic `sponsor[${i}][logo]`, let's try appending to `files.logo` or `logo`.
        // Strapi default upload usually looks for `files` key.
        // Let's assume standard multipart: `logo` as key for file.
        // @ts-expect-error - React Native FormData supports file descriptor objects.
        formData.append('files.logo', fileToUpload);
      } else if (clubDataCopy.logo.documentId) {
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
    const normalizedError = /** @type {any} */ (error);
    console.error('updateClub error full:', JSON.stringify(normalizedError?.response?.data || normalizedError, null, 2));
    const errorToDisplay = normalizedError?.response?.data?.error?.message
      || normalizedError?.message
      || JSON.stringify(normalizedError);
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
 * @returns {Promise<{ id: number | string; documentId: string | number }>} - Uploaded file references
 */
export const uploadFile = async (file) => {
  try {
    console.log('[DEBUG] Uploading file payload:', JSON.stringify(file));

    // Safety check for file object
    // @ts-expect-error - file type definition is partial
    if (!file || !file.path) {
      throw new Error('Invalid file object provided for upload');
    }

    const formData = new FormData();

    // Robust name generation
    // @ts-expect-error - file type definition
    const extension = file.path.split('.').pop() || 'jpg';
    // @ts-expect-error - file type definition
    const fileName = file.filename || `upload_${Date.now()}.${extension}`;

    // Robust mime type
    // @ts-expect-error - file type definition
    const mimeType = file.mime || 'image/jpeg';

    const fileToUpload = {
      name: fileName,
      type: mimeType,
      // @ts-expect-error - file type definition
      uri: Platform.OS === 'ios' ? file.path.replace('file://', '') : file.path,
    };

    console.log('[DEBUG] FormData file:', JSON.stringify(fileToUpload));

    // @ts-expect-error because of react native image type
    formData.append('files', fileToUpload);

    const auth = getAuthTokens();
    const token = auth?.token;
    const uploadEndpoint = getUploadEndpoint();
    if (!uploadEndpoint) {
      throw new Error('Upload endpoint is missing');
    }

    console.log('[DEBUG] UPLOAD URL:', uploadEndpoint);
    console.log('[DEBUG] UPLOAD Headers:', JSON.stringify({ Authorization: token ? 'Bearer [HIDDEN]' : 'None' }));

    // Use native fetch to avoid Axios issues with FormData on Android
    const response = await fetch(uploadEndpoint, {
      body: formData,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // Do NOT set Content-Type manually, fetch sets it with boundary
      },
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || errorData?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data && data.length > 0) {
      console.log('[DEBUG] Upload success. ID:', data[0].id);
      return {
        documentId: data[0].documentId || data[0].id,
        id: data[0].id,
      };
    }
    throw new Error('Upload failed: No data received from server');
  } catch (error) {
    console.error('[DEBUG] Upload Error Full:', error);
    // @ts-expect-error - unknown error type
    const errorToDisplay = error?.message || 'Unknown upload error';
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
      const uploadResult = await uploadFile(clubDataCopy.logo);
      logoId = uploadResult.id; // Use INTERNAL ID for strapi.db relations
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
    const requestError = /** @type {any} */ (error);
    const responseError = requestError?.response?.data?.error;
    const responseData = requestError?.response?.data;
    const errorToDisplay = responseError?.message
      || responseData?.message
      || (requestError && typeof requestError === 'object' && 'message' in requestError ? requestError.message : requestError)
      || 'Unknown error';
    const nextError = /** @type {any} */ (new Error(`Failed to update club info: ${errorToDisplay}`));
    nextError.code = responseError?.code || responseData?.code || requestError?.code || null;
    nextError.details = responseError?.details || responseData?.details || requestError?.details || null;
    nextError.status = Number(
      requestError?.status
      || requestError?.response?.status
      || responseError?.status
      || responseData?.status
      || 0,
    ) || null;
    if (nextError?.details?.decision) {
      nextError.decision = nextError.details.decision;
    }
    throw nextError;
  }
};

/**
 * Claim a club
 * @param {string|number} clubId - The club ID
 * @returns {Promise<any>} - The response
 */
export const claimClub = async (clubId) => {
  try {
    const response = await client.post(`/clubs/${clubId}/claim`);
    return response.data;
  } catch (error) {
    const errorToDisplay = error && typeof error === 'object' && 'message' in error ? error.message : error;
    throw new Error(`Failed to claim club: ${errorToDisplay}`);
  }
};

/**
 * Création self-service d'un club (coach/dirigeant qui ne trouve pas son club).
 * Le serveur crée le club immédiatement (non vérifié) et notifie les superadmins.
 * @param {{
 *   name: string;
 *   coordinates?: { lat: number; lng: number } | null;
 *   addressLabel?: string;
 *   addressDetails?: string;
 *   activityDocumentIds?: string[];
 *   email?: string;
 *   phoneNumber?: string;
 *   alsoDirector?: boolean;
 *   forceCreate?: boolean;
 *   screen?: string;
 * }} payload
 * @returns {Promise<{
 *   duplicate?: boolean;
 *   suggestions?: Array<{ documentId: string; name: string; addressDetails: string | null }>;
 *   club?: any;
 *   clubRequestDocumentId?: string | null;
 * }>}
 */
export const createSelfOnboardClub = async (payload) => {
  try {
    const response = await client.post('/clubs/self-onboard', { data: payload });
    // 201 : { data: club, clubRequestDocumentId }
    return {
      club: response.data?.data || response.data,
      clubRequestDocumentId: response.data?.clubRequestDocumentId || null,
      duplicate: false,
    };
  } catch (error) {
    // 409 : doublon suspecté → on renvoie les suggestions au tunnel (choix explicite).
    const status = error?.response?.status;
    const details = error?.response?.data?.error?.details;
    if (status === 409 && details?.code === 'CLUB_DUPLICATE_SUSPECTED') {
      return {
        duplicate: true,
        suggestions: Array.isArray(details.suggestions) ? details.suggestions : [],
      };
    }
    const message = error?.response?.data?.error?.message
      || (error && typeof error === 'object' && 'message' in error ? error.message : null)
      || 'Impossible de créer le club.';
    throw new Error(String(message));
  }
};
