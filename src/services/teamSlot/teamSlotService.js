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
 * Delete a team slot
 * @param {string} documentId - The slot documentId
 * @returns {Promise<void>}
 */
export const deleteTeamSlot = async (documentId) => {
  await client.delete(`/team-slots/${documentId}`);
};

/**
 * Get available slots for a team (recurring format)
 * @param {string} teamId - The team documentId
 * @returns {Promise<Array>} - List of slots sorted by day of week
 */
export const getAvailableSlots = async (teamId) => {
  // Fetch all open/matchmaking slots for the team (recurring format)
  const { data } = await client.get('/team-slots', {
    params: {
      'filters[league_team][documentId]': teamId,
      'filters[status][$in][0]': 'open',
      'filters[status][$in][1]': 'matchmaking',
      'pagination[limit]': 20,
    },
  });

  // Sort by day of week (Monday first)
  const DAY_ORDER = {
    friday: 5, monday: 1, saturday: 6, sunday: 7, thursday: 4, tuesday: 2, wednesday: 3,
  };
  const slots = data.data || [];
  slots.sort((a, b) => {
    const dayA = DAY_ORDER[a.recurrence_day?.toLowerCase()] || 8;
    const dayB = DAY_ORDER[b.recurrence_day?.toLowerCase()] || 8;
    if (dayA !== dayB) return dayA - dayB;
    // Same day, sort by start_hour
    return (a.start_hour || '').localeCompare(b.start_hour || '');
  });

  return slots;
};
