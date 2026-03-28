/**
 * @param {string | null | undefined} matchId
 * @param {any} proposalData
 * @param {Record<string, any>} [existingLocation]
 * @returns {{
 *   matchUpdate: {
 *     location: Record<string, any>;
 *     proposed_time: string;
 *     proposed_venue: string;
 *   };
 *   message: {
 *     composition: Record<string, any>;
 *     message: string;
 *   };
 * }}
 */
export const buildLeagueProposalPayload = (matchId, proposalData, existingLocation = {}) => {
  const proposalStartDate = new Date(proposalData.date);
  const proposalEndDate = proposalData.endDate
    ? new Date(proposalData.endDate)
    : new Date(proposalStartDate.getTime() + (60 * 60 * 1000));
  const addressLabel = typeof proposalData?.address === 'string'
    ? proposalData.address
    : proposalData?.addressObject?.label
        || proposalData?.addressObject?.address
        || null;

  const nextLocation = {
    ...(existingLocation && typeof existingLocation === 'object' ? existingLocation : {}),
    ...(proposalData?.addressObject && typeof proposalData.addressObject === 'object'
      ? proposalData.addressObject
      : {}),
    ...(addressLabel ? { address: addressLabel, label: addressLabel } : {}),
    proposed_end_time: proposalEndDate.toISOString(),
  };

  return {
    matchUpdate: {
      location: nextLocation,
      proposed_time: proposalStartDate.toISOString(),
      proposed_venue: proposalData.venue,
    },
    message: {
      composition: {
        address: addressLabel,
        addressObject: nextLocation,
        date: proposalStartDate.toISOString(),
        endDate: proposalEndDate.toISOString(),
        matchId: matchId || '',
        status: 'pending',
        type: 'proposal',
        venue: proposalData.venue,
      },
      message: 'Nouvelle proposition de match',
    },
  };
};
