// @ts-nocheck
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { blockUser, getMyBlockedUsers, unblockUser } from './userBlockService';

/**
 * BLOQUER — UNE SEULE LISTE POUR TOUTE L APP.
 *
 * Tous les ecrans lisent la MEME clef (`['userBlocks', 'mine']`) : la fiche
 * d une personne, le menu d une conversation, la liste des discussions et
 * l ecran « Personnes bloquees ». Bloquer quelqu un depuis un ecran met donc
 * les autres a jour tout seuls.
 *
 * 🧊 APRES UN BLOCAGE, ON `refetch()` — pas seulement `invalidateQueries`.
 * Une requete en VEILLE (l ecran n est plus monte) ne relit rien sur une simple
 * invalidation : elle attend d etre remontee. La liste des discussions, elle,
 * doit changer TOUT DE SUITE, sinon un fil bloque reste affiche.
 */

/** La clef unique de la liste des personnes bloquees. */
export const MY_USER_BLOCKS_QUERY_KEY = ['userBlocks', 'mine'];

/**
 * Les personnes que J AI bloquees.
 * @param {object} [options] - Options react-query.
 * @returns {object} Le resultat react-query.
 */
export const useGetMyBlockedUsers = (options = {}) => useQuery({
  queryFn: getMyBlockedUsers,
  queryKey: MY_USER_BLOCKS_QUERY_KEY,
  staleTime: 60 * 1000,
  ...options,
});

/**
 * Bloquer, puis relire la liste POUR DE VRAI.
 * @param {object} [options] - Options react-query (`onSuccess` compris).
 * @returns {object} La mutation.
 */
export const useBlockUser = (options = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options || {};

  return useMutation({
    mutationFn: (userId) => blockUser(userId),
    onSuccess: async (data, variables, context) => {
      await queryClient.refetchQueries({ queryKey: MY_USER_BLOCKS_QUERY_KEY });
      // La liste des discussions doit perdre le fil bloque immediatement.
      await queryClient.refetchQueries({ queryKey: ['chats'] });
      onSuccess?.(data, variables, context);
    },
    ...rest,
  });
};

/**
 * Debloquer, puis relire la liste POUR DE VRAI.
 * @param {object} [options] - Options react-query (`onSuccess` compris).
 * @returns {object} La mutation.
 */
export const useUnblockUser = (options = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options || {};

  return useMutation({
    mutationFn: (userId) => unblockUser(userId),
    onSuccess: async (data, variables, context) => {
      await queryClient.refetchQueries({ queryKey: MY_USER_BLOCKS_QUERY_KEY });
      await queryClient.refetchQueries({ queryKey: ['chats'] });
      onSuccess?.(data, variables, context);
    },
    ...rest,
  });
};
