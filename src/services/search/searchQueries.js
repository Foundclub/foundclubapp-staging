import { useInfiniteQuery } from '@tanstack/react-query';

import {
  searchClubs,
  searchEvents,
  searchRecruitment,
  searchReservations,
} from './searchService';

const getNextPageParam = (lastPage) => {
  const page = lastPage?.meta?.pagination?.page;
  const pageCount = lastPage?.meta?.pagination?.pageCount;
  if (!page || !pageCount) return undefined;
  return page < pageCount ? page + 1 : undefined;
};

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchEvents = (params = {}, options = {}) => useInfiniteQuery({
  enabled: Boolean(params?.q && String(params.q).trim().length >= 2),
  getNextPageParam,
  queryFn: ({ pageParam = 1, signal }) => searchEvents({ ...params, page: pageParam }, { signal }),
  queryKey: ['search', 'events', params],
  staleTime: 30_000,
  ...options,
});

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchClubs = (params = {}, options = {}) => useInfiniteQuery({
  enabled: Boolean(params?.q && String(params.q).trim().length >= 2),
  getNextPageParam,
  queryFn: ({ pageParam = 1, signal }) => searchClubs({ ...params, page: pageParam }, { signal }),
  queryKey: ['search', 'clubs', params],
  staleTime: 30_000,
  ...options,
});

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchReservations = (params = {}, options = {}) => useInfiniteQuery({
  enabled: Boolean(params?.q && String(params.q).trim().length >= 2),
  getNextPageParam,
  queryFn: ({ pageParam = 1, signal }) => searchReservations({ ...params, page: pageParam }, { signal }),
  queryKey: ['search', 'reservations', params],
  staleTime: 30_000,
  ...options,
});

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchRecruitment = (params = {}, options = {}) => useInfiniteQuery({
  enabled: Boolean(params?.q && String(params.q).trim().length >= 2),
  getNextPageParam,
  queryFn: ({ pageParam = 1, signal }) => searchRecruitment({ ...params, page: pageParam }, { signal }),
  queryKey: ['search', 'recruitment', params],
  staleTime: 30_000,
  ...options,
});
