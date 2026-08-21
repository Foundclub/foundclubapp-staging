import client from '@/services/client';

const unwrapResponse = (response) => response?.data?.data || response?.data;

/**
 * @typedef {object} MatchStatsPayload
 * @property {any[]} [coachPlayerReviews] - Le retour du coach, joueur par joueur.
 * @property {string | null} [collectiveComment] - Son commentaire sur le collectif.
 * @property {number | null} [collectiveRating] - Sa note du collectif.
 * @property {any[]} [playerLines] - Les lignes de statistiques.
 * @property {number} [scoreAgainst] - Buts encaisses.
 * @property {number} [scoreFor] - Buts marques.
 * @property {string} [teamId] - L equipe concernee.
 */

/**
 * AC07 : le retour du coach part vraiment.
 *
 * Les quatre envois de stats recopiaient leurs clefs UNE PAR UNE et n avaient
 * jamais recopie ces trois-la. Le serveur les attendait pourtant deja
 * (`upsertReport`) : l ecran acceptait la saisie, disait « enregistre », et la
 * jetait au passage du service.
 *
 * ⚠️ On ne recopie que les clefs PRESENTES : cote serveur, un champ absent
 * conserve la valeur enregistree, tandis qu un champ a `null` l efface. Etaler
 * le payload entier ferait entrer des clefs parasites dans la charge.
 * @param {MatchStatsPayload | null | undefined} payload - La charge construite par l ecran.
 * @returns {Record<string, any>} - Les seuls champs de retour du coach presents.
 */
const pickCoachFeedback = (payload) => {
  /** @type {Record<string, any>} */
  const feedback = {};
  if (payload?.coachPlayerReviews !== undefined) {
    feedback.coachPlayerReviews = payload.coachPlayerReviews;
  }
  if (payload?.collectiveComment !== undefined) {
    feedback.collectiveComment = payload.collectiveComment;
  }
  if (payload?.collectiveRating !== undefined) {
    feedback.collectiveRating = payload.collectiveRating;
  }
  return feedback;
};

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
 * @param {MatchStatsPayload} payload
 * @returns {Promise<any>}
 */
export const saveEventMatchStatsDraft = async (eventId, payload) => {
  const response = await client.post(`/events/${eventId}/match-stats/draft`, {
    data: {
      ...pickCoachFeedback(payload),
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
 * @param {MatchStatsPayload} payload
 * @returns {Promise<any>}
 */
export const submitEventMatchStats = async (eventId, payload) => {
  const response = await client.post(`/events/${eventId}/match-stats/submit`, {
    data: {
      ...pickCoachFeedback(payload),
      playerLines: Array.isArray(payload?.playerLines) ? payload.playerLines : [],
      scoreAgainst: payload?.scoreAgainst,
      scoreFor: payload?.scoreFor,
      teamId: payload?.teamId || null,
    },
  });
  return unwrapResponse(response);
};

/**
 * Relance les joueur·se·s sans retour post-match soumis (handoff 10c).
 * @param {string} eventId
 * @param {string | null | undefined} teamId
 * @returns {Promise<{ missingCount: number, remindedCount: number } | null>}
 */
export const remindEventMatchResponses = async (eventId, teamId) => {
  const response = await client.post(`/events/${eventId}/match-stats/remind-responses`, {
    data: {
      teamId: teamId || null,
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
 * @param {MatchStatsPayload} payload
 * @returns {Promise<any>}
 */
export const saveLeagueMatchStatsDraft = async (matchId, payload) => {
  const response = await client.post(`/league-matches/${matchId}/match-stats/draft`, {
    data: {
      ...pickCoachFeedback(payload),
      playerLines: Array.isArray(payload?.playerLines) ? payload.playerLines : [],
      teamId: payload?.teamId || null,
    },
  });
  return unwrapResponse(response);
};

/**
 * @param {string} matchId
 * @param {MatchStatsPayload} payload
 * @returns {Promise<any>}
 */
export const submitLeagueMatchStats = async (matchId, payload) => {
  const response = await client.post(`/league-matches/${matchId}/match-stats/submit`, {
    data: {
      ...pickCoachFeedback(payload),
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
