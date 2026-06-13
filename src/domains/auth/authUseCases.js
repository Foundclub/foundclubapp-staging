import { sanitizeUser } from '@/domains/auth/authSanitizer';
import { storage } from '@/store/appContext';
import {
  dispatchAuthRuntimeAction,
  getAuthRuntimeSnapshot,
} from '@/store/authRuntime';

import { RouteNames } from '@/navigation/routeNames';

import { isBirthdateUnder13 } from '@/constants/parentalDeclaration';
import { SPORTS_POSITIONS } from '@/constants/sportsPositions';

const SPORTS_WITH_POSITIONS = Object.keys(SPORTS_POSITIONS).map((s) => s.toLowerCase());

export const USER_ROLES = /** @type {const} */({
  coach: 'Entraineur',
  new: 'Authenticated',
  player: 'Joueur',
  president: 'Dirigeant',
  superAdmin: 'SuperAdmin',
});

const normalizeRoleName = (roleName) => String(roleName || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

export const getUserRoleKey = (roleName) => {
  const normalized = normalizeRoleName(roleName);

  if (!normalized || normalized === 'authenticated') return 'new';
  if (normalized.includes('super')) return 'superAdmin';
  if (
    normalized.includes('dirigeant')
    || normalized.includes('president')
    || normalized.includes('clubadmin')
  ) {
    return 'president';
  }
  if (normalized.includes('entra') || normalized.includes('coach')) return 'coach';
  if (normalized.includes('joueur') || normalized === 'player') return 'player';
  return 'new';
};

export const getManagedMultisportSectionIds = (/** @type {any} */ userData) => new Set(
  (Array.isArray(userData?.multisportClubs) ? userData.multisportClubs : [])
    .flatMap((multisportClub) => (
      Array.isArray(multisportClub?.sections) ? multisportClub.sections : []
    ))
    .map((section) => String(section?.documentId || '').trim())
    .filter(Boolean),
);

export const getActiveClubId = (/** @type {any} */ userData) => (
  String(
    userData?.club?.documentId
    || userData?.club?.id
    || userData?.clubs?.[0]?.documentId
    || userData?.clubs?.[0]?.id
    || userData?.clubAffiliations?.[0]?.club?.documentId
    || userData?.clubAffiliations?.[0]?.club?.id
    || '',
  ).trim() || null
);

export const getClubIds = (/** @type {any} */ userData) => {
  const clubIds = new Set();
  const addId = (value) => {
    const normalizedValue = String(value || '').trim();
    if (normalizedValue) {
      clubIds.add(normalizedValue);
    }
  };

  addId(userData?.club?.documentId || userData?.club?.id);
  (Array.isArray(userData?.clubs) ? userData.clubs : []).forEach((club) => {
    addId(club?.documentId || club?.id);
  });
  (Array.isArray(userData?.clubAffiliations) ? userData.clubAffiliations : []).forEach((affiliation) => {
    addId(affiliation?.club?.documentId || affiliation?.club?.id);
  });

  return [...clubIds];
};

export const hasClubAccess = (/** @type {any} */ userData, /** @type {string} */ clubId) => {
  const normalizedClubId = String(clubId || '').trim();
  if (!normalizedClubId) return false;

  if (getClubIds(userData).includes(normalizedClubId)) {
    return true;
  }

  return getManagedMultisportSectionIds(userData).has(normalizedClubId);
};

export const canUserEditClub = (/** @type {any} */ userData, /** @type {string} */ clubId) => {
  const normalizedClubId = String(clubId || '').trim();
  if (!normalizedClubId || getUserRoleKey(userData?.role?.name) !== 'president') {
    return false;
  }

  return hasClubAccess(userData, normalizedClubId);
};

export const findRoleByKey = (roles, roleNameOrKey) => {
  const expectedRoleKey = getUserRoleKey(roleNameOrKey);
  return roles?.find((role) => getUserRoleKey(role?.type || role?.name) === expectedRoleKey);
};

export const getRoleDocumentIdByKey = (roles, roleNameOrKey) => (
  findRoleByKey(roles, roleNameOrKey)?.documentId || ''
);

export const getAuthTokens = () => {
  const runtimeSnapshot = getAuthRuntimeSnapshot();
  if (runtimeSnapshot.ready) {
    if (runtimeSnapshot.isAddingAccount) {
      return null;
    }
    return runtimeSnapshot.auth || null;
  }

  const storageAuthRaw = storage.getString('auth');
  let auth = null;
  try {
    auth = storageAuthRaw ? JSON.parse(storageAuthRaw) : null;
  } catch (e) {
    auth = null;
  }
  return auth;
};

const normalizeDocumentId = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getSessionDocumentId = (session) => normalizeDocumentId(session?.user?.documentId);

const orderSessionsByActive = (sessions, activeSessionDocumentId) => {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const normalizedActiveDocumentId = normalizeDocumentId(activeSessionDocumentId);
  if (!normalizedActiveDocumentId) {
    return [...safeSessions];
  }

  const matchingSession = safeSessions.find(
    (session) => getSessionDocumentId(session) === normalizedActiveDocumentId,
  );

  if (!matchingSession) {
    return [...safeSessions];
  }

  return [
    matchingSession,
    ...safeSessions.filter((session) => getSessionDocumentId(session) !== normalizedActiveDocumentId),
  ];
};

const safeJsonParse = (rawValue, fallbackValue) => {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return fallbackValue;
  }

  try {
    return JSON.parse(rawValue);
  } catch (_error) {
    return fallbackValue;
  }
};

