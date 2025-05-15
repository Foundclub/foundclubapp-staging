import useSocket, { EVENTS } from '@/hooks/useSocket';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { storage } from '@/store/appContext';

import { createWhisperChat } from '@/services/chat/chatService';

/**
 * Get the storage key for the last read message timestamp of a chat
 * @param {string} chatId - The chat ID
 * @returns {string} The storage key
 */
const getLastReadMessageKey = (/** @type {string} */ chatId) => `chat_${chatId}_last_read`;

/**
 * Custom hook to handle messaging functionality
 * @param {string} [currentChatId] - The ID of the current chat room
 * @returns {{
 *   joinChat: (chatId: string) => void;
 *   leaveChat: (chatId: string) => void;
 *   sendMessage: (chatId: string, text: string) => void;
 *   startWhisperChat: (participants: string[]) => Promise<Chat | undefined>;
 *   getUnreadStatus: (chatId: string, lastMessageTimestamp: string) => boolean;
 *   updateLastReadMessage: (chatId: string) => void;
 * }} The messaging functionality
 */
const useMessaging = (currentChatId) => {
  const queryClient = useQueryClient();
  const { isConnected, socket } = useSocket();

  /**
   * Check if a chat has unread messages
   * @param {string} chatId - The chat ID
   * @param {string} lastMessageTimestamp - The timestamp of the last message
   * @returns {boolean} - Whether the chat has unread messages
   */
  const getUnreadStatus = useCallback((
    /** @type {string} */ chatId,
    /** @type {string} */ lastMessageTimestamp,
  ) => {
    const lastReadTimestamp = storage.getString(getLastReadMessageKey(chatId));
    if (!lastReadTimestamp) return true;
    return new Date(lastMessageTimestamp) >= new Date(lastReadTimestamp);
  }, []);

  /**
   * Update the last read message timestamp for a chat
   * @param {string} chatId - The chat ID
   */
  const updateLastReadMessage = useCallback((/** @type {string} */ chatId) => {
    storage.set(getLastReadMessageKey(chatId), new Date().toISOString());
  }, []);

  /**
   * Handle new message received from socket
   * @param {ChatMessage} message - The received message
   */
  const handleNewMessage = useCallback((/** @type {ChatMessage} */ message) => {
    // Add new message to chat messages cache
    queryClient.setQueryData(
      ['chat-messages', message.chat?.documentId],
      (/** @type {any} */ oldData) => {
        const formattedMessage = {
          chat: message.chat,
          createdAt: message.createdAt,
          documentId: message.documentId,
          id: message.id,
          message: message.message,
          sender: message.sender,
        };

        if (!oldData) {
          return {
            pages: [{
              data: [formattedMessage],
              meta: { pagination: { page: 1, pageCount: 1, total: 1 } },
            }],
          };
        }
        // Add new message to first page
        return {
          ...oldData,
          pages: [{
            ...oldData.pages[0],
            data: [formattedMessage, ...oldData.pages[0].data],
          }, ...oldData.pages.slice(1)],
        };
      },
    );

    // Update chat list to show latest message
    queryClient.setQueryData(
      ['chats'],
      (/** @type {Chat[] | undefined} */ oldChats) => {
        if (!oldChats) return undefined;
        return oldChats.map((chat) => {
          if (chat.documentId === message.chat?.documentId) {
            return {
              ...chat,
              messages: [message],
            };
          }
          return chat;
        });
      },
    );
  }, [queryClient]);

  const handleMessageDeleted = useCallback((/** @type {MessageDeletionData} */ data) => {
    queryClient.setQueryData(
      ['chat-messages', data.chatDocumentId],
      (/** @type {any} */ oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((/** @type {{ data: Array<{ id: string }> }} */ page) => ({
            ...page,
            data: page.data.filter((msg) => msg.id !== data.messageId),
          })),
        };
      },
    );
  }, [queryClient]);

  const handleJoined = useCallback((/** @type {JoinData} */ data) => {
    queryClient.invalidateQueries({ queryKey: ['chat-messages', data.chatDocumentId] });
  }, [queryClient]);

  // Subscribe to chat events when socket is available
  useEffect(() => {
    if (!isConnected || !currentChatId || !socket) return undefined;

    // Join the chat first
    socket.emit(EVENTS.JOIN_CHAT, { chatDocumentId: currentChatId });

    // Set up event listeners after joining
    socket.on(EVENTS.MESSAGE_RECEIVED, handleNewMessage);
    socket.on(EVENTS.MESSAGE_DELETED, handleMessageDeleted);
    socket.on(EVENTS.JOINED, handleJoined);
    socket.on(EVENTS.ERROR, (error) => {
      // eslint-disable-next-line no-console
      console.error('Chat error:', error.message);
    });

    // Cleanup: leave chat and remove listeners
    return () => {
      socket.emit(EVENTS.LEAVE_CHAT, { chatDocumentId: currentChatId });
      socket.off(EVENTS.MESSAGE_RECEIVED);
      socket.off(EVENTS.MESSAGE_DELETED);
      socket.off(EVENTS.JOINED);
      socket.off(EVENTS.ERROR);
    };
  }, [socket, handleNewMessage, handleMessageDeleted, handleJoined, currentChatId, isConnected]);

  const createWhisperChatMutation = useMutation({
    mutationFn: createWhisperChat,
  });

  /**
   * Send a message
   * @param {string} chatId - The chat id
   * @param {string} message - The message text
   * @returns {void}
   */
  const sendMessage = useCallback((/** @type {string} */ chatId, /** @type {string} */ message) => {
    if (!socket || !isConnected) {
      // eslint-disable-next-line no-console
      console.error('Cannot send message: socket not connected');
      return;
    }
    socket.emit(EVENTS.SEND_MESSAGE, {
      chatDocumentId: chatId,
      message,
    });
  }, [socket, isConnected]);

  /**
   * Join a chat room
   * @param {string} chatId - The chat id to join
   * @returns {void}
   */
  const joinChat = useCallback((/** @type {string} */ chatId) => {
    if (socket) {
      socket.emit(EVENTS.JOIN_CHAT, chatId);
    }
  }, [socket]);

  /**
   * Leave a chat room
   * @param {string} chatId - The chat id to leave
   * @returns {void}
   */
  const leaveChat = useCallback((/** @type {string} */ chatId) => {
    if (socket) {
      socket.emit(EVENTS.LEAVE_CHAT, chatId);
    }
  }, [socket]);

  /**
   * Start a whisper chat
   * @param {string[]} participants - The participants to start the chat with
   * @returns {Promise<Chat | undefined>} The created chat or existing chat
   */
  const startWhisperChat = async (participants) => {
    // Sort participants to ensure consistent comparison
    const sortedParticipants = [...participants].sort();

    // Check existing chats
    const existingChats = queryClient.getQueryData(['chats']) || [];
    if (Array.isArray(existingChats) && existingChats.length > 0) {
      const existingChat = existingChats.find((/** @type {any} */ chat) => {
        const chatParticipants = chat.participants
          ?.map((/** @type {any} */ p) => (p.documentId || p))
          .sort();

        return (
          chatParticipants?.length === sortedParticipants.length
          && chatParticipants?.every((
            /** @type {string} */ p,
            /** @type {number} */ i,
          ) => p === sortedParticipants[i])
        );
      });

      if (existingChat) {
        return existingChat;
      }
    }

    // If no existing chat found, create a new one
    const result = await createWhisperChatMutation.mutateAsync(participants);
    return result;
  };

  // Update last read message when entering/leaving chat
  useEffect(() => {
    if (currentChatId && socket) {
      updateLastReadMessage(currentChatId);

      return () => {
        updateLastReadMessage(currentChatId);
      };
    }
    return undefined;
  }, [currentChatId, socket, updateLastReadMessage]);

  return {
    getUnreadStatus,
    joinChat,
    leaveChat,
    sendMessage,
    startWhisperChat,
    updateLastReadMessage,
  };
};

export default useMessaging;
