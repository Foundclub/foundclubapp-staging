import client from '@/services/client';

const normalizeApplicationStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'accepted') return 'accepted';
  if (normalized === 'declined') return 'declined';
  if (normalized === 'withdrawn') return 'withdrawn';
  if (normalized === 'cancelled') return 'cancelled';
  return 'pending';
};

const normalizeAudienceType = (value) => (
  String(value || '').trim().toLowerCase() === 'coach' ? 'coach' : 'player'
);

const normalizeRecruitmentApplication = (application) => {
  if (!application || typeof application !== 'object') return application;
  return {
    ...application,
    status: normalizeApplicationStatus(application.status),
  };
};

const mapApplicationToRecruitmentAd = (application) => {
  const normalizedApplication = normalizeRecruitmentApplication(application);
  const normalizedAd = normalizeRecruitmentAd(normalizedApplication?.recruitmentAd || {});
  return {
    ...normalizedAd,
    applicationStatus: normalizedApplication?.status || null,
    currentUserApplication: normalizedApplication,
    myApplication: normalizedApplication,
  };
};

const normalizeRecruitmentAd = (ad) => {
  if (!ad || typeof ad !== 'object') {
    return ad;
  }

  const applications = Array.isArray(ad.applications)
    ? ad.applications.map((application) => normalizeRecruitmentApplication(application))
    : [];
  let candidates = [];
  if (Array.isArray(ad.candidates)) {
    candidates = ad.candidates;
  }

  return {
    ...ad,
    applications,
    applicationsCount: applications.length,
    audienceType: normalizeAudienceType(ad.audienceType),
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

const normalizeParticipationStatus = (value) => String(value || '').trim().toLowerCase();

const normalizeTypeLabel = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

const normalizeDocumentIds = (values) => {
  const sourceValues = Array.isArray(values) ? values : [values];

  return Array.from(new Set(sourceValues.map((value) => {
    if (!value) return undefined;

    if (typeof value === 'object') {
      const documentId = typeof value.documentId === 'string' ? value.documentId.trim() : '';
      const fallbackId = typeof value.id === 'string' ? value.id.trim() : '';
      return documentId || fallbackId || undefined;
    }

    const normalizedValue = String(value).trim();
    return normalizedValue || undefined;
  }).filter(Boolean)));
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

const userMatchesReference = (candidate, userRef) => {
  const normalizedUserRef = normalizeUserReference(userRef);
  const candidateDocumentId = typeof candidate?.documentId === 'string' ? candidate.documentId.trim() : '';
  const candidateId = Number(candidate?.id);

  if (normalizedUserRef.documentId && candidateDocumentId) {
    return candidateDocumentId === normalizedUserRef.documentId;
  }

  if (Number.isFinite(normalizedUserRef.id) && Number.isFinite(candidateId)) {
    return candidateId === normalizedUserRef.id;
  }

  return false;
};

const getRecruitmentEventDocumentId = (ad) => {
  const value = ad?.event?.documentId || ad?.event?.id;
  return typeof value === 'string' ? value.trim() : String(value || '').trim();
};

const isDetectionRecruitmentAd = (ad) => normalizeTypeLabel(ad?.event?.type?.name).includes('detection');

const getActiveDetectionParticipation = (ad, userRef) => {
  if (!isDetectionRecruitmentAd(ad)) return null;

  const eventParticipations = Array.isArray(ad?.event?.participationRequests)
    ? ad.event.participationRequests
    : [];

  return eventParticipations.find((participation) => (
    participation?.isActive !== false
    && ['accepted', 'pending'].includes(normalizeParticipationStatus(participation?.participationStatus))
    && userMatchesReference(participation?.user, userRef)
  )) || null;
};

const hasDirectCandidateApplication = (ad, userRef) => (
  Array.isArray(ad?.applications)
    ? ad.applications.some((application) => (
      ['accepted', 'pending'].includes(normalizeApplicationStatus(application?.status))
      && userMatchesReference(application?.applicant, userRef)
    ))
    : false
) || (
  Array.isArray(ad?.candidates)
    ? ad.candidates.some((candidate) => userMatchesReference(candidate, userRef))
    : false
);

/**
 * Build a detection application status map keyed by event documentId.
 * @param {Array<any>} ads
 * @param {string | number | { id?: string | number, documentId?: string }} userRef
 * @returns {Record<string, { status: 'accepted' | 'pending', recruitmentAdDocumentId?: string }>}
 */
export const buildDetectionApplicationStatusMap = (ads, userRef) => {
  if (!Array.isArray(ads) || ads.length === 0) return {};

  return ads.reduce((accumulator, ad) => {
    const eventDocumentId = getRecruitmentEventDocumentId(ad);
    if (!eventDocumentId || !isDetectionRecruitmentAd(ad) || accumulator[eventDocumentId]) {
      return accumulator;
    }

    const activeParticipation = getActiveDetectionParticipation(ad, userRef);
    if (activeParticipation) {
      accumulator[eventDocumentId] = {
        recruitmentAdDocumentId: String(
          activeParticipation?.recruitmentAd?.documentId
          || activeParticipation?.recruitmentAd?.id
          || ad?.documentId
          || ad?.id
          || '',
        ).trim(),
        status: /** @type {'accepted' | 'pending'} */ (normalizeParticipationStatus(activeParticipation?.participationStatus)),
      };
      return accumulator;
    }

    if (hasDirectCandidateApplication(ad, userRef)) {
      accumulator[eventDocumentId] = {
        recruitmentAdDocumentId: String(ad?.documentId || ad?.id || '').trim(),
        status: 'pending',
      };
    }

    return accumulator;
  }, {});
};

/**
 * Resolve the application state for a recruitment ad, including detection-wide shared status.
 * @param {any} ad
 * @param {string | number | { id?: string | number, documentId?: string }} userRef
 * @param {Record<string, { status?: string, recruitmentAdDocumentId?: string }>} [sharedDetectionStatusByEvent]
 * @returns {{ hasApplied: boolean, linkedRecruitmentAdDocumentId: string, status: 'accepted' | 'pending' | null }}
 */
export const resolveRecruitmentAdApplicationState = (ad, userRef, sharedDetectionStatusByEvent = {}) => {
  const eventDocumentId = getRecruitmentEventDocumentId(ad);
  const sharedStatus = eventDocumentId ? sharedDetectionStatusByEvent[eventDocumentId] : null;
  const normalizedSharedStatus = normalizeParticipationStatus(sharedStatus?.status);

  if (['accepted', 'pending'].includes(normalizedSharedStatus)) {
    return {
      hasApplied: true,
      linkedRecruitmentAdDocumentId: String(sharedStatus?.recruitmentAdDocumentId || '').trim(),
      status: /** @type {'accepted' | 'pending'} */ (normalizedSharedStatus),
    };
  }

  const activeParticipation = getActiveDetectionParticipation(ad, userRef);
  if (activeParticipation) {
    return {
      hasApplied: true,
      linkedRecruitmentAdDocumentId: String(
        activeParticipation?.recruitmentAd?.documentId
        || activeParticipation?.recruitmentAd?.id
        || ad?.documentId
        || ad?.id
        || '',
      ).trim(),
      status: /** @type {'accepted' | 'pending'} */ (normalizeParticipationStatus(activeParticipation?.participationStatus)),
    };
  }

  if (hasDirectCandidateApplication(ad, userRef)) {
    const matchingApplication = Array.isArray(ad?.applications)
      ? ad.applications.find((application) => userMatchesReference(application?.applicant, userRef))
      : null;
    const nextStatus = normalizeApplicationStatus(matchingApplication?.status);
    return {
      hasApplied: true,
      linkedRecruitmentAdDocumentId: String(ad?.documentId || ad?.id || '').trim(),
      status: ['accepted', 'pending'].includes(nextStatus) ? nextStatus : 'pending',
    };
  }

  return {
    hasApplied: false,
    linkedRecruitmentAdDocumentId: '',
    status: null,
  };
};

/**
 * Get recruitment ads matching player profile
 * @param {object} filters - Filters for matching
 * @param {string} [filters.sport] - Sport to match
 * @param {string} [filters.section] - Section (Masculine/Féminine)
 * @param {string} [filters.category] - Category (U15, Senior, etc.)
 * @param {string | string[]} [filters.position] - Position to match
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
        'event.participationRequests',
        'event.participationRequests.user',
        'event.participationRequests.recruitmentAd',
        'event.type',
        'applications',
        'applications.applicant',
        'applications.reviewedBy',
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
    if (filters.position) {
      const positionFilter = Array.isArray(filters.position) ? filters.position[0] : filters.position;
      if (positionFilter) {
        params.filters.position = { $containsi: positionFilter };
      }
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
        'event.participationRequests',
        'event.participationRequests.user',
        'event.participationRequests.recruitmentAd',
        'event.type',
        'applications',
        'applications.applicant',
        'applications.reviewedBy',
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
 * @param {{
 *  authorDocumentId?: string,
 *  teamIds?: Array<string | number | { documentId?: string, id?: string | number }>
 * }} [filters]
 * @returns {Promise<Array>} Array of my ads
 */
export const getMyRecruitmentAds = async (filters = {}) => {
  try {
    const normalizedAuthorDocumentId = typeof filters.authorDocumentId === 'string'
      ? filters.authorDocumentId.trim()
      : '';
    const normalizedTeamIds = normalizeDocumentIds(filters.teamIds);
    const requestFilters = {};

    if (normalizedTeamIds.length > 0) {
      requestFilters.team = {
        documentId: normalizedTeamIds.length === 1
          ? normalizedTeamIds[0]
          : { $in: normalizedTeamIds },
      };
    } else if (normalizedAuthorDocumentId) {
      requestFilters.author = {
        documentId: normalizedAuthorDocumentId,
      };
    }

    const response = await client.get('/recruitment-ads', {
      params: {
        filters: requestFilters,
        populate: [
          'team',
          'team.club',
          'team.club.logo',
          'team.club.sponsor',
          'team.club.sponsor.logo',
          'author',
          'event',
          'event.participationRequests',
          'event.participationRequests.user',
          'event.participationRequests.recruitmentAd',
          'event.type',
          'applications',
          'applications.applicant',
          'applications.reviewedBy',
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
    const backendMessage = error?.response?.data?.error?.message
      || error?.response?.data?.message
      || error?.message
      || "Impossible de creer l'annonce";
    throw new Error(backendMessage);
  }
};

/**
 * Apply to a recruitment ad
 * @param {string} adId - Ad documentId
 * @param {{ acceptRiskDeclaration?: boolean }} [payload]
 * @returns {Promise<object>} Application result
 */
export const applyToRecruitmentAd = async (adId, payload = {}) => {
  try {
    const response = await client.post(`/recruitment-ads/${adId}/apply`, payload);
    return response.data;
  } catch (error) {
    const status = Number(error?.response?.status || error?.status || 0);
    const backendMessage = String(
      error?.response?.data?.error?.message
      || error?.response?.data?.message
      || error?.message
      || '',
    ).trim();
    const isExpectedBusinessRejection = status === 400
      && /deja candidate|deja une candidature en attente|deja postule|deja validee|deja acceptee|declaration de responsabilite|poste est deja complet|candidature active|detection fermee/i.test(backendMessage);

    if (!isExpectedBusinessRejection) {
      console.error('[recruitmentService] Error applying to ad:', error);
    }

    throw error;
  }
};

export const getRecruitmentApplications = async (adId) => {
  const response = await client.get(`/recruitment-ads/${adId}/applications`);
  return Array.isArray(response.data?.data)
    ? response.data.data.map((application) => normalizeRecruitmentApplication(application))
    : [];
};

export const updateRecruitmentApplicationStatus = async (applicationId, payload) => {
  const response = await client.patch(`/recruitment-applications/${applicationId}/status`, {
    data: payload,
  });
  return normalizeRecruitmentApplication(response.data?.data);
};

export const withdrawRecruitmentApplication = async (applicationId) => {
  const response = await client.post(`/recruitment-applications/${applicationId}/withdraw`);
  return normalizeRecruitmentApplication(response.data?.data);
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
    const response = await client.get('/me/recruitment-applications');
    const applications = Array.isArray(response.data?.data) ? response.data.data : [];
    return applications.map((application) => mapApplicationToRecruitmentAd(application));
  } catch (error) {
    const status = Number(error?.response?.status || error?.status || 0);
    const isExpectedFallbackStatus = status === 403 || status === 404;

    if (!isExpectedFallbackStatus) {
      console.error('[recruitmentService] Error fetching applications via dedicated endpoint, falling back:', error);
    }

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
        'event.participationRequests',
        'event.participationRequests.user',
        'event.participationRequests.recruitmentAd',
        'event.type',
        'applications',
        'applications.applicant',
        'applications.reviewedBy',
        'category',
        'section',
        'level',
      ],
      sort: ['createdAt:desc'],
    };

    try {
      const fallbackResponse = await client.get('/recruitment-ads', { params });
      return normalizeRecruitmentCollection(fallbackResponse.data?.data);
    } catch (fallbackError) {
      console.error('[recruitmentService] Error fetching applications via fallback recruitment ads query:', fallbackError);
      throw fallbackError;
    }
  }
};
