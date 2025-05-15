import { useCallback, useEffect, useState } from 'react';

import { useGetChats } from '@/services/chat/chatQueries';

import useMessaging from './useMessaging';

/**
 * Hook to manage unread messages across all chats
 * @returns {{
 *   unreadCount: number;
 * }} Object containing unread messages count
 */
const useUnreadMessages = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const { getUnreadStatus } = useMessaging();
  const { data: chats } = useGetChats();

  const countUnreadMessages = useCallback(() => {
    if (!chats) return 0;
    return chats.reduce((count, chat) => {
      const lastMessage = chat.messages?.[0];
      if (!lastMessage) return count;

      const hasUnread = getUnreadStatus(
        chat.documentId,
        new Date(lastMessage.createdAt).toISOString(),
      );
      return hasUnread ? count + 1 : count;
    }, 0);
  }, [chats, getUnreadStatus]);

  useEffect(() => {
    setUnreadCount(countUnreadMessages());
  }, [countUnreadMessages]);

  return { unreadCount };
};

export default useUnreadMessages;
