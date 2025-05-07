import { useInfiniteQuery, useMutation } from '@tanstack/react-query';

import {
  acceptEventParticipation,
  createEventParticipation,
  declineEventParticipation,
  getEventParticipations,
} from './eventParticipationService';

/**
 * React Query hook to fetch event participation requests
 * @param {string} eventId
 * @param {string} [userId]
 * @param {{
 *   pageSize?: number;
 * }} [params]
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<{
 * pages: { data: EventParticipation[];
 * meta: { pagination: { page: number; pageCount: number } } }[] }>}
 */
export const useGetEventParticipations = (eventId, userId, params, options) => useInfiniteQuery({
  enabled: !!eventId,
  getNextPageParam: (lastPage) => {
    const { meta: { pagination } } = lastPage;
    return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
  },
  queryFn: ({ pageParam = 1 }) => getEventParticipations(
    eventId,
    userId,
    { ...params, page: pageParam },
  ),
  queryKey: ['eventParticipations', eventId, userId, params],
  ...options,
});

/**
 * React Query hook to create an event participation request
 * @param {object} options - The mutation options
 * @returns {import('@tanstack/react-query').UseMutationResult<
 * EventParticipation,
 * Error,
 * {user: string, event: string, reason?: string}
 * >}
 */
export const useCreateEventParticipation = (options = {}) => useMutation({
  mutationFn: (data) => createEventParticipation(data),
  ...options,
});

/**
 * React Query hook to accept an event participation request
 * @param {object} options - The mutation options
 * @returns {import('@tanstack/react-query').UseMutationResult<
 * EventParticipation,
 * Error,
 * string
 * >}
 */
export const useAcceptEventParticipation = (options = {}) => useMutation({
  mutationFn: acceptEventParticipation,
  ...options,
});

/**
 * React Query hook to decline an event participation request
 * @param {object} options - The mutation options
 * @returns {import('@tanstack/react-query').UseMutationResult<
 * EventParticipation,
 * Error,
 * string
 * >}
 */
export const useDeclineEventParticipation = (options = {}) => useMutation({
  mutationFn: declineEventParticipation,
  ...options,
});
