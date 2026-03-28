import { useQuery } from '@tanstack/react-query';

import { getPendingLeagueAction } from './leagueActionService';

export const usePendingLeagueAction = (teamId, options = {}) => useQuery({
  queryFn: () => getPendingLeagueAction(teamId),
  queryKey: ['pendingLeagueAction', teamId || 'auto'],
  staleTime: 1000 * 30,
  ...options,
});
