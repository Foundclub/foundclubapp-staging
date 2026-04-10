import { useQuery } from '@tanstack/react-query';

import {
  getTournamentDashboard,
  getTournamentMatchById,
} from './tournamentCompetitionService';

export const useGetTournamentDashboard = (eventId, options = {}) => useQuery({
  enabled: Boolean(eventId),
  queryFn: () => getTournamentDashboard(eventId),
  queryKey: ['tournament-dashboard', eventId],
  staleTime: 15_000,
  ...options,
});

export const useGetTournamentMatch = (matchId, options = {}) => useQuery({
  enabled: Boolean(matchId),
  queryFn: () => getTournamentMatchById(matchId),
  queryKey: ['tournament-match', matchId],
  staleTime: 15_000,
  ...options,
});
