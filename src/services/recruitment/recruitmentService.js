import client from '@/services/client';

const normalizeRecruitmentAd = (ad) => {
  if (!ad || typeof ad !== 'object') {
    return ad;
  }

  let candidates = [];
  if (Array.isArray(ad.candidates)) {
    candidates = ad.candidates;
  } else if (Array.isArray(ad.applications)) {
    candidates = ad.applications;
  }

  return {
    ...ad,
    applications: candidates,
    candidates,
    candidatesCount: candidates.length,
  };
};

const normalizeRecruitmentCollection = (items) => (
  Array.isArray(items) ? items.map((item) => normalizeRecruitmentAd(item)) : []
);

const normalizeUserReference = (userRef) => {
  if (!userRef) {
    return { documentId: undefined, id: undefined };
  }

  if (typeof userRef === 'object') {
    const documentId = typeof userRef.documentId === 'string' ? userRef.documentId.trim() : undefined;
    const numericId = Number(userRef.id);

    return {
      documentId: documentId || undefined,
      id: Number.isFinite(numericId) ? numericId : undefined,
    };
  }

  const normalizedValue = String(userRef).trim();
  if (!normalizedValue) {
    return { documentId: undefined, id: undefined };
  }

  if (/^\d+$/.test(normalizedValue)) {
    return {
      documentId: undefined,
      id: Number.parseInt(normalizedValue, 10),
    };
  }

  return {
    documentId: normalizedValue,
    id: undefined,
  };
};

const buildCandidateFilter = (userRef) => {
  const { documentId, id } = normalizeUserReference(userRef);
  if (documentId) {
    return {
      documentId: {
        $eq: documentId,
      },
    };
  }

  if (Number.isFinite(id)) {
    return {
      id: {
        $eq: id,
      },
    };
  }

  return undefined;
};

/**
 * Get recruitment ads matching player profile
 * @param {object} filters - Filters for matching
 * @param {string} [filters.sport] - Sport to match
 * @param {string} [filters.section] - Section (Masculine/Féminine)
 * @param {string} [filters.category] - Category (U15, Senior, etc.)
 * @param {string} [filters.minLevel] - Player's level for comparison
 * @param {boolean} [filters.isActive] - Only active ads
 * @param {number} [filters.page] - Page number (default 1)
 * @param {number} [filters.pageSize] - Page size (default 20)
 * @returns {Promise<any>} Response with data and meta
 */
export const getRecruitmentAds = async (filters = {}) => {
  try {
    const { page = 1, pageSize = 20 } = filters;
    const params = {
      filters: {
        isActive: true,
      },
      pagination: {
        page,
        pageSize,
      },
      populate: [
        'team',
        'team.club',
        'team.club.logo',
        'team.club.sponsor',
        'team.club.sponsor.logo',
        'author',
        'event',
        'candidates',
        'category',
        'section',
        'level',
      ],
      sort: ['createdAt:desc'],
    };

    // Apply filters
    if (filters.sport) {
      params.filters.sport = { $eqi: filters.sport };
    }
    if (filters.section) {
      params.filters.section = { $eqi: filters.section };
    }
    if (filters.category) {
      params.filters.category = { $eqi: filters.category };
    }

    // Note: minLevel comparison will need server-side logic for proper hierarchy
    // For now, we fetch all and can filter client-side if needed

    const response = await client.get('/recruitment-ads', { params });
    return {
      ...response.data,
      data: normalizeRecruitmentCollection(response.data?.data),
    };
  } catch (error) {
    console.error('[recruitmentService] Error fetching ads:', error);
    throw error;
  }
};

/**
 * Get a single recruitment ad by ID
 * @param {string} adId - Ad documentId
 * @returns {Promise<object>} Ad data
 */
export const getRecruitmentAd = async (adId) => {
  try {
    const params = {
      populate: [
        'team',
        'team.club',
        'team.club.logo',
        'team.club.sponsor',
        'team.club.sponsor.logo',
        'author',
        'event',
        'candidates',
        'category',
        'section',
        'level',
      ],
    };

    const response = await client.get(`/recruitment-ads/${adId}`, { params });
    return normalizeRecruitmentAd(response.data?.data);
  } catch (error) {
    console.error('[recruitmentService] Error fetching single ad:', error);
    throw error;
  }
};

