import client from '../client';

/**
 * Get search alerts for the current user
 * @returns {Promise<any>}
 */
export const getSearchAlerts = async () => {
    const response = await client.get('/search-alerts');
    return response.data;
};

/**
 * Create a new search alert
 * @param {object} data
 * @param {string} data.label
 * @param {object} data.filters
 * @returns {Promise<any>}
 */
export const createSearchAlert = async (data) => {
    const response = await client.post('/search-alerts', { data });
    return response.data;
};

/**
 * Delete a search alert
 * @param {string} id
 * @returns {Promise<any>}
 */
export const deleteSearchAlert = async (id) => {
    const response = await client.delete(`/search-alerts/${id}`);
    return response.data;
};

/**
 * Update a search alert
 * @param {string} id
 * @param {object} data
 * @returns {Promise<any>}
 */
export const updateSearchAlert = async (id, data) => {
    const response = await client.put(`/search-alerts/${id}`, { data });
    return response.data;
};

/**
 * Get preview count of matching items for given filters
 * @param {object} filters - The search filters
 * @param {string} type - 'event' or 'mercato'
 * @returns {Promise<{count: number}>}
 */
export const getPreviewCount = async (filters, type) => {
    const response = await client.post('/search-alerts/preview-count', { filters, type });
    return response.data;
};
