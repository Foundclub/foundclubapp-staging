import { useQuery } from '@tanstack/react-query';
import { getTeamStats } from './statsService';

/**
 * Hook to fetch team statistics
 * @param {string} teamId - The team document ID
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export const useGetTeamStats = (teamId) => {
  return useQuery({
    queryKey: ['teamStats', teamId],
    queryFn: () => getTeamStats(teamId),
    enabled: !!teamId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};
