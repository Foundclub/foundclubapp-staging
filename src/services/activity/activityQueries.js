import { useQuery } from '@tanstack/react-query';

import { REFERENCE_TABLE_STALE_MS } from '@/services/queryOptions';

import { getActivities } from './activityService';

/**
 * React Query hook to fetch activities list
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<Activity[]>}
 */
export const useGetActivities = (options = {}) => useQuery({
  queryFn: () => getActivities(),
  queryKey: ['activities'],
  staleTime: REFERENCE_TABLE_STALE_MS,
  ...options,
});
