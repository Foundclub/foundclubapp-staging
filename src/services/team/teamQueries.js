import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { getTeamById, getTeams } from './teamService';

/**
 * React Query hook to fetch teams
 * @param {string} clubId
 * @param {{
 *   pageSize?: number;
 * }} [params]
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<{
 * pages: { data: Team[];
 * meta: { pagination: { page: number; pageCount: number; total: number } } }[] }>}
 */
export const useGetTeams = (clubId, params, options) => useInfiniteQuery({
  enabled: !!clubId,
  getNextPageParam: (lastPage) => {
    if (!lastPage) return undefined;
    const { meta: { pagination } } = lastPage;
    return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
  },
  queryFn: ({ pageParam = 1 }) => getTeams(clubId, { ...params, page: pageParam }),
  queryKey: ['teams', clubId, params],
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
