import client from '@/services/client';

const unwrapResponse = (response) => response?.data?.data || response?.data;

export const getTournamentDashboard = async (eventId) => {
  const response = await client.get(`/events/${eventId}/tournament/dashboard`);
  return unwrapResponse(response);
};

export const setupTournamentCompetition = async (eventId, payload) => {
  const response = await client.post(`/events/${eventId}/tournament/setup-competition`, {
    data: payload,
  });
  return unwrapResponse(response);
};

export const drawTournamentGroups = async (eventId, payload = {}) => {
  const response = await client.post(`/events/${eventId}/tournament/draw-groups`, {
    data: payload,
  });
  return unwrapResponse(response);
};

export const generateTournamentMatches = async (eventId) => {
  const response = await client.post(`/events/${eventId}/tournament/generate-matches`);
  return unwrapResponse(response);
};

export const generateTournamentKnockout = async (eventId) => {
  const response = await client.post(`/events/${eventId}/tournament/generate-knockout`);
  return unwrapResponse(response);
};

export const publishTournamentCompetition = async (eventId) => {
  const response = await client.post(`/events/${eventId}/tournament/publish-competition`);
  return unwrapResponse(response);
};

export const getTournamentMatchById = async (matchId) => {
  const response = await client.get(`/tournament-matches/${matchId}`);
  return unwrapResponse(response);
};

export const scheduleTournamentMatch = async (matchId, payload) => {
  const response = await client.post(`/tournament-matches/${matchId}/schedule`, {
    data: payload,
  });
  return unwrapResponse(response);
};

export const reportTournamentMatchScore = async (matchId, payload) => {
  const response = await client.post(`/tournament-matches/${matchId}/report-score`, {
    data: payload,
  });
  return unwrapResponse(response);
};

export const validateTournamentMatchScore = async (matchId) => {
  const response = await client.post(`/tournament-matches/${matchId}/validate-score`);
  return unwrapResponse(response);
};
