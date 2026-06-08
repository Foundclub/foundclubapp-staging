// @ts-nocheck
import { useQuery } from '@tanstack/react-query';

import { getMyClubInterestRequests } from './clubInterestRequestService';

export const getMyClubInterestRequestsQueryKey = (params = {}) => [
  'clubInterestRequests',
  'mine',
  {
    clubId: String(params?.clubId || '').trim(),
    includeHistory: params?.includeHistory === true,
    teamId: String(params?.teamId || '').trim(),
  },
];

export const useGetMyClubInterestRequests = (params = {}, options = {}) => {
  const normalizedParams = {
    clubId: String(params?.clubId || '').trim(),
    includeHistory: params?.includeHistory === true,
    teamId: String(params?.teamId || '').trim(),
  };

  return useQuery({
    queryFn: () => getMyClubInterestRequests(normalizedParams),
    queryKey: getMyClubInterestRequestsQueryKey(normalizedParams),
    ...options,
  });
};