export const getStoredAuthSessions = () => {
  const runtimeSnapshot = getAuthRuntimeSnapshot();
  if (runtimeSnapshot.ready) {
    return Array.isArray(runtimeSnapshot.authSessions) ? runtimeSnapshot.authSessions : [];
  }

  const storedAuth = safeJsonParse(storage.getString('auth'), null);
  const storedSessions = safeJsonParse(storage.getString('authSessions'), []);
  const orderedSessions = Array.isArray(storedSessions) ? [...storedSessions] : [];
  const storedAuthDocumentId = getSessionDocumentId(storedAuth);

  if (
    storedAuthDocumentId
    && !orderedSessions.some((session) => getSessionDocumentId(session) === storedAuthDocumentId)
  ) {
    orderedSessions.push(storedAuth);
  }

  return orderedSessions.filter(Boolean);
};

export const findAuthSessionByDocumentId = (documentId) => {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!normalizedDocumentId) return null;

  return getStoredAuthSessions().find(
    (session) => getSessionDocumentId(session) === normalizedDocumentId,
  ) || null;
};

export const getActiveSessionDocumentId = () => {
  const runtimeSnapshot = getAuthRuntimeSnapshot();
  if (runtimeSnapshot.ready) {
    return normalizeDocumentId(runtimeSnapshot.activeSessionDocumentId)
      || getSessionDocumentId(runtimeSnapshot.auth);
  }

  return normalizeDocumentId(storage.getString('activeSessionDocumentId'))
    || getSessionDocumentId(safeJsonParse(storage.getString('auth'), null));
};

export const activateSessionByDocumentId = (documentId) => {
  const normalizedDocumentId = normalizeDocumentId(documentId);
  if (!normalizedDocumentId) {
    return { activated: false, reason: 'missing_document_id' };
  }

  const session = findAuthSessionByDocumentId(normalizedDocumentId);
  if (!session?.token) {
    return { activated: false, reason: 'session_not_found' };
  }

  const currentDocumentId = getActiveSessionDocumentId();
  if (currentDocumentId === normalizedDocumentId) {
    return {
      activated: true,
      session,
      switched: false,
    };
  }

  const didDispatch = dispatchAuthRuntimeAction({
    payload: normalizedDocumentId,
    type: 'SET_ACTIVE_SESSION',
  });

  if (!didDispatch) {
    const orderedSessions = orderSessionsByActive(getStoredAuthSessions(), normalizedDocumentId);
    storage.set('activeSessionDocumentId', normalizedDocumentId);
    storage.set('auth', JSON.stringify(session));
    storage.set('authSessions', JSON.stringify(orderedSessions));
  }

  return {
    activated: true,
    session,
    switched: true,
  };
};

