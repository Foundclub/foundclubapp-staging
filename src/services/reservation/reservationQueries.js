import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

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
 * }} filters
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult}
 */
export const useGetReservations = (filters = {}) => useInfiniteQuery({
  getNextPageParam: (lastPage) => {
    const { page, pageCount } = lastPage?.meta?.pagination || {};
    if (page < pageCount) {
      return page + 1;
    }
    return undefined;
  },
  initialPageParam: 1,
  queryFn: ({ pageParam = 1 }) => getReservations({ ...filters, page: pageParam }),
  queryKey: ['reservations', filters],
});

/**
 * Hook to get featured reservations
 * Returns featured items if available, otherwise returns latest reservations chronologically
 * @param {number} [limit=10] - Maximum number of items to return
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
export const useGetFeaturedReservations = (limit = 10) => useQuery({
  queryFn: () => getFeaturedReservations(limit),
  queryKey: ['featured-reservations', limit],
  retry: false,  // Pas de retry (le service gère déjà le fallback)
  staleTime: 5 * 60 * 1000,  // Cache 5 minutes (réduire les appels)
  refetchOnMount: false,  // Ne pas refetch à chaque mount
  refetchOnWindowFocus: false,  // Éviter les refetch intempestifs
});
