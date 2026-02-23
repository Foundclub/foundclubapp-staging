import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  getEventAttendance,
  getEventById,
  getEvents,
  getEventTypes,
} from './eventService';

const normalizeQueryValue = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return [...value].map((item) => normalizeQueryValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const nextValue = value[key];
        if (nextValue !== undefined) {
          acc[key] = normalizeQueryValue(nextValue);
        }
        return acc;
      }, {});
  }
  return value;
};

/**
 * @param {Record<string, any> | undefined} params
 * @returns {[string, Record<string, any>]}
 */
export const getEventsQueryKey = (params) => ['events', normalizeQueryValue(params || {})];

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
 * React Query hook to fetch attendance/lateness for event participants
 * @param {string} eventId
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<any>}
 */
export const useGetEventAttendance = (eventId, options = {}) => useQuery({
  enabled: !!eventId,
  queryFn: () => getEventAttendance(eventId),
  queryKey: ['eventAttendance', eventId],
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
  queryKey: getEventsQueryKey(params),
  staleTime: 30 * 1000,
  ...options,
});
