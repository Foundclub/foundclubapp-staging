import { useQuery } from '@tanstack/react-query';
import { getAdminStats, getPendingClubClaims, getClubClaimsRequestList } from './adminService';

// ... existing hooks

/**
 * Hook to get club claims list
 * @param {object} params
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>}
 */
export const useGetClubClaimsRequestList = (params) => useQuery({
    queryKey: ['admin', 'claims', 'list', params],
    queryFn: () => getClubClaimsRequestList(params),
});

/**
 * Hook to get single claim request
 * @param {string} documentId
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>}
 */
export const useGetClubClaimRequest = (documentId) => useQuery({
    queryKey: ['admin', 'claims', 'detail', documentId],
    queryFn: () => getClubClaimRequest(documentId),
    enabled: !!documentId,
});

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approveClubClaim, refuseClubClaim, getClubClaimRequest } from './adminService';

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
 * Hook to get admin stats
 * @returns {import('@tanstack/react-query').UseQueryResult<{revenue: number, reportsCount: number, eventsToday: number}, Error>}
 */
export const useGetAdminStats = () => useQuery({
    queryKey: ['adminStats'],
    queryFn: getAdminStats,
});

/**
 * Hook to get pending club claims count
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>}
 */
export const useGetPendingClubClaims = () => useQuery({
    queryKey: ['admin', 'claims', 'pending'],
    queryFn: getPendingClubClaims,
});

// ================== ADMIN USERS ==================

import { getAdminUsers, getAdminUser, updateAdminUser, getAdminClubs, getAdminClub, updateAdminClub } from './adminService';

/**
 * Hook to get admin users list
 */
export const useGetAdminUsers = (params) => useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => getAdminUsers(params),
});

/**
 * Hook to get single user
 */
export const useGetAdminUser = (documentId) => useQuery({
    queryKey: ['admin', 'users', 'detail', documentId],
    queryFn: () => getAdminUser(documentId),
    enabled: !!documentId,
});

/**
 * Hook to update user
 */
export const useUpdateAdminUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ documentId, data }) => updateAdminUser(documentId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        },
    });
};

// ================== ADMIN CLUBS ==================

/**
 * Hook to get admin clubs list
 */
export const useGetAdminClubs = (params) => useQuery({
    queryKey: ['admin', 'clubs', params],
    queryFn: () => getAdminClubs(params),
});

/**
 * Hook to get single club
 */
export const useGetAdminClub = (documentId) => useQuery({
    queryKey: ['admin', 'clubs', 'detail', documentId],
    queryFn: () => getAdminClub(documentId),
    enabled: !!documentId,
});

/**
 * Hook to update club
 */
export const useUpdateAdminClub = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ documentId, data }) => updateAdminClub(documentId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'clubs'] });
        },
    });
};
