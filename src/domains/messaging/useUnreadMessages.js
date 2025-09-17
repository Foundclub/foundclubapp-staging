import { useCallback, useEffect, useState } from 'react';

import { useGetChats } from '@/services/chat/chatQueries';

import useAuth from '../auth/useAuth';
import useMessaging from './useMessaging';

/**
 * Hook to manage unread messages across all chats
 * @returns {{ unreadCount: number }} Object containing unread messages count
 */
const useUnreadMessages = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const { userData } = useAuth();
  const { getUnreadStatus } = useMessaging();
  const { data: chatsData } = useGetChats();

  const countUnreadMessages = useCallback(() => {
    // Ensure we have the expected data structure
    const chats = chatsData?.pages?.[0]?.data;
    if (!Array.isArray(chats)) return 0;

    return chats.reduce((total, chat) => {
      // Runtime check to ensure we have a valid chat object
      if (!chat || typeof chat.documentId !== 'string' || !Array.isArray(chat.messages)) {
        return total;
      }

      const lastMessage = chat.messages[0];
      if (!lastMessage?.createdAt || lastMessage?.sender?.documentId === userData?.documentId) {
        return total;
      }

      const hasUnread = getUnreadStatus(
        chat.documentId,
        new Date(lastMessage.createdAt).toISOString(),
      );

      return hasUnread ? total + 1 : total;
    }, 0);
  }, [chatsData, getUnreadStatus, userData]);

  useEffect(() => {
    setUnreadCount(countUnreadMessages());
  }, [countUnreadMessages]);

  return { unreadCount };
};

export default useUnreadMessages;
