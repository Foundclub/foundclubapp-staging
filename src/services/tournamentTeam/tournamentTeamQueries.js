import { useQuery } from '@tanstack/react-query';

import { getTournamentTeamById } from './tournamentTeamService';

export const useGetTournamentTeam = (documentId, options = {}) => useQuery({
  enabled: Boolean(documentId),
  queryFn: () => getTournamentTeamById(documentId),
  queryKey: ['tournamentTeam', documentId],
  ...options,
});
