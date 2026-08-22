import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';

import { useGetChats } from '@/services/chat/chatQueriesCompat';

import useAuth from '../auth/useAuth';
import { getChatLastMessage, getUnreadStatus } from './messagingUseCases';

// AE06 — la pastille ne dira jamais plus que ca. Le serveur borne deja, mais
// une app peut parler a un serveur plus vieux OU plus recent : on borne ici
// aussi. 🧨 Sur l ONGLET le nombre reste un NOMBRE : PrivateTabNavigator
// n affiche la pastille que si `badge > 0`, et une chaine « 99+ » vaudrait
// false — la pastille disparaitrait au moment ou elle compte le plus.
export const UNREAD_BADGE_CAP = 99;

/**
 * Le nombre a peindre A COTE du point « Non lu » d une conversation.
 * Contrairement a l onglet, la liste a la place d ecrire « 99+ ».
 * @param {unknown} count - Le compte rendu par le serveur pour ce fil.
 * @returns {string} Le libelle, ou '' quand il n y a rien a dire.
 */
export const formatThreadUnreadBadge = (count) => {
  const parsed = Number(count);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  return parsed > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : String(Math.floor(parsed));
};

/**
 * Ramene un compte brut a ce que la pastille de l onglet sait afficher.
 * @param {unknown} value - Un compte brut.
 * @returns {number} Le meme compte, entier, positif et borne.
 */
const toBoundedCount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), UNREAD_BADGE_CAP);
};

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
 * AE06 — le total que le serveur a calcule sur TOUS les fils accessibles.
 * C est la seule source qui voit au-dela de la page 1.
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @returns {number | null} Le total, ou null si le serveur ne le dit pas.
 */
const getServerUnreadTotal = (queryClient) => {
  const queryEntries = queryClient.getQueriesData({ queryKey: ['chats'] });

  for (let index = 0; index < queryEntries.length; index += 1) {
    const queryData = /** @type {any} */ (queryEntries[index][1]);
    const meta = Array.isArray(queryData?.pages)
      ? queryData.pages[0]?.meta
      : queryData?.meta;
    const total = Number(meta?.unreadTotal);
    if (Number.isFinite(total)) return total;
  }

  return null;
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
 * AE06 — CE QUI A CHANGE : le compte ci-dessous comptait des CONVERSATIONS,
 * sur un « lu » garde en local (MMKV), et ne voyait jamais plus loin que la
 * page 1. Le serveur relit maintenant le curseur de lecture et rend le compte
 * de MESSAGES : `meta.unreadTotal` pour l ensemble, `unreadCount` par fil.
 * Trois marches, de la plus sure a la plus ancienne :
 *   1. le total du serveur — le seul qui voit au-dela de la page 1 ;
 *   2. la somme des comptes de la page — si le serveur compte par fil sans
 *      donner de total (filtres, page > 1) ;
 *   3. l ancien calcul — si le serveur ne compte pas du tout. L app peut
 *      partir AVANT le serveur : rien ne casse, la pastille compte des
 *      conversations comme avant.
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
    // 1. Le total du serveur, quand il le dit.
    const serverTotal = getServerUnreadTotal(queryClient);
    if (serverTotal !== null) {
      return toBoundedCount(serverTotal);
    }

    const chats = getCachedChats(queryClient);
    if (!Array.isArray(chats) || chats.length === 0) {
      return 0;
    }

    // 2. La somme des comptes de la page, quand le serveur compte par fil.
    const chatsAvecCompte = chats.filter(
      (chat) => Number.isFinite(Number(chat?.unreadCount)),
    );
    if (chatsAvecCompte.length > 0) {
      return toBoundedCount(chatsAvecCompte.reduce(
        (total, chat) => total + Math.max(0, Number(chat.unreadCount)),
        0,
      ));
    }

    // 3. L ancien calcul : des conversations, sur le « lu » local.
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
