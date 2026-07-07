import { useQuery } from '@tanstack/react-query';

import {
  getLeagueTeamById,
  getLeagueTeamContext,
} from './leagueTeamService';

export const getLeagueTeamContextQueryKey = (userId) => [
  'leagueTeamContext',
  userId || 'anonymous',
];

const composeSelect = (baseSelect, extraSelect) => {
  if (typeof extraSelect !== 'function') {
    return baseSelect;
  }

  return (data) => extraSelect(baseSelect(data));
};

const LEAGUE_TEAM_CONTEXT_STALE_TIME_MS = 1000 * 120;

const withLeagueContextDefaults = (queryOptions = {}) => ({
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  staleTime: LEAGUE_TEAM_CONTEXT_STALE_TIME_MS,
  ...queryOptions,
});

/**
 * React Query hook to fetch a single league team
 * @param {string} teamId
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<any>}
 */
export const useGetLeagueTeam = (teamId, options) => useQuery({
  enabled: !!teamId,
  queryFn: () => getLeagueTeamById(teamId),
  queryKey: ['leagueTeam', teamId],
  ...options,
});

export const useGetLeagueTeamContext = (userId, options = {}) => {
  const { select, ...queryOptions } = withLeagueContextDefaults(options);

  return useQuery({
    enabled: !!userId,
    queryFn: () => getLeagueTeamContext(userId),
    queryKey: getLeagueTeamContextQueryKey(userId),
    select,
    ...queryOptions,
  });
};

export const loadLeagueTeamContextWithCache = async (
  queryClient,
  userId,
  options = {},
) => {
  const queryKey = getLeagueTeamContextQueryKey(userId);
  const cachedValue = queryClient?.getQueryData?.(queryKey);
  if (cachedValue) {
    return cachedValue;
  }

  return queryClient.fetchQuery({
    queryFn: () => getLeagueTeamContext(userId),
    queryKey,
    staleTime: options?.staleTime ?? LEAGUE_TEAM_CONTEXT_STALE_TIME_MS,
  });
};

/**
 * React Query hook to fetch my league team
 * @param {string} userId
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>}
 */
export const useGetMyLeagueTeam = (userId, options = {}) => {
  const { select, ...queryOptions } = withLeagueContextDefaults(options);

  return useQuery({
    enabled: !!userId,
    queryFn: () => getLeagueTeamContext(userId),
    queryKey: getLeagueTeamContextQueryKey(userId),
    select: composeSelect((data) => data?.squads || [], select),
    ...queryOptions,
  });
};

/**
 * React Query hook to fetch pending league squad requests for the current user
 * @param {string} userId
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>}
 */
export const useGetPendingLeagueTeams = (userId, options = {}) => {
  const { select, ...queryOptions } = withLeagueContextDefaults(options);

  return useQuery({
    enabled: !!userId,
    queryFn: () => getLeagueTeamContext(userId),
    queryKey: getLeagueTeamContextQueryKey(userId),
    select: composeSelect((data) => data?.pendingSquads || [], select),
    ...queryOptions,
  });
};

/**
 * React Query hook to fetch invited league squads for the current user
 * @param {string} userId
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>}
 */
export const useGetInvitedLeagueTeams = (userId, options = {}) => {
  const { select, ...queryOptions } = withLeagueContextDefaults(options);

  return useQuery({
    enabled: !!userId,
    queryFn: () => getLeagueTeamContext(userId),
    queryKey: getLeagueTeamContextQueryKey(userId),
    select: composeSelect((data) => data?.invitedSquads || [], select),
    ...queryOptions,
  });
};
