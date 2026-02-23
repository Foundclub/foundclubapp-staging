import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  approveClubClaim,
  getAdminClub,
  getAdminClubs,
  getAdminStats,
  getAdminUser,
  getAdminUsers,
  getClubClaimRequest,
  getClubClaimsRequestList,
  getLeagueDisputes,
  getPendingClubClaims,
  processAffiliationHelpRequest,
  refuseAffiliationHelpRequest,
  refuseClubClaim,
  resolveLeagueDispute,
  updateAdminClub,
  updateAdminUser,
} from './adminService';

/**
 * Hook to get club claims list
 * @param {object} params
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>}
 */
export const useGetClubClaimsRequestList = (params) => useQuery({
  queryFn: () => getClubClaimsRequestList(params),
  queryKey: ['admin', 'claims', 'list', params],
});

/**
 * Hook to get single claim request
 * @param {string} documentId
 * @param {'claim'|'club_not_found'|'team_not_found'} [requestType]
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>}
 */
export const useGetClubClaimRequest = (documentId, requestType) => useQuery({
  enabled: !!documentId,
  queryFn: () => getClubClaimRequest(documentId, requestType),
  queryKey: ['admin', 'claims', 'detail', documentId, requestType],
});

/**
 * Hook to approve claim
 */
export const useApproveClubClaim = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveClubClaim,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'claims'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
};

/**
 * Hook to refuse claim
 */
export const useRefuseClubClaim = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: refuseClubClaim,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'claims'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
};

/**
 * Hook to process affiliation help request (club/team not found).
 */
export const useProcessAffiliationHelpRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {{ documentId: string; adminNote?: string }} */ payload) => processAffiliationHelpRequest(payload.documentId, { adminNote: payload.adminNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'claims'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
};

/**
 * Hook to refuse affiliation help request (club/team not found).
 */
export const useRefuseAffiliationHelpRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {{ documentId: string; adminNote?: string }} */ payload) => refuseAffiliationHelpRequest(payload.documentId, { adminNote: payload.adminNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'claims'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
};

/**
 * Hook to get admin stats
 * @returns {import('@tanstack/react-query').UseQueryResult<{revenue: number, reportsCount: number, eventsToday: number}, Error>}
 */
export const useGetAdminStats = () => useQuery({
  queryFn: getAdminStats,
  queryKey: ['adminStats'],
});

/**
 * Hook to get pending club claims count
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>}
 */
export const useGetPendingClubClaims = () => useQuery({
  queryFn: getPendingClubClaims,
  queryKey: ['admin', 'claims', 'pending'],
});

// ================== ADMIN USERS ==================

/**
 * Hook to get admin users list
 * @param params
 */
export const useGetAdminUsers = (/** @type {Record<string, any> | undefined} */ params) => useQuery({
  queryFn: () => getAdminUsers(params),
  queryKey: ['admin', 'users', params],
});

/**
 * Hook to get single user
 * @param documentId
 */
export const useGetAdminUser = (/** @type {string | undefined} */ documentId) => useQuery({
  enabled: !!documentId,
  queryFn: () => getAdminUser(documentId),
  queryKey: ['admin', 'users', 'detail', documentId],
});

/**
 * Hook to update user
 */
export const useUpdateAdminUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {{ documentId: string; data: Record<string, any> }} */ payload) => updateAdminUser(payload.documentId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
};

// ================== ADMIN CLUBS ==================

/**
 * Hook to get admin clubs list
 * @param params
 */
export const useGetAdminClubs = (/** @type {Record<string, any> | undefined} */ params) => useQuery({
  queryFn: () => getAdminClubs(params),
  queryKey: ['admin', 'clubs', params],
});

/**
 * Hook to get single club
 * @param documentId
 */
export const useGetAdminClub = (/** @type {string | undefined} */ documentId) => useQuery({
  enabled: !!documentId,
  queryFn: () => getAdminClub(documentId),
  queryKey: ['admin', 'clubs', 'detail', documentId],
});

/**
 * Hook to update club
 */
export const useUpdateAdminClub = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {{ documentId: string; data: Record<string, any> }} */ payload) => updateAdminClub(payload.documentId, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'clubs'] });
    },
  });
};

// ================== LEAGUE DISPUTES ==================

/**
 * Hook to get League disputes list
 * @param params
 */
export const useGetLeagueDisputes = (/** @type {Record<string, any> | undefined} */ params) => useQuery({
  queryFn: () => getLeagueDisputes(params),
  queryKey: ['admin', 'league-disputes', params],
});

/**
 * Hook to resolve a League dispute
 */
export const useResolveLeagueDispute = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {{ matchId: string; scoreA: number; scoreB: number; reason?: string }} */ payload) => resolveLeagueDispute(payload.matchId, {
      reason: payload.reason,
      scoreA: payload.scoreA,
      scoreB: payload.scoreB,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'league-disputes'] });
      queryClient.invalidateQueries({ queryKey: ['league-matches'] });
    },
  });
};
