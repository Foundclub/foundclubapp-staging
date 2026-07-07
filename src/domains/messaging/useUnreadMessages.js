import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import useAuth from '../auth/useAuth';
import { getUnreadStatus } from './messagingUseCases';

/**
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @returns {Chat[]}
 */
const getCachedChats = (queryClient) => {
  const queryEntries = queryClient.getQueriesData({ queryKey: ['chats'] });
  const seenChatIds = new Set();
  const chats = /** @type {Chat[]} */ ([]);

  queryEntries.forEach((entry) => {
    const value = entry[1];
    const queryData = /** @type {any} */ (value);
    let pages = [];
    if (Array.isArray(queryData?.pages)) {
      pages = queryData.pages;
    } else if (Array.isArray(queryData?.data)) {
      pages = [{ data: queryData.data }];
    }

    pages.forEach((/** @type {{ data?: Chat[] }} */ page) => {
      const pageChats = Array.isArray(page?.data) ? page.data : [];
      pageChats.forEach((/** @type {Chat} */ chat) => {
        const chatId = String(chat?.documentId || '').trim();
        if (!chatId || seenChatIds.has(chatId)) {
          return;
        }

        seenChatIds.add(chatId);
        chats.push(chat);
      });
    });
  });

  return chats;
};

/**
 * Hook to manage unread messages across cached chats only.
 * Avoids spinning up extra messaging queries from global navigators.
 * @returns {{ unreadCount: number }} Object containing unread messages count
 */
const useUnreadMessages = () => {
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);
  const { userData } = useAuth();

  const countUnreadMessages = useCallback(() => {
    const chats = getCachedChats(queryClient);
    if (!Array.isArray(chats) || chats.length === 0) {
      return 0;
    }

    return chats.reduce((total, chat) => {
      if (!chat || typeof chat.documentId !== 'string' || !Array.isArray(chat.messages)) {
        return total;
      }

      const lastMessage = chat.messages[0];
      if (!lastMessage?.createdAt || lastMessage?.sender?.documentId === userData?.documentId) {
        return total;
      }

      return getUnreadStatus(
        chat.documentId,
        new Date(lastMessage.createdAt).toISOString(),
      ) ? total + 1 : total;
    }, 0);
  }, [queryClient, userData?.documentId]);

  useEffect(() => {
    setUnreadCount(countUnreadMessages());

    const unsubscribe = queryClient.getQueryCache().subscribe((/** @type {any} */ event) => {
      if (!Array.isArray(event?.query?.queryKey) || event.query.queryKey[0] !== 'chats') {
        return;
      }

      setUnreadCount(countUnreadMessages());
    });

    return unsubscribe;
  }, [countUnreadMessages, queryClient]);

  return { unreadCount };
};

export default useUnreadMessages;
