import { useQuery } from '@tanstack/react-query';

import {
  getEventMatchResult,
  getEventMatchStats,
  getLeagueMatchStats,
  getPendingMatchStatsPrompts,
  getPersonalStats,
  getTeamPerformanceStats,
} from './matchStatsService';

export const useGetEventMatchResult = (eventId, teamId, options = {}) => useQuery({
  enabled: Boolean(eventId),
  queryFn: () => getEventMatchResult(eventId, teamId),
  queryKey: ['eventMatchResult', eventId, teamId || 'auto'],
  ...options,
});

export const useGetEventMatchStats = (eventId, teamId, options = {}) => useQuery({
  enabled: Boolean(eventId),
  queryFn: () => getEventMatchStats(eventId, teamId),
  queryKey: ['eventMatchStats', eventId, teamId || 'auto'],
  ...options,
});

export const useGetLeagueMatchStats = (matchId, teamId, options = {}) => useQuery({
  enabled: Boolean(matchId),
  queryFn: () => getLeagueMatchStats(matchId, teamId),
  queryKey: ['leagueMatchStats', matchId, teamId || 'auto'],
  ...options,
});

export const useGetPersonalStats = (userId, options = {}) => useQuery({
  enabled: Boolean(userId),
  queryFn: () => getPersonalStats(userId),
  queryKey: ['personalStats', userId],
  staleTime: 1000 * 60 * 5,
  ...options,
});

export const useGetTeamPerformanceStats = (teamId, options = {}) => useQuery({
  enabled: Boolean(teamId),
  queryFn: () => getTeamPerformanceStats(teamId),
  queryKey: ['teamPerformanceStats', teamId],
  staleTime: 1000 * 60 * 5,
  ...options,
});

export const useGetPendingMatchStatsPrompts = (options = {}) => useQuery({
  queryFn: () => getPendingMatchStatsPrompts(),
  queryKey: ['pendingMatchStatsPrompts'],
  staleTime: 1000 * 30,
  ...options,
});
