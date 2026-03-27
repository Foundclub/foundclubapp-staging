import client from '@/services/client';

const unwrapResponse = (response) => response?.data?.data || response?.data;

/**
 * @param {string} eventId
 * @param {string | undefined} teamId
 * @returns {Promise<any>}
 */
export const getEventMatchResult = async (eventId, teamId) => {
  const response = await client.get(`/events/${eventId}/match-result`, {
    params: teamId ? { teamId } : undefined,
  });
  return unwrapResponse(response);
};

/**
 * @param {string} eventId
 * @param {{ teamId?: string, scoreFor: number, scoreAgainst: number }} payload
 * @returns {Promise<any>}
 */
export const saveEventMatchResult = async (eventId, payload) => {
  const response = await client.put(`/events/${eventId}/match-result`, {
    data: {
      scoreAgainst: payload?.scoreAgainst,
      scoreFor: payload?.scoreFor,
      teamId: payload?.teamId || null,
    },
  });
  return unwrapResponse(response);
};

/**
 * @param {string} eventId
 * @param {string | undefined} teamId
 * @returns {Promise<any>}
 */
export const getEventMatchStats = async (eventId, teamId) => {
  const response = await client.get(`/events/${eventId}/match-stats`, {
    params: teamId ? { teamId } : undefined,
  });
  return unwrapResponse(response);
};

/**
 * @param {string} eventId
 * @param {string | undefined} teamId
 * @returns {Promise<any>}
 */
export const getEventMyMatchResponse = async (eventId, teamId) => {
  const response = await client.get(`/events/${eventId}/my-match-response`, {
    params: teamId ? { teamId } : undefined,
  });
  return unwrapResponse(response);
};

/**
 * @param {string} eventId
 * @param {Record<string, any>} payload
 * @returns {Promise<any>}
 */
export const saveEventMyMatchResponse = async (eventId, payload) => {
  const response = await client.post(`/events/${eventId}/my-match-response`, {
    data: {
      ...payload,
      teamId: payload?.teamId || null,
    },
  });
  return unwrapResponse(response);
};

/**
 * @param {string} eventId
 * @param {{ teamId?: string, scoreFor?: number, scoreAgainst?: number, playerLines?: any[] }} payload
 * @returns {Promise<any>}
 */
export const saveEventMatchStatsDraft = async (eventId, payload) => {
  const response = await client.post(`/events/${eventId}/match-stats/draft`, {
    data: {
      playerLines: Array.isArray(payload?.playerLines) ? payload.playerLines : [],
      scoreAgainst: payload?.scoreAgainst,
      scoreFor: payload?.scoreFor,
      teamId: payload?.teamId || null,
    },
  });
  return unwrapResponse(response);
};

/**
 * @param {string} eventId
 * @param {{ teamId?: string, scoreFor?: number, scoreAgainst?: number, playerLines?: any[] }} payload
 * @returns {Promise<any>}
 */
export const submitEventMatchStats = async (eventId, payload) => {
  const response = await client.post(`/events/${eventId}/match-stats/submit`, {
    data: {
      playerLines: Array.isArray(payload?.playerLines) ? payload.playerLines : [],
      scoreAgainst: payload?.scoreAgainst,
      scoreFor: payload?.scoreFor,
      teamId: payload?.teamId || null,
    },
  });
  return unwrapResponse(response);
};

/**
 * @param {string} matchId
 * @param {string | undefined} teamId
 * @returns {Promise<any>}
 */
export const getLeagueMatchStats = async (matchId, teamId) => {
  const response = await client.get(`/league-matches/${matchId}/match-stats`, {
    params: teamId ? { teamId } : undefined,
  });
  return unwrapResponse(response);
};

/**
 * @param {string} matchId
 * @param {string | undefined} teamId
 * @returns {Promise<any>}
 */
export const getLeagueMyMatchResponse = async (matchId, teamId) => {
  const response = await client.get(`/league-matches/${matchId}/my-match-response`, {
    params: teamId ? { teamId } : undefined,
  });
  return unwrapResponse(response);
};

/**
 * @param {string} matchId
 * @param {Record<string, any>} payload
 * @returns {Promise<any>}
 */
export const saveLeagueMyMatchResponse = async (matchId, payload) => {
  const response = await client.post(`/league-matches/${matchId}/my-match-response`, {
    data: {
      ...payload,
      teamId: payload?.teamId || null,
    },
  });
  return unwrapResponse(response);
};

/**
 * @param {string} matchId
 * @param {{ teamId?: string, playerLines?: any[] }} payload
 * @returns {Promise<any>}
 */
export const saveLeagueMatchStatsDraft = async (matchId, payload) => {
  const response = await client.post(`/league-matches/${matchId}/match-stats/draft`, {
    data: {
      playerLines: Array.isArray(payload?.playerLines) ? payload.playerLines : [],
      teamId: payload?.teamId || null,
    },
  });
  return unwrapResponse(response);
};

/**
 * @param {string} matchId
 * @param {{ teamId?: string, playerLines?: any[] }} payload
 * @returns {Promise<any>}
 */
export const submitLeagueMatchStats = async (matchId, payload) => {
  const response = await client.post(`/league-matches/${matchId}/match-stats/submit`, {
    data: {
      playerLines: Array.isArray(payload?.playerLines) ? payload.playerLines : [],
      teamId: payload?.teamId || null,
    },
  });
  return unwrapResponse(response);
};

/**
 * @param {string} userId
 * @returns {Promise<any>}
 */
export const getPersonalStats = async (userId) => {
  const response = await client.get(`/users/${userId}/personal-stats`);
  return unwrapResponse(response);
};

/**
 * @param {string} teamId
 * @returns {Promise<any>}
 */
export const getTeamPerformanceStats = async (teamId) => {
  const response = await client.get(`/teams/${teamId}/performance-stats`);
  return unwrapResponse(response);
};

/**
 * @param {string} teamId
 * @returns {Promise<any>}
 */
export const getLeagueTeamPerformanceStats = async (teamId) => {
  const response = await client.get(`/league-teams/${teamId}/performance-stats`);
  return unwrapResponse(response);
};

/**
 * @returns {Promise<any>}
 */
export const getPendingMatchStatsPrompts = async () => {
  const response = await client.get('/firebase-auth/me/pending-match-stats');
  return unwrapResponse(response);
};
