// @ts-nocheck
import { useQuery } from '@tanstack/react-query';

import { getMyClubInterestRequests } from './clubInterestRequestService';

// PAR-L5L6 (13/10) — `includeChildRequests` change la REPONSE du serveur (les lignes d un
// enfant n en sortent qu avec lui) : il fait donc partie de la cle. Sans lui, la lecture avec
// et la lecture sans partageaient la meme case de cache (design parent, §5 ligne L5).
export const getMyClubInterestRequestsQueryKey = (params = {}) => [
  'clubInterestRequests',
  'mine',
  {
    clubId: String(params?.clubId || '').trim(),
    includeChildRequests: params?.includeChildRequests === true,
    includeHistory: params?.includeHistory === true,
    teamId: String(params?.teamId || '').trim(),
  },
];

export const useGetMyClubInterestRequests = (params = {}, options = {}) => {
  const normalizedParams = {
    clubId: String(params?.clubId || '').trim(),
    includeChildRequests: params?.includeChildRequests === true,
    includeHistory: params?.includeHistory === true,
    teamId: String(params?.teamId || '').trim(),
  };

  return useQuery({
    queryFn: () => getMyClubInterestRequests(normalizedParams),
    queryKey: getMyClubInterestRequestsQueryKey(normalizedParams),
    ...options,
  });
};
