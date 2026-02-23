/**
 * Compute attendance access flags for EventDetails.
 * External accepted participants can access attendance and self-arrival.
 * @param {{
 *  canEdit: boolean;
 *  isCurrentUserParticipating: boolean;
 *  isTeamMember: boolean;
 * }} input
 * @returns {{ canAccessAttendance: boolean; canSelfMarkArrival: boolean; }}
 */
export const resolveEventAttendanceGate = ({
  canEdit,
  isCurrentUserParticipating,
  isTeamMember,
}) => {
  const canAccessAttendance = Boolean(isTeamMember || isCurrentUserParticipating);
  const canSelfMarkArrival = Boolean(!canEdit && isCurrentUserParticipating);

  return {
    canAccessAttendance,
    canSelfMarkArrival,
  };
};

export default resolveEventAttendanceGate;
