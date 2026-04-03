import client from '@/services/client';

const getFacilities = async (clubId) => {
  try {
    const response = await client.get(`/facilities?filters[club][documentId][$eq]=${clubId}&populate=*`);
    return response.data;
  } catch (error) {
    console.error('Error fetching facilities:', error);
    throw error;
  }
};

/**
 * Get facilities for a multisport club
 * @param {string} cmId - MultisportClub documentId
 * @returns {Promise<object>} List of facilities
 */
const getCMFacilities = async (cmId) => {
  try {
    const response = await client.get(`/facilities?filters[multisportClub][documentId][$eq]=${cmId}&populate=*`);
    return response.data;
  } catch (error) {
    console.error('Error fetching CM facilities:', error);
    throw error;
  }
};

const getFacilityOwnerName = (facility, fallback = '') => {
  if (facility?.multisportClub?.name) return facility.multisportClub.name;
  if (facility?.club?.name) return facility.club.name;
  return fallback;
};

const normalizeClubFacility = (facility) => ({
  ...facility,
  isReadOnly: false,
  isShared: false,
  ownerName: getFacilityOwnerName(facility, facility?.club?.name || ''),
  ownerType: 'club',
});

const normalizeSharedFacility = (facility) => ({
  ...facility,
  isReadOnly: true,
  isShared: true,
  ownerName: getFacilityOwnerName(facility, facility?.multisportClub?.name || 'Multisport'),
  ownerType: 'multisport',
  source: 'Multisport',
});

const getFacilitySections = (facilities, labels = {}) => {
  if (!Array.isArray(facilities) || facilities.length === 0) return [];

  const clubTitle = labels.clubTitle || 'Installations du club';
  const sharedTitle = labels.sharedTitle || 'Installations partagées';
  const editableFacilities = facilities.filter((facility) => !facility?.isShared);
  const sharedFacilities = facilities.filter((facility) => facility?.isShared);

  if (editableFacilities.length > 0 && sharedFacilities.length > 0) {
    return [
      { data: editableFacilities, title: clubTitle },
      { data: sharedFacilities, title: sharedTitle },
    ];
  }

  if (sharedFacilities.length > 0) {
    return [{ data: sharedFacilities, title: sharedTitle }];
  }

  return [{ data: editableFacilities, title: clubTitle }];
};

const resolveParentMultisportId = async (clubId) => {
  if (!clubId) return null;

  try {
    const response = await client.get(`/clubs/${clubId}`, {
      params: {
        populate: {
          parentMultisport: {
            fields: ['documentId', 'name'],
          },
        },
      },
    });
    return response?.data?.data?.parentMultisport?.documentId || null;
  } catch (error) {
    console.error('Error resolving club parent multisport:', error);
    return null;
  }
};

const getClubFacilityContext = async (clubId, cmId) => {
  const resolvedCmId = cmId || await resolveParentMultisportId(clubId);
  const [clubResponse, cmResponse] = await Promise.all([
    clubId ? getFacilities(clubId) : Promise.resolve(null),
    resolvedCmId ? getCMFacilities(resolvedCmId) : Promise.resolve(null),
  ]);
  const clubFacilities = Array.isArray(clubResponse?.data)
    ? clubResponse.data.map(normalizeClubFacility)
    : [];
  const sharedFacilities = Array.isArray(cmResponse?.data)
    ? cmResponse.data.map(normalizeSharedFacility)
    : [];
  const allFacilities = [...clubFacilities, ...sharedFacilities];

  return {
    allFacilities,
    clubFacilities,
    cmId: resolvedCmId || null,
    hasSharedFacilities: sharedFacilities.length > 0,
    sharedFacilities,
  };
};

const getFacility = async (id) => {
  try {
    const response = await client.get(`/facilities/${id}?populate=*`);
    return response.data;
  } catch (error) {
    console.error('Error fetching facility:', error);
    throw error;
  }
};

