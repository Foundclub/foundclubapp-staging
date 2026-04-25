import { useQuery } from '@tanstack/react-query';

import {
  getLeaguePlatformRuntime,
  LEAGUE_PLATFORM_RUNTIME_QUERY_KEY,
} from './leaguePlatformService';

export const useLeaguePlatformRuntime = (options = {}) => useQuery({
  queryFn: getLeaguePlatformRuntime,
  queryKey: LEAGUE_PLATFORM_RUNTIME_QUERY_KEY,
  refetchOnMount: false,
  retry: false,
  staleTime: 1000 * 30,
  ...options,
});
