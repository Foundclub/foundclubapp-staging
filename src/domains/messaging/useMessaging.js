import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import useAuth from '@/domains/auth/useAuth';
import {
  getConversationName,
  getLastReadMessageKey,
  getUnreadStatus,
  shouldRefetchUnreadOnMessage,
} from '@/domains/messaging/messagingUseCases';
import {
  getMyPollOptionIds,
  isAnonymousPollNamingNoOne,
  withMyAnonymousPollVotes,
} from '@/domains/messaging/pollUseCases';
import { rattraperLaListe, rattraperLeFil } from '@/domains/messaging/rattrapageDuFil';
import {
  indexReactionsByMessage,
  withMessageReactions,
} from '@/domains/messaging/reactionUseCases';
import useMyAnonymousPollVotes, {
  myAnonymousPollVotesKey,
} from '@/domains/messaging/useMyAnonymousPollVotes';
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
  markChatUnread as markChatUnreadRequest,
  pinChat,
  reactToChatMessage,
  removeGroupMember,
  respondProposalMessage,
  unarchiveChat,
  unpinChat,
  updateGroupMeta,
  votePollMessage,
} from '@/services/chat/chatService';
import { compterConnexionsEtablies } from '@/services/socket/socketManager';

import { createLogger } from '@/utils/logger/logger';
import { markMessagingPerf } from '@/utils/performance/messagingPerformance';
import { buildNormalizedQueryKey } from '@/utils/queryKey';

import useSocket, { EVENTS } from '@/hooks/useSocket';

const messagingLogger = createLogger('messaging');
const isAttachmentDebugEnabled = ['1', 'true', 'yes'].includes(String(process.env.FC_CHAT_ATTACHMENT_DEBUG || 'true').trim().toLowerCase());
const LEGACY_ID_KEY = '_id';

/**
 * @param {unknown} value
 * @returns {string}
 */
const normalizeChatId = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

/**
 * AE06 — faut-il relire la liste des conversations apres cet echo de lecture ?
 * Seulement si c est MOI qui ai lu : c est mon compte de non-lus qui vient de
 * changer, pas celui des autres. Sans ce filtre, chaque lecture de n importe
 * qui dans le fil declencherait un appel reseau chez tout le monde.
 * @param {any} payload - La charge utile de l evenement MESSAGE_READ.
 * @param {string | undefined} myDocumentId - Mon identifiant.
 * @returns {boolean} Vrai s il faut relire.
 */
export const shouldRefetchChatsAfterRead = (payload, myDocumentId) => {
  const readerId = normalizeChatId(payload?.userDocumentId);
  const safeMyId = normalizeChatId(myDocumentId);
  return Boolean(readerId) && Boolean(safeMyId) && readerId === safeMyId;
};

/**
 * AE06 — j entre dans une conversation : son compte tombe a zero et le total
 * baisse d autant, TOUT DE SUITE et SANS reseau. Le serveur confirmera au
 * prochain echo ; en attendant la pastille ne ment plus.
 * 🧨 Quand rien ne change, le tableau `data` GARDE son identite : une liste
 * dont l identite change relache le verrou de sa pagination et se relance.
 * @param {any} oldData - La page (ou les pages) en cache.
 * @param {string} chatDocumentId - Le fil qu on vient d ouvrir.
 * @returns {any} Les memes donnees, compte du fil remis a zero.
 */
export const applyOptimisticChatRead = (oldData, chatDocumentId) => {
  if (!oldData || typeof oldData !== 'object') return oldData;

  const safeChatId = normalizeChatId(chatDocumentId);

  /**
   * Remet a zero le compte du fil ouvert dans une page, total compris.
   * @param {any} page - Une page de la liste.
   * @returns {any} La page, compte remis a zero si besoin.
   */
  const readPage = (page) => {
    const chats = Array.isArray(page?.data) ? page.data : null;
    let cleared = 0;

    const nextChats = chats
      ? chats.map((/** @type {any} */ chat) => {
        if (!safeChatId || normalizeChatId(chat?.documentId) !== safeChatId) return chat;

        const current = Number(chat?.unreadCount);
        if (!Number.isFinite(current) || current <= 0) return chat;

        cleared += current;
        return { ...chat, unreadCount: 0 };
      })
      : null;

    const previousTotal = Number(page?.meta?.unreadTotal);
    const nextMeta = (cleared > 0 && Number.isFinite(previousTotal))
      ? { ...page.meta, unreadTotal: Math.max(0, previousTotal - cleared) }
      : page?.meta;

    return {
      ...page,
      // Le tableau ne change d identite QUE si un compte a bouge.
      ...(chats ? { data: cleared > 0 ? nextChats : chats } : {}),
      ...(page?.meta ? { meta: nextMeta } : {}),
    };
  };

  if (Array.isArray(oldData?.pages)) {
    return { ...oldData, pages: oldData.pages.map(readPage) };
  }

  return readPage(oldData);
};

// MSG2 — pendant ce delai apres un accuse chiffre, l echo de lecture ne relit
// pas la liste : la replique qui la servirait peut rendre l ANCIEN compte (cache
// chaud 3 s + jeton de version garde 5 s cote serveur).
const FRESH_READ_ACK_MS = 10000;

/**
 * MSG2 — applique le compte que le SERVEUR rend dans l accuse de lecture : le
 * fil lu prend son compte, la page 1 prend le total (c est la que la pastille
 * le lit). Sans chiffre, ou sur un accuse NON, rien ne bouge.
 * 🧨 Le tableau `data` garde son identite quand le compte du fil ne change
 * pas : une liste dont l identite change relance sa pagination.
 * @param {any} oldData - La page (ou les pages) en cache.
 * @param {string} chatDocumentId - Le fil qui vient d etre lu.
 * @param {any} ack - La reponse du serveur a `read-message`.
 * @returns {any} Les donnees, comptes du serveur appliques.
 */
