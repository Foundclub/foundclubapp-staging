import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import {
  getChatById,
  getChatMessages,
  getChats,
} from './chatService';

/**
 * React Query hook to fetch all chats
 * @returns {import('@tanstack/react-query').UseQueryResult<Chat[]>}
 */
export const useGetChats = () => useQuery({
  queryFn: () => getChats(),
  queryKey: ['chats'],
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
  queryKey: ['chat-messages', params?.chatId],
  ...options,
});
