import { useMutation, useQuery } from '@tanstack/react-query';

import {
  createEvent,
  getEventById,
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
 * @returns {import('@tanstack/react-query').UseMutationResult<FCEvent, Error, FCEvent>}
 */
export const useCreateEvent = (options = {}) => useMutation({
  mutationFn: (data) => createEvent(data),
  ...options,
});

/**
 * React Query hook to update an event
 * @param {object} options - The mutation options
 * @returns {import('@tanstack/react-query').UseMutationResult<
 * FCEvent,
 * Error,
 * { documentId: string } & FCEvent
 * >}
 */
export const useUpdateEvent = (options = {}) => useMutation({
  mutationFn: ({ documentId, ...data }) => updateEvent(documentId, data),
  ...options,
});
