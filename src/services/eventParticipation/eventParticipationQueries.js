import { useInfiniteQuery } from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  getEventParticipations,
} from './eventParticipationService';

/**
 * React Query hook to fetch event participation requests
 * @param {string} eventId
 * @param {string} [userId]
 * @param {{
 *   pageSize?: number;
 *   includeInactive?: boolean;
 * }} [params]
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<{
 * pages: { data: EventParticipation[];
 * meta: { pagination: { page: number; pageCount: number } } }[] }>}
 */
export const useGetEventParticipations = (eventId, userId, params, options) => useInfiniteQuery({
  enabled: !!eventId,
  getNextPageParam: (lastPage) => {
    const { meta: { pagination } } = lastPage;
    return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
  },
  queryFn: ({ pageParam = 1 }) => getEventParticipations(
    eventId,
    userId,
    { ...params, page: pageParam },
  ),
  queryKey: buildNormalizedQueryKey(['eventParticipations', eventId, userId || 'all'], params),
  ...options,
});
