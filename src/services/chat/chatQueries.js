import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  getChatById,
  getChatMessages,
  getChats,
} from './chatService';

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
export const useGetChats = (params, options) => useInfiniteQuery({
  enabled: Boolean(params?.currentUserId) && (options?.enabled ?? true),
  getNextPageParam: (lastPage) => {
    if (!lastPage) return undefined;
    const { meta: { pagination } } = lastPage;
    return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
  },
  initialPageParam: 1,
  queryFn: ({ pageParam = 1 }) => getChats(pageParam, params?.pageSize, {
    currentUserClubId: params?.currentUserClubId,
    currentUserId: params?.currentUserId,
    currentUserTeamIds: params?.currentUserTeamIds,
  }),
  queryKey: buildNormalizedQueryKey('chats', {
    currentUserClubId: params?.currentUserClubId,
    currentUserId: params?.currentUserId,
    currentUserTeamIds: params?.currentUserTeamIds,
    pageSize: params?.pageSize,
  }),
  ...options,
});

/**
 * React Query hook to fetch a chat by id
 * @param {string} chatId - The chat id
 * @returns {import('@tanstack/react-query').UseQueryResult<Chat>}
 */
export const useGetChatById = (chatId) => useQuery({
  enabled: !!chatId,
  queryFn: () => getChatById(chatId),
  queryKey: ['chat', chatId],
});

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
export const useGetChatMessages = (params, options) => useInfiniteQuery({
  enabled: !!params?.chatId,
  getNextPageParam: (lastPage) => {
    if (!lastPage) return undefined;
    const { meta: { pagination } } = lastPage;
    return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
  },
  initialPageParam: 1,
  queryFn: ({ pageParam = 1 }) => getChatMessages(params?.chatId, pageParam, params?.pageSize),
  queryKey: buildNormalizedQueryKey(['chat-messages', params?.chatId], {
    pageSize: params?.pageSize,
  }),
  ...options,
});
