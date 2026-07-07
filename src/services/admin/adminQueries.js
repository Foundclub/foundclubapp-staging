import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  approveClubClaim,
  createManualEntitlement,
  createManualSubscription,
  generateTestTournament,
  getAdminClub,
  getAdminClubs,
  getAdminReports,
  getAdminStats,
  getAdminUser,
  getAdminUsers,
  getClubClaimRequest,
  getClubClaimsRequestList,
  getDetectionVerificationQueue,
  getLeagueDisputes,
  getNonPartnerCoachAffiliations,
  getNonPartnerCoachGovernance,
  getNotificationsHealth,
  getPendingClubClaims,
  getPendingClubOnboardingRequests,
  getSubscriptionOps,
  migrateLegacySubscriptions,
  processAffiliationHelpRequest,
  purgeNotificationDeliveries,
  refuseAffiliationHelpRequest,
  refuseClubClaim,
  resolveLeagueDispute,
  retryNotificationDelivery,
  sendNotificationsHealthTest,
  syncSubscriptionTeamEntitlements,
  updateAdminClub,
  updateAdminUser,
  updateDetectionVerification,
  updateManualEntitlement,
  updateNonPartnerCoachAffiliation,
  updateNonPartnerCoachGovernance,
} from './adminService';

/**
 * Hook to get club claims list
 * @param {object} params
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>}
 */
export const useGetClubClaimsRequestList = (params) => useQuery({
  queryFn: () => getClubClaimsRequestList(params),
  queryKey: buildNormalizedQueryKey(['admin', 'claims', 'list'], params),
});

/**
 * Hook to get single claim request
 * @param {string} documentId
 * @param {'claim'|'club_creation'|'club_not_found'|'team_not_found'} [requestType]
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

export const useGetDetectionVerificationQueue = (params) => useQuery({
  queryFn: () => getDetectionVerificationQueue(params),
  queryKey: buildNormalizedQueryKey(['admin', 'detectionVerification'], params),
});

export const useUpdateDetectionVerification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {{ documentId: string; notes?: string; status: 'pending' | 'rejected' | 'verified' }} */ payload) => updateDetectionVerification(payload.documentId, {
      notes: payload.notes,
      status: payload.status,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'detectionVerification'] });
    },
  });
};

export const useGetNonPartnerCoachGovernance = () => useQuery({
  queryFn: getNonPartnerCoachGovernance,
  queryKey: ['admin', 'non-partner-coach-governance'],
});

export const useUpdateNonPartnerCoachGovernance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (/** @type {{ globalEnabled: boolean }} */ payload) => updateNonPartnerCoachGovernance(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'non-partner-coach-governance'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'non-partner-coach-affiliations'] });
    },
  });
};

export const useGetNonPartnerCoachAffiliations = (params) => useQuery({
  queryFn: () => getNonPartnerCoachAffiliations(params),
  queryKey: buildNormalizedQueryKey(['admin', 'non-partner-coach-affiliations'], params),
});

export const useGetSubscriptionOps = () => useQuery({
  queryFn: getSubscriptionOps,
  queryKey: ['admin', 'subscription-ops'],
});

export const useCreateManualSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createManualSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscription-ops'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
};

export const useSaveManualEntitlement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      /** @type {{ documentId?: string; payload: any }} */ params,
    ) => (
      params?.documentId
        ? updateManualEntitlement(params.documentId, params.payload)
        : createManualEntitlement(params?.payload || {})
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscription-ops'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
};

export const useSyncSubscriptionTeamEntitlements = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      /** @type {{ documentId: string; reason: string }} */ payload,
    ) => syncSubscriptionTeamEntitlements(payload.documentId, { reason: payload.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscription-ops'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
};

export const useMigrateLegacySubscriptions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: migrateLegacySubscriptions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscription-ops'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'claims'] });
    },
  });
};

export const useUpdateNonPartnerCoachAffiliation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      /** @type {{ userDocumentId: string; clubDocumentId: string; allowed: boolean; notes?: string }} */ payload,
    ) => updateNonPartnerCoachAffiliation(payload.userDocumentId, payload.clubDocumentId, {
      allowed: payload.allowed,
      notes: payload.notes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'non-partner-coach-governance'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'non-partner-coach-affiliations'] });
    },
  });
};

export const useGetNotificationsHealth = () => useQuery({
  queryFn: getNotificationsHealth,
  queryKey: ['admin', 'notifications-health'],
  refetchInterval: 30000,
});

export const useGenerateTestTournament = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generateTestTournament,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning'] });
    },
  });
};

export const useSendNotificationsHealthTest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendNotificationsHealthTest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications-health'] });
    },
  });
};

export const useRetryNotificationDelivery = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retryNotificationDelivery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications-health'] });
    },
  });
};

export const usePurgeNotificationDeliveries = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: purgeNotificationDeliveries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications-health'] });
    },
  });
};

/**
 * Hook to get aggregated admin reports.
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>}
 */
export const useGetAdminReports = () => useQuery({
  queryFn: getAdminReports,
  queryKey: ['admin', 'reports'],
});

/**
 * Hook to get pending club claims count
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>}
 */
export const useGetPendingClubClaims = () => useQuery({
  queryFn: getPendingClubClaims,
  queryKey: ['admin', 'claims', 'pending'],
});

/**
 * Hook to get pending club onboarding requests.
 * @param {object} params
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>}
 */
export const useGetPendingClubOnboardingRequests = (params) => useQuery({
  queryFn: () => getPendingClubOnboardingRequests(params),
  queryKey: buildNormalizedQueryKey(['admin', 'club-onboarding'], params),
});

// ================== ADMIN USERS ==================

/**
 * Hook to get admin users list
 * @param params
 */
export const useGetAdminUsers = (/** @type {Record<string, any> | undefined} */ params) => useQuery({
  queryFn: () => getAdminUsers(params),
  queryKey: buildNormalizedQueryKey(['admin', 'users'], params),
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
  queryKey: buildNormalizedQueryKey(['admin', 'clubs'], params),
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
  queryKey: buildNormalizedQueryKey(['admin', 'league-disputes'], params),
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