const createFacility = async (data) => {
  try {
    const response = await client.post('/facilities', { data });
    return response.data;
  } catch (error) {
    console.error('Error creating facility:', error);
    throw error;
  }
};

const updateFacility = async (id, data) => {
  try {
    const response = await client.put(`/facilities/${id}`, { data });
    return response.data;
  } catch (error) {
    console.error('Error updating facility:', error);
    throw error;
  }
};

const deleteFacility = async (id) => {
  try {
    const response = await client.delete(`/facilities/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting facility:', error);
    throw error;
  }
};

/**
 * Get availability for a facility on a specific date
 * @param {string} facilityId - The facility document ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<{facility: object, date: string, slots: Array}>}
 */
const getAvailability = async (facilityId, date) => {
  try {
    const response = await client.get(`/facilities/${facilityId}/availability?date=${date}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching availability:', error);
    throw error;
  }
};

/**
 * Get occupancy snapshot for a facility on a specific time window.
 * @param {string} facilityId
 * @param {{ start: string, end: string, excludeEventId?: string | null }} params
 * @returns {Promise<any>}
 */
const getOccupancy = async (facilityId, { end, excludeEventId, start }) => {
  try {
    const response = await client.get(`/facilities/${facilityId}/occupancy`, {
      params: {
        end,
        excludeEventId: excludeEventId || undefined,
        start,
      },
    });
    return response.data;
  } catch (error) {
    const errorDetails = typeof error === 'string'
      ? { message: error }
      : {
        details: error?.details || null,
        message: error?.message || error?.error?.message || 'Unknown occupancy error',
        name: error?.name || null,
        status: error?.status || error?.error?.status || null,
      };
    console.error('Error fetching facility occupancy:', errorDetails);
    throw error;
  }
};

const getPendingFacilityOverrideRequests = async (clubId) => {
  try {
    const response = await client.get('/facility-override-requests/pending', {
      params: {
        clubId,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching facility override requests:', error);
    throw error;
  }
};

const approveFacilityOverrideRequest = async (requestId, decisionReason = '') => {
  try {
    const response = await client.post(`/facility-override-requests/${requestId}/approve`, {
      data: {
        decisionReason,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error approving facility override request:', error);
    throw error;
  }
};

const refuseFacilityOverrideRequest = async (requestId, decisionReason = '') => {
  try {
    const response = await client.post(`/facility-override-requests/${requestId}/refuse`, {
      data: {
        decisionReason,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error refusing facility override request:', error);
    throw error;
  }
};

/**
 * Create a booking from the Smart Slots system
 * @param {object} data - Booking data
 * @param {string} data.facilityId - Facility document ID
 * @param {string} data.date - Date in YYYY-MM-DD format
 * @param {string} data.startTime - Start time in HH:mm format
 * @param {string} data.endTime - End time in HH:mm format
 * @param {string} data.mode - 'private' or 'shared'
 * @param {number} [data.targetPlayers] - Total players needed (for shared mode)
 * @param {number} [data.currentPlayers] - Current players count
 * @returns {Promise<object>} The created event/booking
 */
const createBooking = async (data) => {
  try {
    const response = await client.post('/events/booking', { data });
    return response.data;
  } catch (error) {
    console.error('Error creating booking:', error);
    throw error;
  }
};

/**
 * Get bookable facilities (for listing)
 * @returns {Promise<Array>} List of bookable facilities
 */
const getBookableFacilities = async () => {
  try {
    const response = await client.get('/facilities?filters[isBookable][$eq]=true&populate=*');
    return response.data;
  } catch (error) {
    console.error('Error fetching bookable facilities:', error);
    throw error;
  }
};

export {
  approveFacilityOverrideRequest,
  createBooking,
  createFacility,
  deleteFacility,
  getAvailability,
  getBookableFacilities,
  getClubFacilityContext,
  getCMFacilities,
  getFacilities,
  getFacility,
  getFacilitySections,
  getOccupancy,
  getPendingFacilityOverrideRequests,
  refuseFacilityOverrideRequest,
  updateFacility,
};
