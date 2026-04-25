import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { LEAGUE_PLATFORM_RUNTIME_QUERY_KEY } from '@/services/league/leaguePlatformService';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  applySuperadminLeagueDisputeAction,
  getSuperadminLeagueDashboard,
  getSuperadminLeagueDisputes,
  getSuperadminLeagueDivisions,
  getSuperadminLeagueMatches,
  getSuperadminLeaguePlatformSettings,
  getSuperadminLeagueSquadDetail,
  getSuperadminLeagueSquads,
  updateSuperadminLeaguePlatformSettings,
} from './superadminLeagueService';

const dashboardKey = ['superadmin', 'league', 'dashboard'];
const settingsKey = ['superadmin', 'league', 'settings'];
const squadsKey = (params) => buildNormalizedQueryKey(['superadmin', 'league', 'squads'], params);
const squadDetailKey = (documentId) => ['superadmin', 'league', 'squads', 'detail', documentId];
const matchesKey = (params) => buildNormalizedQueryKey(['superadmin', 'league', 'matches'], params);
const disputesKey = (params) => buildNormalizedQueryKey(['superadmin', 'league', 'disputes'], params);
const divisionsKey = ['superadmin', 'league', 'divisions'];

export const useGetSuperadminLeaguePlatformSettings = () => useQuery({
  queryFn: getSuperadminLeaguePlatformSettings,
  queryKey: settingsKey,
});

export const useUpdateSuperadminLeaguePlatformSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSuperadminLeaguePlatformSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKey });
      queryClient.invalidateQueries({ queryKey: dashboardKey });
      queryClient.invalidateQueries({ queryKey: LEAGUE_PLATFORM_RUNTIME_QUERY_KEY });
    },
  });
};

export const useGetSuperadminLeagueDashboard = () => useQuery({
  queryFn: getSuperadminLeagueDashboard,
  queryKey: dashboardKey,
});

export const useGetSuperadminLeagueSquads = (params = {}) => useQuery({
  queryFn: () => getSuperadminLeagueSquads(params),
  queryKey: squadsKey(params),
});

export const useGetSuperadminLeagueSquadDetail = (documentId) => useQuery({
  enabled: Boolean(documentId),
  queryFn: () => getSuperadminLeagueSquadDetail(documentId),
  queryKey: squadDetailKey(documentId),
});

export const useGetSuperadminLeagueMatches = (params = {}) => useQuery({
  queryFn: () => getSuperadminLeagueMatches(params),
  queryKey: matchesKey(params),
});

export const useGetSuperadminLeagueDisputes = (params = {}) => useQuery({
  queryFn: () => getSuperadminLeagueDisputes(params),
  queryKey: disputesKey(params),
});

export const useApplySuperadminLeagueDisputeAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ documentId, payload }) => applySuperadminLeagueDisputeAction(documentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'league'] });
    },
  });
};

export const useGetSuperadminLeagueDivisions = () => useQuery({
  queryFn: getSuperadminLeagueDivisions,
  queryKey: divisionsKey,
});
