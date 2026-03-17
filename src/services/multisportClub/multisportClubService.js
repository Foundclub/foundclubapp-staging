/**
 * MultisportClub Service for Mobile
 * Handles API calls for Dirigeant Omnisport features
 */

import client from '../client';
import { uploadFile } from '../club/clubService';

/**
 * @typedef {{ lat?: number; lng?: number; label?: string }} LocationAddress
 * @typedef {{
 *   documentId?: string;
 *   name?: string;
 *   email?: string;
 *   phoneNumber?: string;
 *   logo?: { url?: string; path?: string; uri?: string; mime?: string; filename?: string; id?: number | string; documentId?: string };
 *   address?: LocationAddress;
 *   addressDetails?: string;
 * }} MultisportClubEntity
 * @typedef {{
 *   name: string;
 *   activites?: string[];
 *   addressLabel?: string;
 *   coordinates?: string;
 *   managerPhone?: string;
 * }} CreateCMSectionPayload
 * @typedef {{ data?: { name?: string; documentId?: string } }} CreateCMSectionResponse
 * @typedef {{ name?: string; geohash?: string; page?: number; pageSize?: number }} MultisportClubSearchParams
 * @typedef {{ sectionId?: string; installationId?: string; from?: string; to?: string }} CMPlanningFilters
 * @typedef {{ installationId?: string; from?: string; to?: string }} ClubSharedPlanningFilters
 * @typedef {{ id?: string; name?: string; color?: string | null }} PlanningInstallation
 * @typedef {{
 *   eventId?: string;
 *   title?: string;
 *   startAt?: string;
 *   endAt?: string;
 *   startTime?: string;
 *   endTime?: string;
 *   installation?: PlanningInstallation;
 *   clubName?: string | null;
 *   teamName?: string | null;
 *   isSharedFacility?: boolean;
 * }} CMPlanningSlot
 * @typedef {{ path?: string; id?: number | string; documentId?: string }} MediaRef
 * @typedef {{ logo?: MediaRef | number | string; [key: string]: any }} SponsorPayload
 * @typedef {{ logo?: MediaRef | number | string; sponsor?: SponsorPayload[]; [key: string]: any }} MultisportClubUpdatePayload
 */

/**
 * Get a single multisport club by ID
 * @param {string} id - MultisportClub documentId
 * @returns {Promise<MultisportClubEntity>} MultisportClub with populated sections
 */
