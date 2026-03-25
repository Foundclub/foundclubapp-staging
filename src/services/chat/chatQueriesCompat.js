import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import * as ChatQueries from './chatQueries';
import {
  getChatById,
  getChatMessages,
  getChats,
} from './chatService';

const CHATS_STALE_MS = 10 * 1000;

const hasFunction = (value) => typeof value === 'function';

const useFallbackGetChats = (params, options) => useInfiniteQuery({
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
  staleTime: CHATS_STALE_MS,
  ...options,
});

const useFallbackGetChatById = (chatId) => useQuery({
  enabled: !!chatId,
  queryFn: () => getChatById(chatId),
  queryKey: ['chat', chatId],
});

const useFallbackGetChatMessages = (params, options) => useInfiniteQuery({
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

export const useGetChats = hasFunction(ChatQueries.useGetChats)
  ? ChatQueries.useGetChats
  : useFallbackGetChats;

export const useGetChatById = hasFunction(ChatQueries.useGetChatById)
  ? ChatQueries.useGetChatById
  : useFallbackGetChatById;

export const useGetChatMessages = hasFunction(ChatQueries.useGetChatMessages)
  ? ChatQueries.useGetChatMessages
  : useFallbackGetChatMessages;
