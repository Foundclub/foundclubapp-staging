import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  getChatById,
  getChatMessages,
  getChats,
} from './chatService';

const CHATS_STALE_MS = 30 * 1000;
const CHAT_DETAIL_STALE_MS = 30 * 1000;
const CHAT_MESSAGES_STALE_MS = 15 * 1000;

/**
 * React Query hook to fetch messages
 * @param {{
 *   pageSize?: number;
 *   currentUserClubId?: string;
 *   currentUserId?: string;
 *   currentUserTeamIds?: string[];
 * }} [params]
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<{
 * pages: { data: Chat[];
 * meta: { pagination: { page: number; pageCount: number; total: number } } }[] }>}
 */
export const useGetChats = (params, options = {}) => {
  const {
    enabled = true,
    refetchOnMount = false,
    refetchOnWindowFocus = false,
    staleTime = CHATS_STALE_MS,
    ...queryOptions
  } = options || {};

  return useInfiniteQuery({
    enabled: Boolean(params?.currentUserId) && enabled,
    getNextPageParam: (lastPage) => {
      if (!lastPage) return undefined;
      const { meta: { pagination } } = lastPage;
      return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
    },
    initialPageParam: 1,
    queryFn: ({ pageParam = 1 }) => getChats(pageParam, params?.pageSize),
    // MSG1/N3 — `chatScope` N'EST PAS dans la clef, et c'est voulu.
    // Il n'atteint jamais le serveur : `getChats` ne prend que
    // (page, pageSize) — chatService.js:52. Le laisser ici fabriquait une
    // 2e entree de cache pour une requete HTTP RIGOUREUSEMENT identique,
    // donc un 2e telechargement de la meme liste a chaque ouverture (la
    // pastille demandait 'all', l'ecran 'classic'). Le tri Toutes /
    // Classique / League se fait cote app (Messaging.js:343-344).
    queryKey: buildNormalizedQueryKey('chats', {
      currentUserClubId: params?.currentUserClubId,
      currentUserId: params?.currentUserId,
      currentUserTeamIds: params?.currentUserTeamIds,
      pageSize: params?.pageSize,
    }),
    refetchOnMount,
    refetchOnWindowFocus,
    staleTime,
    ...queryOptions,
  });
};

/**
 * React Query hook to fetch a chat by id
 * @param {string} chatId - The chat id
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<Chat>}
 */
export const useGetChatById = (chatId, options = {}) => {
  const {
    enabled = true,
    refetchOnMount = false,
    refetchOnWindowFocus = false,
    serviceOptions = {},
    staleTime = CHAT_DETAIL_STALE_MS,
    ...queryOptions
  } = options || {};
  const includeMessages = serviceOptions?.includeMessages === true;

  return useQuery({
    enabled: !!chatId && enabled,
    queryFn: () => getChatById(chatId, { includeMessages }),
    queryKey: buildNormalizedQueryKey(['chat', chatId], {
      includeMessages,
    }),
    refetchOnMount,
    refetchOnWindowFocus,
    staleTime,
    ...queryOptions,
  });
};

/**
 * React Query hook to fetch messages
 * @param {{
 *   pageSize?: number;
 *   chatId?: string;
 * }} [params]
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<{
 * pages: { data: ChatMessage[];
 * meta: { pagination: { page: number; pageCount: number; total: number } } }[] }>}
 */
export const useGetChatMessages = (params, options = {}) => {
  const {
    enabled = true,
    refetchOnMount = false,
    refetchOnWindowFocus = false,
    staleTime = CHAT_MESSAGES_STALE_MS,
    ...queryOptions
  } = options || {};

  return useInfiniteQuery({
    enabled: !!params?.chatId && enabled,
    getNextPageParam: (lastPage) => {
      if (!lastPage) return undefined;
      const { meta: { pagination } } = lastPage;
      return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
    },
    initialPageParam: 1,
    queryFn: ({ pageParam = 1 }) => getChatMessages(params?.chatId, pageParam, params?.pageSize),
    queryKey: buildNormalizedQueryKey(['chat-messages', params?.chatId], {
      pageSize: params?.pageSize,
      payload: 'light',
    }),
    refetchOnMount,
    refetchOnWindowFocus,
    staleTime,
    ...queryOptions,
  });
};
