/**
 * teamInviteQueries.js — INVIT2 : les lectures de la feuille « Inviter dans l'équipe ».
 *
 * ⚠️ Montées SEULEMENT quand la feuille est ouverte (`enabled`) : la fiche
 * d'équipe s'affiche des centaines de fois sans que personne n'invite.
 */
import { useQuery } from '@tanstack/react-query';

import { getSentTeamInvites, getTeamInviteSuggestions } from './teamInviteService';

export const TEAM_INVITE_SUGGESTIONS_KEY = 'team-invite-suggestions';
export const TEAM_INVITE_SENT_KEY = 'team-invite-sent';

/**
 * Qui proposer pour cette équipe.
 * @param {string | undefined} teamId - l'équipe.
 * @param {{ enabled?: boolean }} [options] - activer la lecture.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} la requête.
 */
export const useTeamInviteSuggestions = (teamId, { enabled = true } = {}) => useQuery({
  enabled: Boolean(teamId) && enabled,
  queryFn: () => getTeamInviteSuggestions(String(teamId)),
  queryKey: [TEAM_INVITE_SUGGESTIONS_KEY, teamId],
  retry: false,
  staleTime: 30_000,
});

/**
 * Les invitations envoyées pour cette équipe.
 * @param {string | undefined} teamId - l'équipe.
 * @param {{ enabled?: boolean }} [options] - activer la lecture.
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} la requête.
 */
export const useSentTeamInvites = (teamId, { enabled = true } = {}) => useQuery({
  enabled: Boolean(teamId) && enabled,
  queryFn: () => getSentTeamInvites(String(teamId)),
  queryKey: [TEAM_INVITE_SENT_KEY, teamId],
  retry: false,
  staleTime: 15_000,
});
