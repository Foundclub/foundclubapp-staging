import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  getTeamById,
  getTeamDefaultComposition,
  getTeams,
} from './teamService';

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
  queryKey: buildNormalizedQueryKey('teams', params),
  ...options,
});

/**
 * React Query hook to fetch a single team
 * @param {string} teamId
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<Team>}
 */
export const useGetTeam = (teamId, options) => useQuery({
  enabled: !!teamId,
  queryFn: () => getTeamById(teamId),
  queryKey: ['team', teamId],
  ...options,
});

/**
 * React Query hook to fetch a team's default composition template.
 * @param {string} teamId
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<any>}
 */
export const useGetTeamDefaultComposition = (teamId, options) => useQuery({
  enabled: !!teamId,
  queryFn: () => getTeamDefaultComposition(teamId),
  queryKey: ['teamDefaultComposition', teamId],
  ...options,
});
