import { useQuery } from '@tanstack/react-query';

import { getSections } from './sectionService';

/**
 * React Query hook to fetch sections list
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<Section[]>}
 */
export const useGetSections = (options = {}) => useQuery({
  queryFn: () => getSections(),
  queryKey: ['sections'],
  ...options,
});
