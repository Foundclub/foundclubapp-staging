import { useInfiniteQuery } from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  searchClubs,
  searchClubsMap,
  searchEvents,
  searchProfiles,
  searchRecruitment,
  searchReservations,
} from './searchService';

const getNextPageParam = (lastPage) => {
  const page = lastPage?.meta?.pagination?.page;
  const pageCount = lastPage?.meta?.pagination?.pageCount;
  if (!page || !pageCount) return undefined;
  return page < pageCount ? page + 1 : undefined;
};

const hasAnyActiveSearchParam = (params = {}) => Object.entries(params).some(([key, value]) => {
  if (['debug', 'page', 'pageSize', 'sort'].includes(key)) return false;
  if (key === 'q') return Boolean(value && String(value).trim().length >= 2);
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Boolean(value?.value || value?.label || value?.documentId || value?.id);
  return true;
});

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchEvents = (params = {}, options = {}) => useInfiniteQuery({
  enabled: Boolean(params?.q && String(params.q).trim().length >= 2),
  getNextPageParam,
  queryFn: ({ pageParam = 1, signal }) => searchEvents({ ...params, page: pageParam }, { signal }),
  queryKey: buildNormalizedQueryKey(['search', 'events'], params),
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
  queryKey: buildNormalizedQueryKey(['search', 'clubs'], params),
  staleTime: 30_000,
  ...options,
});

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchClubsMap = (params = {}, options = {}) => useInfiniteQuery({
  enabled: options.enabled ?? (
    Number.isFinite(Number(params?.north))
    && Number.isFinite(Number(params?.south))
    && Number.isFinite(Number(params?.east))
    && Number.isFinite(Number(params?.west))
    && Number.isFinite(Number(params?.zoom))
  ),
  getNextPageParam,
  placeholderData: options.placeholderData ?? ((previousData) => previousData),
  queryFn: ({ pageParam = 1, signal }) => searchClubsMap({ ...params, page: pageParam }, { signal }),
  queryKey: buildNormalizedQueryKey(['search', 'clubs', 'map'], params),
  refetchOnMount: options.refetchOnMount ?? false,
  refetchOnReconnect: options.refetchOnReconnect ?? false,
  retry: options.retry ?? 0,
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
  queryKey: buildNormalizedQueryKey(['search', 'reservations'], params),
  staleTime: 30_000,
  ...options,
});

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchRecruitment = (params = {}, options = {}) => useInfiniteQuery({
  enabled: options.enabled ?? hasAnyActiveSearchParam(params),
  getNextPageParam,
  queryFn: ({ pageParam = 1, signal }) => searchRecruitment({ ...params, page: pageParam }, { signal }),
  queryKey: buildNormalizedQueryKey(['search', 'recruitment'], params),
  staleTime: 30_000,
  ...options,
});

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchProfiles = (params = {}, options = {}) => useInfiniteQuery({
  enabled: options.enabled ?? true,
  getNextPageParam,
  queryFn: ({ pageParam = 1, signal }) => searchProfiles({ ...params, page: pageParam }, { signal }),
  queryKey: buildNormalizedQueryKey(['search', 'profiles'], params),
  staleTime: 30_000,
  ...options,
});
