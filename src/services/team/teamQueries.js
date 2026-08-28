import {
  useInfiniteQuery, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import {
  approveTeamCreation,
  getTeamById,
  getTeamDefaultComposition,
  getTeams,
  getTeamsAwaitingClubApproval,
} from './teamService';

/**
 * React Query hook to fetch teams
 * @param {{
 *   pageSize?: number;
 *   clubId?: string;
 *   playerId?: string;
 * }} [params]
 * @param {any} [options]
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult<{
 * pages: { data: Team[];
 * meta: { pagination: { page: number; pageCount: number; total: number } } }[] }>}
 */
export const useGetTeams = (params, options) => useInfiniteQuery({
  getNextPageParam: (lastPage) => {
    if (!lastPage) return undefined;
    const { meta: { pagination } } = lastPage;
    return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
  },
  queryFn: ({ pageParam = 1 }) => getTeams({ ...params, page: pageParam }),
  queryKey: buildNormalizedQueryKey('teams', params),
  ...options,
});

/**
 * LES EQUIPES DU CLUB EN ATTENTE DE VALIDATION — lot EQUIPES (Q7, 2026-08-28).
 *
 * ⚠️ Le hook vit ICI et non dans l ecran, et ce n est pas un gout : un ecran qui
 * importe `teamService` charge le client HTTP, qui exige `API_URL` — absent de
 * tout worktree — et fait tomber la SUITE ENTIERE de ses temoins (piege deja paye
 * six fois le 2026-08-20). `teamQueries` est le module que les temoins doublent.
 * @param {string} clubId L identifiant du club.
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options] Les options react-query (dont `enabled`).
 * @returns {import('@tanstack/react-query').UseQueryResult<any>} Les equipes en attente.
 */
export const useTeamsAwaitingClubApproval = (clubId, options) => useQuery({
  queryFn: () => getTeamsAwaitingClubApproval(clubId),
  queryKey: ['teams', 'awaiting-club-approval', clubId],
  ...options,
});

/**
 * VALIDER L EQUIPE CREEE PAR UN ENTRAINEUR — lot EQUIPES (Q7, 2026-08-28).
 * @returns {import('@tanstack/react-query').UseMutationResult<any, unknown, string>} La mutation.
 */
export const useApproveTeamCreation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (/** @type {string} */ teamDocumentId) => approveTeamCreation(teamDocumentId),
    onSettled: () => {
      // Les deux listes deviennent fausses au meme instant : celle des equipes
      // en attente, et celle des equipes du club (l equipe validee y entre).
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
};

/**
 * React Query hook to fetch a single team
 * @param {string} teamId
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<Team>}
 */
export const useGetTeam = (teamId, options) => useQuery({
  enabled: !!teamId,
  queryFn: () => getTeamById(teamId),
  queryKey: ['team', teamId],
  ...options,
});

/**
 * React Query hook to fetch a team's default composition template.
 * @param {string} teamId
 * @param {Omit<import('@tanstack/react-query').UseQueryOptions, 'queryKey'>} [options]
 * @returns {import('@tanstack/react-query').UseQueryResult<any>}
 */
export const useGetTeamDefaultComposition = (teamId, options) => useQuery({
  enabled: !!teamId,
  queryFn: () => getTeamDefaultComposition(teamId),
  queryKey: ['teamDefaultComposition', teamId],
  ...options,
});
