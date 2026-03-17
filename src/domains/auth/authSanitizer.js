/**
 * Sanitize user object to prevent storage overflow while keeping essential data.
 * @param {User} user
 * @returns {Partial<User> | undefined}
 */
export const sanitizeUser = (user) => {
  if (!user) return undefined;

  const {
    address, avatar, bestLevel, birthdate, category, club,
    documentId, email,
    firstname,
    geohash, height,
    id,
    isLookingForClub,
    lastname,
    multisportClubs,
    myTeams,
    phoneNumber,
    position,
    preferredSport,
    role,
    section,
    teamMembershipRequests,
    trainedTeams,
    weight,
  } = user;

  const sanitizedRole = role ? {
    documentId: role.documentId,
    id: role.id,
    name: role.name,
    type: role.type,
  } : role;

  return {
    address,
    avatar,
    bestLevel,
    birthdate,
    category,
    club,
    documentId,
    email,
    firstname,
    geohash,
    height,
    id,
    isLookingForClub,
    lastname,
    multisportClubs,
    myTeams,
    phoneNumber,
    position,
    preferredSport,
    role: sanitizedRole,
    section,
    teamMembershipRequests,
    trainedTeams,
    weight,
  };
};
