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
  // L5-0 (vague P, 23/08) — `canEdit` ouvre la LECTURE, parce qu il ouvrait
  // deja l ECRITURE cote serveur : un dirigeant organisateur hors de l equipe
  // pouvait pointer les autres (`api::event.is-event-trainer` accepte
  // `canManageTeam`) mais recevait un 403 sur `GET /events/:id/attendance`.
  // La policy `can-access-attendance` a ete alignee ; cette grille suit.
  const canAccessAttendance = Boolean(canEdit || isTeamMember || isCurrentUserParticipating);
  // 🔒 INCHANGE, et ce n est pas un oubli : celui qui gere pointe les AUTRES,
  // il ne se pointe pas lui-meme comme joueur.
  const canSelfMarkArrival = Boolean(!canEdit && isCurrentUserParticipating);

  return {
    canAccessAttendance,
    canSelfMarkArrival,
  };
};

export default resolveEventAttendanceGate;
