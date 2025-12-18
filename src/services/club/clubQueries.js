import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { getClubById, getClubs } from './clubService';

/**
 * React Query hook to fetch clubs list
 * @param {{
 *   page?: number;
 *   pageSize?: number;
 *   activity?: string;
 *   name?: string;
 *   geohash?: string[];
 * }} [params]
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<{
 * pages: { data: Club[]; meta: { pagination: { page: number; pageCount: number } } }[] }>}
 */
export const useGetClubs = (params, options) => useInfiniteQuery({
  getNextPageParam: (lastPage) => {
    const { meta: { pagination } } = lastPage;
    return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
  },
  queryFn: ({ pageParam = 1 }) => getClubs({ ...params, page: pageParam }),
  queryKey: ['clubs', params],
  ...options,
});

/**
 * React Query hook to fetch a single club
 * @param {string|number} id
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<Club>}
 */
export const useGetClub = (id, options = {}) => useQuery({
  enabled: !!id,
  queryFn: () => getClubById(id),
  queryKey: ['club', id],
  ...options,
});

/**
 * React Query hook to search clubs by name
 * @param {string} searchQuery - Search query
 * @param {object} options - Query options
 * @returns {import('@tanstack/react-query').UseQueryResult<Club[]>}
 */
export const useSearchClubs = (searchQuery, options = {}) => useQuery({
  enabled: searchQuery?.length >= 2,
  queryFn: async () => {
    const result = await getClubs({ name: searchQuery, pageSize: 10 });
    return result.data || [];
  },
  queryKey: ['clubs', 'search', searchQuery],
  staleTime: 30000,
  ...options,
});
