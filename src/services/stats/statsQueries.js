import { useQuery } from '@tanstack/react-query';

import { getTeamStats } from './statsService';

/**
 * Hook to fetch team statistics
 * @param {string} teamId - The team document ID
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export const useGetTeamStats = (teamId, options = {}) => useQuery({
  enabled: !!teamId,
  queryFn: () => getTeamStats(teamId),
  queryKey: ['teamStats', teamId],
  staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  ...options,
});
