import { useQuery } from '@tanstack/react-query';

import { REFERENCE_TABLE_STALE_MS } from '@/services/queryOptions';

import { getSections } from './sectionService';

/**
 * React Query hook to fetch sections list
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<Section[]>}
 */
export const useGetSections = (options = {}) => useQuery({
  queryFn: () => getSections(),
  queryKey: ['sections'],
  staleTime: REFERENCE_TABLE_STALE_MS,
  ...options,
});
