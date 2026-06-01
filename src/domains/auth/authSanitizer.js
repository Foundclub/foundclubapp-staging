const normalizeString = (/** @type {any} */ value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeIdList = (/** @type {any} */ values) => (
  Array.isArray(values)
    ? values.filter(Boolean).sort()
    : []
);

const sanitizeImageSummary = (/** @type {any} */ image) => {
  if (!image) return null;
  return {
    url: normalizeString(image?.url),
  };
};

const sanitizeEntitySummary = (/** @type {any} */ entity) => {
  if (!entity) return null;
  return {
    documentId: normalizeString(entity?.documentId),
    id: entity?.id ?? null,
    name: normalizeString(entity?.name),
  };
};

const sanitizeMultisportClubSummary = (/** @type {any} */ club) => {
  if (!club) return null;
  return {
    documentId: normalizeString(club?.documentId),
    id: club?.id ?? null,
    isCustomer: typeof club?.isCustomer === 'boolean' ? club.isCustomer : null,
    logo: sanitizeImageSummary(club?.logo),
    name: normalizeString(club?.name),
    sections: Array.isArray(club?.sections)
      ? club.sections.map(sanitizeEntitySummary).filter(Boolean)
      : [],
  };
};

const sanitizeClubSummary = (/** @type {any} */ club) => {
  if (!club) return null;
  return {
    documentId: normalizeString(club?.documentId),
    id: club?.id ?? null,
    isCustomer: typeof club?.isCustomer === 'boolean' ? club.isCustomer : null,
    logo: sanitizeImageSummary(club?.logo),
    name: normalizeString(club?.name),
    parentMultisport: sanitizeMultisportClubSummary(club?.parentMultisport),
  };
};

const sanitizeNonPartnerCoachPublishingAccess = (/** @type {any} */ access) => {
  if (!access || typeof access !== 'object') return null;
  return {
    canPublish: access?.canPublish === true,
    clubDocumentId: normalizeString(access?.clubDocumentId),
    isNonPartnerCoach: access?.isNonPartnerCoach === true,
    overrideAllowed: access?.overrideAllowed === true,
    reason: normalizeString(access?.reason),
  };
};

const sanitizeTeamSummary = (/** @type {any} */ team) => {
  if (!team) return null;
  return {
    activities: Array.isArray(team?.activities)
      ? team.activities.map(sanitizeEntitySummary).filter(Boolean)
      : [],
    category: sanitizeEntitySummary(team?.category),
    club: sanitizeClubSummary(team?.club),
    documentId: normalizeString(team?.documentId),
    externalCompetitionEligible: typeof team?.externalCompetitionEligible === 'boolean'
      ? team.externalCompetitionEligible
      : null,
    externalProvider: normalizeString(team?.externalProvider),
    externalStandingUrl: normalizeString(team?.externalStandingUrl),
    externalSyncStatus: normalizeString(team?.externalSyncStatus),
    id: team?.id ?? null,
    level: sanitizeEntitySummary(team?.level),
    name: normalizeString(team?.name),
    section: sanitizeEntitySummary(team?.section),
  };
};

const sanitizeTeamMembershipRequest = (/** @type {any} */ request) => {
  if (!request) return null;
  return {
    documentId: normalizeString(request?.documentId),
    id: request?.id ?? null,
    state: normalizeString(request?.state),
    team: sanitizeTeamSummary(request?.team),
  };
};

const sanitizeClubMembershipRequest = (/** @type {any} */ request) => {
  if (!request) return null;
  return {
    club: sanitizeClubSummary(request?.club),
    documentId: normalizeString(request?.documentId),
    id: request?.id ?? null,
    state: normalizeString(request?.state),
  };
};

const buildUserSignature = (/** @type {any} */ user) => JSON.stringify({
  address: normalizeString(user?.address),
  avatarUrl: normalizeString(user?.avatar?.url),
  bestLevel: normalizeString(user?.bestLevel),
  birthdate: normalizeString(user?.birthdate),
  category: normalizeString(user?.category),
  clubId: normalizeString(user?.club?.documentId),
  clubIsCustomer: typeof user?.club?.isCustomer === 'boolean' ? user.club.isCustomer : null,
  clubMembershipRequestIds: normalizeIdList(
    user?.clubMembershipRequests?.map((/** @type {any} */ request) => normalizeString(request?.documentId)),
  ),
  documentId: normalizeString(user?.documentId),
  firstname: normalizeString(user?.firstname),
  geohash: normalizeString(user?.geohash),
  height: user?.height ?? null,
  id: user?.id ?? null,
  isLookingForClub: typeof user?.isLookingForClub === 'boolean'
    ? user.isLookingForClub
    : null,
  lastname: normalizeString(user?.lastname),
  multisportIds: normalizeIdList(
    user?.multisportClubs?.map((/** @type {any} */ club) => normalizeString(club?.documentId)),
  ),
  myTeamIds: normalizeIdList(
    user?.myTeams?.map((/** @type {any} */ team) => normalizeString(team?.documentId)),
  ),
  nonPartnerCoachPublishingAccess: sanitizeNonPartnerCoachPublishingAccess(
    user?.nonPartnerCoachPublishingAccess,
  ),
  parentAccountDocumentId: normalizeString(user?.parentAccount?.documentId),
  parentalDeclarantUserDocumentId: normalizeString(user?.parentalDeclarantUserDocumentId),
  parentalDeclarationAccepted: user?.parentalDeclarationAccepted === true,
  parentalDeclarationAcceptedAt: normalizeString(user?.parentalDeclarationAcceptedAt),
  position: normalizeString(user?.position),
  preferredSport: normalizeString(user?.preferredSport),
  roleId: normalizeString(user?.role?.documentId) || normalizeString(user?.role?.name),
  sectionId: normalizeString(user?.section?.documentId),
  sportsHistory: normalizeString(user?.sportsHistory),
  teamMembershipRequestIds: normalizeIdList(
    user?.teamMembershipRequests?.map((/** @type {any} */ request) => normalizeString(request?.documentId)),
  ),
  trainedTeamIds: normalizeIdList(
    user?.trainedTeams?.map((/** @type {any} */ team) => normalizeString(team?.documentId)),
  ),
  weight: user?.weight ?? null,
});

/**
 * Sanitize user object to prevent storage overflow while keeping boot-critical data.
 * @param {any} user
 * @returns {any | undefined}
 */
export const sanitizeUser = (user) => {
  if (!user) return undefined;

  const sanitizedRole = user?.role ? {
    documentId: normalizeString(user.role.documentId),
    id: user.role.id ?? null,
    name: normalizeString(user.role.name),
    type: normalizeString(user.role.type),
  } : null;

  return {
    address: normalizeString(user?.address),
    avatar: sanitizeImageSummary(user?.avatar),
    bestLevel: normalizeString(user?.bestLevel),
    birthdate: normalizeString(user?.birthdate),
    category: normalizeString(user?.category),
    club: sanitizeClubSummary(user?.club),
    clubMembershipRequests: Array.isArray(user?.clubMembershipRequests)
      ? user.clubMembershipRequests.map(sanitizeClubMembershipRequest).filter(Boolean)
      : [],
    documentId: normalizeString(user?.documentId),
    email: normalizeString(user?.email),
    firstname: normalizeString(user?.firstname),
    geohash: normalizeString(user?.geohash),
    height: user?.height ?? null,
    id: user?.id ?? null,
    isLookingForClub: typeof user?.isLookingForClub === 'boolean'
      ? user.isLookingForClub
      : null,
    lastname: normalizeString(user?.lastname),
    multisportClubs: Array.isArray(user?.multisportClubs)
      ? user.multisportClubs.map(sanitizeMultisportClubSummary).filter(Boolean)
      : [],
    myTeams: Array.isArray(user?.myTeams)
      ? user.myTeams.map(sanitizeTeamSummary).filter(Boolean)
      : [],
    nonPartnerCoachPublishingAccess: sanitizeNonPartnerCoachPublishingAccess(
      user?.nonPartnerCoachPublishingAccess,
    ),
    parentAccount: user?.parentAccount
      ? { documentId: normalizeString(user.parentAccount.documentId) }
      : null,
    parentalDeclarantUserDocumentId: normalizeString(user?.parentalDeclarantUserDocumentId),
    parentalDeclarationAccepted: user?.parentalDeclarationAccepted === true,
    parentalDeclarationAcceptedAt: normalizeString(user?.parentalDeclarationAcceptedAt),
    phoneNumber: normalizeString(user?.phoneNumber),
    position: normalizeString(user?.position),
    preferredSport: normalizeString(user?.preferredSport),
    role: sanitizedRole,
    section: sanitizeEntitySummary(user?.section),
    sportsHistory: normalizeString(user?.sportsHistory),
    teamMembershipRequests: Array.isArray(user?.teamMembershipRequests)
      ? user.teamMembershipRequests.map(sanitizeTeamMembershipRequest).filter(Boolean)
      : [],
    trainedTeams: Array.isArray(user?.trainedTeams)
      ? user.trainedTeams.map(sanitizeTeamSummary).filter(Boolean)
      : [],
    weight: user?.weight ?? null,
  };
};

/**
 * @param {User | undefined | null} left
 * @param {User | undefined | null} right
 * @returns {boolean}
 */
export const haveSameSanitizedUser = (left, right) => (
  buildUserSignature(left) === buildUserSignature(right)
);

/**
 * @param {User | undefined | null} user
 * @returns {string}
 */
export const getSanitizedUserSignature = (user) => buildUserSignature(user);
