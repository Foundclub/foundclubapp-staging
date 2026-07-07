import { useQuery } from '@tanstack/react-query';

import { fetchMatch } from './leagueMatchService';

const LEAGUE_MATCH_STALE_MS = 30_000;

/**
 * @param {string | null | undefined} matchId
 * @returns {[string, string]}
 */
export const getLeagueMatchQueryKey = (matchId) => ['league-match', matchId || 'unknown'];

/**
 * @param {string | null | undefined} matchId
 * @param {({
 *   enabled?: boolean,
 *   refetchOnMount?: boolean | 'always',
 *   refetchOnWindowFocus?: boolean | 'always',
 *   staleTime?: number,
 * } & Record<string, any>)} [options]
 */
export const useGetLeagueMatch = (matchId, options = {}) => {
  const resolvedOptions = /** @type {any} */ (options || {});
  const {
    enabled = true,
    refetchOnMount = false,
    refetchOnWindowFocus = false,
    staleTime = LEAGUE_MATCH_STALE_MS,
    ...queryOptions
  } = resolvedOptions;

  return useQuery({
    enabled: Boolean(matchId) && enabled,
    queryFn: () => fetchMatch(matchId),
    queryKey: getLeagueMatchQueryKey(matchId),
    refetchOnMount,
    refetchOnWindowFocus,
    staleTime,
    ...queryOptions,
  });
};

/**
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string | null | undefined} matchId
 * @param {{ staleTime?: number }} [options]
 */
export const loadLeagueMatchWithCache = (queryClient, matchId, options = {}) => {
  const resolvedOptions = /** @type {{ staleTime?: number }} */ (options || {});
  return queryClient.fetchQuery({
    queryFn: () => fetchMatch(matchId),
    queryKey: getLeagueMatchQueryKey(matchId),
    staleTime: resolvedOptions.staleTime ?? LEAGUE_MATCH_STALE_MS,
  });
};