export const getMultisportClubById = async (id) => {
  const result = await client.get(`/multisport-clubs/${id}`, {
    params: {
      populate: {
        admins: {
          populate: ['avatar', 'role'],
        },
        logo: true,
        sections: {
          populate: ['logo', 'activites', 'teams'],
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
 * @param {MultisportClubSearchParams} [params] - Search params (name, geohash, page, pageSize)
 * @returns {Promise<object>} List of multisport clubs
 */
export const getMultisportClubs = async (params = {}) => {
  const {
    geohash, name, page = 1, pageSize = 30,
  } = params;

  /** @type {{ pagination: { page: number; pageSize: number }; populate: any; filters?: Record<string, any> }} */
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
  const dataWithType = result.data?.data?.map((/** @type {any} */ cm) => ({
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
 * @returns {Promise<object>} List of club sections with stats
 */
export const getCMClubs = async (cmId) => {
  const result = await client.get(`/cm/${cmId}/clubs`);
  return result.data;
};

/**
 * Get planning for a multisport club
 * @param {string} cmId - MultisportClub documentId
 * @param {CMPlanningFilters} [filters] - Optional filters (sectionId, installationId, from, to)
 * @returns {Promise<{ data?: CMPlanningSlot[]; meta?: object }>} Planning slots
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
 * Get planning for shared multisport facilities from a child club perspective.
 * @param {string} cmId
 * @param {string} clubId
 * @param {ClubSharedPlanningFilters} [filters]
 * @returns {Promise<{ data?: CMPlanningSlot[]; meta?: object }>}
 */
export const getClubSharedPlanning = async (cmId, clubId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.installationId) params.append('installationId', filters.installationId);
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);

  const queryString = params.toString();
  const suffix = queryString ? `?${queryString}` : '';
  const result = await client.get(`/cm/${cmId}/clubs/${clubId}/shared-planning${suffix}`);
  return result.data;
};

/**
 * Create a new section under a multisport club
 * @param {string} cmId - MultisportClub documentId
 * @param {CreateCMSectionPayload} data - Section data (name, sport, city)
 * @returns {Promise<CreateCMSectionResponse>} Created section
 */
export const createCMSection = async (cmId, data) => {
  const result = await client.post(`/cm/${cmId}/clubs`, data);
  return result.data;
};

/**
 * Delete a section from a multisport club
 * @param {string} cmId - MultisportClub documentId
 * @param {string} sectionId - Section (Club) documentId
 * @returns {Promise<object>} Success message
 */
export const deleteCMSection = async (cmId, sectionId) => {
  const result = await client.delete(`/cm/${cmId}/clubs/${sectionId}`);
  return result.data;
};

/**
 * Get highlight requests for a multisport club (pending)
 * @param {string} cmId - MultisportClub documentId
 * @returns {Promise<object>} List of pending requests
 */
export const getCMHighlightRequests = async (cmId) => {
  const result = await client.get('/event-highlight-requests', {
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
 * @param {object} data - Request data (kind, message)
 * @returns {Promise<object>} Created request
 */
export const createHighlightRequest = async (eventId, data = {}) => {
  const result = await client.post(`/events/${eventId}/highlight-requests`, data);
  return result.data;
};

/**
 * Approve a highlight request
 * @param {string} requestId - Request documentId
 * @returns {Promise<object>} Updated request
 */
export const approveHighlightRequest = async (requestId) => {
  const result = await client.post(`/highlight-requests/${requestId}/approve`);
  return result.data;
};

/**
 * Reject a highlight request
 * @param {string} requestId - Request documentId
 * @param {string} reason - Optional rejection reason
 * @returns {Promise<object>} Updated request
 */
export const rejectHighlightRequest = async (requestId, reason) => {
  const result = await client.post(`/highlight-requests/${requestId}/reject`, { reason });
  return result.data;
};

/**
 * Get all members of a multisport club (aggregated)
 * @param {string} cmId - MultisportClub documentId
 * @returns {Promise<object>} Aggregated members
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

/**
 * @param {string} cmId
 * @returns {Promise<any>}
 */
export const getCMMembers = async (cmId) => {
  const result = await client.get(`/cm/${cmId}/members`);
  return result.data;
};

/**
 * Update a multisport club
 * @param {string} cmId - MultisportClub documentId
 * @param {MultisportClubUpdatePayload} data - Update data (name, email, phone, addressLabel, coordinates, logo)
 * @returns {Promise<object>} Updated CM
 */
export const updateMultisportClub = async (cmId, data) => {
  /** @type {MultisportClubUpdatePayload} */
  const dataCopy = { ...data };
  let logoId = null;

  // Handle logo file upload if it's a new file (has path)
  if (dataCopy.logo && typeof dataCopy.logo === 'object' && 'path' in dataCopy.logo && dataCopy.logo.path) {
    const uploadResult = /** @type {{ id?: number | string; documentId?: string }} */ (await uploadFile(dataCopy.logo));
    logoId = uploadResult.documentId || uploadResult.id || null;
  } else if (dataCopy.logo && typeof dataCopy.logo === 'object' && 'id' in dataCopy.logo && dataCopy.logo.id) {
    // Keep existing logo if not changed
    logoId = dataCopy.logo.id;
  } else if (dataCopy.logo && typeof dataCopy.logo === 'object' && 'documentId' in dataCopy.logo && dataCopy.logo.documentId) {
    // Keep existing logo if using documentId
    logoId = dataCopy.logo.documentId;
  }

  // Remove logo object from payload
  delete dataCopy.logo;

  // Handle Sponsors Uploads
  if (dataCopy.sponsor && Array.isArray(dataCopy.sponsor)) {
    const processedSponsors = await Promise.all(dataCopy.sponsor.map(async (sponsor) => {
      const newSponsor = { ...sponsor };

      // If logo is a new file (has path), upload it
      if (newSponsor.logo && typeof newSponsor.logo === 'object' && 'path' in newSponsor.logo && newSponsor.logo.path) {
        const uploadResult = /** @type {{ id?: number | string; documentId?: string }} */ (await uploadFile(newSponsor.logo));
        // For components media fields, we use the Integer ID
        newSponsor.logo = uploadResult.id || uploadResult.documentId || newSponsor.logo;
      } else if (newSponsor.logo && typeof newSponsor.logo === 'object' && ('documentId' in newSponsor.logo || 'id' in newSponsor.logo)) {
        // Reuse existing media references when the logo is already uploaded.
        newSponsor.logo = newSponsor.logo.id || newSponsor.logo.documentId || newSponsor.logo;
      }

      return newSponsor;
    }));
    dataCopy.sponsor = processedSponsors;
  }

  // Prepare payload
  /** @type {Record<string, any>} */
  const payload = {
    ...dataCopy,
    ...(logoId && { logo: logoId }),
  };

  // Clean payload of undefined/null values
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  const result = await client.put(`/cm/${cmId}`, payload);
  return result.data;
};

export default {
  approveHighlightRequest,
  createCMSection,
  createHighlightRequest,
  getClubSharedPlanning,
  getCMClubs,
  getCMHighlightRequests,
  getCMMembers,
  getCMPlanning,
  rejectHighlightRequest,
  updateMultisportClub,
};
