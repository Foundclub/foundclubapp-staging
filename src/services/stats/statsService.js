import client from '../client';

/**
 * Get team statistics (attendance, absences, convocations)
 * @param {string} teamId - The team document ID
 * @returns {Promise<{data: Array, sport: string, teamName: string, totalEvents: number}>}
 */
export const getTeamStats = async (teamId) => {
  const response = await client.get(`/teams/${teamId}/stats`);
  return response.data;
};
