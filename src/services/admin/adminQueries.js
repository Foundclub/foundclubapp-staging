import { useQuery } from '@tanstack/react-query';
import { getAdminStats } from './adminService';

/**
 * Hook to get admin stats
 * @returns {import('@tanstack/react-query').UseQueryResult<{revenue: number, reportsCount: number, eventsToday: number}, Error>}
 */
export const useGetAdminStats = () => useQuery({
    queryKey: ['adminStats'],
    queryFn: getAdminStats,
});
