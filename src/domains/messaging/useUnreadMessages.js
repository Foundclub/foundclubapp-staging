import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';

import { useGetChats } from '@/services/chat/chatQueriesCompat';

import useAuth from '../auth/useAuth';
import { getChatLastMessage, getUnreadStatus } from './messagingUseCases';

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
 * Hook to manage unread messages across cached chats.
 *
 * AC05 — Adel : « il manque une pastille rouge avec le nombre de messages non
 * ouverts sur l'icône Messages ». MESURE du 2026-08-21 : la pastille EXISTE
 * (PrivateTabNavigator.js:202), mais ce compteur ne lisait QUE le cache
 * `['chats']` — or rien ne le remplit tant que l'écran Messagerie n'a pas été
 * ouvert au moins une fois. Résultat : pastille à zéro au démarrage, quel que
 * soit le nombre de conversations non lues. On monte donc la MÊME requête que
 * l'écran (même clef, donc aucun appel réseau en double quand il est ouvert).
 * ⚠️ Le serveur ne renvoie qu'UN message par conversation
 * (`chat.messages` vient de `latestMessageSnapshot`) : ce compteur compte donc
 * des CONVERSATIONS non lues, jamais des messages.
 * @returns {{ unreadCount: number }} Object containing unread messages count
 */
const useUnreadMessages = () => {
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);
  const { allMyTeams, userData } = useAuth();
  const safeTeamIds = useMemo(
    () => (Array.isArray(allMyTeams)
      ? Array.from(new Set(
        allMyTeams
          .map((team) => String(team?.documentId || '').trim())
          .filter(Boolean),
      ))
      : []),
    [allMyTeams],
  );

  useGetChats({
    chatScope: 'all',
    currentUserClubId: userData?.club?.documentId,
    currentUserId: userData?.documentId,
    currentUserTeamIds: safeTeamIds,
  });

  const countUnreadMessages = useCallback(() => {
    const chats = getCachedChats(queryClient);
    if (!Array.isArray(chats) || chats.length === 0) {
      return 0;
    }

    return chats.reduce((total, chat) => {
      if (!chat || typeof chat.documentId !== 'string' || !Array.isArray(chat.messages)) {
        return total;
      }

      const lastMessage = getChatLastMessage(chat);
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
