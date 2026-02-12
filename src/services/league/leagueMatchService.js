import client from '@/services/client';
import { areSameEntityId, getEntityDocumentId, requireDocumentId } from '@/utils/entityId';

/**
 * Generic partial update for a league match (proposal, metadata, etc.)
 * @param {string} matchId
 * @param {object} data
 */
export const updateMatch = async (matchId, data) => {
  const normalizedMatchId = requireDocumentId(matchId, 'match');
  const response = await client.put(`/league-matches/${normalizedMatchId}`, { data });
  return response.data;
};

/**
 * Confirm participation for a match
 * @param {string} matchId - The match documentId
 * @param {'a' | 'b'} teamSide - Which team the user is part of
 */
export const confirmParticipation = async (matchId, teamSide) => {
  const normalizedMatchId = requireDocumentId(matchId, 'match');
  const response = await client.post(`/league-matches/${normalizedMatchId}/confirm-participation`, {
    teamSide,
  });
  return response.data;
};

/**
 * Decline participation for a match
 * @param {string} matchId - The match documentId
 * @param {'a' | 'b'} teamSide - Which team the user is part of
 */
export const declineParticipation = async (matchId, teamSide) => {
  const normalizedMatchId = requireDocumentId(matchId, 'match');
  const response = await client.post(`/league-matches/${normalizedMatchId}/decline-participation`, {
    teamSide,
  });
  return response.data;
};

/**
 * Mark venue as booked (captain only)
 * @param {string} matchId - The match documentId
 */
export const markVenueBooked = async (matchId) => {
  const normalizedMatchId = requireDocumentId(matchId, 'match');
  const response = await client.post(`/league-matches/${normalizedMatchId}/venue-booked`);
  return response.data;
};

/**
 * Confirm a match proposal (schedule it)
 * @param {string} matchId - The match documentId
 */
export const confirmMatch = async (matchId) => {
  const normalizedMatchId = requireDocumentId(matchId, 'match');
  const response = await client.post(`/league-matches/${normalizedMatchId}/confirm`);
  return response.data;
};

/**
 * Cancel a league match
 * @param {string} matchId - The match documentId
 * @param {string} teamId - The team documentId requesting cancellation
 * @param {string} reason - Reason for cancellation (optional)
 */
export const cancelMatch = async (matchId, teamId, reason = 'captain_request') => {
  const normalizedMatchId = requireDocumentId(matchId, 'match');
  const normalizedTeamId = requireDocumentId(teamId, 'team');
  const response = await client.post(`/league-matches/${normalizedMatchId}/cancel`, {
    teamId: normalizedTeamId,
    reason,
  });
  return response.data;
};

/**
 * Claim no-show for a match (opponent didn't show up)
 * @param {string} matchId - The match documentId
 * @param {string} teamId - The team documentId claiming the no-show
 */
export const claimNoShow = async (matchId, teamId) => {
  const normalizedMatchId = requireDocumentId(matchId, 'match');
  const normalizedTeamId = requireDocumentId(teamId, 'team');
  const response = await client.post(`/league-matches/${normalizedMatchId}/claim-no-show`, {
    teamId: normalizedTeamId,
  });
  return response.data;
};

/**
 * Get penalty warning message based on hours until match
 * @param {number} hoursUntilMatch - Hours remaining before match
 */
export const getCancellationPenalty = (hoursUntilMatch) => {
  if (hoursUntilMatch < 24) {
    return {
      penalty: 200,
      message: "⚠️ ATTENTION: Forfait! Pénalité de -200 ELO et défaite attribuée.",
      isSevere: true,
    };
  } else if (hoursUntilMatch < 48) {
    return {
      penalty: 50,
      message: "⚠️ Pénalité de -50 ELO applicable.",
      isSevere: false,
    };
  } else {
    return {
      penalty: 0,
      message: "✅ Aucune pénalité (annulation > 48h avant le match).",
      isSevere: false,
    };
  }
};

/**
 * Fetch a single match with full details
 * @param {string} matchId - The match documentId
 */
export const fetchMatch = async (matchId) => {
  const normalizedMatchId = requireDocumentId(matchId, 'match');
  const response = await client.get(`/league-matches/${normalizedMatchId}`, {
    params: {
      populate: {
        team_a: {
          populate: ['captain', 'crest', 'roster']
        },
        team_b: {
          populate: ['captain', 'crest', 'roster']
        },
        participations_a: true,
        participations_b: true,
        chat: true,
        winner: true,
        cancelled_by: true,
      }
    }
  });
  return response.data?.data || response.data;
};

/**
 * Get match history for a team
 * @param {string} teamId - The team documentId
 * @param {number} limit - Max number of matches to return (default 10)
 */
