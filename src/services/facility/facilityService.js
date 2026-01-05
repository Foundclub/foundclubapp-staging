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
 * @returns {Promise<Object>} List of facilities
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
    getFacilities,
    getCMFacilities,
    getFacility,
    createFacility,
    updateFacility,
    deleteFacility,
    getAvailability,
    createBooking,
    getBookableFacilities,
};
