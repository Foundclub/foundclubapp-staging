import axiosInstance from '../client';

const MatchmakingService = {
    /**
     * Get active request and status for the team
     * @param {string} teamId 
     * @returns {Promise<object|null>} { state: 'searching'|'matched'|'idle', request, match }
     */
    getActiveRequest: async (teamId) => {
        try {
            const response = await axiosInstance.get(`/matchmaking-request/status`, {
                params: { teamId }
            });
            return response.data; // Expected: { state, request, match? }
        } catch (error) {
            console.error("Error fetching matchmaking status:", error);
            // Fallback for MVP if backend error
            return null;
        }
    },

    /**
     * Launch a new search with recurring slot IDs
     * @param {string} teamId 
     * @param {Array} selectedSlotIds - Array of slot IDs to include in search
     * @param {object} params { radius, location }
     */
    triggerSearch: async (teamId, selectedSlotIds, params) => {
        try {
            const payload = {
                teamId,
                selectedSlotIds, // Array of recurring slot IDs
                radius: params.radius,
                location: params.location,
            };
            
            const response = await axiosInstance.post(`/matchmaking-request/search`, payload);
            return response.data;
        } catch (error) {
            console.error("Error triggering search:", error);
            throw error;
        }
    },


    /**
     * Cancel an active request
     * @param {string} requestId 
     */
    cancelRequest: async (requestId) => {
        try {
            await axiosInstance.post(`/matchmaking-request/cancel`, { requestId });
            return true;
        } catch (error) {
            console.error("Error canceling request:", error);
            return false;
        }
    }
};

export default MatchmakingService;
