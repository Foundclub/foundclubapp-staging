import client from '@/services/client';

/**
 * Get user notifications with pagination
 * @param {object} params - Query params
 * @param {number} [params.page] - Page number
 * @param {number} [params.pageSize] - Items per page
 * @param {boolean} [params.read] - Filter by read status
 * @returns {Promise<{data: any[], meta: {pagination: {page: number, pageSize: number, pageCount: number, total: number}}}>}
 */
export const getNotifications = async (params = {}) => {
  const {
    page = 1, pageSize = 20, read, ...rest
  } = params;

  const queryParams = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    sort: 'createdAt:desc',
    ...rest,
  };

  // Add read filter if specified
  if (read !== undefined) {
    queryParams['filters[read][$eq]'] = read;
  }

  const response = await client.get('/notifications', { params: queryParams });
  return response.data;
};

/**
 * Get one notification owned by the current user.
 * Uses the list endpoint so backend ownership filtering stays centralized.
 * @param {string | number} notificationId - Notification document id
 * @returns {Promise<any | null>}
 */
export const getNotificationById = async (notificationId) => {
  const safeNotificationId = String(notificationId || '').trim();
  if (!safeNotificationId) return null;

  const response = await getNotifications({
    'filters[documentId][$eq]': safeNotificationId,
    page: 1,
    pageSize: 1,
  });

  return Array.isArray(response?.data) ? response.data[0] || null : null;
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

/**
 * Delete a notification
 * @param {string} id - Notification ID
 * @returns {Promise<any>}
 */
export const deleteNotification = async (id) => {
  const response = await client.delete(`/notifications/${id}`);
  return response.data;
};
