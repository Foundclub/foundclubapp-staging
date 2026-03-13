import { useQuery } from '@tanstack/react-query';

import { getCategories } from './categoryService';

/**
 * React Query hook to fetch categories list
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<Category[]>}
 */
export const useGetCategories = (options = {}) => useQuery({
  queryFn: () => getCategories(),
  queryKey: ['catégories'],
  ...options,
});
