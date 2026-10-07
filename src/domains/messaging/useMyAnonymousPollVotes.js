import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  isAnonymousPollNamingNoOne,
  withMyAnonymousPollVotes,
} from '@/domains/messaging/pollUseCases';

import { getPollVoterProfiles } from '@/services/chat/chatService';

/**
 * SECU-SONDAGE-ANONYME (07/10) — MON CHOIX DANS LES SONDAGES ANONYMES D'UN FIL, À LA COUCHE
 * DONNÉES.
 *
 * Le serveur ne met plus les votants d'un sondage anonyme dans sa composition (décision d'Adel
 * « anonyme A ») : la page de messages, servie depuis un cache de 3 min commun à tout le fil,
 * n'y porte que les compteurs. Mon choix se lit À PART, à moi seul :
 * GET /chat-messages/:id/poll-voters rend `myOptionIds`.
 *
 * Ce crochet, appelé par `useMessaging` (donc par chaque écran qui montre un fil ou un
 * sondage), garde mon choix POSÉ dans la composition en cache (`voters: [moi]` sur mes options,
 * la forme que les écrans lisent déjà) :
 *   · à l'ouverture du fil, pour chaque sondage anonyme dont je ne connais pas encore mon
 *     choix : UNE lecture par sondage (le serveur n'en a que pour les sondages anonymes) ;
 *   · après chaque réécriture du cache (page relue, diffusion) : mon choix connu est reposé.
 * Un serveur ancien (votants encore dans la composition) fait foi : rien n'est lu ni posé.
 */

/**
 * Le cache de mon choix, par sondage : `{ myOptionIds: string[] | null }` (`null` = illisible).
 * @param {string} messageId Le sondage.
 * @returns {string[]} La clef react-query.
 */
export const myAnonymousPollVotesKey = (messageId) => [
  'chat-poll-my-votes',
  String(messageId || ''),
];

const MY_VOTES_STALE_MS = 60 * 1000;

const messageIdOf = (/** @type {any} */ message) => (
  String(message?.documentId || message?.id || '').trim()
);

/**
 * Les sondages anonymes d'un fil, tels qu'en cache (toutes les pages, toutes les clefs).
 * @param {import('@tanstack/react-query').QueryClient} queryClient Le cache.
 * @param {string} chatId Le fil.
 * @returns {Array<{ messageId: string, poll: any }>} Les sondages anonymes enregistrés.
 */
const anonymousPollsOf = (queryClient, chatId) => {
  const polls = new Map();
  queryClient.getQueriesData({ queryKey: ['chat-messages', chatId] }).forEach(([, data]) => {
    (/** @type {any} */ (data)?.pages || []).forEach((/** @type {any} */ page) => {
      (Array.isArray(page?.data) ? page.data : []).forEach((/** @type {any} */ message) => {
        const messageId = messageIdOf(message);
        if (!messageId || messageId.startsWith('temp-')) return;
        if (message?.composition?.type !== 'poll' || !message.composition.isAnonymous) return;
        polls.set(messageId, message.composition);
      });
    });
  });
  return [...polls].map(([messageId, poll]) => ({ messageId, poll }));
};

/**
 * Pose mon choix dans le sondage en cache — et N'ÉCRIT RIEN s'il y est déjà : chaque écriture
 * réveille l'écoute du cache, une écriture pour rien relancerait la boucle.
 * @param {import('@tanstack/react-query').QueryClient} queryClient Le cache.
 * @param {string} chatId Le fil.
 * @param {string} messageId Le sondage.
 * @param {string[]} myOptionIds Mon choix.
 * @param {string} me Mon identifiant.
 * @returns {void}
 */
export const applyMyAnonymousPollVotesToCache = (
  queryClient,
  chatId,
  messageId,
  myOptionIds,
  me,
) => {
  const needsWrite = anonymousPollsOf(queryClient, chatId).some((entry) => (
    entry.messageId === messageId
    && withMyAnonymousPollVotes(entry.poll, myOptionIds, me) !== entry.poll
  ));
  if (!needsWrite) return;
  const withMyChoice = (/** @type {any} */ message) => {
    if (messageIdOf(message) !== messageId) return message;
    const composition = withMyAnonymousPollVotes(message.composition, myOptionIds, me);
    return composition === message.composition ? message : { ...message, composition };
  };
  const rewrite = (/** @type {any} */ oldData) => {
    if (!oldData?.pages) return oldData;
    return {
      ...oldData,
      pages: oldData.pages.map((/** @type {any} */ page) => ({
        ...page,
        data: Array.isArray(page?.data) ? page.data.map(withMyChoice) : page?.data,
      })),
    };
  };
  queryClient.setQueriesData({ queryKey: ['chat-messages', chatId] }, rewrite);
};

/**
 * Lit mon choix au serveur. Route absente (serveur ancien), réseau coupé : `null`, noté une
 * fois pour toutes (aucune nouvelle tentative tant que la note vit dans le cache).
 * @param {string} messageId Le sondage.
 * @returns {Promise<{ myOptionIds: string[] | null }>} Mon choix, ou `null` s'il est illisible.
 */
const readMyChoice = (messageId) => Promise.resolve()
  .then(() => getPollVoterProfiles(messageId))
  .then((/** @type {any} */ response) => ({
    myOptionIds: Array.isArray(response?.myOptionIds) ? response.myOptionIds : null,
  }))
  .catch(() => ({ myOptionIds: null }));

/**
 * Garde mon choix posé dans les sondages anonymes du fil ouvert.
 * @param {string | undefined} chatId Le fil ouvert.
 * @param {string | undefined} currentUserId Mon identifiant.
 * @returns {void}
 */
export default function useMyAnonymousPollVotes(chatId, currentUserId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const safeChatId = String(chatId || '').trim();
    const me = String(currentUserId || '').trim();
    if (!safeChatId || !me) return undefined;

    let active = true;
    const pending = new Set();

    const reconcile = () => {
      if (!active) return;
      anonymousPollsOf(queryClient, safeChatId).forEach(({ messageId, poll }) => {
        const key = myAnonymousPollVotesKey(messageId);
        const known = /** @type {any} */ (queryClient.getQueryData(key));
        if (known !== undefined) {
          if (Array.isArray(known?.myOptionIds)) {
            const mine = known.myOptionIds;
            applyMyAnonymousPollVotesToCache(queryClient, safeChatId, messageId, mine, me);
          }
          return;
        }
        if (!isAnonymousPollNamingNoOne(poll) || pending.has(messageId)) return;
        pending.add(messageId);
        queryClient
          .fetchQuery({
            queryFn: () => readMyChoice(messageId),
            queryKey: key,
            staleTime: MY_VOTES_STALE_MS,
          })
          .catch(() => queryClient.setQueryData(key, { myOptionIds: null }))
          .finally(() => {
            pending.delete(messageId);
            reconcile();
          });
      });
    };

    reconcile();
    const unsubscribe = queryClient.getQueryCache().subscribe((/** @type {any} */ event) => {
      const queryKey = event?.query?.queryKey;
      if (event?.type !== 'updated' || !Array.isArray(queryKey)) return;
      if (queryKey[0] === 'chat-messages' && String(queryKey[1] || '') === safeChatId) reconcile();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [chatId, currentUserId, queryClient]);
}
