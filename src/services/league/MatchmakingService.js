import { requireDocumentId } from '@/utils/entityId';

import axiosInstance from '../client';

/**
 * @typedef {Error & {
 *  code?: string | null;
 *  details?: Record<string, any> | null;
 *  status?: number | null;
 * }} MatchmakingServiceError
 */

/**
 * Normalize an API error into a reusable Error instance for the UI layer.
 * @param {unknown} error
 * @param {string} fallbackMessage
 * @returns {MatchmakingServiceError}
 */
const buildApiError = (error, fallbackMessage) => {
  const apiError = /** @type {any} */ (error);
  const message = apiError?.response?.data?.message
    || apiError?.response?.data?.error
    || apiError?.message
    || fallbackMessage;
  const nextError = /** @type {MatchmakingServiceError} */ (new Error(message));
  nextError.code = apiError?.response?.data?.code
    || apiError?.response?.data?.details?.code
    || apiError?.code
    || null;
  nextError.status = apiError?.response?.status || apiError?.status || null;
  nextError.details = apiError?.response?.data?.details || null;
  return nextError;
};

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
      throw buildApiError(error, 'Unable to fetch matchmaking status');
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
   * @returns {Promise<boolean>}
   */
  cancelRequest: async (requestId) => {
    try {
      await axiosInstance.post('/matchmaking-request/cancel', { requestId });
      return true;
    } catch (error) {
      console.error('Error canceling request:', error);
      throw buildApiError(error, 'Unable to cancel matchmaking request');
    }
  },

  /**
   * Answer an optional widened matchmaking suggestion.
   * @param {string} suggestionId
   * @param {'accept' | 'decline'} decision
   * @returns {Promise<any>}
   */
  respondSuggestion: async (suggestionId, decision) => {
    const normalizedSuggestionId = requireDocumentId(suggestionId, 'matchmakingSuggestion');
    const response = await axiosInstance.post(`/matchmaking-suggestions/${normalizedSuggestionId}/respond`, {
      decision,
    });
    return response.data;
  },
};

export default MatchmakingService;
