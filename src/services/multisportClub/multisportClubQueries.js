/**
 * MultisportClub React Query hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCMClubs,
  getCMPlanning,
  createCMSection,
  getCMHighlightRequests,
  createHighlightRequest,
  approveHighlightRequest,
  rejectHighlightRequest,
} from './multisportClubService';

export const CM_QUERY_KEYS = {
  clubs: (cmId) => ['cm', cmId, 'clubs'],
  planning: (cmId, filters) => ['cm', cmId, 'planning', filters],
  highlightRequests: (cmId) => ['cm', cmId, 'highlight-requests'],
};

/**
 * Get all club sections for a multisport club
 */
export function useGetCMClubs(cmId, options = {}) {
  return useQuery({
    queryKey: CM_QUERY_KEYS.clubs(cmId),
    queryFn: () => getCMClubs(cmId),
    enabled: !!cmId,
    ...options,
  });
}

/**
 * Get planning for a multisport club
 */
export function useGetCMPlanning(cmId, filters = {}, options = {}) {
  return useQuery({
    queryKey: CM_QUERY_KEYS.planning(cmId, filters),
    queryFn: () => getCMPlanning(cmId, filters),
    enabled: !!cmId,
    ...options,
  });
}

/**
 * Get pending highlight requests for a multisport club
 */
export function useGetCMHighlightRequests(cmId, options = {}) {
  return useQuery({
    queryKey: CM_QUERY_KEYS.highlightRequests(cmId),
    queryFn: () => getCMHighlightRequests(cmId),
    enabled: !!cmId,
    ...options,
  });
}

/**
 * Create a new section under a multisport club
 */
export function useCreateCMSection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ cmId, data }) => createCMSection(cmId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: CM_QUERY_KEYS.clubs(variables.cmId),
      });
    },
  });
}

/**
 * Create a highlight request for an event
 */
export function useCreateHighlightRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ eventId, data }) => createHighlightRequest(eventId, data),
    onSuccess: () => {
      // Invalidate all CM highlight requests
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[2] === 'highlight-requests',
      });
    },
  });
}

/**
 * Approve a highlight request
 */
export function useApproveHighlightRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (requestId) => approveHighlightRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[2] === 'highlight-requests',
      });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

/**
 * Reject a highlight request
 */
export function useRejectHighlightRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ requestId, reason }) => rejectHighlightRequest(requestId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[2] === 'highlight-requests',
      });
    },
  });
}
