/**
 * MultisportClub Service for Mobile
 * Handles API calls for Dirigeant Omnisport features
 */

import client from '../client';

/**
 * Get a single multisport club by ID
 * @param {string} id - MultisportClub documentId
 * @returns {Promise<Object>} MultisportClub with populated sections
 */
export const getMultisportClubById = async (id) => {
  const result = await client.get(`/multisport-clubs/${id}`, {
    params: {
      populate: {
        logo: true,
        sections: {
          populate: ['logo', 'activites', 'teams'],
        },
        admins: {
          populate: ['avatar', 'role'],
        },
        sponsor: {
          populate: ['logo'],
        },
      },
    },
  });
  return result.data?.data;
};

/**
 * Get list of multisport clubs (for search)
 * @param {Object} params - Search params (name, geohash, page, pageSize)
 * @returns {Promise<Object>} List of multisport clubs
 */
export const getMultisportClubs = async (params = {}) => {
  const { name, geohash, page = 1, pageSize = 30 } = params;
  
  const filters = {
    pagination: { page, pageSize },
    populate: {
      logo: true,
      sections: { fields: ['documentId', 'name'] },
      sponsor: { populate: ['logo'] },
    },
  };

  if (name) {
    filters.filters = {
      ...filters.filters,
      name: { $containsi: name },
    };
  }

  if (geohash && geohash.length) {
    filters.filters = {
      ...filters.filters,
      geohash: { $contains: geohash },
    };
  }

  const result = await client.get('/multisport-clubs', { params: filters });
  
  // Add type indicator to differentiate from regular clubs
  const dataWithType = result.data?.data?.map(cm => ({
    ...cm,
    _type: 'multisport',
    // Count sections for display
    sectionsCount: cm.sections?.length || 0,
  })) || [];

  return {
    data: dataWithType,
    meta: result.data?.meta,
  };
};

/**
 * Get all club sections for a multisport club
 * @param {string} cmId - MultisportClub documentId
 * @returns {Promise<Object>} List of club sections with stats
 */
export const getCMClubs = async (cmId) => {
  const result = await client.get(`/cm/${cmId}/clubs`);
  return result.data;
};

/**
 * Get planning for a multisport club
 * @param {string} cmId - MultisportClub documentId
 * @param {Object} filters - Optional filters (sectionId, installationId, from, to)
 * @returns {Promise<Object>} Planning slots
 */
export const getCMPlanning = async (cmId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.sectionId) params.append('sectionId', filters.sectionId);
  if (filters.installationId) params.append('installationId', filters.installationId);
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);
  
  const result = await client.get(`/cm/${cmId}/planning?${params.toString()}`);
  return result.data;
};

/**
 * Create a new section under a multisport club
 * @param {string} cmId - MultisportClub documentId
 * @param {Object} data - Section data (name, sport, city)
 * @returns {Promise<Object>} Created section
 */
export const createCMSection = async (cmId, data) => {
  const result = await client.post(`/cm/${cmId}/clubs`, data);
  return result.data;
};

/**
 * Get highlight requests for a multisport club (pending)
 * @param {string} cmId - MultisportClub documentId
 * @returns {Promise<Object>} List of pending requests
 */
export const getCMHighlightRequests = async (cmId) => {
  const result = await client.get(`/event-highlight-requests`, {
    params: {
      filters: {
        multisportClub: { documentId: cmId },
        status: 'PENDING',
      },
      populate: ['event', 'requester'],
    },
  });
  return result.data;
};

/**
 * Create a highlight request for an event
 * @param {string} eventId - Event documentId
 * @param {Object} data - Request data (kind, message)
 * @returns {Promise<Object>} Created request
 */
export const createHighlightRequest = async (eventId, data = {}) => {
  const result = await client.post(`/events/${eventId}/highlight-requests`, data);
  return result.data;
};

/**
 * Approve a highlight request
 * @param {string} requestId - Request documentId
 * @returns {Promise<Object>} Updated request
 */
export const approveHighlightRequest = async (requestId) => {
  const result = await client.post(`/highlight-requests/${requestId}/approve`);
  return result.data;
};

/**
 * Reject a highlight request
 * @param {string} requestId - Request documentId
 * @param {string} reason - Optional rejection reason
 * @returns {Promise<Object>} Updated request
 */
export const rejectHighlightRequest = async (requestId, reason) => {
  const result = await client.post(`/highlight-requests/${requestId}/reject`, { reason });
  return result.data;
};

/**
 * Get all members of a multisport club (aggregated)
 * @param {string} cmId - MultisportClub documentId
 * @returns {Promise<Object>} Aggregated members
 */
/**
 * Get all teams of a CM
 * @param {string} cmId
 * @returns {Promise<any>}
 */
export const getCMTeams = async (cmId) => {
  const response = await client.get(`/cm/${cmId}/teams`);
  return response.data;
};

export const getCMMembers = async (cmId) => {
  const result = await client.get(`/cm/${cmId}/members`);
  return result.data;
};

export default {
  getCMClubs,
  getCMPlanning,
  createCMSection,
  getCMHighlightRequests,
  createHighlightRequest,
  approveHighlightRequest,
  rejectHighlightRequest,
  getCMMembers,
};
