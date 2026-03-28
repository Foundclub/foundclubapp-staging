import client from '@/services/client';

import { requireDocumentId } from '@/utils/entityId';

/**
 * @param {string | undefined} [teamId]
 * @returns {Promise<{nextAction: any, serverNow?: string}>}
 */
export const getPendingLeagueAction = async (teamId) => {
  const params = teamId ? { teamId: requireDocumentId(teamId, 'team') } : undefined;
  const response = await client.get('/league-actions/pending', { params });
  return response.data || { nextAction: null };
};