/**
 * Get my recruitment ads (as a coach)
 * @returns {Promise<Array>} Array of my ads
 */
export const getMyRecruitmentAds = async () => {
  try {
    const response = await client.get('/recruitment-ads', {
      params: {
        filters: {
          // The backend should filter by author = current user
          // We'll rely on the controller to handle this
        },
        populate: [
          'team',
          'team.club',
          'team.club.logo',
          'team.club.sponsor',
          'team.club.sponsor.logo',
          'author',
          'event',
          'candidates',
          'category',
          'section',
          'level',
        ],
        sort: ['createdAt:desc'],
      },
    });
    return normalizeRecruitmentCollection(response.data?.data);
  } catch (error) {
    console.error('[recruitmentService] Error fetching my ads:', error);
    throw error;
  }
};

/**
 * Create a recruitment ad
 * @param {object} adData - Ad data
 * @param {string} adData.team - Team documentId
 * @param {string} adData.position - Position required
 * @param {string} [adData.minLevel] - Minimum level required
 * @param {number} [adData.quantity] - Number of positions
 * @param {string} [adData.type] - 'saison' or 'ponctuel'
 * @param {string} [adData.validationMode] - 'auto' or 'manual'
 * @param {string} [adData.event] - Event documentId (for ponctuel type)
 * @returns {Promise<object>} Created ad
 */
export const createRecruitmentAd = async (adData) => {
  try {
    const response = await client.post('/recruitment-ads', {
      data: adData,
    });
    return response.data?.data;
  } catch (error) {
    console.error('[recruitmentService] Error creating ad:', JSON.stringify(error, null, 2));
    if (error.response) {
      console.error('[recruitmentService] Response Data:', JSON.stringify(error.response.data, null, 2));
      console.error('[recruitmentService] Response Status:', error.response.status);
    }
    throw error;
  }
};

/**
 * Apply to a recruitment ad
 * @param {string} adId - Ad documentId
 * @returns {Promise<object>} Application result
 */
export const applyToRecruitmentAd = async (adId) => {
  try {
    const response = await client.post(`/recruitment-ads/${adId}/apply`);
    return response.data;
  } catch (error) {
    console.error('[recruitmentService] Error applying to ad:', error);
    throw error;
  }
};

/**
 * Renew a recruitment ad (extend by 30 days)
 * @param {string} adId - Ad documentId
 * @returns {Promise<object>} Renewal result
 */
export const renewRecruitmentAd = async (adId) => {
  try {
    const response = await client.post(`/recruitment-ads/${adId}/renew`);
    return response.data;
  } catch (error) {
    console.error('[recruitmentService] Error renewing ad:', error);
    throw error;
  }
};

/**
 * Update a recruitment ad
 * @param {string} adId - Ad documentId
 * @param {object} adData - Updated data
 * @returns {Promise<object>} Updated ad
 */
export const updateRecruitmentAd = async (adId, adData) => {
  try {
    const response = await client.put(`/recruitment-ads/${adId}`, {
      data: adData,
    });
    return response.data?.data;
  } catch (error) {
    console.error('[recruitmentService] Error updating ad:', error);
    throw error;
  }
};

/**
 * Delete (soft delete) a recruitment ad
 * @param {string} adId - Ad documentId
 * @returns {Promise<void>}
 */
export const deleteRecruitmentAd = async (adId) => {
  try {
    await client.delete(`/recruitment-ads/${adId}`);
  } catch (error) {
    console.error('[recruitmentService] Error deleting ad:', error);
    throw error;
  }
};
/**
 * Get applications for the current user (ads they applied to)
 * @param {string | number | { id?: string | number, documentId?: string }} userRef - Current user reference
 * @returns {Promise<Array>} Array of ads
 */
export const getMyApplications = async (userRef) => {
  try {
    const candidateFilter = buildCandidateFilter(userRef);
    if (!candidateFilter) return [];

    const params = {
      filters: {
        candidates: candidateFilter,
      },
      populate: [
        'team',
        'team.club',
        'team.club.logo',
        'author',
        'event',
        'category',
        'section',
        'level',
      ],
      sort: ['createdAt:desc'],
    };

    const response = await client.get('/recruitment-ads', { params });
    return normalizeRecruitmentCollection(response.data?.data);
  } catch (error) {
    console.error('[recruitmentService] Error fetching applications:', error);
    throw error;
  }
};
