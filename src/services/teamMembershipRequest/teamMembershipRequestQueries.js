import { useInfiniteQuery } from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import { getTeamMembershipRequests } from './teamMembershipRequestService';

/**
 * React Query hook to fetch team membership requests
 * @param {string} teamId
 * @param {{
 *   pageSize?: number;
 * }} [params]
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<{
 * pages: { data: TeamMembershipRequest[];
 * meta: { pagination: { page: number; pageCount: number } } }[] }>}
 */
export const useGetTeamMembershipRequests = (teamId, params, options) => useInfiniteQuery({
  enabled: !!teamId,
  getNextPageParam: (lastPage) => {
    const { meta: { pagination } } = lastPage;
    return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
  },
  queryFn: ({ pageParam = 1 }) => getTeamMembershipRequests(teamId, { ...params, page: pageParam }),
  queryKey: buildNormalizedQueryKey(['teamMembershipRequests', teamId], params),
  ...options,
});
