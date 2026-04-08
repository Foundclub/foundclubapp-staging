import client from '@/services/client';

export const getTournamentTeamById = async (documentId) => {
  const response = await client.get(`/tournament-teams/${documentId}`);
  return response?.data?.data || response?.data;
};

export const registerClubTeamToTournament = async (eventId, sourceTeamId) => {
  const response = await client.post(`/events/${eventId}/tournament/register-club-team`, {
    data: { sourceTeamId },
  });
  return response?.data?.data || response?.data;
};

export const createCustomTournamentTeam = async (eventId, payload) => {
  const response = await client.post(`/events/${eventId}/tournament/create-team`, {
    data: payload,
  });
  return response?.data?.data || response?.data;
};

export const respondToTournamentTeam = async (teamId, responseStatus) => {
  const response = await client.post(`/tournament-teams/${teamId}/respond`, {
    data: { responseStatus },
  });
  return response?.data?.data || response?.data;
};

export const reviewTournamentTeamRegistration = async (teamId, status) => {
  const response = await client.post(`/tournament-teams/${teamId}/review`, {
    data: { status },
  });
  return response?.data?.data || response?.data;
};

export const addTournamentTeamMember = async (teamId, userId, origin = 'invited') => {
  const response = await client.post(`/tournament-teams/${teamId}/add-member`, {
    data: { origin, userId },
  });
  return response?.data?.data || response?.data;
};

export const removeTournamentTeamMember = async (teamId, memberId, reason = '') => {
  const response = await client.post(`/tournament-teams/${teamId}/remove-member`, {
    data: { memberId, reason },
  });
  return response?.data?.data || response?.data;
};

export const transferTournamentTeamCaptain = async (teamId, memberId) => {
  const response = await client.post(`/tournament-teams/${teamId}/transfer-captain`, {
    data: { memberId },
  });
  return response?.data?.data || response?.data;
};
