import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import useAuth from '@/domains/auth/useAuth';
import { getConversationName, getLastReadMessageKey, getUnreadStatus } from '@/domains/messaging/messagingUseCases';
import { storage } from '@/store/appContext';

import {
  addGroupMembers,
  archiveChat,
  createClubChat,
  createGroupChat,
  createTeamChat,
  createWhisperChat,
  deleteMessage,
  editMessage,
  getChats,
  pinChat,
  removeGroupMember,
  respondProposalMessage,
  unarchiveChat,
  unpinChat,
  updateGroupMeta,
  votePollMessage,
} from '@/services/chat/chatService';

import { createLogger } from '@/utils/logger/logger';
import { buildNormalizedQueryKey } from '@/utils/queryKey';

import useSocket, { EVENTS } from '@/hooks/useSocket';

const messagingLogger = createLogger('messaging');
const isAttachmentDebugEnabled = ['1', 'true', 'yes'].includes(String(process.env.FC_CHAT_ATTACHMENT_DEBUG || 'true').trim().toLowerCase());

const normalizeChatId = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const normalizeClientMessageId = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const generateClientMessageId = () => `cmid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getAttachmentSignature = (attachments = []) => attachments
  .map((attachment) => String(
    attachment?.documentId
    || attachment?.id
    || attachment?.url
    || attachment?.name
    || '',
  ))
  .filter(Boolean)
  .join('|');

const getMessageSignature = (message) => {
  const clientMessageId = normalizeClientMessageId(message?.clientMessageId || '');
  const text = String(message?.message || '').trim();
  const compositionType = String(message?.composition?.type || '');
  const eventRef = String(message?.event?.documentId || message?.event || '');
  const replyRef = String(message?.replyTo?.documentId || message?.replyTo?.id || '');
  const attachmentSignature = getAttachmentSignature(message?.attachments || []);

  return `${clientMessageId}::${text}::${compositionType}::${eventRef}::${replyRef}::${attachmentSignature}`;
};

const getMessageEntityId = (message) => (
  // eslint-disable-next-line no-underscore-dangle
  String(message?.documentId || message?.id || message?._id || '')
);

const getSenderEntityId = (message) => (
  // eslint-disable-next-line no-underscore-dangle
  normalizeChatId(message?.sender?.documentId || message?.sender?.id || message?.user?._id || '')
);

/**
 * Custom hook to handle messaging functionality
 * @param {string} [currentChatId] - The current chat ID
 * @inheritdoc
 */
const useMessaging = (currentChatId) => {
  const queryClient = useQueryClient();
  const { isConnected, socket } = useSocket();
  const { allMyTeams, userData } = useAuth();
  const pendingTimeoutsRef = useRef(new Map());
  const safeTeamIds = useMemo(() => Array.from(
    new Set(
      (Array.isArray(allMyTeams) ? allMyTeams : [])
        .map((team) => normalizeChatId(team?.documentId || ''))
        .filter(Boolean),
    ),
  ), [allMyTeams]);
  const chatsLookupFilters = useMemo(() => ({
    currentUserClubId: userData?.club?.documentId,
    currentUserId: userData?.documentId,
    currentUserTeamIds: safeTeamIds,
  }), [safeTeamIds, userData?.club?.documentId, userData?.documentId]);
  const chatsLookupQueryKey = useMemo(
    () => buildNormalizedQueryKey('chats', chatsLookupFilters),
    [chatsLookupFilters],
  );

  const clearPendingTimeout = useCallback((tempMessageId) => {
    const timeoutId = pendingTimeoutsRef.current.get(tempMessageId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      pendingTimeoutsRef.current.delete(tempMessageId);
    }
  }, []);

  const markMessageState = useCallback((chatId, messageId, patch) => {
    queryClient.setQueriesData({ queryKey: ['chat-messages', chatId] }, (oldData) => {
      if (!oldData?.pages) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          data: Array.isArray(page?.data)
            ? page.data.map((msg) => {
              const currentId = getMessageEntityId(msg);
              if (currentId !== String(messageId)) return msg;
              return { ...msg, ...patch };
            })
            : [],
        })),
      };
    });
  }, [queryClient]);

  useEffect(() => () => {
    pendingTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    pendingTimeoutsRef.current.clear();
  }, []);

  const getCachedChatsForLookup = useCallback(() => {
    const queryEntries = queryClient.getQueriesData({ queryKey: ['chats'] });
    const seenChatIds = new Set();
    const chats = [];

    queryEntries.forEach(([, value]) => {
      let pages = [];
      if (Array.isArray(value?.pages)) {
        pages = value.pages;
      } else if (Array.isArray(value?.data)) {
        pages = [{ data: value.data }];
      }

      pages.forEach((page) => {
        const pageChats = Array.isArray(page?.data) ? page.data : [];
        pageChats.forEach((chat) => {
          const chatId = normalizeChatId(chat?.documentId || '');
          if (!chatId || seenChatIds.has(chatId)) return;
          seenChatIds.add(chatId);
          chats.push(chat);
        });
      });
    });

    return chats;
  }, [queryClient]);

  const loadChatsForLookup = useCallback(async () => {
    const cachedChats = getCachedChatsForLookup();
    if (cachedChats.length > 0) {
      return cachedChats;
    }

    const response = await queryClient.fetchQuery({
      queryFn: () => getChats(1, 20, chatsLookupFilters),
      queryKey: chatsLookupQueryKey,
      staleTime: 15000,
    });

    return Array.isArray(response?.data) ? response.data : [];
  }, [chatsLookupFilters, chatsLookupQueryKey, getCachedChatsForLookup, queryClient]);

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
    queryClient.setQueriesData(
      { queryKey: ['chat-messages', message.chat?.documentId] },
      (/** @type {any} */ oldData) => {
        const formattedMessage = {
          attachments: message.attachments, // Handle attachments
          chat: message.chat,
          clientMessageId: normalizeClientMessageId(message?.clientMessageId || ''),
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
          const confirmedSignature = getMessageSignature(formattedMessage);
          // Filter out pending messages that look identical to the confirmed one
          const filteredData = data.filter((msg) => {
            if (!msg?.pending && !msg?.failed) return true;
            const confirmedClientMessageId = normalizeClientMessageId(
              formattedMessage?.clientMessageId || '',
            );
            const pendingClientMessageId = normalizeClientMessageId(msg?.clientMessageId || '');
            if (
              confirmedClientMessageId
              && pendingClientMessageId
              && pendingClientMessageId === confirmedClientMessageId
            ) {
              const pendingId = getMessageEntityId(msg);
              if (pendingId) {
                clearPendingTimeout(pendingId);
              }
              return false;
            }
            const pendingSignature = getMessageSignature(msg);
            if (pendingSignature === confirmedSignature) {
              const pendingId = getMessageEntityId(msg);
              if (pendingId) {
                clearPendingTimeout(pendingId);
              }
              return false;
            }
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
  }, [queryClient, clearPendingTimeout]);

  const handleMessageDeleted = useCallback((/** @type {MessageDeletionData} */ data) => {
    const chatDocumentId = normalizeChatId(data?.chatDocumentId || data?.chat?.documentId);
    if (!chatDocumentId) return;

    const deletedMessageId = normalizeChatId(
      data?.messageId
      || data?.documentId
      || data?.messageDocumentId,
    );
    if (!deletedMessageId) return;

    queryClient.setQueriesData(
      { queryKey: ['chat-messages', chatDocumentId] },
      (/** @type {any} */ oldData) => {
        if (!oldData || !oldData.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((/** @type {{ data: Array<{ id: string }> }} */ page) => ({
            ...page,
            data: Array.isArray(page.data)
              ? page.data.filter((msg) => {
                const msgId = normalizeChatId(getMessageEntityId(msg));
                return msgId !== deletedMessageId;
              })
              : [],
          })),
        };
      },
    );
  }, [queryClient]);

  const handleMessageUpdated = useCallback((payload) => {
    const updatedMessage = payload?.message && typeof payload.message === 'object'
      ? payload.message
      : payload;
    const chatDocumentId = normalizeChatId(
      payload?.chatDocumentId
      || updatedMessage?.chat?.documentId
      || updatedMessage?.chat,
    );
    const messageDocumentId = normalizeChatId(
      getMessageEntityId(updatedMessage),
    );
    if (!chatDocumentId || !messageDocumentId) return;

    queryClient.setQueriesData(
      { queryKey: ['chat-messages', chatDocumentId] },
      (oldData) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            data: Array.isArray(page?.data)
              ? page.data.map((message) => {
                const existingId = normalizeChatId(getMessageEntityId(message));
                if (existingId !== messageDocumentId) return message;
                return {
                  ...message,
                  ...updatedMessage,
                  documentId: updatedMessage?.documentId || message.documentId,
                  id: updatedMessage?.id || message.id,
                };
              })
              : [],
          })),
        };
      },
    );
  }, [queryClient]);

  const handleMessageRead = useCallback((payload) => {
    const chatDocumentId = normalizeChatId(payload?.chatDocumentId);
    const readerId = normalizeChatId(payload?.userDocumentId);
    if (!chatDocumentId || !readerId) return;

    queryClient.setQueriesData({ queryKey: ['chat-messages', chatDocumentId] }, (oldData) => {
      if (!oldData?.pages) return oldData;

      const lastSeenMessageId = normalizeChatId(payload?.lastSeenMessageId || '');
      let cutoffTime = null;

      if (lastSeenMessageId) {
        const foundMessage = oldData.pages
          .flatMap((page) => (Array.isArray(page?.data) ? page.data : []))
          .find((message) => {
            const id = normalizeChatId(getMessageEntityId(message));
            return id === lastSeenMessageId;
          });
        if (foundMessage?.createdAt) {
          cutoffTime = new Date(foundMessage.createdAt).getTime();
        }
      }

      return {
        ...oldData,
        pages: oldData.pages.map((page) => ({
          ...page,
          data: Array.isArray(page?.data)
            ? page.data.map((message) => {
              const senderId = getSenderEntityId(message);
              if (!senderId || senderId === readerId) return message;

              if (cutoffTime !== null) {
                const createdAt = new Date(message?.createdAt || 0).getTime();
                if (!Number.isFinite(createdAt) || createdAt > cutoffTime) {
                  return message;
                }
              }

              const readBy = Array.isArray(message?.readBy) ? message.readBy : [];
              const alreadyRead = readBy.some((entry) => normalizeChatId(entry?.documentId || entry?.id) === readerId);
              if (alreadyRead) return message;

              return {
                ...message,
                readBy: [...readBy, { documentId: readerId }],
              };
            })
            : [],
        })),
      };
    });
  }, [queryClient]);

  const handleJoined = useCallback((/** @type {JoinData} */ data) => {
    queryClient.invalidateQueries({ queryKey: ['chat-messages', data.chatDocumentId] });
  }, [queryClient]);

  // Subscribe to chat events when socket is available
  useEffect(() => {
    const safeCurrentChatId = normalizeChatId(currentChatId);
    if (!isConnected || !safeCurrentChatId || !socket) return undefined;

    // Join the chat first
    socket.emit(EVENTS.JOIN_CHAT, { chatDocumentId: safeCurrentChatId });

    // Set up event listeners after joining
    socket.on(EVENTS.MESSAGE_RECEIVED, handleNewMessage);
    socket.on(EVENTS.MESSAGE_DELETED, handleMessageDeleted);
    socket.on(EVENTS.MESSAGE_UPDATED, handleMessageUpdated);
    socket.on(EVENTS.MESSAGE_READ, handleMessageRead);
    socket.on(EVENTS.JOINED, handleJoined);
    socket.on(EVENTS.ERROR, (error) => {
      const errorPayload = {
        chatId: safeCurrentChatId,
        code: error?.code,
        message: error?.message || error,
      };
      messagingLogger.error('Socket chat error', errorPayload);
      if (isAttachmentDebugEnabled) {
        messagingLogger.warn('[attachment-debug] socket error received', errorPayload);
      }
    });

    // Cleanup: leave chat and remove listeners
    return () => {
      socket.emit(EVENTS.LEAVE_CHAT, { chatDocumentId: safeCurrentChatId });
      socket.off(EVENTS.MESSAGE_RECEIVED);
      socket.off(EVENTS.MESSAGE_DELETED);
      socket.off(EVENTS.MESSAGE_UPDATED);
      socket.off(EVENTS.MESSAGE_READ);
      socket.off(EVENTS.JOINED);
      socket.off(EVENTS.ERROR);
      updateLastReadMessage(safeCurrentChatId);
    };
  }, [socket,
    handleNewMessage,
    handleMessageDeleted,
    handleMessageUpdated,
    handleMessageRead,
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
  const createGroupChatMutation = useMutation({
    mutationFn: createGroupChat,
  });

  const deleteMessageMutation = useMutation({
    mutationFn: deleteMessage,
    onSuccess: () => {
      // Optimistic or Real update? The socket will handle real update for others.
      // For me, I can remove it immediately if socket delay is high.
      // But wait, socket emits MESSAGE_DELETED which calls handleMessageDeleted.
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: ({ data, messageId }) => editMessage(messageId, data),
    onSuccess: (updatedMessage, variables) => {
      handleMessageUpdated({
        chatDocumentId: variables?.chatId || currentChatId,
        message: updatedMessage,
      });
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

  const votePollMutation = useMutation({
    mutationFn: (payload) => votePollMessage(payload.messageId, payload.optionId),
    onSuccess: (data) => {
      if (data?.messageDocumentId) {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', currentChatId] });
      }
    },
  });

  const proposalResponseMutation = useMutation({
    mutationFn: (payload) => respondProposalMessage(payload.messageId, payload.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', currentChatId] });
    },
  });

  const addGroupMembersMutation = useMutation({
    mutationFn: ({ chatId, memberIds }) => addGroupMembers(chatId, memberIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat', variables?.chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  const removeGroupMemberMutation = useMutation({
    mutationFn: ({ chatId, userId }) => removeGroupMember(chatId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat', variables?.chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  const updateGroupMetaMutation = useMutation({
    mutationFn: ({ chatId, data }) => updateGroupMeta(chatId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat', variables?.chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
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
    const safeChatId = normalizeChatId(chatId);
    const safeClientMessageId = normalizeClientMessageId(extraData?.clientMessageId)
      || generateClientMessageId();
    const attachmentCount = Array.isArray(extraData?.attachments) ? extraData.attachments.length : 0;
    const payloadSummary = {
      attachmentCount,
      chatId: safeChatId,
      clientMessageId: safeClientMessageId,
      hasComposition: Boolean(extraData?.composition),
      hasEvent: Boolean(extraData?.event),
      hasReplyTo: Boolean(extraData?.replyTo),
      messageLength: String(message || '').length,
      socketConnected: Boolean(isConnected && socket),
    };
    if (isAttachmentDebugEnabled && attachmentCount > 0) {
      messagingLogger.warn('[attachment-debug] sendMessage called', payloadSummary);
    }

    if (!safeChatId) {
      messagingLogger.warn('sendMessage skipped: missing chatId', payloadSummary);
      return null;
    }

    // Check if socket is connected before sending
    if (!isConnected || !socket) {
      messagingLogger.warn('sendMessage skipped: socket disconnected', payloadSummary);
      return null;
    }

    const tempId = normalizeChatId(extraData?.optimisticMessageId || '') || `temp-${Date.now()}`;
    const shouldSkipOptimistic = Boolean(extraData?.skipOptimistic && tempId);
    const optimisticMessage = {
      attachments: extraData.attachments || [],
      chat: { documentId: safeChatId },
      clientMessageId: safeClientMessageId,
      composition: extraData.composition,
      createdAt: new Date().toISOString(),
      documentId: tempId,
      event: extraData.event,
      failed: false,
      id: tempId,
      message: message || '',
      pending: true,
      readBy: [],
      replyTo: extraData.replyTo || null,
      sender: { documentId: 'me', ...extraData.sender }, // We need current user info here
    };

    if (!shouldSkipOptimistic) {
      // Update Cache Immediately
      queryClient.setQueriesData(
        { queryKey: ['chat-messages', safeChatId] },
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
    }

    socket.emit(EVENTS.SEND_MESSAGE, {
      attachments: extraData.attachments,
      chatDocumentId: safeChatId,
      clientMessageId: safeClientMessageId,
      composition: extraData.composition,
      event: extraData.event,
      message,
      replyTo: extraData.replyTo || null,
    }, (ackPayload) => {
      const ackError = ackPayload?.ok === false ? ackPayload?.error : null;
      const ackMessage = ackPayload?.ok ? ackPayload?.message : null;

      if (ackError) {
        clearPendingTimeout(tempId);
        markMessageState(safeChatId, tempId, {
          failed: true,
          pending: false,
        });
        messagingLogger.warn('sendMessage ack error', {
          chatId: safeChatId,
          code: ackError?.code,
          message: ackError?.message || 'unknown',
          tempId,
        });
        return;
      }

      if (ackMessage?.chat?.documentId === safeChatId) {
        clearPendingTimeout(tempId);
        handleNewMessage({
          ...ackMessage,
          clientMessageId: normalizeClientMessageId(
            ackMessage?.clientMessageId || safeClientMessageId,
          ),
        });
      }
    });
    if (isAttachmentDebugEnabled && attachmentCount > 0) {
      messagingLogger.warn('[attachment-debug] sendMessage emitted to socket', {
        ...payloadSummary,
        clientMessageId: safeClientMessageId,
        tempId,
      });
    }

    const timeoutId = setTimeout(() => {
      pendingTimeoutsRef.current.delete(tempId);
      markMessageState(safeChatId, tempId, {
        failed: true,
        pending: false,
      });
    }, 10000);
    pendingTimeoutsRef.current.set(tempId, timeoutId);

    if (!shouldSkipOptimistic) {
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
                if (chat.documentId === safeChatId) {
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
    }
    return tempId;
  }, [socket, isConnected, queryClient, markMessageState, clearPendingTimeout, handleNewMessage]);

  const sendTypingStart = useCallback((chatId) => {
    const safeChatId = normalizeChatId(chatId);
    if (socket && safeChatId) socket.emit(EVENTS.TYPING_START, { chatDocumentId: safeChatId });
  }, [socket]);

  const sendTypingStop = useCallback((chatId) => {
    const safeChatId = normalizeChatId(chatId);
    if (socket && safeChatId) socket.emit(EVENTS.TYPING_STOP, { chatDocumentId: safeChatId });
  }, [socket]);

  const sendReadReceipt = useCallback((chatId, lastSeenMessageId) => {
    const safeChatId = normalizeChatId(chatId);
    const safeLastSeenId = normalizeChatId(lastSeenMessageId || '');
    if (socket && safeChatId) {
      socket.emit(EVENTS.READ_MESSAGE, {
        chatDocumentId: safeChatId,
        ...(safeLastSeenId ? { lastSeenMessageId: safeLastSeenId } : {}),
      });
    }
  }, [socket]);

  /**
   * Join a chat room
   * @param {string} chatId - The chat id to join
   * @returns {void}
   */
  const joinChat = useCallback((/** @type {string} */ chatId) => {
    const safeChatId = normalizeChatId(chatId);
    if (socket && safeChatId) {
      socket.emit(EVENTS.JOIN_CHAT, { chatDocumentId: safeChatId });
    }
  }, [socket]);

  /**
   * Leave a chat room
   * @param {string} chatId - The chat id to leave
   * @returns {void}
   */
  const leaveChat = useCallback((/** @type {string} */ chatId) => {
    const safeChatId = normalizeChatId(chatId);
    if (socket && safeChatId) {
      socket.emit(EVENTS.LEAVE_CHAT, { chatDocumentId: safeChatId });
    }
  }, [socket]);

  const retryFailedMessage = useCallback((chatId, failedMessage) => {
    const safeChatId = normalizeChatId(chatId);
    if (!safeChatId || !failedMessage) return;

    const failedMessageId = normalizeChatId(
      failedMessage.documentId
      || failedMessage.id
      // eslint-disable-next-line no-underscore-dangle
      || failedMessage._id
      || '',
    );

    if (failedMessageId) {
      clearPendingTimeout(failedMessageId);
      queryClient.setQueriesData({ queryKey: ['chat-messages', safeChatId] }, (oldData) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            data: Array.isArray(page?.data)
              ? page.data.filter((message) => {
                const messageId = normalizeChatId(getMessageEntityId(message));
                return messageId !== failedMessageId;
              })
              : [],
          })),
        };
      });
    }

    sendMessage(safeChatId, failedMessage?.message || failedMessage?.text || '', {
      attachments: failedMessage?.attachments || [],
      clientMessageId: failedMessage?.clientMessageId || undefined,
      composition: failedMessage?.composition,
      event: failedMessage?.event?.documentId || failedMessage?.event || undefined,
      replyTo: failedMessage?.replyTo?.documentId
        ? { documentId: failedMessage.replyTo.documentId }
        : null,
      sender: userData,
    });
  }, [clearPendingTimeout, queryClient, sendMessage, userData]);

  /**
   * Start a whisper chat
   * @param {string[]} participants - The participants to start the chat with
   * @returns {Promise<Chat | undefined>} The created chat or existing chat
   */
  const startWhisperChat = async (participants) => {
    const currentUserId = normalizeChatId(userData?.documentId || '');
    if (!currentUserId || !participants || !Array.isArray(participants)) {
      messagingLogger.warn('startWhisperChat called with invalid payload');
      return undefined;
    }

    const otherParticipants = Array.from(
      new Set(
        participants
          .map((participantId) => normalizeChatId(participantId))
          .filter((participantId) => participantId && participantId !== currentUserId),
      ),
    );
    if (otherParticipants.length === 0) return undefined;

    const sortedParticipants = [currentUserId, ...otherParticipants].sort();

    // Check existing chats by ensuring we have the data
    try {
      const chatsData = await loadChatsForLookup();

      if (Array.isArray(chatsData)) {
        const existingChat = chatsData.find((/** @type {any} */ chat) => {
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
              messagingLogger.warn('Failed to unarchive chat on open', e?.message || e);
            }
          }
          return existingChat;
        }
      }
    } catch (error) {
      messagingLogger.warn('Error checking existing chats', error?.message || error);
    }

    // If no existing chat found, create a new one
    const result = await createWhisperChatMutation.mutateAsync(otherParticipants);
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
      const chatsData = await loadChatsForLookup();

      if (Array.isArray(chatsData)) {
        const existingChat = chatsData.find(
          (/** @type {any} */ chat) => chat.team?.documentId === teamId,
        );
        if (existingChat) return existingChat;
      }
    } catch (error) {
      messagingLogger.warn('Error checking existing team chats', error?.message || error);
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
      const chatsData = await loadChatsForLookup();

      if (Array.isArray(chatsData)) {
        const existingChat = chatsData.find(
          (/** @type {any} */ chat) => chat.club?.documentId === clubId,
        );
        if (existingChat) return existingChat;
      }
    } catch (error) {
      messagingLogger.warn('Error checking existing club chats', error?.message || error);
    }

    // If no existing chat found, create a new one
    const result = await createClubChatMutation.mutateAsync(clubId);
    return result;
  };

  const startGroupChat = async ({ groupName, participants }) => {
    const currentUserId = normalizeChatId(userData?.documentId || '');
    if (!currentUserId) return undefined;

    const memberIds = Array.from(
      new Set(
        (Array.isArray(participants) ? participants : [])
          .map((participantId) => normalizeChatId(participantId))
          .filter((participantId) => participantId && participantId !== currentUserId),
      ),
    );

    if (memberIds.length < 2) {
      messagingLogger.warn('startGroupChat skipped: not enough participants');
      return undefined;
    }

    const safeGroupName = String(groupName || '').trim();
    if (!safeGroupName) {
      messagingLogger.warn('startGroupChat skipped: missing group name');
      return undefined;
    }

    return createGroupChatMutation.mutateAsync({
      groupName: safeGroupName,
      participants: memberIds,
    });
  };

  const votePoll = useCallback((messageId, optionId) => votePollMutation.mutateAsync({
    messageId,
    optionId,
  }), [votePollMutation]);

  const respondToProposal = useCallback((messageId, status) => proposalResponseMutation.mutateAsync({
    messageId,
    status,
  }), [proposalResponseMutation]);

  // Update last read message when entering/leaving chat
  useEffect(() => {
    const safeCurrentChatId = normalizeChatId(currentChatId);
    if (safeCurrentChatId && socket) {
      updateLastReadMessage(safeCurrentChatId);

      return () => {
        updateLastReadMessage(safeCurrentChatId);
      };
    }
    return undefined;
  }, [currentChatId, socket, updateLastReadMessage]);

  return {
    addGroupMembers: addGroupMembersMutation.mutateAsync,
    archiveChat: archiveChatMutation.mutate,
    deleteMessage: deleteMessageMutation.mutateAsync,
    editMessage: editMessageMutation.mutateAsync,
    getConversationName,
    getUnreadStatus,
    isSocketConnected: isConnected,
    joinChat,
    leaveChat,
    pinChat: pinChatMutation.mutate,
    removeGroupMember: removeGroupMemberMutation.mutateAsync,
    respondToProposal,
    retryFailedMessage,
    sendMessage,
    sendReadReceipt,
    sendTypingStart,
    sendTypingStop,
    socket,
    startClubChat,
    startGroupChat,
    startTeamChat,
    startWhisperChat,
    unarchiveChat: unarchiveChatMutation.mutate,
    unpinChat: unpinChatMutation.mutate,
    updateGroupMeta: updateGroupMetaMutation.mutateAsync,
    updateLastReadMessage,
    votePoll,
  };
};

export default useMessaging;
// Force Rebuild for Metro
