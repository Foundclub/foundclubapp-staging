import { requireDocumentId } from '@/utils/entityId';

import axiosInstance from '../client';

const MatchmakingService = {
  /**
   * Get active request and status for the team
   * @param {string} teamId
   * @returns {Promise<MatchmakingStatus | null>}
   */
  getActiveRequest: async (teamId) => {
    try {
      const normalizedTeamId = requireDocumentId(teamId, 'team');
      const response = await axiosInstance.get('/matchmaking-request/status', {
        params: { teamId: normalizedTeamId },
      });
      return response.data; // Expected: { state, request, match? }
    } catch (error) {
      console.error('Error fetching matchmaking status:', error);
      const apiMessage = error?.response?.data?.message || error?.message || 'Unable to fetch matchmaking status';
      throw new Error(apiMessage);
    }
  },

  /**
   * Launch a new search with recurring slot IDs
   * @param {string} teamId
   * @param {string[]} selectedSlotIds - Array of slot IDs to include in search
   * @param {{radius: number, location: object}} params
   * @returns {Promise<MatchmakingStatus | MatchRequest>}
   */
  triggerSearch: async (teamId, selectedSlotIds, params) => {
    try {
      const normalizedTeamId = requireDocumentId(teamId, 'team');
      const payload = {
        location: params.location,
        radius: params.radius,
        selectedSlotIds, // Array of recurring slot IDs
        teamId: normalizedTeamId,
      };

      const response = await axiosInstance.post('/matchmaking-request/search', payload);
      return response.data;
    } catch (error) {
      console.error('Error triggering search:', error);
      throw error;
    }
  },

  /**
   * Cancel an active request
   * @param {string} requestId
   */
  cancelRequest: async (requestId) => {
    try {
      await axiosInstance.post('/matchmaking-request/cancel', { requestId });
      return true;
    } catch (error) {
      console.error('Error canceling request:', error);
      return false;
    }
  },
};

export default MatchmakingService;
