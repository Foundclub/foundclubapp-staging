import client from '@/services/client';

/**
 * Create a new team slot
 * @param {object} slotData - The slot data
 * @returns {Promise<object>} - The created slot
 */
export const createTeamSlot = async (slotData) => {
  const { data } = await client.post('/team-slots', {
    data: slotData,
  });
  return data;
};
/**
 * Update a team slot
 * @param {string} documentId - The slot documentId
 * @param {object} slotData - The data to update
 * @returns {Promise<object>} - The updated slot
 */
export const updateTeamSlot = async (documentId, slotData) => {
  const { data } = await client.put(`/team-slots/${documentId}`, {
    data: slotData,
  });
  return data;
};

/**
 * Get available slots for a team
 * @param {string} teamId - The team documentId
 * @returns {Promise<Array>} - List of slots
 */
export const getAvailableSlots = async (teamId) => {
    // Fetch slots for the team that are in the future
    const now = new Date();
    const { data } = await client.get('/team-slots', {
        params: {
            'filters[team][documentId]': teamId,
            'filters[start_time][$gt]': now.toISOString(),
            'sort': 'start_time:asc',
            'pagination[limit]': 1
        }
    });
    return data.data;
};
