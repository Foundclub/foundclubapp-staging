import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { getTeamById, getTeams } from './teamService';

/**
 * React Query hook to fetch teams
 * @param {{
 *   pageSize?: number;
 *   clubId?: string;
 *   playerId?: string;
 * }} [params]
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<{
 * pages: { data: Team[];
 * meta: { pagination: { page: number; pageCount: number; total: number } } }[] }>}
 */
export const useGetTeams = (params, options) => useInfiniteQuery({
  getNextPageParam: (lastPage) => {
    if (!lastPage) return undefined;
    const { meta: { pagination } } = lastPage;
    return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
  },
  queryFn: ({ pageParam = 1 }) => getTeams({ ...params, page: pageParam }),
  queryKey: ['teams', params],
  ...options,
});

/**
 * React Query hook to fetch a single team
 * @param {string} teamId
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<Team>}
 */
export const useGetTeam = (teamId, options) => useQuery({
  enabled: !!teamId,
  queryFn: () => getTeamById(teamId),
  queryKey: ['team', teamId],
  ...options,
});
