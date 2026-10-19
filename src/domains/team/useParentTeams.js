import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { getUserById } from '@/services/auth/authService';
import {
  MY_DECLARED_CHILDREN_QUERY_KEY,
  useGetMyDeclaredChildren,
} from '@/services/declaredChild/declaredChildQueries';
import {
  PARENT_LINKS_AS_PARENT_QUERY_KEY,
  useParentLinksAsParent,
} from '@/services/parentLink/parentLinkQueries';

/**
 * REC17-002 : les equipes des enfants sont un perimetre de lecture, jamais
 * une affiliation du parent comme joueur ou entraineur.
 * @param {any[]} declaredChildren Fiches sans compte.
 * @param {any[]} linkedChildren Comptes effectivement relies par l'API.
 * @param {any[]} profiles Profils correspondants, dans le meme ordre.
 * @returns {{ childrenByTeam: Record<string, string[]>, teamIds: string[] }} L'index d'affichage.
 */
export const buildParentTeamIndex = (declaredChildren = [], linkedChildren = [], profiles = []) => {
  /** @type {Record<string, string[]>} */
  const childrenByTeam = {};
  const add = (/** @type {any} */ child, /** @type {any[]} */ teams) => {
    const name = [child?.firstname, child?.lastname].filter(Boolean).join(' ').trim();
    teams.forEach((team) => {
      const id = String(team?.documentId || '').trim();
      if (!id) return;
      if (!childrenByTeam[id]) childrenByTeam[id] = [];
      if (name && !childrenByTeam[id].includes(name)) childrenByTeam[id].push(name);
    });
  };
  declaredChildren.filter((child) => !child?.account?.documentId)
    .forEach((child) => add(child, child?.team ? [child.team] : []));
  linkedChildren.forEach((child, index) => {
    const teams = profiles[index]?.myTeams;
    add(child, Array.isArray(teams) ? teams : []);
  });
  return { childrenByTeam, teamIds: Object.keys(childrenByTeam) };
};

/**
 * Relit les memes sources que « Mes enfants », uniquement en mode Parent.
 * @param {{ enabled: boolean }} options Active les lectures autorisees.
 * @returns {any} Equipes et etat des lectures, sans ecriture metier.
 */
export default function useParentTeams({ enabled }) {
  const queryClient = useQueryClient();
  const declared = /** @type {any} */ (useGetMyDeclaredChildren({ enabled }));
  const links = /** @type {any} */ (useParentLinksAsParent({ enabled }));
  /** @type {any[]} */
  const linkedChildren = enabled && Array.isArray(links.data?.children) ? links.data.children : [];
  const profiles = useQueries({
    queries: linkedChildren.filter((child) => child?.documentId).map((child) => ({
      queryFn: () => getUserById(child.documentId),
      queryKey: ['get-user-by-id', child.documentId],
    })),
  });
  const childrenWithAccounts = linkedChildren.filter((child) => child?.documentId);
  const idsKey = childrenWithAccounts.map((child) => child.documentId).join(',');
  const refetch = useCallback(async () => {
    if (!enabled) return;
    await Promise.all([
      queryClient.refetchQueries({ queryKey: MY_DECLARED_CHILDREN_QUERY_KEY }),
      queryClient.refetchQueries({ queryKey: PARENT_LINKS_AS_PARENT_QUERY_KEY }),
      ...idsKey.split(',').filter(Boolean).map((id) => queryClient.refetchQueries({
        queryKey: ['get-user-by-id', id],
      })),
    ]);
  }, [enabled, idsKey, queryClient]);
  const index = enabled ? buildParentTeamIndex(
    Array.isArray(declared.data) ? declared.data : [],
    childrenWithAccounts,
    profiles.map((profile) => profile.data),
  ) : { childrenByTeam: {}, teamIds: [] };
  return {
    ...index,
    error: enabled ? declared.error || links.error || profiles.find((profile) => profile.error)?.error : null,
    isLoading: enabled && (declared.isLoading || links.isLoading || profiles.some((profile) => profile.isLoading)),
    refetch,
  };
}