export const activateSessionForNotificationPayload = (payload) => {
  const normalizedDocumentId = normalizeDocumentId(payload?.targetUserDocumentId);
  if (!normalizedDocumentId) {
    return { activated: false, reason: 'no_target_user' };
  }

  return activateSessionByDocumentId(normalizedDocumentId);
};

/**
 * Get the onboarding view to show based on user type and existing user data
 * @param {User} params - The user data parameters
 * @returns {{totalViews: number, views: {index: number, route: string, canShow: boolean}[]}}
 */
export const getOnboardingViews = ({
  address, avatar, bestLevel, birthdate, category, club, clubAffiliations,
  clubs, documentId, firstname, height, lastname, multisportClubs, myTeams, parentalDeclarationAccepted, position, preferredSport, role,
  section, sportsHistory, trainedTeams, weight,
}) => {
  // Check if user has already completed onboarding once
  const hasCompletedOnboarding = (() => {
    try {
      if (documentId) {
        return storage.getBoolean(`hasCompletedOnboarding_${documentId}`);
      }
      return false;
    } catch (e) { return false; }
  })();

  // If onboarding was already completed once, skip all onboarding
  if (hasCompletedOnboarding) {
    return {
      totalViews: 0,
      views: [],
    };
  }

  const roleName = role?.name || USER_ROLES.new;
  const roleKey = getUserRoleKey(roleName);
  const hasClubAffiliation = !!(club?.documentId || club?.id)
    || ((Array.isArray(clubs) ? clubs.length : 0) > 0)
    || ((Array.isArray(clubAffiliations) ? clubAffiliations.length : 0) > 0)
    || ((Array.isArray(multisportClubs) ? multisportClubs.length : 0) > 0);
  const hasTeamAffiliation = (Array.isArray(myTeams) ? myTeams.length : 0)
    + (Array.isArray(trainedTeams) ? trainedTeams.length : 0) > 0;
  const shouldShowAffiliationGuide = (() => {
    if (roleKey === 'coach' || roleKey === 'president') {
      return !hasClubAffiliation;
    }
    if (roleKey === 'player') {
      return !hasTeamAffiliation;
    }
    return false;
  })();
  const needsParentalDeclaration = Boolean(
    birthdate
    && isBirthdateUnder13(birthdate)
    && parentalDeclarationAccepted !== true,
  );

  const baseViews = (() => {
    switch (roleKey) {
      case 'coach':
        return [
          { canShow: true, index: 1, route: RouteNames.UserName },
          { canShow: true, index: 2, route: RouteNames.UserBirthdate },
          ...(needsParentalDeclaration
            ? [{ canShow: true, index: 3, route: RouteNames.UserParentalDeclaration }]
            : []),
          { canShow: true, index: needsParentalDeclaration ? 4 : 3, route: RouteNames.UserAddress },
          { canShow: true, index: needsParentalDeclaration ? 5 : 4, route: RouteNames.UserAvatar },
          {
            canShow: shouldShowAffiliationGuide,
            index: needsParentalDeclaration ? 6 : 5,
            route: RouteNames.UserAffiliationGuide,
          },
          { canShow: true, index: needsParentalDeclaration ? 7 : 6, route: RouteNames.Welcome },
        ];
      case 'player':
        return [
          { canShow: true, index: 1, route: RouteNames.UserName },
          { canShow: true, index: 2, route: RouteNames.UserSection },
          { canShow: true, index: 3, route: RouteNames.UserBirthdate },
          ...(needsParentalDeclaration
            ? [{ canShow: true, index: 4, route: RouteNames.UserParentalDeclaration }]
            : []),
          { canShow: true, index: needsParentalDeclaration ? 5 : 4, route: RouteNames.UserAddress },
          { canShow: true, index: needsParentalDeclaration ? 6 : 5, route: RouteNames.UserAvatar },
          // Optional steps for players
          { canShow: true, index: needsParentalDeclaration ? 7 : 6, route: RouteNames.UserSport },
          { canShow: true, index: needsParentalDeclaration ? 8 : 7, route: RouteNames.UserPosition },
          { canShow: true, index: needsParentalDeclaration ? 9 : 8, route: RouteNames.UserPhysique },
          { canShow: true, index: needsParentalDeclaration ? 10 : 9, route: RouteNames.UserLevel },
          { canShow: true, index: needsParentalDeclaration ? 11 : 10, route: RouteNames.UserCategory },
          { canShow: true, index: needsParentalDeclaration ? 12 : 11, route: RouteNames.UserSportHistory },
          { canShow: true, index: needsParentalDeclaration ? 13 : 12, route: RouteNames.UserClubSearch },
          {
            canShow: shouldShowAffiliationGuide,
            index: needsParentalDeclaration ? 14 : 13,
            route: RouteNames.UserAffiliationGuide,
          },
          { canShow: true, index: needsParentalDeclaration ? 15 : 14, route: RouteNames.Welcome },
        ];
      case 'president':
        return [
          { canShow: true, index: 1, route: RouteNames.UserName },
          { canShow: true, index: 2, route: RouteNames.UserAvatar },
          { canShow: shouldShowAffiliationGuide, index: 3, route: RouteNames.UserAffiliationGuide },
          { canShow: true, index: 4, route: RouteNames.Welcome },
        ];
      case 'superAdmin':
        return [
          { canShow: true, index: 1, route: RouteNames.UserName },
          { canShow: true, index: 2, route: RouteNames.UserAvatar },
          { canShow: true, index: 3, route: RouteNames.Welcome },
        ];
      default:
        return [
          { canShow: true, index: 1, route: RouteNames.UserRole },
          { canShow: true, index: 2, route: RouteNames.UserName },
          { canShow: true, index: 3, route: RouteNames.UserSection },
          { canShow: true, index: 4, route: RouteNames.UserBirthdate },
          ...(needsParentalDeclaration
            ? [{ canShow: true, index: 5, route: RouteNames.UserParentalDeclaration }]
            : []),
          { canShow: true, index: needsParentalDeclaration ? 6 : 5, route: RouteNames.UserAddress },
          { canShow: true, index: needsParentalDeclaration ? 7 : 6, route: RouteNames.UserAvatar },
          // Optional steps (will apply if user selects player role)
          { canShow: true, index: needsParentalDeclaration ? 8 : 7, route: RouteNames.UserSport },
          { canShow: true, index: needsParentalDeclaration ? 9 : 8, route: RouteNames.UserPosition },
          { canShow: true, index: needsParentalDeclaration ? 10 : 9, route: RouteNames.UserPhysique },
          { canShow: true, index: needsParentalDeclaration ? 11 : 10, route: RouteNames.UserLevel },
          { canShow: true, index: needsParentalDeclaration ? 12 : 11, route: RouteNames.UserCategory },
          { canShow: true, index: needsParentalDeclaration ? 13 : 12, route: RouteNames.UserSportHistory },
          { canShow: true, index: needsParentalDeclaration ? 14 : 13, route: RouteNames.UserClubSearch },
          { canShow: true, index: needsParentalDeclaration ? 15 : 14, route: RouteNames.Welcome },
        ];
    }
  })();
  const totalViews = baseViews.length;
  const filteredViews = baseViews.map((view) => {
    if (view.route === RouteNames.UserName && firstname && lastname) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserSection && section) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserBirthdate && birthdate) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserParentalDeclaration && !needsParentalDeclaration) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserAddress && address) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserAvatar && avatar) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserRole && roleName !== USER_ROLES.new) {
      return Object.assign(view, { canShow: false });
    }
    // Optional steps - skip if already filled
    if (view.route === RouteNames.UserSport && preferredSport) {
      return Object.assign(view, { canShow: false });
    }
    // Skip position if sport does not expose dedicated positions in the app.
    if (view.route === RouteNames.UserPosition) {
      if (position) {
        return Object.assign(view, { canShow: false });
      }
      // If user skipped preferred sport, do not show position selection.
      if (!preferredSport) {
        return Object.assign(view, { canShow: false });
      }
      // If sport is set but doesn't have positions, skip this step
      if (preferredSport && !SPORTS_WITH_POSITIONS.includes(preferredSport.toLowerCase())) {
        return Object.assign(view, { canShow: false });
      }
    }
    if (view.route === RouteNames.UserPhysique && (height || weight)) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserLevel && bestLevel) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserCategory && category) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserSportHistory && sportsHistory) {
      return Object.assign(view, { canShow: false });
    }
    return view;
  });

  const views = filteredViews?.filter((view) => view.canShow)?.length > 0 ? filteredViews
    : [];
  return {
    totalViews,
    views,
  };
};

