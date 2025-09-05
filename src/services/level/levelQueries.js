import { useQuery } from '@tanstack/react-query';

import { getLevels } from './levelService';

/**
 * React Query hook to fetch levels list
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<Level[]>}
 */
export const useGetLevels = (options = {}) => useQuery({
  queryFn: () => getLevels(),
  queryKey: ['levels'],
  ...options,
});
