import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { getAuthTokens } from '@/domains/auth/authUseCases';

import { getPlaceholderDataOption } from '@/services/queryOptions';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  getClubById, getClubs, getMultisportClubs, getPublicClubById,
} from './clubService';

/**
 * React Query hook to fetch clubs list
 * @param {{
 *   page?: number;
 *   pageSize?: number;
 *   activity?: string;
 *   name?: string;
 *   geohash?: string[];
 * }} [params]
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<{
 * pages: { data: Club[]; meta: { pagination: { page: number; pageCount: number } } }[] }>}
 */
export const useGetClubs = (params, options) => useInfiniteQuery({
  getNextPageParam: (lastPage) => {
    const { meta: { pagination } } = lastPage;
    return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
  },
  placeholderData: getPlaceholderDataOption(options),
  queryFn: ({ pageParam = 1 }) => getClubs({ ...params, page: pageParam }),
  queryKey: buildNormalizedQueryKey('clubs', params),
  refetchOnMount: options?.refetchOnMount ?? false,
  staleTime: options?.staleTime ?? 30_000,
  ...options,
});

/**
 * React Query hook to fetch multisport clubs list
 * @param {Record<string, any>} [params]
 * @param {any} [options]
 */
export const useGetMultisportClubs = (params, options) => useInfiniteQuery({
  getNextPageParam: (lastPage) => {
    const { meta: { pagination } } = lastPage;
    return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
  },
  placeholderData: getPlaceholderDataOption(options),
  queryFn: ({ pageParam = 1 }) => getMultisportClubs({ ...params, page: pageParam }),
  queryKey: buildNormalizedQueryKey('multisport-clubs', params),
  refetchOnMount: options?.refetchOnMount ?? false,
  staleTime: options?.staleTime ?? 30_000,
  ...options,
  // SENTRY1 — ce crochet n'avait AUCUN `enabled` propre : il partait sans
  // session et le serveur refusait. Mesure du 2026-09-05 : 4 refus `403` sur
  // `GET /api/multisport-clubs` en production, et le refus se reproduit sans
  // jeton (`curl https://api.foundclubpro.com/api/multisport-clubs` → 403).
  // Posé APRÈS `...options` : ClubListContent.js:176 passe son propre
  // `enabled`, qui garde le droit d'éteindre mais pas celui de rallumer.
  enabled: Boolean(getAuthTokens()?.token) && (options?.enabled ?? true),
});

/**
 * React Query hook to fetch a single club
 * @param {string|number} id
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<Club>}
 */
export const useGetClub = (id, options = {}) => {
  // 🔒 CLUBPUB (decision d'Adel du 2026-09-07) — deux portes, une par public.
  // Sans jeton, la porte privee `/clubs/:id` rend 403 : le visiteur ne voyait
  // donc RIEN, et chaque tentative fabriquait un evenement Sentry. On frappe
  // desormais a la porte publique, celle des ~28 000 pages indexees.
  const hasSession = Boolean(getAuthTokens()?.token);

  return useQuery({
    enabled: !!id,
    queryFn: () => (hasSession ? getClubById(id) : getPublicClubById(id)),
    // ⚠️ LA PORTE FAIT PARTIE DE LA CLE, et ce n'est pas cosmetique : sans
    // elle, une fiche complete mise en cache AVANT une deconnexion serait
    // reservie au visiteur, telephone compris.
    queryKey: ['club', id, hasSession ? 'prive' : 'public'],
    ...options,
  });
};

/**
 * React Query hook to search clubs by name
 * @param {string} searchQuery - Search query
 * @param {object} options - Query options
 * @returns {import('@tanstack/react-query').UseQueryResult<Club[]>}
 */
export const useSearchClubs = (searchQuery, options = {}) => useQuery({
  enabled: searchQuery?.length >= 2,
  queryFn: async () => {
    const result = await getClubs({ name: searchQuery, pageSize: 10 });
    return result.data || [];
  },
  queryKey: ['clubs', 'search', searchQuery],
  staleTime: 30000,
  ...options,
});
