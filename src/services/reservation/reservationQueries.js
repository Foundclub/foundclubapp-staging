import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  getFeaturedReservations,
  getReservations,
} from './reservationService';

/**
 * Hook to get reservations with pagination
 * @param {{
 *   page?: number;
 *   pageSize?: number;
 *   q?: string;
 *   type?: string;
 *   reservationMode?: string;
 *   club?: string;
 *   activity?: string;
 *   geohash?: string;
 *   maxPricePerPerson?: number;
 *   needsPlayers?: boolean;
 *   startTime?: string;
 *   startDateAfter?: string;
 *   startDateBefore?: string;
 * }} filters
 * @param options
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult}
 */
export const useGetReservations = (filters = {}, options = {}) => useInfiniteQuery({
  getNextPageParam: (lastPage) => {
    const { page, pageCount } = lastPage?.meta?.pagination || {};
    if (page < pageCount) {
      return page + 1;
    }
    return undefined;
  },
  initialPageParam: 1,
  placeholderData: options?.placeholderData ?? ((previousData) => previousData),
  queryFn: ({ pageParam = 1 }) => getReservations({ ...filters, page: pageParam }),
  queryKey: buildNormalizedQueryKey('reservations', filters),
  refetchOnMount: options?.refetchOnMount ?? false,
  staleTime: options?.staleTime ?? 30_000,
  ...options,
});

/**
 * Hook to get featured reservations
 * Returns featured items if available, otherwise returns latest reservations chronologically
 * @param {number} [limit] - Maximum number of items to return
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export const useGetFeaturedReservations = (limit = 10, options = {}) => useQuery({
  queryFn: () => getFeaturedReservations(limit),
  queryKey: ['featured-reservations', limit],
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: false,
  staleTime: 5 * 60 * 1000,
  ...options,
});
