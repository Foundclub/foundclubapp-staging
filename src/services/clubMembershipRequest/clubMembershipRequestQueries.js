import { useInfiniteQuery } from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import { getClubMembershipRequests } from './clubMembershipRequestService';

/**
 * React Query hook to fetch club membership requests
 * @param {string} clubId
 * @param {{
 *   pageSize?: number;
 * }} [params]
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<{
 * pages: { data: ClubMembershipRequest[];
 * meta: { pagination: { page: number; pageCount: number } } }[] }>}
 */
export const useGetClubMembershipRequests = (clubId, params, options) => useInfiniteQuery({
  enabled: !!clubId,
  getNextPageParam: (lastPage) => {
    if (!lastPage) return undefined;
    const { meta: { pagination } } = lastPage;
    return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
  },
  queryFn: ({ pageParam = 1 }) => getClubMembershipRequests(clubId, { ...params, page: pageParam }),
  queryKey: buildNormalizedQueryKey(['clubMembershipRequests', clubId], params),
  ...options,
});
