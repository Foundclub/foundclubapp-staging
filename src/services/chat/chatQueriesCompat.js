import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import * as ChatQueries from './chatQueries';
import {
  getChatById,
  getChatMessages,
  getChats,
} from './chatService';

const hasFunction = (value) => typeof value === 'function';

const useFallbackGetChats = (params, options) => useInfiniteQuery({
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
  queryKey: ['chats', params?.currentUserClubId, params?.currentUserId, params?.currentUserTeamIds],
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
  queryKey: ['chat-messages', params?.chatId],
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