export const applyServerChatReadCounts = (oldData, chatDocumentId, ack) => {
  const total = Number(ack?.unreadTotal);
  if (!oldData || typeof oldData !== 'object' || !ack?.ok || !Number.isFinite(total)) {
    return oldData;
  }

  const safeChatId = normalizeChatId(chatDocumentId);
  const chatCount = Number.isFinite(Number(ack?.unreadCount)) ? Number(ack.unreadCount) : 0;

  /**
   * Applique les comptes du serveur a une page.
   * @param {any} page - Une page de la liste.
   * @param {number} index - Sa position.
   * @returns {any} La page, comptes du serveur appliques.
   */
  const readPage = (page, index) => {
    const chats = Array.isArray(page?.data) ? page.data : null;
    let changed = false;
    const nextChats = chats
      ? chats.map((/** @type {any} */ chat) => {
        if (!safeChatId || normalizeChatId(chat?.documentId) !== safeChatId) return chat;
        if (Number(chat?.unreadCount) === chatCount) return chat;
        changed = true;
        return { ...chat, unreadCount: chatCount };
      })
      : null;

    return {
      ...page,
      ...(chats ? { data: changed ? nextChats : chats } : {}),
      ...(index === 0 ? { meta: { ...(page?.meta || {}), unreadTotal: total } } : {}),
    };
  };

  if (Array.isArray(oldData?.pages)) {
    return { ...oldData, pages: oldData.pages.map(readPage) };
  }

  return readPage(oldData, 0);
};

/**
 * @param {unknown} value
 * @returns {string}
 */
