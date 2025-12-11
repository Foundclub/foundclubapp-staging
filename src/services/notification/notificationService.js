import client from '@/services/client';

/**
 * Get user notifications
 * @param {object} params - Query params
 * @returns {Promise<any>}
 */
export const getNotifications = async (params = {}) => {
    const response = await client.get('/notifications', {
        params: {
            sort: 'createdAt:desc',
            ...params,
        },
    });
    return response.data;
};

/**
 * Get unread notifications count
 * @returns {Promise<{count: number}>}
 */
export const getUnreadCount = async () => {
    const response = await client.get('/notifications/count-unread');
    return response.data;
};

/**
 * Mark a notification as read
 * @param {string} id - Notification ID
 * @returns {Promise<any>}
 */
export const markAsRead = async (id) => {
    const response = await client.put(`/notifications/${id}/read`);
    return response.data;
};

/**
 * Mark all notifications as read
 * @returns {Promise<any>}
 */
export const markAllAsRead = async () => {
    const response = await client.put('/notifications/read-all');
    return response.data;
};
