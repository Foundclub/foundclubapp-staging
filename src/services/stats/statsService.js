import client from '../client';

/**
 * Get team statistics.
 * @param {string} teamId - The team document ID
 * @returns {Promise<{
 * data: Array,
 * sport: string,
 * teamName: string,
 * totalEvents: number,
 * baselineAt?: string | null,
 * baselineBy?: { documentId?: string, firstname?: string, lastname?: string } | null,
 * totals?: { attendanceCount?: number, absenceCount?: number, lateCount?: number, lateMinutesTotal?: number, lateMinutesAvg?: number }
 * }>}
 */
export const getTeamStats = async (teamId) => {
  const response = await client.get(`/teams/${teamId}/stats`);
  return response.data;
};

/**
 * Reset team statistics baseline (staff only).
 * @param {string} teamId
 * @param {string} [reason]
 * @returns {Promise<{ data?: { baselineAt?: string, baselineReason?: string | null } }>}
 */
export const resetTeamStats = async (teamId, reason) => {
  const response = await client.post(`/teams/${teamId}/stats/reset`, {
    reason: reason || null,
  });
  return response.data;
};
