import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import {
  createEvent,
  getEventById,
  getEvents,
  getEventTypes,
  updateEvent,
} from './eventService';

/**
 * React Query hook to fetch event types
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<FCEventType[]>}
 */
export const useGetEventTypes = (options = {}) => useQuery({
  queryFn: () => getEventTypes(),
  queryKey: ['event-types'],
  ...options,
});

/**
 * React Query hook to fetch an event
 * @param {string} documentId - The event ID
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<FCEvent>}
 */
export const useGetEvent = (documentId, options = {}) => useQuery({
  enabled: !!documentId,
  queryFn: () => getEventById(documentId),
  queryKey: ['event', documentId],
  ...options,
});

/**
 * React Query hook to create an event
 * @param {object} options - The mutation options
 * @returns {import('@tanstack/react-query').UseMutationResult<FCEventForm, Error, FCEventForm>}
 */
export const useCreateEvent = (options = {}) => useMutation({
  mutationFn: (data) => createEvent(data),
  ...options,
});

/**
 * React Query hook to update an event
 * @param {object} options - The mutation options
 * @returns {import('@tanstack/react-query').UseMutationResult<
 * FCEventForm,
 * Error,
 * { documentId: string } & FCEventForm
 * >}
 */
export const useUpdateEvent = (options = {}) => useMutation({
  mutationFn: ({ documentId, ...data }) => updateEvent(documentId, data),
  ...options,
});

/**
 * React Query hook to fetch events
 * @param {{
 *   pageSize?: number;
 *   clubId?: string;
 *   name?: string;
 *   type?: string;
 * }} [params]
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<{
 * pages: { data: FCEvent[];
 * meta: { pagination: { page: number; pageCount: number; total: number } } }[] }>}
 */
export const useGetEvents = (params, options) => useInfiniteQuery({
  getNextPageParam: (lastPage) => {
    if (!lastPage) return undefined;
    const { meta: { pagination } } = lastPage;
    return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
  },
  queryFn: ({ pageParam = 1 }) => getEvents({ ...params, page: pageParam }),
  queryKey: ['events', params],
  ...options,
});
