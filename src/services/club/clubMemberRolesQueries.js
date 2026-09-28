import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { replaceMemberRow } from '@/domains/clubMemberRoles/clubMemberRoles';
import { invalidateAfterAction } from '@/domains/refresh/afterAction';

import { getClubMemberRoles, updateClubMemberRole } from './clubMemberRolesService';

/** @typedef {import('@/domains/clubMemberRoles/clubMemberRoles').MemberRoleChange} Change */

/**
 * La clé de cache de la liste des membres et rôles d'un club.
 * @param {string} clubId - Le club.
 * @returns {Array<string>} La clé.
 */
export const clubMemberRolesQueryKey = (clubId) => ['clubMemberRoles', clubId];

/**
 * LOT RÔLES — la liste des membres d'un club et leurs rôles.
 * @param {string} clubId - Le club.
 * @param {object} [options] - Options react-query.
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} La liste.
 */
export const useClubMemberRoles = (clubId, options) => useQuery({
  enabled: !!clubId,
  queryFn: () => getClubMemberRoles(clubId),
  queryKey: clubMemberRolesQueryKey(clubId),
  ...options,
});

/**
 * LOT RÔLES — donner ou retirer un rôle.
 *
 * La ligne à jour que rend le serveur remplace l'ancienne dans le cache (pas de
 * relecture du club entier). Un rôle qui change fait bouger des équipes, des
 * convocations, et — quand c'est le lecteur lui-même — son propre profil :
 * `membershipChanged` relit exactement ça (`get-me`, `teams`, `planning`…).
 * @param {string} clubId - Le club.
 * @returns {import('@tanstack/react-query').UseMutationResult<any, unknown, Change>} La mutation.
 */
export const useUpdateClubMemberRole = (clubId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (change) => updateClubMemberRole(clubId, change),
    onSuccess: (result) => {
      queryClient.setQueryData(
        clubMemberRolesQueryKey(clubId),
        (/** @type {any} */ current) => replaceMemberRow(current, result?.member),
      );
      if (result?.changed) {
        invalidateAfterAction(queryClient, 'membershipChanged').catch(() => {});
      }
    },
  });
};
