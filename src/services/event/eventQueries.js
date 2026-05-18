import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { getPlaceholderDataOption } from '@/services/queryOptions';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  getEventAttendance,
  getEventById,
  getEventConvocation,
  getEvents,
  getEventTeamComposition,
  getEventTypes,
} from './eventService';

const EVENT_DETAIL_STALE_MS = 30_000;
const EVENT_ATTENDANCE_STALE_MS = 15_000;
const EVENT_LIST_STALE_MS = 60_000;

/**
 * @param {Record<string, any> | undefined} params
 * @returns {any[]}
 */
export const getEventsQueryKey = (params) => buildNormalizedQueryKey('events', params || {});

/**
 * React Query hook to fetch event types
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>}
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
 * @returns {import('@tanstack/react-query').UseQueryResult<any>}
 */
export const useGetEvent = (documentId, options = {}) => useQuery({
  enabled: !!documentId,
  queryFn: () => getEventById(documentId),
  queryKey: ['event', documentId],
  refetchOnMount: options?.refetchOnMount ?? false,
  staleTime: options?.staleTime ?? EVENT_DETAIL_STALE_MS,
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
  refetchOnMount: options?.refetchOnMount ?? false,
  staleTime: options?.staleTime ?? EVENT_ATTENDANCE_STALE_MS,
  ...options,
});

/**
 * React Query hook to fetch composition draft/published data for a team event branch.
 * @param {string} eventId
 * @param {string | undefined} teamId
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<any>}
 */
export const useGetEventTeamComposition = (eventId, teamId, options = {}) => useQuery({
  enabled: !!eventId,
  queryFn: () => getEventTeamComposition(eventId, teamId),
  queryKey: ['eventComposition', eventId, teamId || 'auto'],
  refetchOnMount: options?.refetchOnMount ?? false,
  staleTime: options?.staleTime ?? EVENT_DETAIL_STALE_MS,
  ...options,
});

/**
 * React Query hook to fetch published convocation view for a team event branch.
 * @param {string} eventId
 * @param {string | undefined} teamId
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<any>}
 */
export const useGetEventConvocation = (eventId, teamId, options = {}) => useQuery({
  enabled: !!eventId,
  queryFn: () => getEventConvocation(eventId, teamId),
  queryKey: ['eventConvocation', eventId, teamId || 'auto'],
  refetchOnMount: options?.refetchOnMount ?? false,
  staleTime: options?.staleTime ?? EVENT_DETAIL_STALE_MS,
  ...options,
});

/**
 * React Query hook to fetch events
 * @param {{
 *   pageSize?: number;
 *   clubId?: string;
 *   name?: string;
 *   type?: string;
 *   excludeType?: string;
 *   myTeams?: boolean | string[];
 *   sort?: string;
 * }} [params]
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<{
 * pages: { data: any[];
 * meta: { pagination: { page: number; pageCount: number; total: number } } }[] }>}
 */
export const useGetEvents = (params, options) => useInfiniteQuery({
  getNextPageParam: (lastPage) => {
    if (!lastPage) return undefined;
    const { meta: { pagination } } = lastPage;
    return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
  },
  placeholderData: getPlaceholderDataOption(options),
  queryFn: ({ pageParam = 1, signal }) => getEvents(
    /** @type {any} */ ({ ...params, page: pageParam }),
    { signal },
  ),
  queryKey: getEventsQueryKey(params),
  refetchOnMount: options?.refetchOnMount ?? false,
  staleTime: EVENT_LIST_STALE_MS,
  ...options,
});