/**
 * Mark onboarding as completed for a user
 * This should be called when the user finishes or skips the last onboarding step
 * @param {string} documentId - The user's document ID
 */
export const markOnboardingComplete = (documentId) => {
  if (documentId) {
    storage.set(`hasCompletedOnboarding_${documentId}`, true);
  }
};

/**
 * Get the fields to display in the profile based on user role
 * @param {Role} role - The user role
 * @returns {string[]} Array of field names to display
 */
export const profileFieldToDisplay = (role) => {
  switch (getUserRoleKey(role?.name)) {
    case 'coach':
      return [
        'firstname',
        'lastname',
        'birthdate',
        'address',
        'avatar',
      ];
    case 'player':
      return [
        'firstname',
        'lastname',
        'birthdate',
        'address',
        'avatar',
        'section',
        'height',
        'weight',
        'position',
        'bestLevel',
        'category',
        'preferredSport',
      ];
    case 'president':
      return [
        'firstname',
        'lastname',
        'avatar',
      ];
    default:
      return [
        'firstname',
        'lastname',
        'section',
        'birthdate',
        'address',
        'avatar',
        'bestLevel',
        'category',
        'preferredSport',
      ];
  }
};

/**
 * Format date string from YYYY-MM-DD to DD/MM/YYYY pattern
 * @param {string} value - The input value to format (expected in YYYY-MM-DD format)
 * @returns {string} - The formatted date string in DD/MM/YYYY format
 */
