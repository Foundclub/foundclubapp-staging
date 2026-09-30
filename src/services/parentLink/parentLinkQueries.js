// @ts-nocheck
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptParentLink,
  cancelParentLink,
  getParentLinksAsChild,
  getParentLinksAsParent,
  refuseParentLink,
  requestParentLink,
  unlinkParent,
} from './parentLinkService';

/**
 * PARENT-LIEN — DEUX LISTES, UNE PAR CÔTÉ DU LIEN.
 *
 * · côté PARENT (« Mes enfants ») : les comptes de mes enfants reliés et mes demandes ;
 * · côté ENFANT (« Mon parent ») : qui est relié à mon compte, et qui le demande.
 *
 * 🧊 APRÈS UNE ÉCRITURE, ON `refetch()` — jamais seulement `invalidateQueries` : une requête en
 * veille ne relit rien sur une invalidation (même piège, même correctif que
 * `declaredChildQueries`). L'acceptation et le retrait changent aussi MON profil
 * (`parentAccount`) : on le relit avec la liste.
 */

export const PARENT_LINKS_AS_PARENT_QUERY_KEY = ['parentLinks', 'asParent'];
export const PARENT_LINKS_AS_CHILD_QUERY_KEY = ['parentLinks', 'asChild'];

/** Le profil connecté (`useGetMe`) : l'acceptation et le retrait changent son `parentAccount`. */
const ME_QUERY_KEY = ['get-me'];

/**
 * Les comptes de mes enfants reliés, et mes demandes en cours.
 * @param {object} [options] - Options react-query.
 * @returns {object} Le résultat react-query.
 */
export const useParentLinksAsParent = (options = {}) => useQuery({
  queryFn: getParentLinksAsParent,
  queryKey: PARENT_LINKS_AS_PARENT_QUERY_KEY,
  staleTime: 30 * 1000,
  ...options,
});

/**
 * Qui est relié à mon compte, et qui le demande.
 * @param {object} [options] - Options react-query.
 * @returns {object} Le résultat react-query.
 */
export const useParentLinksAsChild = (options = {}) => useQuery({
  queryFn: getParentLinksAsChild,
  queryKey: PARENT_LINKS_AS_CHILD_QUERY_KEY,
  staleTime: 30 * 1000,
  ...options,
});

/**
 * Fabrique une mutation qui relit POUR DE VRAI les listes touchées.
 * @param {(variables: any) => Promise<any>} mutationFn - Le geste serveur.
 * @param {any[][]} queryKeys - Les clefs à relire.
 * @param {object} options - Options react-query (`onSuccess` compris).
 * @returns {object} La mutation.
 */
const useLinkMutation = (mutationFn, queryKeys, options = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...rest } = options || {};

  return useMutation({
    // L'écran dit lui-même ce qui ne va pas (code serveur) : pas de second message.
    meta: { preventToastError: true },
    mutationFn,
    onSuccess: async (data, variables, context) => {
      await Promise.all(queryKeys.map((queryKey) => queryClient.refetchQueries({ queryKey })));
      onSuccess?.(data, variables, context);
    },
    ...rest,
  });
};

/**
 * Le parent demande le lien.
 * @param {object} [options] - Options react-query.
 * @returns {object} La mutation.
 */
export const useRequestParentLink = (options = {}) => useLinkMutation(
  (params) => requestParentLink(params),
  [PARENT_LINKS_AS_PARENT_QUERY_KEY],
  options,
);

/**
 * Le parent retire sa demande.
 * @param {object} [options] - Options react-query.
 * @returns {object} La mutation.
 */
export const useCancelParentLink = (options = {}) => useLinkMutation(
  (documentId) => cancelParentLink(documentId),
  [PARENT_LINKS_AS_PARENT_QUERY_KEY],
  options,
);

/**
 * L'enfant accepte.
 * @param {object} [options] - Options react-query.
 * @returns {object} La mutation.
 */
export const useAcceptParentLink = (options = {}) => useLinkMutation(
  (documentId) => acceptParentLink(documentId),
  [PARENT_LINKS_AS_CHILD_QUERY_KEY, ME_QUERY_KEY],
  options,
);

/**
 * L'enfant refuse.
 * @param {object} [options] - Options react-query.
 * @returns {object} La mutation.
 */
export const useRefuseParentLink = (options = {}) => useLinkMutation(
  (documentId) => refuseParentLink(documentId),
  [PARENT_LINKS_AS_CHILD_QUERY_KEY],
  options,
);

/**
 * L'enfant retire le lien.
 * @param {object} [options] - Options react-query.
 * @returns {object} La mutation.
 */
export const useUnlinkParent = (options = {}) => useLinkMutation(
  () => unlinkParent(),
  [PARENT_LINKS_AS_CHILD_QUERY_KEY, ME_QUERY_KEY],
  options,
);
