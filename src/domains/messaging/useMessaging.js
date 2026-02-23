import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import useAuth from '@/domains/auth/useAuth';
import { getConversationName, getLastReadMessageKey, getUnreadStatus } from '@/domains/messaging/messagingUseCases';
import { storage } from '@/store/appContext';

import {
  archiveChat,
  createClubChat,
  createTeamChat,
  createWhisperChat,
  deleteMessage,
  getChats,
  pinChat,
  unarchiveChat,
  unpinChat,
  updateMessage,
} from '@/services/chat/chatService';

import useSocket, { EVENTS } from '@/hooks/useSocket';

/**
 * Custom hook to handle messaging functionality
 * @param {string} [currentChatId] - The current chat ID
 * @inheritdoc
 */
const useMessaging = (currentChatId) => {
  const queryClient = useQueryClient();
  const { isConnected, socket } = useSocket();
  const { userData } = useAuth();

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
          attachments: message.attachments, // Handle attachments
          chat: message.chat,
          composition: message.composition, // Handle composition
          createdAt: message.createdAt,
          documentId: message.documentId,
          event: message.event,
          id: message.id,
          message: message.message,
          readBy: message.readBy, // Handle readBy
          replyTo: message.replyTo, // Handle reply
          sender: message.sender,
        };

        // Safety check: if oldData is missing or malformed, initialize it
        if (!oldData || !oldData.pages || !Array.isArray(oldData.pages) || oldData.pages.length === 0) {
          return {
            pageParams: [null],
            pages: [{
              data: [formattedMessage],
              meta: { pagination: { page: 1, pageCount: 1, total: 1 } },
            }],
          };
        }

        // Deep clone pages to avoid mutating unexpected references, or map safely
        const cleanPages = oldData.pages.map((page) => {
          // Ensure page.data is an array
          const data = Array.isArray(page?.data) ? page.data : [];
          // Filter out pending messages that look identical to the confirmed one
          const filteredData = data.filter((msg) => {
            if (msg.pending && msg.message === formattedMessage.message) return false;
            // Add more duplicate checks if needed (e.g. by tempId if available)
            return true;
          });
          return { ...page, data: filteredData };
        });

        // Check if message already exists in the first page (dedup)
        const firstPage = cleanPages[0];
        const firstPageData = firstPage?.data || [];

        const messageExists = firstPageData.some(
          (/** @type {{ id: string }} */ msg) => msg.id === formattedMessage.id,
        );

        if (messageExists) {
          return { ...oldData, pages: cleanPages };
        }

        // Add new message to start of first page
        const newFirstPage = {
          ...firstPage,
          data: [formattedMessage, ...firstPageData],
        };

        return {
          ...oldData,
          pages: [newFirstPage, ...cleanPages.slice(1)],
        };
      },
    );

    // Update chat list to show latest message
    queryClient.setQueriesData(
      { queryKey: ['chats'] },
      (/** @type {{ pages?: Array<{ data: Chat[] }> }} */ oldData) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            data: Array.isArray(page.data) ? page.data.map((chat) => {
              if (chat.documentId === message.chat?.documentId) {
                return {
                  ...chat,
                  archivedBy: [], // Force unarchive locally
                  messages: [message],
                };
              }
              return chat;
            }) : [],
          })),
        };
      },
    );
  }, [queryClient]);

  const handleMessageDeleted = useCallback((/** @type {MessageDeletionData} */ data) => {
    queryClient.setQueryData(
      ['chat-messages', data.chatDocumentId],
      (/** @type {any} */ oldData) => {
        if (!oldData || !oldData.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((/** @type {{ data: Array<{ id: string }> }} */ page) => ({
            ...page,
            data: Array.isArray(page.data) ? page.data.filter((msg) => msg.id !== data.messageId && msg.documentId !== data.messageId) : [],
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

  const deleteMessageMutation = useMutation({
    mutationFn: deleteMessage,
    onSuccess: (_, messageId) => {
      // Optimistic or Real update? The socket will handle real update for others.
      // For me, I can remove it immediately if socket delay is high.
      // But wait, socket emits MESSAGE_DELETED which calls handleMessageDeleted.
    },
  });

  const pinChatMutation = useMutation({
    mutationFn: pinChat,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chats'] }),
  });
  const unpinChatMutation = useMutation({
    mutationFn: unpinChat,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chats'] }),
  });

  const archiveChatMutation = useMutation({
    mutationFn: archiveChat,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chats'] }),
  });
  const unarchiveChatMutation = useMutation({
    mutationFn: unarchiveChat,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chats'] }),
  });

  /**
   * Send a message
   * @param {string} chatId - The chat id
   * @param {string} message - The message text
   * @param {object} [extraData] - Extra data (e.g. { event: eventId })
   * @returns {void}
   */
  const sendMessage = useCallback((
    /** @type {string} */ chatId,
    /** @type {string} */ message,
    /** @type {object} */ extraData = {},
  ) => {
    // Check if socket is connected before sending
    if (!isConnected || !socket) return;

    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      createdAt: new Date().toISOString(),
      documentId: tempId,
      event: extraData.event,
      id: tempId,
      message,
      pending: true,
      sender: { documentId: 'me', ...extraData.sender }, // We need current user info here
      ...extraData,
    };

    // Update Cache Immediately
    queryClient.setQueryData(
      ['chat-messages', chatId],
      (/** @type {any} */ oldData) => {
        // Safe check for valid pages structure, init if absolutely missing
        if (!oldData || !oldData.pages || !Array.isArray(oldData.pages) || oldData.pages.length === 0) {
          return {
            pageParams: [null],
            pages: [{
              data: [optimisticMessage],
              meta: { pagination: { page: 1, pageCount: 1, total: 1 } },
            }],
          };
        }

        // Safe access to first page data
        const firstPage = oldData.pages[0];
        const firstPageData = Array.isArray(firstPage?.data) ? firstPage.data : [];

        return {
          ...oldData,
          pages: [{
            ...firstPage,
            data: [optimisticMessage, ...firstPageData],
          }, ...oldData.pages.slice(1)],
        };
      },
    );

    socket.emit(EVENTS.SEND_MESSAGE, {
      chatDocumentId: chatId,
      message,
      ...extraData, // files, replyTo, event
    });

    // Update chat list to show latest message AND unarchive
    queryClient.setQueriesData(
      { queryKey: ['chats'] },
      (/** @type {{ pages?: Array<{ data: Chat[] }> }} */ oldData) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            data: Array.isArray(page.data) ? page.data.map((chat) => {
              if (chat.documentId === chatId) {
                return {
                  ...chat,
                  archivedBy: [], // Force unarchive
                  messages: [optimisticMessage],
                  updatedAt: optimisticMessage.createdAt,
                };
              }
              return chat;
            }) : [],
          })),
        };
      },
    );
  }, [socket, isConnected, queryClient]);

  const sendTypingStart = useCallback((chatId) => {
    if (socket) socket.emit(EVENTS.TYPING_START, { chatDocumentId: chatId });
  }, [socket]);

  const sendTypingStop = useCallback((chatId) => {
    if (socket) socket.emit(EVENTS.TYPING_STOP, { chatDocumentId: chatId });
  }, [socket]);

  const sendReadReceipt = useCallback((chatId) => {
    if (socket) socket.emit(EVENTS.READ_MESSAGE, { chatDocumentId: chatId });
  }, [socket]);

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

  /* UPDATE MESSAGE MUTATION */
  const updateMessageMutation = useMutation({
    mutationFn: (/** @type {{ messageId: string; data: any }} */ payload) => updateMessage(payload.messageId, payload.data),
    onError: (error) => {
      // eslint-disable-next-line no-console
      console.error('Error updating message:', error);
    },
    onSuccess: (data) => {
      // Optimistically we might have already updated, but let's confirm
      queryClient.invalidateQueries({ queryKey: ['chat-messages', currentChatId || data.chat?.documentId] });
    },
  });

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
    // Check inputs
    if (!participants || !Array.isArray(participants)) {
      console.error('startWhisperChat called with invalid participants', participants);
      return undefined;
    }

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
          if (!chat?.participants || !Array.isArray(chat.participants)) return false;

          const chatParticipants = chat.participants
            .filter((p) => p && (p.documentId || p)) // Filter out nulls
            .map((/** @type {any} */ p) => (p.documentId || p))
            .sort();

          return (
            chatParticipants.length === sortedParticipants.length
            && chatParticipants.every((
              /** @type {string} */ p,
              /** @type {number} */ i,
            ) => p === sortedParticipants[i])
          );
        });

        if (existingChat) {
          // Automatic Unarchive Check
          const isArchived = existingChat.archivedBy?.some((u) => u.documentId === userData?.documentId);
          if (isArchived) {
            // 1. Optimistic Update (Force Visible)
            queryClient.setQueriesData({ queryKey: ['chats'] }, (oldData) => {
              if (!oldData?.pages) return oldData;
              return {
                ...oldData,
                pages: oldData.pages.map((page) => ({
                  ...page,
                  data: Array.isArray(page.data) ? page.data.map((chat) => {
                    if (chat.documentId === existingChat.documentId) {
                      return { ...chat, archivedBy: [] };
                    }
                    return chat;
                  }) : [],
                })),
              };
            });

            // 2. Call API to unarchive
            try {
              await unarchiveChatMutation.mutateAsync(existingChat.documentId);
            } catch (e) {
              console.error('Failed to unarchive chat on open', e);
            }
          }
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
    archiveChat: archiveChatMutation.mutate,
    deleteMessage: deleteMessageMutation.mutate,
    getConversationName,
    getUnreadStatus,
    joinChat,
    leaveChat,
    pinChat: pinChatMutation.mutate,
    sendMessage,
    sendReadReceipt,
    sendTypingStart,
    sendTypingStop,
    socket,
    startClubChat,
    startTeamChat,
    startWhisperChat,
    unarchiveChat: unarchiveChatMutation.mutate,
    unpinChat: unpinChatMutation.mutate,
    updateLastReadMessage,
    updateMessage: updateMessageMutation.mutateAsync,
  };
};

export default useMessaging;
// Force Rebuild for Metro
