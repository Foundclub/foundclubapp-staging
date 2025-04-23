import client from '../client';

/**
 * Create a new club membership request
 * @param {ClubMembershipRequest} clubMembershipRequestData
 * @returns {Promise<ClubMembershipRequest>} - The created request
 */
export const createClubMembershipRequest = async (clubMembershipRequestData) => {
  const response = await client.post('/club-membership-requests', {
    data: clubMembershipRequestData,
  });
  return response.data;
};
