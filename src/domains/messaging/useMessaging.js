import useSocket, { EVENTS } from '@/hooks/useSocket';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import { storage } from '@/store/appContext';

import {
  createClubChat,
  createTeamChat,
  createWhisperChat,
  getChats,
} from '@/services/chat/chatService';

import { getConversationName, getLastReadMessageKey, getUnreadStatus } from './messagingUseCases';

/**
 * Custom hook to handle messaging functionality
 * @param {string} [currentChatId] - The current chat ID
 * @inheritdoc
 */
const useMessaging = (currentChatId) => {
  const queryClient = useQueryClient();
  const { isConnected, socket } = useSocket();

  /**
   * Update the last read message timestamp for a chat
   * @param {string} chatId - The chat ID
   */
  const updateLastReadMessage = useCallback((/** @type {string} */ chatId) => {
    storage.set(getLastReadMessageKey(chatId), new Date().toISOString());
    // Invalidate chats query to refetch with updated unread status
    queryClient.invalidateQueries({ queryKey: ['chats'] });
  }, [queryClient]);

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
            pageParams: [null],
            pages: [{
              data: [formattedMessage],
              meta: { pagination: { page: 1, pageCount: 1, total: 1 } },
            }],
          };
        }

        // Check if message already exists in first page
        const messageExists = oldData.pages[0].data.some(
          (/** @type {{ id: string }} */ msg) => msg.id === formattedMessage.id,
        );
        if (messageExists) {
          return oldData;
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
      (/** @type {{ pages?: Array<{ data: Chat[] }> }} */ oldData) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            data: page.data.map((chat) => {
              if (chat.documentId === message.chat?.documentId) {
                return {
                  ...chat,
                  messages: [message],
                };
              }
              return chat;
            }),
          })),
        };
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
      updateLastReadMessage(currentChatId);
    };
  }, [socket,
    handleNewMessage,
    handleMessageDeleted,
    handleJoined,
    currentChatId,
    isConnected,
    updateLastReadMessage,
  ]);

  const createWhisperChatMutation = useMutation({
    mutationFn: createWhisperChat,
  });
  const createClubChatMutation = useMutation({
    mutationFn: createClubChat,
  });
  const createTeamChatMutation = useMutation({
    mutationFn: createTeamChat,
  });

  /**
   * Send a message
   * @param {string} chatId - The chat id
   * @param {string} message - The message text
   * @returns {void}
   */
  const sendMessage = useCallback((
    /** @type {string} */ chatId,
    /** @type {string} */ message,
  ) => {
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

    // Check existing chats by ensuring we have the data
    try {
      const chatsData = await queryClient.ensureQueryData({
        queryFn: () => getChats(),
        queryKey: ['chats'],
      });

      if (chatsData?.data) {
        const existingChat = chatsData.data.find((/** @type {any} */ chat) => {
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
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error checking existing chats:', error);
    }

    // If no existing chat found, create a new one
    const result = await createWhisperChatMutation.mutateAsync(participants);
    return result;
  };

  /**
   * Start a team chat
   * @param {string} teamId - The team ID to start the chat with
   * @returns {Promise<Chat | undefined>} The created chat or existing chat
   */
  const startTeamChat = async (teamId) => {
    // Check existing chats by ensuring we have the data
    try {
      const chatsData = await queryClient.ensureQueryData({
        queryFn: () => getChats(),
        queryKey: ['chats'],
      });

      if (chatsData?.data) {
        const existingChat = chatsData.data.find(
          (/** @type {any} */ chat) => chat.team?.documentId === teamId,
        );
        if (existingChat) return existingChat;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error checking existing team chats:', error);
    }

    // If no existing chat found, create a new one
    const result = await createTeamChatMutation.mutateAsync(teamId);
    return result;
  };

  /**
   * Start a club chat
   * @param {string} clubId - The club ID to start the chat with
   * @returns {Promise<Chat | undefined>} The created chat or existing chat
   */
  const startClubChat = async (clubId) => {
    // Check existing chats by ensuring we have the data
    try {
      const chatsData = await queryClient.ensureQueryData({
        queryFn: () => getChats(),
        queryKey: ['chats'],
      });

      if (chatsData?.data) {
        const existingChat = chatsData.data.find(
          (/** @type {any} */ chat) => chat.club?.documentId === clubId,
        );
        if (existingChat) return existingChat;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error checking existing club chats:', error);
    }

    // If no existing chat found, create a new one
    const result = await createClubChatMutation.mutateAsync(clubId);
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
    getConversationName,
    getUnreadStatus,
    joinChat,
    leaveChat,
    sendMessage,
    startClubChat,
    startTeamChat,
    startWhisperChat,
    updateLastReadMessage,
  };
};

export default useMessaging;
