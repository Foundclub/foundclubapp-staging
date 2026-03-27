import { useQuery } from '@tanstack/react-query';

import {
  getInvitedLeagueTeams,
  getLeagueTeamById,
  getMyLeagueTeam,
  getPendingLeagueTeams,
} from './leagueTeamService';

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

/**
 * React Query hook to fetch my league team
 * @param {string} userId
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>}
 */
export const useGetMyLeagueTeam = (userId, options) => useQuery({
  enabled: !!userId,
  queryFn: () => getMyLeagueTeam(userId),
  queryKey: ['myLeagueTeam', userId],
  ...options,
});

/**
 * React Query hook to fetch pending league squad requests for the current user
 * @param {string} userId
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>}
 */
export const useGetPendingLeagueTeams = (userId, options) => useQuery({
  enabled: !!userId,
  queryFn: () => getPendingLeagueTeams(userId),
  queryKey: ['pendingLeagueTeams', userId],
  ...options,
});

/**
 * React Query hook to fetch invited league squads for the current user
 * @param {string} userId
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>}
 */
export const useGetInvitedLeagueTeams = (userId, options) => useQuery({
  enabled: !!userId,
  queryFn: () => getInvitedLeagueTeams(userId),
  queryKey: ['invitedLeagueTeams', userId],
  ...options,
});