export const getMatchHistory = async (teamId, limit = 10) => {
  const normalizedTeamId = requireDocumentId(teamId, 'team');
  const parsedNumericId = Number.parseInt(normalizedTeamId, 10);
  const isNumericTeamId = Number.isFinite(parsedNumericId) && String(parsedNumericId) === normalizedTeamId;
  const teamFilterOr = [
    { team_a: { documentId: { $eq: normalizedTeamId } } },
    { team_b: { documentId: { $eq: normalizedTeamId } } },
  ];
  if (isNumericTeamId) {
    teamFilterOr.push({ team_a: { id: { $eq: parsedNumericId } } });
    teamFilterOr.push({ team_b: { id: { $eq: parsedNumericId } } });
  }

  const response = await client.get('/league-matches', {
    params: {
      filters: {
        $and: [
          { $or: teamFilterOr },
          { status: { $in: ['valid', 'cancelled', 'forfeit', 'no_show'] } },
        ],
      },
      populate: ['team_a', 'team_a.crest', 'team_b', 'team_b.crest', 'winner'],
      sort: 'date:desc',
      pagination: { limit }
    }
  });

  const matches = response.data?.data || [];
  // Transform to a simpler format with result/opponent perspective
  return matches.map(match => {
    const isTeamA = areSameEntityId(getEntityDocumentId(match.team_a), normalizedTeamId)
      || (isNumericTeamId && areSameEntityId(match.team_a?.id, parsedNumericId));
    const myScore = isTeamA ? match.score_a : match.score_b;
    const opponentScore = isTeamA ? match.score_b : match.score_a;
    const opponent = isTeamA ? match.team_b : match.team_a;
    
    let result = 'pending';
    if (match.status === 'valid') {
      if (myScore > opponentScore) result = 'win';
      else if (myScore < opponentScore) result = 'loss';
      else result = 'draw';
    } else if (match.status === 'forfeit' || match.status === 'no_show') {
      const winnerId = getEntityDocumentId(match.winner);
      result = areSameEntityId(winnerId, normalizedTeamId) || (isNumericTeamId && areSameEntityId(match.winner?.id, parsedNumericId))
        ? 'win'
        : 'loss';
    }

    return {
      id: getEntityDocumentId(match),
      date: match.date,
      score_a: myScore,
      score_b: opponentScore,
      opponent,
      result,
      status: match.status,
      eloChange: result === 'win' ? 25 : result === 'loss' ? -25 : 0 // Approximation, real value in lifecycle
    };
  });
};

/**
 * Get a single match by ID
 * @param {string} matchId - The match documentId
 */
export const getMatch = async (matchId) => {
  const normalizedMatchId = requireDocumentId(matchId, 'match');
  const response = await client.get(`/league-matches/${normalizedMatchId}`, {
    params: {
      populate: ['team_a', 'team_a.captain', 'team_a.crest', 'team_b', 'team_b.captain', 'team_b.crest', 'winner', 'chat']
    }
  });
  return response.data?.data || response.data;
};

/**
 * Request a rematch against a specific opponent
 * @param {string} teamId - Your team documentId
 * @param {string} opponentTeamId - Opponent team documentId  
 * @param {string} matchId - Original match documentId (optional)
 */
export const requestRematch = async (teamId, opponentTeamId, matchId = null) => {
  const normalizedTeamId = requireDocumentId(teamId, 'team');
  const normalizedOpponentTeamId = requireDocumentId(opponentTeamId, 'opponentTeam');
  const normalizedMatchId = matchId ? requireDocumentId(matchId, 'match') : null;
  const response = await client.post('/matchmaking-request/rematch', {
    teamId: normalizedTeamId,
    opponentTeamId: normalizedOpponentTeamId,
    matchId: normalizedMatchId
  });
  return response.data;
};

/**
 * Submit player goals for a match
 * @param {string} matchId - The match documentId
 * @param {Object} goals - Object mapping player documentIds to goal counts
 */
export const submitPlayerGoals = async (matchId, goals) => {
  const normalizedMatchId = requireDocumentId(matchId, 'match');
  const response = await client.put(`/league-matches/${normalizedMatchId}`, {
    data: {
      player_goals: goals
    }
  });
  return response.data;
};

/**
 * Submit match score
 * @param {string} matchId - The match documentId
 * @param {number} scoreA - Score of Team A
 * @param {number} scoreB - Score of Team B
 * @param {boolean} [dispute] - Whether there is a dispute
 * @param {object} [proof] - Optional proof file (image) { uri, name, type }
 */
export const submitMatchProof = async (matchId, proof) => {
  const normalizedMatchId = requireDocumentId(matchId, 'match');
  if (!proof?.uri) {
    throw new Error('Proof file is required');
  }

  const formData = new FormData();
  formData.append('proof', {
    uri: proof.uri,
    name: proof.name || 'proof.jpg',
    type: proof.type || 'image/jpeg',
  });
  if (proof?.source) {
    formData.append('source', proof.source);
  }

  const response = await client.post(`/league-matches/${normalizedMatchId}/proof`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const submitMatchScore = async (
  matchId,
  scoreA,
  scoreB,
  dispute = false,
  proof = null,
  extras = {},
) => {
  const normalizedScoreA = Number.parseInt(scoreA, 10);
  const normalizedScoreB = Number.parseInt(scoreB, 10);

  if (Number.isNaN(normalizedScoreA) || Number.isNaN(normalizedScoreB)) {
    throw new Error('Invalid scores payload');
  }

  if (proof) {
    await submitMatchProof(matchId, proof);
  }

  const payload = {
    score_a: normalizedScoreA,
    score_b: normalizedScoreB,
    dispute: Boolean(dispute),
  };

  if (extras?.disputeType) {
    payload.dispute_type = extras.disputeType;
  }
  if (extras?.disputeComment) {
    payload.dispute_comment = extras.disputeComment;
  }

  const normalizedMatchId = requireDocumentId(matchId, 'match');
  const response = await client.post(`/league-matches/${normalizedMatchId}/submit-score`, payload);

  return response.data;
};

