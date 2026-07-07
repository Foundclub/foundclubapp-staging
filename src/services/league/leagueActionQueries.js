import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getPendingLeagueAction } from './leagueActionService';

/**
 * @param {string | null | undefined} teamId
 * @returns {[string, string]}
 */
export const getPendingLeagueActionQueryKey = (teamId) => ['pendingLeagueAction', teamId || 'auto'];

/**
 * @param {string | null | undefined} teamId
 * @returns {string}
 */
const normalizeTeamId = (teamId) => {
  if (typeof teamId !== 'string') return '';
  return teamId.trim();
};

/**
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string | null | undefined} teamId
 * @returns {{data: any, updatedAt: number} | null}
 */
export const getPendingLeagueActionCacheSnapshot = (queryClient, teamId) => {
  const normalizedTeamId = normalizeTeamId(teamId);
  const directQueryKey = getPendingLeagueActionQueryKey(normalizedTeamId || undefined);
  const directState = queryClient.getQueryState(directQueryKey);
  const directData = queryClient.getQueryData(directQueryKey);
  if (directData) {
    return {
      data: directData,
      updatedAt: Number(directState?.dataUpdatedAt || 0),
    };
  }

  if (!normalizedTeamId) {
    return null;
  }

  const autoQueryKey = getPendingLeagueActionQueryKey(undefined);
  const autoData = queryClient.getQueryData(autoQueryKey);
  const autoState = queryClient.getQueryState(autoQueryKey);
  const autoTeamId = normalizeTeamId(autoData?.nextAction?.teamId || '');
  if (!autoData || autoTeamId !== normalizedTeamId) {
    return null;
  }

  return {
    data: autoData,
    updatedAt: Number(autoState?.dataUpdatedAt || 0),
  };
};

/**
 * @param {string | null | undefined} teamId
 * @param {({
 *   refetchOnMount?: boolean | 'always',
 *   refetchOnWindowFocus?: boolean | 'always',
 *   staleTime?: number,
 * } & Record<string, any>)} [options]
 */
export const usePendingLeagueAction = (teamId, options = {}) => {
  const queryClient = useQueryClient();
  const normalizedTeamId = normalizeTeamId(teamId);
  const resolvedOptions = /** @type {any} */ (options || {});
  const {
    refetchOnMount = false,
    refetchOnWindowFocus = false,
    staleTime = 1000 * 30,
    ...queryOptions
  } = resolvedOptions;
  const cachedSnapshot = getPendingLeagueActionCacheSnapshot(queryClient, normalizedTeamId || undefined);

  return useQuery({
    initialData: cachedSnapshot?.data,
    initialDataUpdatedAt: cachedSnapshot?.updatedAt,
    queryFn: () => getPendingLeagueAction(normalizedTeamId || undefined),
    queryKey: getPendingLeagueActionQueryKey(normalizedTeamId || undefined),
    refetchOnMount,
    refetchOnWindowFocus,
    staleTime,
    ...queryOptions,
  });
};
