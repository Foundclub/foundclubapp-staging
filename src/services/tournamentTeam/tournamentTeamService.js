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

export const inviteTournamentTeamMember = async (teamId, userId, origin = 'invited') => {
  const response = await client.post(`/tournament-teams/${teamId}/invite-member`, {
    data: { origin, userId },
  });
  return response?.data?.data || response?.data;
};

export const requestJoinTournamentTeam = async (teamId, payload = {}) => {
  const response = await client.post(`/tournament-teams/${teamId}/request-join`, {
    data: payload,
  });
  return response?.data?.data || response?.data;
};

export const respondToTournamentInvitation = async (teamId, status) => {
  const response = await client.post(`/tournament-teams/${teamId}/respond-invitation`, {
    data: { status },
  });
  return response?.data?.data || response?.data;
};

export const reviewTournamentJoinRequest = async (teamId, memberId, status) => {
  const response = await client.post(`/tournament-teams/${teamId}/review-request`, {
    data: { memberId, status },
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

export const leaveTournamentTeam = async (teamId) => {
  const response = await client.post(`/tournament-teams/${teamId}/leave`);
  return response?.data?.data || response?.data;
};

export const toggleTournamentTeamOpenRequests = async (teamId, isOpenToJoinRequests) => {
  const response = await client.post(`/tournament-teams/${teamId}/toggle-open-requests`, {
    data: { isOpenToJoinRequests },
  });
  return response?.data?.data || response?.data;
};

export const closeTournament = async (eventId) => {
  const response = await client.post(`/events/${eventId}/tournament/close`);
  return response?.data?.data || response?.data;
};

// T-INVITE (15/11/2026) — le lien d'invitation d'une équipe de tournoi (admin :
// services/tournament-team.js).
// L'aperçu est public ; fabriquer (qui gère l'équipe) et rejoindre (le joueur) exigent un compte.
/**
 * L'aperçu public d'un lien d'équipe de tournoi.
 * @param {string} code - Le code du lien.
 * @returns {Promise<any>} Le tournoi, l'équipe et l'effectif.
 */
export const previewTournamentTeamInviteLink = async (code) => {
  const response = await client.get(`/tournament-teams/invite-link/${encodeURIComponent(code)}`);
  return response?.data?.data || response?.data;
};

/**
 * Le code du lien de l'équipe (existant ou neuf) ; `renew` le change, `revoke` l'efface.
 * @param {string} teamId - L'équipe.
 * @param {{ renew?: boolean, revoke?: boolean }} [options] - Renouveler ou révoquer.
 * @returns {Promise<any>} `{ code, eventDocumentId, teamDocumentId }`.
 */
export const createTournamentTeamInviteLink = async (teamId, options = {}) => {
  const response = await client.post(`/tournament-teams/${teamId}/invite-link`, {
    data: { renew: options?.renew === true, revoke: options?.revoke === true },
  });
  return response?.data?.data || response?.data;
};

/**
 * Rejoindre l'équipe par son lien (compte connecté).
 * @param {string} code - Le code du lien.
 * @returns {Promise<any>} L'équipe rejointe.
 */
export const joinTournamentTeamByInviteLink = async (code) => {
  const response = await client.post(
    `/tournament-teams/invite-link/${encodeURIComponent(code)}/join`,
    { data: {} },
  );
  return response?.data?.data || response?.data;
};
