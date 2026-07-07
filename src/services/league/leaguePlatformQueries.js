import { useQuery } from '@tanstack/react-query';

import {
  getLeaguePlatformRuntime,
  LEAGUE_PLATFORM_RUNTIME_QUERY_KEY,
} from './leaguePlatformService';

export const useLeaguePlatformRuntime = (options = {}) => useQuery({
  queryFn: getLeaguePlatformRuntime,
  queryKey: LEAGUE_PLATFORM_RUNTIME_QUERY_KEY,
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
  retry: false,
  staleTime: 1000 * 120,
  ...options,
});
