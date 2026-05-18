import { useQuery } from '@tanstack/react-query';

import {
  EMPTY_REQUESTS_HUB_DATA,
  getRequestsHubData,
  hasAnyRequestsContext,
  normalizeRequestsHubContext,
} from './requestsHubService';

/**
 * @param {import('./requestsHubService').RequestsHubContext} context
 */
export const getRequestsHubQueryKey = (context) => [
  'requestsHub',
  context.clubId || 'no-club',
  context.cmId || 'no-cm',
  context.teamIds,
];

/**
 * @param {Partial<import('./requestsHubService').RequestsHubContext>} rawContext
 * @param {import('@tanstack/react-query').UseQueryOptions<any>} [options]
 */
export const useRequestsHubData = (rawContext = {}, options = {}) => {
  const context = normalizeRequestsHubContext(rawContext);
  const baseEnabled = options?.enabled ?? true;
  const enabled = Boolean(baseEnabled) && hasAnyRequestsContext(context);

  return useQuery({
    ...options,
    enabled,
    placeholderData: (previousData) => previousData || EMPTY_REQUESTS_HUB_DATA,
    queryFn: () => getRequestsHubData(context),
    queryKey: getRequestsHubQueryKey(context),
    staleTime: 30_000,
  });
};
