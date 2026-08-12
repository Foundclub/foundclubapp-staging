export const resolveClubDetailsActionMatrix = ({
  areClubMembersHidden = false,
  canContactAdmin = false,
  canEdit = false,
  canJoinClub = false,
  canLeaveClub = false,
  canPlayerSignalClubTeam = false,
  canPlayerSignalMissingTeam = false,
  canUseClubPartneringFlow = false,
  clubHasTeams = false,
  hasParentMultisportClub = false,
  isAuthenticated = false,
  isMultisportAdmin = false,
  isParentClubAdmin = false,
  isPlayerRole = false,
  isUserAlreadyAttachedToViewedClub = false,
  ownerCount = 0,
}) => {
  const showLeaveClubAction = Boolean(isAuthenticated && canLeaveClub);
  const canShowAffiliationAction = isAuthenticated && !showLeaveClubAction;

  const showPublicClaimLogin = !isAuthenticated;
  const showPlayerClubAction = Boolean(
    canShowAffiliationAction && canPlayerSignalClubTeam,
  );
  // D95 — le club existe mais personne n'y a cree d'equipe. C'est le cas NORMAL
  // (222 287 clubs sur 222 294 au 2026-08-13), pas un cas limite : le joueur doit
  // pouvoir faire venir son club au lieu de tomber sur « Je dirige ce club ».
  const showPlayerNoTeamAction = Boolean(
    canShowAffiliationAction && canPlayerSignalMissingTeam,
  );
  const showJoinClubAction = Boolean(
    canShowAffiliationAction
    && canJoinClub
    && !isUserAlreadyAttachedToViewedClub
    && !isParentClubAdmin
    && !canUseClubPartneringFlow,
  );
  const showContactAdminClaimAction = Boolean(
    canShowAffiliationAction
    && canContactAdmin
    && !hasParentMultisportClub
    && (ownerCount > 0 || areClubMembersHidden)
    && !canUseClubPartneringFlow
    && !isUserAlreadyAttachedToViewedClub,
  );
  const showClubPartneringAction = Boolean(
    canShowAffiliationAction && canUseClubPartneringFlow,
  );
  const showEmptyClubClaimAction = Boolean(
    canShowAffiliationAction
    && !isUserAlreadyAttachedToViewedClub
    && !canEdit
    && !canJoinClub
    && !canUseClubPartneringFlow
    && !areClubMembersHidden
    && ownerCount === 0
    && !isPlayerRole,
  );

  const hasPrimaryAffiliationAction = [
    showPlayerClubAction,
    showPlayerNoTeamAction,
    showJoinClubAction,
    showContactAdminClaimAction,
    showClubPartneringAction,
    showEmptyClubClaimAction,
  ].some(Boolean);

  const showClubInterestAction = Boolean(
    canShowAffiliationAction
    && !hasPrimaryAffiliationAction
    && !isUserAlreadyAttachedToViewedClub
    && clubHasTeams
    && !(hasParentMultisportClub && isMultisportAdmin),
  );

  return {
    showClubInterestAction,
    showClubPartneringAction,
    showContactAdminClaimAction,
    showEmptyClubClaimAction,
    showJoinClubAction,
    showLeaveClubAction,
    showPlayerClubAction,
    showPlayerNoTeamAction,
    showPublicClaimLogin,
  };
};
