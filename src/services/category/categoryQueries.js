import { useQuery } from '@tanstack/react-query';

import { REFERENCE_TABLE_STALE_MS } from '@/services/queryOptions';

import { getCategories } from './categoryService';

/**
 * React Query hook to fetch categories list
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<Category[]>}
 */
export const useGetCategories = (options = {}) => useQuery({
  queryFn: () => getCategories(),
  queryKey: ['categories'],
  staleTime: REFERENCE_TABLE_STALE_MS,
  ...options,
});
