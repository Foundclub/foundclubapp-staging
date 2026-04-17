import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import * as ChatQueries from './chatQueries';
import {
  getChatById,
  getChatMessages,
  getChats,
} from './chatService';

const CHATS_STALE_MS = 30 * 1000;
const CHAT_DETAIL_STALE_MS = 30 * 1000;
const CHAT_MESSAGES_STALE_MS = 15 * 1000;

const hasFunction = (value) => typeof value === 'function';

const useFallbackGetChats = (params, options = {}) => {
  const {
    enabled = true,
    refetchOnMount = false,
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
    refetchOnMount,
    staleTime,
    ...queryOptions,
  });
};

const useFallbackGetChatById = (chatId, options = {}) => {
  const {
    enabled = true,
    refetchOnMount = false,
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
    staleTime,
    ...queryOptions,
  });
};

const useFallbackGetChatMessages = (params, options = {}) => {
  const {
    enabled = true,
    refetchOnMount = false,
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
    staleTime,
    ...queryOptions,
  });
};

export const useGetChats = hasFunction(ChatQueries.useGetChats)
  ? ChatQueries.useGetChats
  : useFallbackGetChats;

export const useGetChatById = hasFunction(ChatQueries.useGetChatById)
  ? ChatQueries.useGetChatById
  : useFallbackGetChatById;

export const useGetChatMessages = hasFunction(ChatQueries.useGetChatMessages)
  ? ChatQueries.useGetChatMessages
  : useFallbackGetChatMessages;
