import { useQuery } from '@tanstack/react-query';

import {
  getMyTournamentInvitations,
  getMyTournamentTeams,
  getTournamentTeamById,
} from './tournamentTeamService';

export const useGetTournamentTeam = (documentId, options = {}) => useQuery({
  enabled: Boolean(documentId),
  queryFn: () => getTournamentTeamById(documentId),
  queryKey: ['tournamentTeam', documentId],
  ...options,
});

/** T-INVITATION-ACCUEIL (18/11) — la clef des invitations en attente (carte de l'accueil). */
export const MY_TOURNAMENT_INVITATIONS_KEY = Object.freeze(['tournamentInvitations', 'mine']);

/**
 * Mes invitations d'équipe de tournoi en attente.
 * @param {object} [options] - Options react-query de plus (`enabled`, `retry`, `meta`).
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} Les invitations.
 */
export const useMyTournamentInvitations = (options = {}) => useQuery({
  queryFn: getMyTournamentInvitations,
  queryKey: [...MY_TOURNAMENT_INVITATIONS_KEY],
  ...options,
});

/** ACCUEIL-TOURNOI (19/11) — la clef de mes équipes de tournoi à venir (accueil). */
export const MY_TOURNAMENT_TEAMS_KEY = Object.freeze(['tournamentTeams', 'mine']);

/**
 * Mes équipes de tournoi à venir (« Tes prochains événements »).
 * @param {object} [options] - Options react-query de plus (`enabled`, `retry`, `meta`).
 * @returns {import('@tanstack/react-query').UseQueryResult<any[]>} Les équipes.
 */
export const useMyTournamentTeams = (options = {}) => useQuery({
  queryFn: getMyTournamentTeams,
  queryKey: [...MY_TOURNAMENT_TEAMS_KEY],
  ...options,
});
