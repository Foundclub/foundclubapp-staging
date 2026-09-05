import { useInfiniteQuery } from '@tanstack/react-query';

import { getAuthTokens } from '@/domains/auth/authUseCases';

import { getPlaceholderDataOption } from '@/services/queryOptions';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  searchClubs,
  searchClubsMap,
  searchEvents,
  searchEventsMap,
  searchProfiles,
  searchRecruitment,
  searchReservations,
} from './searchService';

const getNextPageParam = (/** @type {any} */ lastPage) => {
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
 * Les deux conditions métier historiques, sorties une seule fois : elles
 * étaient recopiées telles quelles dans plusieurs crochets.
 * @param {Record<string, any>} [params]
 * @returns {boolean} Vrai si la saisie fait au moins 2 caractères.
 */
const hasSearchText = (params = {}) => Boolean(
  params?.q && String(params.q).trim().length >= 2,
);

/**
 * Dit si les bornes de la carte sont toutes lisibles.
 * @param {Record<string, any>} [params]
 * @returns {boolean} Vrai si les 5 bornes sont des nombres finis.
 */
const hasMapBounds = (params = {}) => (
  Number.isFinite(Number(params?.north))
  && Number.isFinite(Number(params?.south))
  && Number.isFinite(Number(params?.east))
  && Number.isFinite(Number(params?.west))
  && Number.isFinite(Number(params?.zoom))
);

/**
 * SENTRY1 — la recherche EXIGE une session, et aucun de ces crochets ne le
 * regardait. Mesure du 2026-09-05 : 8 refus `403` sur `GET /api/search/events`
 * dans les journaux de production, et le serveur a raison —
 * `api::search.search.events` est accordé à `Authenticated` et aux 5 rôles
 * métier, jamais à `Public`. Vérifié le même jour, sans jeton :
 * `curl https://api.foundclubpro.com/api/search/events?q=foot` → **403**.
 *
 * ⛔ Ce défaut ne se filtre pas côté Sentry, il se corrige ici : on ne part
 * plus tant que la session n'est pas là. Même motif qu'`authQueries.js:13`.
 * @returns {boolean}
 */
const hasSession = () => Boolean(getAuthTokens()?.token);

/**
 * Compose la garde de session avec la condition métier du crochet.
 *
 * ⚠️ À poser APRÈS `...options` dans chaque crochet : un appelant passe son
 * propre `enabled` (ConversationPublicEventPicker.js:71) et l'étalement
 * l'écraserait sinon. La session est un plancher que personne ne lève ; le
 * droit d'ÉTEINDRE une requête, lui, reste à l'appelant.
 * @param {any} options
 * @param {boolean} fallbackEnabled - La condition métier historique du crochet.
 * @returns {boolean}
 */
const enabledWithSession = (options, fallbackEnabled) => (
  hasSession() && (options?.enabled ?? fallbackEnabled)
);

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchEvents = (params = {}, options = {}) => useInfiniteQuery({
  getNextPageParam,
  placeholderData: getPlaceholderDataOption(options),
  queryFn: (/** @type {any} */ { pageParam = 1, signal }) => searchEvents({ ...params, page: pageParam }, { signal }),
  queryKey: buildNormalizedQueryKey(['search', 'events'], params),
  refetchOnMount: options.refetchOnMount ?? false,
  refetchOnReconnect: options.refetchOnReconnect ?? false,
  retry: options.retry ?? 0,
  staleTime: 30_000,
  ...options,
  enabled: enabledWithSession(options, hasSearchText(params)),
});

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchEventsMap = (params = {}, options = {}) => useInfiniteQuery({
  getNextPageParam,
  placeholderData: getPlaceholderDataOption(options),
  queryFn: (/** @type {any} */ { pageParam = 1, signal }) => searchEventsMap({ ...params, page: pageParam }, { signal }),
  queryKey: buildNormalizedQueryKey(['search', 'events', 'map'], params),
  refetchOnMount: options.refetchOnMount ?? false,
  refetchOnReconnect: options.refetchOnReconnect ?? false,
  retry: options.retry ?? 0,
  staleTime: 30_000,
  ...options,
  enabled: enabledWithSession(options, hasMapBounds(params)),
});

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchClubs = (params = {}, options = {}) => useInfiniteQuery({
  getNextPageParam,
  placeholderData: getPlaceholderDataOption(options),
  queryFn: (/** @type {any} */ { pageParam = 1, signal }) => searchClubs({ ...params, page: pageParam }, { signal }),
  queryKey: buildNormalizedQueryKey(['search', 'clubs'], params),
  refetchOnMount: options.refetchOnMount ?? false,
  refetchOnReconnect: options.refetchOnReconnect ?? false,
  retry: options.retry ?? 0,
  staleTime: 30_000,
  ...options,
  enabled: enabledWithSession(options, hasSearchText(params)),
});

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchClubsMap = (params = {}, options = {}) => useInfiniteQuery({
  getNextPageParam,
  placeholderData: getPlaceholderDataOption(options),
  queryFn: (/** @type {any} */ { pageParam = 1, signal }) => searchClubsMap({ ...params, page: pageParam }, { signal }),
  queryKey: buildNormalizedQueryKey(['search', 'clubs', 'map'], params),
  refetchOnMount: options.refetchOnMount ?? false,
  refetchOnReconnect: options.refetchOnReconnect ?? false,
  retry: options.retry ?? 0,
  staleTime: 30_000,
  ...options,
  enabled: enabledWithSession(options, hasMapBounds(params)),
});

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchReservations = (params = {}, options = {}) => useInfiniteQuery({
  getNextPageParam,
  placeholderData: getPlaceholderDataOption(options),
  queryFn: (/** @type {any} */ { pageParam = 1, signal }) => searchReservations({ ...params, page: pageParam }, { signal }),
  queryKey: buildNormalizedQueryKey(['search', 'reservations'], params),
  refetchOnMount: options.refetchOnMount ?? false,
  refetchOnReconnect: options.refetchOnReconnect ?? false,
  retry: options.retry ?? 0,
  staleTime: 30_000,
  ...options,
  enabled: enabledWithSession(options, hasSearchText(params)),
});

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchRecruitment = (params = {}, options = {}) => useInfiniteQuery({
  getNextPageParam,
  placeholderData: getPlaceholderDataOption(options),
  queryFn: (/** @type {any} */ { pageParam = 1, signal }) => searchRecruitment({ ...params, page: pageParam }, { signal }),
  queryKey: buildNormalizedQueryKey(['search', 'recruitment'], params),
  refetchOnMount: options.refetchOnMount ?? false,
  refetchOnReconnect: options.refetchOnReconnect ?? false,
  retry: options.retry ?? 0,
  staleTime: 30_000,
  ...options,
  enabled: enabledWithSession(options, hasAnyActiveSearchParam(params)),
});

/**
 * @param {Record<string, any>} params
 * @param {any} [options]
 */
export const useSearchProfiles = (params = {}, options = {}) => useInfiniteQuery({
  getNextPageParam,
  placeholderData: getPlaceholderDataOption(options),
  queryFn: (/** @type {any} */ { pageParam = 1, signal }) => searchProfiles({ ...params, page: pageParam }, { signal }),
  queryKey: buildNormalizedQueryKey(['search', 'profiles'], params),
  refetchOnMount: options.refetchOnMount ?? false,
  refetchOnReconnect: options.refetchOnReconnect ?? false,
  retry: options.retry ?? 0,
  staleTime: 30_000,
  ...options,
  enabled: enabledWithSession(options, true),
});
