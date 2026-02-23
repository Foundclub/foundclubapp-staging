/**
 * MultisportClub React Query hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  approveHighlightRequest,
  createCMSection,
  createHighlightRequest,
  getCMClubs,
  getCMHighlightRequests,
  getCMPlanning,
  rejectHighlightRequest,
} from './multisportClubService';

/**
 * @typedef {object} CreateSectionVariables
 * @property {string} cmId
 * @property {Record<string, any>} data
 */

/**
 * @typedef {object} HighlightRequestVariables
 * @property {string} eventId
 * @property {Record<string, any>} data
 */

/**
 * @typedef {object} RejectHighlightRequestVariables
 * @property {string} requestId
 * @property {string} reason
 */

export const CM_QUERY_KEYS = {
  clubs: (/** @type {string} */ cmId) => ['cm', cmId, 'clubs'],
  highlightRequests: (/** @type {string} */ cmId) => ['cm', cmId, 'highlight-requests'],
  planning: (/** @type {string} */ cmId, /** @type {Record<string, any>} */ filters) => ['cm', cmId, 'planning', filters],
};

/**
 * Get all club sections for a multisport club
 * @param cmId
 * @param options
 */
export function useGetCMClubs(/** @type {string} */ cmId, options = {}) {
  return useQuery({
    enabled: !!cmId,
    queryFn: () => getCMClubs(cmId),
    queryKey: CM_QUERY_KEYS.clubs(cmId),
    ...options,
  });
}

/**
 * Get planning for a multisport club
 * @param cmId
 * @param filters
 * @param options
 */
export function useGetCMPlanning(
  /** @type {string} */ cmId,
  filters = /** @type {Record<string, any>} */ ({}),
  options = {},
) {
  return useQuery({
    enabled: !!cmId,
    queryFn: () => getCMPlanning(cmId, filters),
    queryKey: CM_QUERY_KEYS.planning(cmId, filters),
    ...options,
  });
}

/**
 * Get pending highlight requests for a multisport club
 * @param cmId
 * @param options
 */
export function useGetCMHighlightRequests(/** @type {string} */ cmId, options = {}) {
  return useQuery({
    enabled: !!cmId,
    queryFn: () => getCMHighlightRequests(cmId),
    queryKey: CM_QUERY_KEYS.highlightRequests(cmId),
    ...options,
  });
}

/**
 * Create a new section under a multisport club
 */
export function useCreateCMSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (/** @type {CreateSectionVariables} */ { cmId, data }) => createCMSection(cmId, data),
    onSuccess: (_, /** @type {CreateSectionVariables} */ variables) => {
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
    mutationFn: (/** @type {HighlightRequestVariables} */ { data, eventId }) => createHighlightRequest(eventId, data),
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
    mutationFn: (/** @type {string} */ requestId) => approveHighlightRequest(requestId),
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
    mutationFn: (/** @type {RejectHighlightRequestVariables} */ { reason, requestId }) => rejectHighlightRequest(requestId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[2] === 'highlight-requests',
      });
    },
  });
}
