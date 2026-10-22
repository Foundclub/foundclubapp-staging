import { useQuery } from '@tanstack/react-query';

import { getBoiteAssistance, getRepondantsAssistance } from './assistanceService';

/**
 * MSG-SUPPORT (20/10/2026) — les lectures de la console de l'assistance (super-admins). L'ouverture
 * de SA conversation n'a pas de crochet : elle se fait depuis des écrans montés sans client de
 * requêtes dans leurs témoins (views/chat/useOuvrirLAssistance.js).
 */

export const BOITE_ASSISTANCE_QUERY_KEY = ['assistance', 'boite'];

/**
 * La clef de « qui a répondu » dans une conversation.
 * @param {string | null | undefined} chatId - Le fil.
 * @param {string | null | undefined} dernierMessageId - Le dernier message connu : la liste se
 *   relit quand il change.
 * @returns {Array<string | null | undefined>} La clef.
 */
export const repondantsQueryKey = (chatId, dernierMessageId) => (
  ['assistance', 'repondants', chatId, dernierMessageId]
);

/**
 * La boîte commune : `{ conversations, enAttenteTotal, nonLusTotal }`.
 * @param {Record<string, any>} [options] - Options react-query.
 * @returns {import('@tanstack/react-query').UseQueryResult<any, Error>} La boîte.
 */
export const useBoiteAssistance = (options = {}) => useQuery({
  queryFn: getBoiteAssistance,
  queryKey: BOITE_ASSISTANCE_QUERY_KEY,
  staleTime: 15_000,
  ...options,
});

/**
 * Qui de l'équipe a écrit chaque réponse (console seulement).
 * @param {string | null | undefined} chatId - Le fil.
 * @param {string | null | undefined} dernierMessageId - Le dernier message affiché.
 * @param {Record<string, any>} [options] - Options react-query (`enabled`).
 * @returns {import('@tanstack/react-query').UseQueryResult<Record<string, any>, Error>}
 *   Le nom de qui a répondu, par message.
 */
export const useRepondantsAssistance = (chatId, dernierMessageId, options = {}) => useQuery({
  enabled: Boolean(chatId),
  queryFn: () => getRepondantsAssistance(String(chatId)),
  queryKey: repondantsQueryKey(chatId, dernierMessageId),
  retry: false,
  staleTime: 60_000,
  ...options,
});
