// @ts-nocheck
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createDeclaredChild,
  deleteDeclaredChild,
  getMyDeclaredChildren,
  updateDeclaredChild,
} from './declaredChildService';

/**
 * PARENT P2 — UNE SEULE LISTE D'ENFANTS POUR TOUTE L'APP.
 *
 * Trois écrans lisent la MÊME clef : « Mes enfants », le formulaire d'ajout, et
 * la fiche d'un club (pour savoir s'il faut proposer « demander à rejoindre au
 * nom de… »). Déclarer un enfant met donc les trois à jour tout seuls.
 *
 * 🧊 APRÈS UNE ÉCRITURE, ON `refetch()` — jamais seulement `invalidateQueries`.
 * Une requête en VEILLE (l'écran n'est plus monté) ne relit rien sur une simple
 * invalidation : elle attend d'être remontée. Or le geste normal ici est
 * « j'ajoute un enfant, je reviens en arrière » — la liste doit être à jour
 * AVANT que l'écran précédent ne réapparaisse. Même piège, même correctif que
 * `userBlockQueries`.
 */

/** La clef unique de la liste « mes enfants déclarés ». */
export const MY_DECLARED_CHILDREN_QUERY_KEY = ['declaredChildren', 'mine'];

/**
 * Mes enfants déclarés.
 * @param {object} [options] - Options react-query.
 * @returns {object} Le résultat react-query.
 */
export const useGetMyDeclaredChildren = (options = {}) => useQuery({
  queryFn: getMyDeclaredChildren,
  queryKey: MY_DECLARED_CHILDREN_QUERY_KEY,
  staleTime: 60 * 1000,
  ...options,
});

/**
 * Fabrique une mutation qui relit la liste POUR DE VRAI après coup.
 * @param {(variables: any) => Promise<any>} mutationFn - Le geste serveur.
 * @param {object} options - Options react-query (`onSuccess` compris).
 * @returns {object} La mutation.
 */
const useChildMutation = (mutationFn, options = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options || {};

  return useMutation({
    mutationFn,
    onSuccess: async (data, variables, context) => {
      await queryClient.refetchQueries({ queryKey: MY_DECLARED_CHILDREN_QUERY_KEY });
      onSuccess?.(data, variables, context);
    },
    ...rest,
  });
};

/**
 * Déclarer un enfant.
 * @param {object} [options] - Options react-query.
 * @returns {object} La mutation.
 */
export const useCreateDeclaredChild = (options = {}) => useChildMutation(
  (payload) => createDeclaredChild(payload),
  options,
);

/**
 * Corriger une fiche à moi.
 * @param {object} [options] - Options react-query.
 * @returns {object} La mutation.
 */
export const useUpdateDeclaredChild = (options = {}) => useChildMutation(
  ({ documentId, payload }) => updateDeclaredChild(documentId, payload),
  options,
);

/**
 * Effacer une fiche à moi, vraiment.
 * @param {object} [options] - Options react-query.
 * @returns {object} La mutation.
 */
export const useDeleteDeclaredChild = (options = {}) => useChildMutation(
  (documentId) => deleteDeclaredChild(documentId),
  options,
);
