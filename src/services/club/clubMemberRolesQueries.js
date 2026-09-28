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
 * ROLES2 (recette du 2026-09-28) — le délai de la SECONDE relecture du profil.
 *
 * Chaque réplica du serveur garde 5 s en mémoire le numéro de version du profil
 * (`VERSION_CACHE_TTL_MS`, admin/src/utils/runtime-cache-version-store.js) : une
 * relecture qui tombe sur un autre réplica dans cette fenêtre rend encore l'ancien
 * profil. 6 s = la fenêtre, plus une marge.
 */
export const PROFILE_RELOAD_AFTER_ROLE_CHANGE_MS = 6000;

/** Les deux sources du profil du lecteur (`useAuth` : `get-me` puis le bootstrap). */
const PROFILE_QUERY_KEYS = Object.freeze([['app-bootstrap'], ['get-me']]);

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
      if (!result?.changed) return;
      invalidateAfterAction(queryClient, 'membershipChanged').catch(() => {});
      // ROLES2 — c'est MON rôle qui a changé (« Je joue en… ») : le bandeau du mode
      // joueur dépend de mon `myTeams`. Une seconde relecture du PROFIL, au-delà de
      // la fenêtre de 5 s entre réplicas ; le `queryClient` survit au démontage.
      if (result?.member?.isSelf) {
        setTimeout(() => {
          PROFILE_QUERY_KEYS.forEach((queryKey) => {
            queryClient.invalidateQueries({ queryKey }).catch(() => {});
          });
        }, PROFILE_RELOAD_AFTER_ROLE_CHANGE_MS);
      }
    },
  });
};
