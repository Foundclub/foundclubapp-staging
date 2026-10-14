// @ts-nocheck
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cancelClubInterestRequest, getMyClubInterestRequests } from './clubInterestRequestService';

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

/**
 * PAR-L8 (13/10, design parent E19) — retirer une demande en attente. Quelle que soit l'issue
 * (effacée, ou le club a répondu entre-temps), TOUTES les lectures « mes demandes » se relisent
 * — celle de « Mes enfants » comme celle d'une fiche club : l'enfant y redevient admissible.
 * @param {object} [options] - Options react-query.
 * @returns {object} La mutation (`mutate(requestId, { onSuccess, onError })`).
 */
export const useCancelClubInterestRequest = (options = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId) => cancelClubInterestRequest(requestId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['clubInterestRequests', 'mine'] }),
    ...options,
  });
};