const normalizeClientMessageId = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const generateClientMessageId = () => `cmid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * @param {MessageAttachment[]} [attachments]
 * @returns {string}
 */
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

/**
 * @param {ChatMessage | Record<string, any> | null | undefined} message
 * @returns {string}
 */
const getMessageSignature = (message) => {
  const clientMessageId = normalizeClientMessageId(message?.clientMessageId || '');
  const text = String(message?.message || '').trim();
  const compositionType = String(message?.composition?.type || '');
  const eventRef = String(message?.event?.documentId || message?.event || '');
  const replyRef = String(message?.replyTo?.documentId || message?.replyTo?.id || '');
  const attachmentSignature = getAttachmentSignature(message?.attachments || []);

  return `${clientMessageId}::${text}::${compositionType}::${eventRef}::${replyRef}::${attachmentSignature}`;
};

/**
 * @param {ChatMessage | Record<string, any> | null | undefined} message
 * @returns {string}
 */
const getMessageEntityId = (message) => (
  // eslint-disable-next-line no-underscore-dangle
  String(/** @type {Record<string, any>} */ (message || {})?.documentId
    || /** @type {Record<string, any>} */ (message || {})?.id
    || /** @type {Record<string, any>} */ (message || {})?.[LEGACY_ID_KEY]
    || '')
);

/**
 * @param {ChatMessage | Record<string, any> | null | undefined} message
 * @returns {string}
 */
const getSenderEntityId = (message) => (
  // eslint-disable-next-line no-underscore-dangle
  normalizeChatId(/** @type {Record<string, any>} */ (message || {})?.sender?.documentId
    || /** @type {Record<string, any>} */ (message || {})?.sender?.id
    || /** @type {Record<string, any>} */ (message || {})?.user?.[LEGACY_ID_KEY]
    || '')
);

/**
 * @param {ChatMessage | Record<string, any> | null | undefined} message
 * @returns {string}
 */
const getMessageChatDocumentId = (message) => {
  const chat = /** @type {Record<string, any> | string | undefined} */ (message?.chat);
  if (typeof chat === 'string') return normalizeChatId(chat);
  return normalizeChatId(chat?.documentId || '');
};

/**
 * @param {any} queryData
 * @returns {boolean}
 */
const hasCachedChatMessages = (queryData) => (
  Boolean(
    queryData
    && Array.isArray(queryData?.pages)
    && queryData.pages.some((/** @type {{ data?: unknown[] }} */ page) => Array.isArray(page?.data) && page.data.length > 0),
  )
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
  // SECU-SONDAGE-ANONYME (07/10) — mon choix dans les sondages anonymes du fil ouvert.
  useMyAnonymousPollVotes(currentChatId, userData?.documentId);
  const pendingTimeoutsRef = useRef(
    /** @type {Map<string, ReturnType<typeof setTimeout>>} */ (new Map()),
  );
  // MSG2 — quand le serveur a rendu, pour chaque fil, un compte FRAIS.
  const freshReadAckAtRef = useRef(/** @type {Map<string, number>} */ (new Map()));
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

  const clearPendingTimeout = useCallback((/** @type {string} */ tempMessageId) => {
    const timeoutId = pendingTimeoutsRef.current.get(tempMessageId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      pendingTimeoutsRef.current.delete(tempMessageId);
    }
  }, []);

  const markMessageState = useCallback((
    /** @type {string} */ chatId,
    /** @type {string} */ messageId,
    /** @type {Record<string, any>} */ patch,
  ) => {
    queryClient.setQueriesData({ queryKey: ['chat-messages', chatId] }, (/** @type {any} */ oldData) => {
      if (!oldData?.pages) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((/** @type {{ data?: ChatMessage[] }} */ page) => ({
          ...page,
          data: Array.isArray(page?.data)
            ? page.data.map((/** @type {ChatMessage} */ msg) => {
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
    const chats = /** @type {Chat[]} */ ([]);

    queryEntries.forEach(([, value]) => {
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

    // RECETTE-WEB-COACH — meme clef que `useGetChats`, donc la meme forme PAGINEE.
    // Un `fetchQuery` y rangeait une page nue ({ data, meta }) : la liste des fils
    // montee ensuite lisait `pages.length` dessus et l'ecran tombait.
    const response = await queryClient.fetchInfiniteQuery({
      getNextPageParam: (/** @type {any} */ lastPage) => {
        const pagination = lastPage?.meta?.pagination;
        if (!pagination || pagination.page >= pagination.pageCount) return undefined;
        return pagination.page + 1;
      },
      initialPageParam: 1,
      queryFn: ({ pageParam = 1 }) => getChats(pageParam),
      queryKey: chatsLookupQueryKey,
      staleTime: 30000,
    });

    return (response?.pages || []).flatMap((/** @type {any} */ page) => (
      Array.isArray(page?.data) ? page.data : []
    ));
  }, [chatsLookupQueryKey, getCachedChatsForLookup, queryClient]);

  // AE06 — en plus du clonage qui fait relire le « lu » local, on remet a zero
  // le compte SERVEUR du fil ouvert et on baisse le total d autant. Sans
  // reseau : la pastille tombe a l instant ou on ouvre la conversation.
  const notifyChatsReadStatusChanged = useCallback((/** @type {string} */ chatId = '') => {
    queryClient.setQueriesData(
      { queryKey: ['chats'] },
      (/** @type {any} */ oldData) => applyOptimisticChatRead(oldData, chatId),
    );
  }, [queryClient]);

  /**
   * Update the last read message timestamp for a chat
   * @param {string} chatId - The chat ID
   */
  const updateLastReadMessage = useCallback((/** @type {string} */ chatId) => {
    const safeChatId = normalizeChatId(chatId);
    if (!safeChatId) return;

    storage.set(getLastReadMessageKey(safeChatId), new Date().toISOString());
    // getUnreadStatus reads local storage; clone cached pages to re-render without a network refetch.
    notifyChatsReadStatusChanged(safeChatId);
  }, [notifyChatsReadStatusChanged]);

  /**
   * Handle new message received from socket
   * @param {ChatMessage} message - The received message
   */
  // WHATSAPP3 — 🔴 LA PASTILLE DE NON-LUS SE RELIT, ELLE NE S INVENTE PAS.
  //
  // Ce compteur se calcule cote serveur en comparant des COUPLES (message,
  // lecture), avec un plafond a 100, sur deux repliques. Un « +1 » local
  // paraitrait juste et divergerait en silence. On relit donc la requete qui le
  // porte (`['chats']`), et le serveur reste seul maitre du chiffre.
  //
  // ⏱️ Une reference, pas un etat : la changer ne doit redessiner personne.
  const lastUnreadRefetchAtRef = useRef(0);

  const handleNewMessage = useCallback((/** @type {ChatMessage} */ message) => {
    const receivedChatId = getMessageChatDocumentId(message);
    markMessagingPerf('messaging_message_received', {
      chatId: receivedChatId,
      hasAttachments: Array.isArray(message?.attachments) && message.attachments.length > 0,
      hasComposition: Boolean(message?.composition),
      messageId: getMessageEntityId(message),
    });

    // Add new message to chat messages cache
    queryClient.setQueriesData(
      { queryKey: ['chat-messages', receivedChatId] },
      (/** @type {any} */ oldData) => {
        const formattedMessage = {
          attachments: message.attachments, // Handle attachments
          chat: message.chat,
          clientMessageId: normalizeClientMessageId(message?.clientMessageId || ''),
          composition: message.composition, // Handle composition
          createdAt: message.createdAt,
          documentId: message.documentId,
          event: message.event,
          id: message.id || message.documentId,
          message: message.message,
          readBy: message.readBy, // Handle readBy
          replyTo: message.replyTo, // Handle reply
          sender: message.sender,
          // MSG-SUPPORT (20/10) — la signature posée par le serveur (« Assistance FoundClub »,
          // la Ville, un club) : sans elle, un message reçu EN DIRECT perdait qui il représente
          // jusqu'à la relecture suivante. Absente, la forme du message ne bouge pas.
          ...(message.senderSignature ? { senderSignature: message.senderSignature } : {}),
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
        const cleanPages = oldData.pages.map((/** @type {{ data?: ChatMessage[] }} */ page) => {
          // Ensure page.data is an array
          const data = Array.isArray(page?.data) ? page.data : [];
          const confirmedSignature = getMessageSignature(formattedMessage);
          // Filter out pending messages that look identical to the confirmed one
          const filteredData = data.filter((/** @type {ChatMessage} */ msg) => {
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
        const formattedMessageId = normalizeChatId(getMessageEntityId(formattedMessage));

        const messageExists = firstPageData.some(
          (/** @type {ChatMessage} */ msg) => normalizeChatId(getMessageEntityId(msg)) === formattedMessageId,
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
              if (chat.documentId === receivedChatId) {
                return {
                  ...chat,
                  archivedBy: [], // Force unarchive locally
                  messages: [message],
                  updatedAt: message?.updatedAt || message?.createdAt || chat.updatedAt,
                };
              }
              return chat;
            }) : [],
          })),
        };
      },
    );

    // WHATSAPP3 — et si ce message doit faire bouger la pastille, on RELIT.
    //
    // ⚠️ `refetchType: 'all'` ET PAS `'active'` : la pastille s affiche aussi
    // depuis un ecran ou la requete `['chats']` dort. Une invalidation sur une
    // requete en veille ne relit RIEN (memoire
    // `piege-invalidation-query-desactivee`) — elle se contenterait de la
    // marquer perimee, et le chiffre resterait faux jusqu au prochain reveil.
    if (shouldRefetchUnreadOnMessage({
      currentChatId,
      lastRefetchAt: lastUnreadRefetchAtRef.current,
      message,
      myUserId: userData?.documentId,
      now: Date.now(),
    })) {
      lastUnreadRefetchAtRef.current = Date.now();
      queryClient.refetchQueries({ queryKey: ['chats'], type: 'all' });
    }
  }, [queryClient, clearPendingTimeout, currentChatId, userData?.documentId]);

  const handleMessageDeleted = useCallback((/** @type {MessageDeletionData} */ data) => {
    const deletedMessageId = normalizeChatId(
      data?.messageId
      || data?.documentId
      || data?.messageDocumentId,
    );
    if (!deletedMessageId) return;

    const cachedMessageQuery = queryClient.getQueriesData({ queryKey: ['chat-messages'] })
      .find(([, cached]) => /** @type {any} */ (cached)?.pages?.some((/** @type {any} */ page) => (
        page.data?.some((/** @type {any} */ msg) => normalizeChatId(getMessageEntityId(msg)) === deletedMessageId)
      )));
    const chatDocumentId = normalizeChatId(
      data?.chatDocumentId || data?.chat?.documentId || cachedMessageQuery?.[0]?.[1],
    );
    // Le lifecycle prod émet seulement documentId. Il est globalement unique :
    // on peut enlever CET identifiant des caches, sans attribuer l'événement au fil ouvert.
    const messageFilter = {
      queryKey: chatDocumentId ? ['chat-messages', chatDocumentId] : ['chat-messages'],
    };
    queryClient.setQueriesData(
      messageFilter,
      (/** @type {any} */ oldData) => {
        if (!oldData || !oldData.pages) return oldData;
        let changed = false;
        const pages = oldData.pages.map((/** @type {any} */ page) => {
          if (!Array.isArray(page.data)) return page;
          const remaining = page.data.filter((/** @type {any} */ msg) => (
            normalizeChatId(getMessageEntityId(msg)) !== deletedMessageId
          ));
          if (remaining.length === page.data.length) return page;
          changed = true;
          return { ...page, data: remaining };
        });
        // Le serveur émet deux fois : garder les références évite de réveiller les effets.
        return changed ? { ...oldData, pages } : oldData;
      },
    );

    // Retirer aussi l'aperçu supprimé. Le serveur prod protège son snapshot contre
    // les messages plus anciens : une relecture immédiate ramènerait le texte effacé.
    const survivors = chatDocumentId ? queryClient.getQueriesData(messageFilter)
      .flatMap(([, cached]) => /** @type {any} */ (cached)?.pages || [])
      .flatMap((page) => page.data || []) : [];
    const latestSurvivor = survivors.reduce((latest, message) => (
      !latest || new Date(message.createdAt).getTime() > new Date(latest.createdAt).getTime()
        ? message : latest
    ), null);
    queryClient.setQueriesData({ queryKey: ['chats'] }, (/** @type {any} */ oldData) => {
      const updatePage = (/** @type {any} */ page) => {
        if (!Array.isArray(page?.data)) return page;
        let changed = false;
        const chats = page.data.map((/** @type {any} */ chat) => {
          if (chatDocumentId && chat.documentId !== chatDocumentId) return chat;
          if (!chat.messages?.some((/** @type {any} */ msg) => (
            normalizeChatId(getMessageEntityId(msg)) === deletedMessageId
          ))) return chat;
          changed = true;
          const remaining = chat.messages.filter((/** @type {any} */ msg) => (
            normalizeChatId(getMessageEntityId(msg)) !== deletedMessageId
          ));
          const messages = remaining.length ? remaining : [latestSurvivor].filter(Boolean);
          return { ...chat, messages };
        });
        return changed ? { ...page, data: chats } : page;
      };
      if (!oldData?.pages) return updatePage(oldData);
      const pages = oldData.pages.map(updatePage);
      return pages.some((/** @type {any} */ page, /** @type {number} */ index) => (
        page !== oldData.pages[index]
      )) ? { ...oldData, pages } : oldData;
    });
  }, [queryClient]);

  const handleMessageUpdated = useCallback((/** @type {any} */ payload) => {
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
    // SECU-SONDAGE-ANONYME (07/10) — MON choix, rendu par la réponse de MON vote (jamais diffusé).
    const explicitMyOptionIds = payload?.message && Array.isArray(payload?.myOptionIds)
      ? payload.myOptionIds
      : null;

    queryClient.setQueriesData(
      { queryKey: ['chat-messages', chatDocumentId] },
      (/** @type {any} */ oldData) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((/** @type {{ data?: ChatMessage[] }} */ page) => ({
            ...page,
            data: Array.isArray(page?.data)
              ? page.data.map((/** @type {ChatMessage} */ message) => {
                const existingId = normalizeChatId(getMessageEntityId(message));
                if (existingId !== messageDocumentId) return message;
                // SECU-SONDAGE-ANONYME (07/10) — un sondage anonyme arrive du serveur SANS votant
                // (compteurs seuls) : mon choix est reposé — celui que la réponse de MON vote
                // vient de rendre, sinon celui déjà posé dans le cache (sans quoi chaque vote des
                // autres l'effacerait de l'écran).
                const keepsMyChoice = isAnonymousPollNamingNoOne(updatedMessage?.composition);
                return {
                  ...message,
                  ...updatedMessage,
                  ...(keepsMyChoice ? {
                    composition: withMyAnonymousPollVotes(
                      updatedMessage.composition,
                      explicitMyOptionIds
                        || getMyPollOptionIds(message?.composition, userData?.documentId || ''),
                      userData?.documentId || '',
                    ),
                  } : {}),
                  documentId: updatedMessage?.documentId || message.documentId,
                  id: updatedMessage?.id || message.id,
                };
              })
              : [],
          })),
        };
      },
    );
  }, [queryClient, userData?.documentId]);

  const handleMessageRead = useCallback((/** @type {any} */ payload) => {
    const chatDocumentId = normalizeChatId(payload?.chatDocumentId);
    const readerId = normalizeChatId(payload?.userDocumentId);
    if (!chatDocumentId || !readerId) return;

    // AE06 — le serveur vient de perimer MA liste (il ecrit le curseur, puis
    // invalide son cache) : c est le seul moment ou le nouveau compte est
    // disponible. 🧊 `refetch` et pas `invalidate` : une query en veille — et
    // celle de la pastille l est des qu on n est pas dans la messagerie — ne se
    // relit jamais sur une simple invalidation.
    // MSG2 — sauf si l accuse vient de rendre le compte FRAIS : relire irait sur
    // une replique qui peut resservir l ancien compte, et l ecraserait.
    const freshAckAt = freshReadAckAtRef.current.get(chatDocumentId) || 0;
    if (
      shouldRefetchChatsAfterRead(payload, userData?.documentId)
      && Date.now() - freshAckAt > FRESH_READ_ACK_MS
    ) {
      queryClient.refetchQueries({ queryKey: ['chats'] });
    }

    queryClient.setQueriesData({ queryKey: ['chat-messages', chatDocumentId] }, (/** @type {any} */ oldData) => {
      if (!oldData?.pages) return oldData;

      const lastSeenMessageId = normalizeChatId(payload?.lastSeenMessageId || '');
      let cutoffTime = /** @type {number | null} */ (null);

      if (lastSeenMessageId) {
        const foundMessage = oldData.pages
          .flatMap((/** @type {{ data?: ChatMessage[] }} */ page) => (Array.isArray(page?.data) ? page.data : []))
          .find((/** @type {ChatMessage} */ message) => {
            const id = normalizeChatId(getMessageEntityId(message));
            return id === lastSeenMessageId;
          });
        if (foundMessage?.createdAt) {
          cutoffTime = new Date(foundMessage.createdAt).getTime();
        }
        // P1-15 : message lu inconnu ici, on ne devine pas jusqu'où l'autre a lu.
        if (cutoffTime === null) return oldData;
      }

      return {
        ...oldData,
        pages: oldData.pages.map((/** @type {{ data?: ChatMessage[] }} */ page) => ({
          ...page,
          data: Array.isArray(page?.data)
            ? page.data.map((/** @type {ChatMessage} */ message) => {
              const senderId = getSenderEntityId(message);
              if (!senderId || senderId === readerId) return message;

              if (cutoffTime !== null) {
                const createdAt = new Date(message?.createdAt || 0).getTime();
                if (!Number.isFinite(createdAt) || createdAt > cutoffTime) {
                  return message;
                }
              }

              const readBy = Array.isArray(message?.readBy) ? message.readBy : [];
              const alreadyRead = readBy.some((/** @type {User | Record<string, any>} */ entry) => normalizeChatId(entry?.documentId || entry?.id) === readerId);
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
  }, [queryClient, userData?.documentId]);

  /**
   * MSGREACT — range les reactions d un message dans la reserve du fil.
   *
   * 🧊 On ecrit dans `['chat-message-reactions', chatId]`, JAMAIS dans
   * `['chat-messages', chatId]` : les reactions ont leur propre requete, et
   * c est ce qui garantit qu une reaction ne fait bouger aucun compteur de
   * non-lus. Le meme chemin sert a l accuse du serveur ET a la socket, donc les
   * deux ne peuvent pas diverger.
   */
  const applyReactionsToCache = useCallback((
    /** @type {string} */ chatDocumentId,
    /** @type {string} */ messageDocumentId,
    /** @type {any[]} */ reactions,
  ) => {
    const safeChatDocumentId = normalizeChatId(chatDocumentId);
    const safeMessageDocumentId = normalizeChatId(messageDocumentId);
    if (!safeChatDocumentId || !safeMessageDocumentId) return;

    queryClient.setQueriesData(
      { queryKey: ['chat-message-reactions', safeChatDocumentId] },
      (/** @type {any} */ oldData) => {
        const index = withMessageReactions(
          indexReactionsByMessage(oldData?.data),
          safeMessageDocumentId,
          reactions,
        );

        return {
          ...(oldData || {}),
          chatDocumentId: safeChatDocumentId,
          data: Object.entries(index).map(([entryMessageDocumentId, entryReactions]) => ({
            messageDocumentId: entryMessageDocumentId,
            reactions: entryReactions,
          })),
        };
      },
    );
  }, [queryClient]);

  const handleMessageReactionUpdated = useCallback((/** @type {any} */ payload) => {
    applyReactionsToCache(
      payload?.chatDocumentId,
      payload?.messageDocumentId,
      Array.isArray(payload?.reactions) ? payload.reactions : [],
    );
  }, [applyReactionsToCache]);

  const handleJoined = useCallback((/** @type {JoinData} */ data) => {
    const chatDocumentId = normalizeChatId(data?.chatDocumentId || '');
    if (!chatDocumentId) return;

    const matchingQueries = queryClient.getQueriesData({ queryKey: ['chat-messages', chatDocumentId] });
    const alreadyHasMessages = matchingQueries.some(([, queryData]) => hasCachedChatMessages(queryData));
    const isMessagesFetchInFlight = queryClient.isFetching({ queryKey: ['chat-messages', chatDocumentId] }) > 0;

    if (!alreadyHasMessages && !isMessagesFetchInFlight) {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatDocumentId] });
      markMessagingPerf('messaging_joined_messages_refetch_requested', {
        chatId: chatDocumentId,
      });
      return;
    }

    // MSGNOTIF — entrer, ou RE-entrer après une coupure, dans la salle : ce qui
    // s'y est dit pendant qu'on n'y était pas n'arrivera jamais par le fil. Avant,
    // un cache présent suffisait à tout sauter : le message manquait jusqu'à ce
    // qu'on tue l'app. Une lecture déjà en vol voit tout jusqu'à maintenant.
    // ponytail: une page relue à CHAQUE entrée avec un cache, même si la socket n'a
    // jamais coupé. Sortie : numéroter les connexions (socketManager) et ne rattraper
    // que si la connexion a changé depuis la dernière lecture du fil.
    if (alreadyHasMessages && !isMessagesFetchInFlight) {
      rattraperLeFil(queryClient, chatDocumentId);
      markMessagingPerf('messaging_joined_messages_caught_up', { chatId: chatDocumentId });
      return;
    }

    markMessagingPerf('messaging_joined_messages_refetch_skipped', {
      chatId: chatDocumentId,
      hasCachedMessages: alreadyHasMessages,
      isFetchInFlight: isMessagesFetchInFlight,
    });
  }, [queryClient]);

  /**
   * MSG1BA (§3.14) — `chat-unread-updated` (contrat 1B §7) : un autre appareil du compte a
   * marque un fil non lu, ou a quitte un groupe. Les comptes du serveur sont absolus : on les
   * pose tels quels (rejouer l'evenement ne change rien). Apres un depart, on relit la liste,
   * d'ou le groupe est sorti.
   */
  const handleChatUnreadUpdated = useCallback((/** @type {any} */ payload) => {
    const chatDocumentId = normalizeChatId(payload?.chatDocumentId);
    if (!chatDocumentId) return;
    if (payload?.left) {
      queryClient.refetchQueries({ queryKey: ['chats'], type: 'all' });
      return;
    }
    queryClient.setQueriesData(
      { queryKey: ['chats'] },
      (/** @type {any} */ oldData) => applyServerChatReadCounts(oldData, chatDocumentId, {
        ok: true,
        unreadCount: payload?.unreadCount,
        unreadTotal: payload?.unreadTotal,
      }),
    );
  }, [queryClient]);

  /**
   * MSG1BA (§3.17) — `group-notice` (contrat 1B §7) : une notice de groupe (« Adel a renomme
   * le groupe… »), JAMAIS emise par `message-received`. Elle entre dans le fil telle quelle
   * (avec `systemNotice`, que l'ecran recrit en « Vous »), une seule fois meme recue par la
   * salle du fil ET par la mienne ; elle devient l'apercu de la liste SANS toucher aux non-lus
   * (une notice ne compte jamais) ni a l'archivage ; et le detail du groupe est relu : nom,
   * photo, admins et autorisations ont pu changer.
   */
  const handleGroupNotice = useCallback((/** @type {any} */ payload) => {
    const notice = payload?.message && typeof payload.message === 'object' ? payload.message : null;
    const chatDocumentId = normalizeChatId(payload?.chatDocumentId);
    const noticeId = normalizeChatId(getMessageEntityId(notice));
    if (!chatDocumentId || !notice || !noticeId) return;

    queryClient.setQueriesData(
      { queryKey: ['chat-messages', chatDocumentId] },
      (/** @type {any} */ oldData) => {
        if (!oldData?.pages?.length) return oldData;
        const dejaLa = oldData.pages.some((/** @type {any} */ page) => (
          Array.isArray(page?.data) && page.data.some((/** @type {ChatMessage} */ message) => (
            normalizeChatId(getMessageEntityId(message)) === noticeId
          ))
        ));
        if (dejaLa) return oldData;
        const [premiere, ...suivantes] = oldData.pages;
        return {
          ...oldData,
          pages: [
            {
              ...premiere,
              data: [notice, ...(Array.isArray(premiere?.data) ? premiere.data : [])],
            },
            ...suivantes,
          ],
        };
      },
    );
    queryClient.setQueriesData(
      { queryKey: ['chats'] },
      (/** @type {any} */ oldData) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((/** @type {any} */ page) => ({
            ...page,
            data: Array.isArray(page?.data) ? page.data.map((/** @type {Chat} */ chat) => (
              normalizeChatId(chat?.documentId) === chatDocumentId
                ? { ...chat, messages: [notice] }
                : chat
            )) : page?.data,
          })),
        };
      },
    );
    queryClient.invalidateQueries({ queryKey: ['chat', chatDocumentId] });
  }, [queryClient]);

  const handleSocketError = useCallback((/** @type {any} */ error) => {
    const safeCurrentChatId = normalizeChatId(currentChatId);
    const errorPayload = {
      chatId: safeCurrentChatId,
      code: error?.code,
      message: error?.message || error,
    };
    messagingLogger.error('Socket chat error', errorPayload);
    if (isAttachmentDebugEnabled) {
      messagingLogger.warn('[attachment-debug] socket error received', errorPayload);
    }
  }, [currentChatId]);

  // MSGNOTIF2 — le fil REVIENT (pas son premier branchement) : la liste des fils a pu
  // manquer des messages pendant la coupure (aperçus, non-lus). Elle est relue une
  // fois, même si plusieurs écrans montés voient le retour. Le fil ouvert, lui, se
  // rattrape à son `joined`.
  const etaitConnecteRef = useRef(isConnected);
  useEffect(() => {
    const etaitConnecte = etaitConnecteRef.current;
    etaitConnecteRef.current = isConnected;
    if (isConnected && !etaitConnecte && compterConnexionsEtablies() > 1) {
      rattraperLaListe(queryClient);
    }
  }, [isConnected, queryClient]);

  // Subscribe to chat events when socket is available
  useEffect(() => {
    const safeCurrentChatId = normalizeChatId(currentChatId);

    // WHATSAPP3 — 🚪 ON ECOUTE DES QU UNE SOCKET EXISTE, fil ouvert ou non.
    //
    // 🧨 Avant ce lot, la garde etait `!isConnected || !safeCurrentChatId ||
    // !socket` : sans fil courant, l effet sortait aussitot et AUCUN ecouteur
    // n etait pose. Or l ecran de la liste appelle `useMessaging()` SANS
    // argument — pour lui, `currentChatId` vaut `undefined`. Resultat : un
    // message recu pendant qu on regardait la liste n y apparaissait jamais
    // (defaut vu par Adel le 23/09), quoi que fasse le serveur.
    //
    // Entrer dans une salle, en revanche, n a de sens qu avec un fil : ce geste
    // reste conditionne, et lui seul.
    if (!isConnected || !socket) return undefined;

    if (safeCurrentChatId) {
      socket.emit(EVENTS.JOIN_CHAT, { chatDocumentId: safeCurrentChatId });
    }

    // Set up event listeners after joining
    socket.on(EVENTS.MESSAGE_RECEIVED, handleNewMessage);
    socket.on(EVENTS.MESSAGE_DELETED, handleMessageDeleted);
    socket.on(EVENTS.MESSAGE_UPDATED, handleMessageUpdated);
    socket.on(EVENTS.MESSAGE_REACTION_UPDATED, handleMessageReactionUpdated);
    socket.on(EVENTS.MESSAGE_READ, handleMessageRead);
    socket.on(EVENTS.JOINED, handleJoined);
    socket.on(EVENTS.ERROR, handleSocketError);
    socket.on(EVENTS.CHAT_UNREAD_UPDATED, handleChatUnreadUpdated);
    socket.on(EVENTS.GROUP_NOTICE, handleGroupNotice);

    // Cleanup: leave chat and remove listeners
    return () => {
      // Les ecouteurs, eux, sont TOUJOURS retires : sinon ils s empileraient a
      // chaque navigation, et un message arriverait en double, puis en triple.
      if (safeCurrentChatId) {
        socket.emit(EVENTS.LEAVE_CHAT, { chatDocumentId: safeCurrentChatId });
      }
      socket.off(EVENTS.MESSAGE_RECEIVED, handleNewMessage);
      socket.off(EVENTS.MESSAGE_DELETED, handleMessageDeleted);
      socket.off(EVENTS.MESSAGE_UPDATED, handleMessageUpdated);
      socket.off(EVENTS.MESSAGE_REACTION_UPDATED, handleMessageReactionUpdated);
      socket.off(EVENTS.MESSAGE_READ, handleMessageRead);
      socket.off(EVENTS.JOINED, handleJoined);
      socket.off(EVENTS.ERROR, handleSocketError);
      socket.off(EVENTS.CHAT_UNREAD_UPDATED, handleChatUnreadUpdated);
      socket.off(EVENTS.GROUP_NOTICE, handleGroupNotice);
      if (safeCurrentChatId) {
        updateLastReadMessage(safeCurrentChatId);
      }
    };
  }, [socket,
    handleNewMessage,
    handleMessageDeleted,
    handleMessageUpdated,
    handleMessageReactionUpdated,
    handleMessageRead,
    handleJoined,
    handleSocketError,
    handleChatUnreadUpdated,
    handleGroupNotice,
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
    onSuccess: (result, messageId) => {
      // Le succès HTTP suffit ; un socket absent/lent ne doit pas figer le message.
      handleMessageDeleted({
        chatDocumentId: result?.chatDocumentId || currentChatId,
        messageDocumentId: result?.messageDocumentId || messageId,
      });
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: (/** @type {{ chatId?: string, data: { message?: string, attachments?: Array<{ id?: number, documentId?: string }> }, messageId: string }} */ { data, messageId }) => editMessage(messageId, data),
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
    mutationFn: (/** @type {{ chatId?: string, messageId: string, optionId: string }} */ payload) => votePollMessage(payload.messageId, payload.optionId),
    onSuccess: (data, variables) => {
      const chatDocumentId = normalizeChatId(
        data?.chatDocumentId
        || variables?.chatId
        || currentChatId,
      );
      const messageDocumentId = normalizeChatId(data?.messageDocumentId || variables?.messageId);
      // SECU-SONDAGE-ANONYME (07/10) — la réponse de MON vote porte MON choix (`myOptionIds`) :
      // pour un sondage anonyme, c'est la seule source (la composition ne nomme plus personne).
      const myOptionIds = Array.isArray(data?.myOptionIds) ? data.myOptionIds : null;
      if (messageDocumentId && myOptionIds) {
        queryClient.setQueryData(myAnonymousPollVotesKey(messageDocumentId), { myOptionIds });
      }

      if (chatDocumentId && messageDocumentId && data?.composition) {
        handleMessageUpdated({
          chatDocumentId,
          message: {
            composition: data.composition,
            documentId: messageDocumentId,
            updatedAt: data?.updatedAt,
          },
          myOptionIds,
        });
        markMessagingPerf('messaging_poll_vote_cache_updated', {
          changed: Boolean(data?.changed),
          chatId: chatDocumentId,
          messageId: messageDocumentId,
        });
      }
    },
  });

  const reactToMessageMutation = useMutation({
    mutationFn: (/** @type {{ chatId?: string, emoji: string, messageId: string }} */ payload) => (
      reactToChatMessage(payload.messageId, payload.emoji)
    ),
    onSuccess: (data, variables) => {
      applyReactionsToCache(
        data?.chatDocumentId || variables?.chatId || currentChatId,
        data?.messageDocumentId || variables?.messageId,
        Array.isArray(data?.reactions) ? data.reactions : [],
      );
    },
  });

  const proposalResponseMutation = useMutation({
    mutationFn: (/** @type {{ chatId?: string, messageId: string, status: 'accepted' | 'declined' }} */ payload) => respondProposalMessage(payload.messageId, payload.status),
    onSuccess: (data, variables) => {
      const chatDocumentId = normalizeChatId(
        data?.chatDocumentId
        || variables?.chatId
        || currentChatId,
      );
      const messageDocumentId = normalizeChatId(data?.messageDocumentId || variables?.messageId);

      if (chatDocumentId && messageDocumentId && data?.composition) {
        handleMessageUpdated({
          chatDocumentId,
          message: {
            composition: data.composition,
            documentId: messageDocumentId,
            updatedAt: data?.updatedAt,
          },
        });
        markMessagingPerf('messaging_proposal_response_cache_updated', {
          changed: Boolean(data?.changed),
          chatId: chatDocumentId,
          messageId: messageDocumentId,
        });
      }
    },
  });

  const addGroupMembersMutation = useMutation({
    mutationFn: (/** @type {{ chatId: string, memberIds: string[] }} */ { chatId, memberIds }) => addGroupMembers(chatId, memberIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat', variables?.chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  const removeGroupMemberMutation = useMutation({
    mutationFn: (/** @type {{ chatId: string, userId: string }} */ { chatId, userId }) => removeGroupMember(chatId, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat', variables?.chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  const updateGroupMetaMutation = useMutation({
    mutationFn: (/** @type {{ chatId: string, data: { groupName?: string, addAdminIds?: string[], removeAdminIds?: string[] } }} */ { chatId, data }) => updateGroupMeta(chatId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat', variables?.chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  /**
   * Send a message
   * @param {string} chatId - The chat id
   * @param {string} message - The message text
   * @param {Record<string, any>} [extraData] - Extra data (e.g. { event: eventId })
   * @returns {string | null}
   */
  const sendMessage = useCallback((
    /** @type {string} */ chatId,
    /** @type {string} */ message,
    /** @type {Record<string, any>} */ extraData = {},
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
    markMessagingPerf('messaging_send_started', payloadSummary);

    if (!safeChatId) {
      messagingLogger.warn('sendMessage skipped: missing chatId', payloadSummary);
      markMessagingPerf('messaging_send_skipped', {
        ...payloadSummary,
        reason: 'missing_chat_id',
      });
      return null;
    }

    // Check if socket is connected before sending
    if (!isConnected || !socket) {
      messagingLogger.warn('sendMessage skipped: socket disconnected', payloadSummary);
      markMessagingPerf('messaging_send_skipped', {
        ...payloadSummary,
        reason: 'socket_disconnected',
      });
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
      markMessagingPerf('messaging_send_optimistic_rendered', {
        ...payloadSummary,
        tempId,
      });
    }

    socket.emit(EVENTS.SEND_MESSAGE, {
      attachments: extraData.attachments,
      chatDocumentId: safeChatId,
      clientMessageId: safeClientMessageId,
      composition: extraData.composition,
      event: extraData.event,
      message,
      replyTo: extraData.replyTo || null,
      // COLL-C4A2 (02/10) — dans un fil de la Ville, la voix DEMANDÉE (« ville » depuis l'espace
      // de la Ville). Le serveur décide et écrit la signature ; ailleurs, rien n'est envoyé.
      ...(extraData.senderSignature ? { senderSignature: extraData.senderSignature } : {}),
    }, (/** @type {any} */ ackPayload) => {
      const ackError = ackPayload?.ok === false ? ackPayload?.error : null;
      const ackMessage = ackPayload?.ok ? ackPayload?.message : null;

      if (ackError) {
        clearPendingTimeout(tempId);
        markMessageState(safeChatId, tempId, {
          failed: true,
          pending: false,
        });
        markMessagingPerf('messaging_send_failed', {
          ...payloadSummary,
          code: ackError?.code,
          reason: 'ack_error',
          tempId,
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
        markMessagingPerf('messaging_send_acknowledged', {
          ...payloadSummary,
          messageId: getMessageEntityId(ackMessage),
          tempId,
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
      markMessagingPerf('messaging_send_failed', {
        ...payloadSummary,
        reason: 'timeout',
        tempId,
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

  const sendTypingStart = useCallback((/** @type {string} */ chatId) => {
    const safeChatId = normalizeChatId(chatId);
    if (socket && safeChatId) socket.emit(EVENTS.TYPING_START, { chatDocumentId: safeChatId });
  }, [socket]);

  const sendTypingStop = useCallback((/** @type {string} */ chatId) => {
    const safeChatId = normalizeChatId(chatId);
    if (socket && safeChatId) socket.emit(EVENTS.TYPING_STOP, { chatDocumentId: safeChatId });
  }, [socket]);

  /**
   * MSG1BA (§3.14) — « Marquer comme non lu » depuis l'apercu d'une conversation. Le serveur
   * rend les comptes recalcules (fil et total) : on les pose dans la liste, ou la pastille du
   * fil, de l'onglet et de l'accueil les lisent. Une erreur remonte a l'ecran (un 404 = serveur
   * d'avant 1B : l'ecran cache alors le geste).
   * @param {string} chatId - Le fil.
   * @returns {Promise<any>} La reponse du serveur.
   */
  const markChatUnread = useCallback(async (/** @type {string} */ chatId) => {
    const safeChatId = normalizeChatId(chatId);
    if (!safeChatId) return null;
    const resultat = await markChatUnreadRequest(safeChatId);
    if (resultat?.markedUnread) {
      queryClient.setQueriesData(
        { queryKey: ['chats'] },
        (/** @type {any} */ oldData) => applyServerChatReadCounts(oldData, safeChatId, {
          ok: true,
          unreadCount: resultat?.unreadCount,
          unreadTotal: resultat?.unreadTotal,
        }),
      );
    }
    return resultat;
  }, [queryClient]);

  const sendReadReceipt = useCallback((/** @type {string} */ chatId, /** @type {string | undefined} */ lastSeenMessageId) => {
    const safeChatId = normalizeChatId(chatId);
    const safeLastSeenId = normalizeChatId(lastSeenMessageId || '');
    if (socket && safeChatId) {
      socket.emit(EVENTS.READ_MESSAGE, {
        chatDocumentId: safeChatId,
        ...(safeLastSeenId ? { lastSeenMessageId: safeLastSeenId } : {}),
      }, (/** @type {any} */ ack) => {
        // MSG2 — le serveur repond avec le compte recalcule APRES l ecriture du
        // curseur. Un serveur ancien ne repond pas : l echo relit alors la liste.
        if (!ack?.ok || !Number.isFinite(Number(ack?.unreadTotal))) return;
        freshReadAckAtRef.current.set(safeChatId, Date.now());
        queryClient.setQueriesData(
          { queryKey: ['chats'] },
          (/** @type {any} */ oldData) => applyServerChatReadCounts(oldData, safeChatId, ack),
        );
      });
    }
  }, [queryClient, socket]);

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

  // COLL-C4A3 (03/10, point 4) — `extra` : ce que l'ÉCRAN ajoute à chaque envoi, et qu'un message
  // en échec ne garde pas : la voix DEMANDÉE dans un fil de la Ville (« ville » depuis l'espace de
  // la Ville). Sans elle, « Réessayer » renvoyait au nom du club ce qu'un compte mixte avait écrit
  // au nom de la Ville.
  const retryFailedMessage = useCallback((
    /** @type {string} */ chatId,
    /** @type {ChatMessage | Record<string, any>} */ failedMessage,
    /** @type {{ senderSignature?: { voix: string } }} */ extra = {},
  ) => {
    const safeChatId = normalizeChatId(chatId);
    if (!safeChatId || !failedMessage) return;

    const failedMessageId = normalizeChatId(
      failedMessage.documentId
      || failedMessage.id
      // eslint-disable-next-line no-underscore-dangle
      || /** @type {Record<string, any>} */ (failedMessage)?._id
      || '',
    );

    if (failedMessageId) {
      clearPendingTimeout(failedMessageId);
      queryClient.setQueriesData({ queryKey: ['chat-messages', safeChatId] }, (/** @type {any} */ oldData) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((/** @type {{ data?: ChatMessage[] }} */ page) => ({
            ...page,
            data: Array.isArray(page?.data)
              ? page.data.filter((/** @type {ChatMessage} */ message) => {
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
      ...extra,
    });
  }, [clearPendingTimeout, queryClient, sendMessage, userData]);

  /**
   * Start a whisper chat
   * @param {string[]} participants - The participants to start the chat with
   * @returns {Promise<(Chat & { openingOutcome: 'created' | 'reused' | 'unknown' }) | undefined>}
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
          // P1-12 : une équipe, un club ou un groupe aux mêmes membres n'est pas un fil privé.
          if ((chat.type && chat.type !== 'whisper') || chat.team || chat.club) return false;

          const chatParticipants = chat.participants
            .filter((/** @type {any} */ p) => p && (p.documentId || p)) // Filter out nulls
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
            queryClient.setQueriesData({ queryKey: ['chats'] }, (/** @type {any} */ oldData) => {
              if (!oldData?.pages) return oldData;
              return {
                ...oldData,
                pages: oldData.pages.map((/** @type {{ data?: Chat[] }} */ page) => ({
                  ...page,
                  data: Array.isArray(page.data) ? page.data.map((/** @type {Chat} */ chat) => {
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
              const safeError = /** @type {any} */ (e);
              messagingLogger.warn('Failed to unarchive chat on open', safeError?.message || safeError);
            }
          }
          return { ...existingChat, openingOutcome: 'reused' };
        }
      }
    } catch (error) {
      const safeError = /** @type {any} */ (error);
      messagingLogger.warn('Error checking existing chats', safeError?.message || safeError);
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
      const safeError = /** @type {any} */ (error);
      messagingLogger.warn('Error checking existing team chats', safeError?.message || safeError);
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
          (/** @type {any} */ chat) => chat.type === 'club' && chat.club?.documentId === clubId,
        );
        if (existingChat) return existingChat;
      }
    } catch (error) {
      const safeError = /** @type {any} */ (error);
      messagingLogger.warn('Error checking existing club chats', safeError?.message || safeError);
    }

    // If no existing chat found, create a new one
    const result = await createClubChatMutation.mutateAsync(clubId);
    return result;
  };

  /**
   * Cree un groupe. MSG1BA (§3.15) — `permissions` : les autorisations reglees a la creation
   * (contrat 1B §5.3, partiel) ; absentes, la requete garde sa forme d'avant 1B.
   * @param {{
   *   groupName: string, participants: string[], permissions?: Record<string, boolean>
   * }} params
   * @returns {Promise<any>}
   */
  const startGroupChat = async ({ groupName, participants, permissions }) => {
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
      ...(permissions && Object.keys(permissions).length ? { permissions } : {}),
    });
  };

  const votePoll = useCallback((/** @type {string} */ messageId, /** @type {string} */ optionId) => votePollMutation.mutateAsync({
    chatId: currentChatId,
    messageId,
    optionId,
  }), [currentChatId, votePollMutation]);

  const respondToProposal = useCallback((/** @type {string} */ messageId, /** @type {'accepted' | 'declined'} */ status) => proposalResponseMutation.mutateAsync({
    chatId: currentChatId,
    messageId,
    status,
  }), [currentChatId, proposalResponseMutation]);

  const reactToMessage = useCallback((
    /** @type {string} */ messageId,
    /** @type {string} */ emoji,
  ) => reactToMessageMutation.mutateAsync({
    chatId: currentChatId,
    emoji,
    messageId,
  }), [currentChatId, reactToMessageMutation]);

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
    archiveChatAsync: archiveChatMutation.mutateAsync,
    deleteMessage: deleteMessageMutation.mutateAsync,
    editMessage: editMessageMutation.mutateAsync,
    getConversationName,
    getUnreadStatus,
    isSocketConnected: isConnected,
    joinChat,
    leaveChat,
    markChatUnread,
    pinChat: pinChatMutation.mutate,
    pinChatAsync: pinChatMutation.mutateAsync,
    reactToMessage,
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
    unarchiveChatAsync: unarchiveChatMutation.mutateAsync,
    unpinChat: unpinChatMutation.mutate,
    unpinChatAsync: unpinChatMutation.mutateAsync,
    updateGroupMeta: updateGroupMetaMutation.mutateAsync,
    updateLastReadMessage,
    votePoll,
  };
};

export default useMessaging;
// Force Rebuild for Metro