export const formatBirthdateToDisplay = (value) => {
  if (!value || typeof value !== 'string') return '';

  // Check if the value is in YYYY-MM-DD format
  const datePattern = /^(\d{4})-(\d{2})-(\d{2}).*$/;
  const match = value.match(datePattern);

  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  // If not in expected format, try to handle as in the original function
  const numbers = value.replace(/\D/g, '');

  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
};

/**
 * Format date string from DD/MM/YYYY to YYYY-MM-DD
 * @param {string} value - The input value to format
 * @returns {string} - The formatted date string
 */
export const formatBirthdateToSend = (value) => {
  if (!value || typeof value !== 'string') return '';

  // First, extract just the digits
  const digits = value.replace(/\D/g, '');

  // Check if we have a complete date (at least 8 digits)
  if (digits.length < 8) return '';

  // Extract day, month, year
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  // Return in ISO format
  return `${year}-${month}-${day}`;
};

export const NOTIFICATION_TYPES = {
  // Users
  ADD_TO_TEAM: 'addToTeam',

  // Clubs
  AFFILIATION_HELP_REQUEST: 'affiliationHelpRequest',
  AFFILIATION_HELP_STATUS: 'affiliationHelpStatus',
  CLUB_MEMBERSHIP_REQUEST: 'clubMembershipRequest',
  CLUB_REQUEST: 'clubRequest',

  // Teams
  NEW_TEAM: 'newTeam',
  TEAM_EXTERNAL_SOURCE_UPDATED: 'teamExternalSourceUpdated',
  TEAM_MEMBERSHIP_REQUEST: 'teamMembershipRequest',
  TEAM_REQUEST: 'teamRequest',
  TOURNAMENT_CAPTAIN_TRANSFER: 'tournamentCaptainTransfer',
  TOURNAMENT_CLOSED: 'tournamentClosed',
  TOURNAMENT_TEAM_INVITATION: 'tournamentTeamInvitation',
  TOURNAMENT_TEAM_INVITATION_STATUS: 'tournamentTeamInvitationStatus',
  TOURNAMENT_TEAM_JOIN_REQUEST: 'tournamentTeamJoinRequest',
  TOURNAMENT_TEAM_JOIN_REQUEST_STATUS: 'tournamentTeamJoinRequestStatus',
  TOURNAMENT_TEAM_ROSTER_WARNING: 'tournamentTeamRosterWarning',
  TOURNAMENT_TEAM_STATUS: 'tournamentTeamStatus',

  // Events
  CELEBRATION: 'celebration',
  COACH_REPORT_PUBLISHED: 'coachReportPublished',
  EVENT_ABSENCE_FINAL: 'eventAbsenceFinal',
  EVENT_CANCELLATION: 'eventCancellation',
  EVENT_CONVOCATION_PUBLISHED: 'eventConvocationPublished',
  EVENT_CREATED: 'eventCreated',
  EVENT_LINEUP_PUBLISH_REMINDER: 'eventLineupPublishReminder',
  EVENT_PARTICIPANT_REMINDER: 'eventParticipantReminder',
  EVENT_PUBLISHED: 'eventPublished',
  EVENT_REMINDER: 'eventReminder',
  EVENT_RSVP_STATUS_CHANGED: 'eventRsvpStatusChanged',
  EVENT_TEAM_INVITED: 'eventTeamInvited',
  EVENT_UPDATED: 'eventUpdated',
  FEATURED_APPROVED: 'featuredApproved',
  FEATURED_REJECTED: 'featuredRejected',
  FEATURED_REQUEST: 'featuredRequest',
  NEW_PARTICIPATION: 'newParticipation',
  OVERBOOKING_REQUEST: 'overbookingRequest',
  PARTICIPATION_REQUEST: 'participationRequest',
  RESERVATION_COMPLETE: 'reservationComplete',
  RESERVATION_PLAYER_JOINED: 'reservationPlayerJoined',
  RESERVATION_SOS_ALERT: 'reservationSosAlert',
  SEARCH_ALERT_MATCH: 'searchAlertMatch',
  TEAM_FIRST_EVENT_CREATED: 'teamFirstEventCreated',

  // Licences
  LICENSE_CAMPAIGN_CLOSED: 'licenseCampaignClosed',
  LICENSE_CAMPAIGN_PAUSED: 'licenseCampaignPaused',
  LICENSE_CAMPAIGN_PUBLISHED: 'licenseCampaignPublished',
  LICENSE_DOCUMENT_REPLACEMENT_REQUIRED: 'licenseDocumentReplacementRequired',
  LICENSE_DOCUMENT_SUBMITTED: 'licenseDocumentSubmitted',
  LICENSE_INSTALLMENT_OVERDUE: 'licenseInstallmentOverdue',
  LICENSE_PAYMENT_CONFIRMED: 'licensePaymentConfirmed',
  LICENSE_PAYMENT_DUE: 'licensePaymentDue',
  LICENSE_PAYMENT_REJECTED: 'licensePaymentRejected',
  LICENSE_PAYMENT_REMINDER: 'licensePaymentReminder',
  LICENSE_PAYMENT_SUBMITTED: 'licensePaymentSubmitted',

  // Messages
  NEW_GROUP_MESSAGE: 'newGroupMessage',
  NEW_LEAGUE_MATCH_MESSAGE: 'newLeagueMatchMessage',
  NEW_TEAM_MESSAGE: 'newTeamMessage',
  NEW_TEAM_PLAYER_MESSAGE: 'newTeamPlayerMessage',
  NEW_WHISPER: 'newWhisper',

  // Matchmaking
  LEAGUE_AUTOMATION: 'LEAGUE_AUTOMATION',
  LEAGUE_COUNTER_PROPOSAL_RECEIVED: 'leagueCounterProposalReceived',
  LEAGUE_MATCH_CANCELLED_NEGOTIATION_TIMEOUT: 'leagueMatchCancelledNegotiationTimeout',
  LEAGUE_MATCH_DISPUTED: 'leagueMatchDisputed',
  LEAGUE_MATCH_FINALIZED: 'leagueMatchFinalized',
  LEAGUE_MATCH_FOUND: 'leagueMatchFound',
  LEAGUE_MATCH_VALIDATED: 'leagueMatchValidated',
  LEAGUE_POST_SLOT_CANCELLED: 'leaguePostSlotCancelled',
  LEAGUE_POST_SLOT_CHECK: 'leaguePostSlotCheck',
  LEAGUE_POST_SLOT_CONFIRMATION: 'leaguePostSlotConfirmation',
  LEAGUE_POST_SLOT_RESCHEDULED: 'leaguePostSlotRescheduled',
  LEAGUE_PROPOSAL_ACCEPTED: 'leagueProposalAccepted',
  LEAGUE_PROPOSAL_DECLINED: 'leagueProposalDeclined',
  LEAGUE_PROPOSAL_RECEIVED: 'leagueProposalReceived',
  LEAGUE_QUORUM_REACHED: 'leagueQuorumReached',
  LEAGUE_QUORUM_REMINDER: 'leagueQuorumReminder',
  LEAGUE_SCORE_ADMIN_ESCALATED: 'leagueScoreAdminEscalated',
  LEAGUE_SCORE_DEADLINE_WARNING: 'leagueScoreDeadlineWarning',
  LEAGUE_SCORE_DISPUTED_BY_OPPONENT: 'leagueScoreDisputedByOpponent',
  LEAGUE_SCORE_DUE: 'leagueScoreDue',
  LEAGUE_SCORE_END_DUE: 'leagueScoreEndDue',
  LEAGUE_SCORE_REMINDER_2H: 'leagueScoreReminder2h',
  LEAGUE_SCORE_START_INFO: 'leagueScoreStartInfo',
  LEAGUE_SCORE_SUBMITTED_BY_OPPONENT: 'leagueScoreSubmittedByOpponent',
  LEAGUE_SCORE_VALIDATION_REQUIRED: 'leagueScoreValidationRequired',
  LEAGUE_SEARCH_RELAUNCH_PROMPT: 'leagueSearchRelaunchPrompt',
  LEAGUE_SEARCH_STARTED: 'leagueSearchStarted',
  LEAGUE_SEARCH_STILL_RUNNING: 'leagueSearchStillRunning',
  LEAGUE_SQUAD_INVITATION: 'leagueSquadInvitation',
  LEAGUE_SQUAD_JOIN_REQUEST: 'leagueSquadJoinRequest',
  LEAGUE_SQUAD_JOIN_REQUEST_STATUS: 'leagueSquadJoinRequestStatus',
  LEAGUE_VENUE_BOOKED: 'leagueVenueBooked',
  RECRUITMENT_APPLICATION: 'recruitment_application',
  RECRUITMENT_APPLICATION_AUTO: 'recruitment_application_auto',
  RECRUITMENT_APPLICATION_STATUS: 'recruitment_application_status',
  REMATCH_REQUEST: 'REMATCH_REQUEST',
  RSVP_ALERT: 'RSVP_ALERT',
  // Legacy alias kept for backward compatibility
  MATCH_FOUND: 'MATCH_FOUND',
};

export { sanitizeUser };
