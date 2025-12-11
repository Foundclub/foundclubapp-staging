import client from '@/services/client';

/**
 * Get admin dashboard stats
 * @returns {Promise<{revenue: number, reportsCount: number, eventsToday: number}>}
 */
export const getAdminStats = async () => {
    const result = await client.get('/admin-dashboard/stats');
    return result.data;
};
