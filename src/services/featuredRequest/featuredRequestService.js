import client from '../client';

/**
 * Request to feature an event
 * @param {string} eventId - The event document ID
 * @returns {Promise<{data: object}>}
 */
export const requestFeatured = async (eventId) => {
  try {
    const response = await client.post('/featured-items/request', {
      event: eventId,
    });
    return response.data;
  } catch (error) {
    console.error('Error requesting featured:', error);
    throw error;
  }
};

/**
 * Cancel a featured request
 * @param {string} requestId - The featured item ID
 * @returns {Promise<{data: object}>}
 */
export const cancelFeaturedRequest = async (requestId) => {
  try {
    const response = await client.delete(`/featured-items/${requestId}`);
    return response.data;
  } catch (error) {
    console.error('Error canceling featured request:', error);
    throw error;
  }
};

/**
 * Get user's featured requests
 * @returns {Promise<{data: Array, meta: object}>}
 */
export const getMyFeaturedRequests = async () => {
  try {
    const response = await client.get('/featured-items', {
      params: {
        filters: {
          requestedBy: {
            id: {
              $eq: '$currentUser',
            },
          },
        },
        populate: ['event', 'event.type'],
        sort: ['requestedAt:desc'],
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching featured requests:', error);
    return {
      data: [],
      meta: {
        pagination: {
          page: 1,
          pageCount: 0,
          pageSize: 0,
          total: 0,
        },
      },
    };
  }
};
