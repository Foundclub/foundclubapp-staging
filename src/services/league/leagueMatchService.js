import client from '@/services/client';

/**
 * Confirm participation for a match
 * @param {string} matchId - The match documentId
 * @param {'a' | 'b'} teamSide - Which team the user is part of
 */
export const confirmParticipation = async (matchId, teamSide) => {
  const response = await client.post(`/league-matches/${matchId}/confirm-participation`, {
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
  const response = await client.post(`/league-matches/${matchId}/decline-participation`, {
    teamSide,
  });
  return response.data;
};

/**
 * Mark venue as booked (captain only)
 * @param {string} matchId - The match documentId
 */
export const markVenueBooked = async (matchId) => {
  const response = await client.post(`/league-matches/${matchId}/venue-booked`);
  return response.data;
};

/**
 * Confirm a match proposal (schedule it)
 * @param {string} matchId - The match documentId
 */
export const confirmMatch = async (matchId) => {
  const response = await client.post(`/league-matches/${matchId}/confirm`);
  return response.data;
};

/**
 * Cancel a league match
 * @param {string} matchId - The match documentId
 * @param {string} teamId - The team documentId requesting cancellation
 * @param {string} reason - Reason for cancellation (optional)
 */
export const cancelMatch = async (matchId, teamId, reason = 'captain_request') => {
  const response = await client.post(`/league-matches/${matchId}/cancel`, {
    teamId,
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
  const response = await client.post(`/league-matches/${matchId}/claim-no-show`, {
    teamId,
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
  const response = await client.get(`/league-matches/${matchId}`, {
    params: {
      populate: {
        team_a: {
          populate: ['captain', 'crest']
        },
        team_b: {
          populate: ['captain', 'crest']
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
  const response = await client.get('/league-matches', {
    params: {
      filters: {
        $or: [
          { team_a: teamId },
          { team_b: teamId }
        ],
        status: { $in: ['valid', 'cancelled', 'forfeit', 'no_show'] }
      },
      populate: ['team_a', 'team_a.crest', 'team_b', 'team_b.crest', 'winner'],
      sort: 'date:desc',
      pagination: { limit }
    }
  });

  const matches = response.data?.data || [];
  
  // Transform to a simpler format with result/opponent perspective
  return matches.map(match => {
    const isTeamA = match.team_a?.documentId === teamId || match.team_a?.id === teamId;
    const myScore = isTeamA ? match.score_a : match.score_b;
    const opponentScore = isTeamA ? match.score_b : match.score_a;
    const opponent = isTeamA ? match.team_b : match.team_a;
    
    let result = 'pending';
    if (match.status === 'valid') {
      if (myScore > opponentScore) result = 'win';
      else if (myScore < opponentScore) result = 'loss';
      else result = 'draw';
    } else if (match.status === 'forfeit' || match.status === 'no_show') {
      const winnerId = match.winner?.documentId || match.winner?.id;
      result = winnerId === teamId ? 'win' : 'loss';
    }

    return {
      id: match.documentId || match.id,
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
  const response = await client.get(`/league-matches/${matchId}`, {
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
  const response = await client.post('/matchmaking-request/rematch', {
    teamId,
    opponentTeamId,
    matchId
  });
  return response.data;
};

/**
 * Submit player goals for a match
 * @param {string} matchId - The match documentId
 * @param {Object} goals - Object mapping player documentIds to goal counts
 */
export const submitPlayerGoals = async (matchId, goals) => {
  const response = await client.put(`/league-matches/${matchId}`, {
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
 * @param {object} [proof] - Proof file (image) { uri, name, type }
 */
export const submitMatchScore = async (matchId, scoreA, scoreB, dispute = false, proof = null) => {
  const formData = new FormData();
  formData.append('data', JSON.stringify({
    score_a: scoreA,
    score_b: scoreB,
    dispute
  }));

  if (proof) {
    formData.append('files.proof', {
      uri: proof.uri,
      name: proof.name || 'proof.jpg',
      type: proof.type || 'image/jpeg',
    });
  }

  if (proof) {
      return client.post(`/league-matches/${matchId}/submit-score`, formData, {
          headers: {
              'Content-Type': 'multipart/form-data',
          },
      }).then(res => res.data);
  } else {
      const response = await client.post(`/league-matches/${matchId}/submit-score`, {
        scoreA,
        scoreB,
        dispute
      });
      return response.data;
  }
};

