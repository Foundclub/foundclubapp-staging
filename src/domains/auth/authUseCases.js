import { storage } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';
import { SPORTS_POSITIONS } from '@/constants/sportsPositions';

const SPORTS_WITH_POSITIONS = Object.keys(SPORTS_POSITIONS).map((s) => s.toLowerCase());

export const USER_ROLES = /** @type {const} */({
  coach: 'Entraineur',
  new: 'Authenticated',
  player: 'Joueur',
  president: 'Dirigeant',
  superAdmin: 'SuperAdmin',
});

export const getAuthTokens = () => {
  const storageAuthRaw = storage.getString('auth');
  let auth = null;
  try {
    auth = storageAuthRaw ? JSON.parse(storageAuthRaw) : null;
  } catch (e) {
    auth = null;
  }
  return auth;
};

/**
 * Get the onboarding view to show based on user type and existing user data
 * @param {User} params - The user data parameters
 * @returns {{totalViews: number, views: {index: number, route: string, canShow: boolean}[]}}
 */
export const getOnboardingViews = ({
  avatar, birthdate, firstname, lastname, role, section, documentId,
  preferredSport, position, height, weight, bestLevel, category, sportsHistory, isLookingForClub,
  address,
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

  const baseViews = (() => {
    switch (roleName) {
      case USER_ROLES.coach:
        return [
          { canShow: true, index: 1, route: RouteNames.UserName },
          { canShow: true, index: 2, route: RouteNames.UserBirthdate },
          { canShow: true, index: 3, route: RouteNames.UserAddress },
          { canShow: true, index: 4, route: RouteNames.UserAvatar },
        ];
      case USER_ROLES.player:
        return [
          { canShow: true, index: 1, route: RouteNames.UserName },
          { canShow: true, index: 2, route: RouteNames.UserSection },
          { canShow: true, index: 3, route: RouteNames.UserBirthdate },
          { canShow: true, index: 4, route: RouteNames.UserAddress },
          { canShow: true, index: 5, route: RouteNames.UserAvatar },
          // Optional steps for players
          { canShow: true, index: 6, route: RouteNames.UserSport },
          { canShow: true, index: 7, route: RouteNames.UserPosition },
          { canShow: true, index: 8, route: RouteNames.UserPhysique },
          { canShow: true, index: 9, route: RouteNames.UserLevel },
          { canShow: true, index: 10, route: RouteNames.UserCategory },
          { canShow: true, index: 11, route: RouteNames.UserSportHistory },
          { canShow: true, index: 12, route: RouteNames.UserClubSearch },
        ];
      case USER_ROLES.president:
      case USER_ROLES.superAdmin:
        return [
          { canShow: true, index: 1, route: RouteNames.UserName },
          { canShow: true, index: 2, route: RouteNames.UserAvatar },
        ];
      default:
        return [
          { canShow: true, index: 1, route: RouteNames.UserRole },
          { canShow: true, index: 2, route: RouteNames.UserName },
          { canShow: true, index: 3, route: RouteNames.UserSection },
          { canShow: true, index: 4, route: RouteNames.UserBirthdate },
          { canShow: true, index: 5, route: RouteNames.UserAddress },
          { canShow: true, index: 6, route: RouteNames.UserAvatar },
          // Optional steps (will apply if user selects player role)
          { canShow: true, index: 7, route: RouteNames.UserSport },
          { canShow: true, index: 8, route: RouteNames.UserPosition },
          { canShow: true, index: 9, route: RouteNames.UserPhysique },
          { canShow: true, index: 10, route: RouteNames.UserLevel },
          { canShow: true, index: 11, route: RouteNames.UserCategory },
          { canShow: true, index: 12, route: RouteNames.UserSportHistory },
          { canShow: true, index: 13, route: RouteNames.UserClubSearch },
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
    // Skip position if sport doesn't have positions (only football, basketball, handball, volleyball, rugby have positions)
    if (view.route === RouteNames.UserPosition) {
      if (position) {
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
    if (view.route === RouteNames.UserClubSearch && isLookingForClub !== undefined && isLookingForClub !== null) {
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
  switch (role.name) {
    case USER_ROLES.coach:
      return [
        'firstname',
        'lastname',
        'birthdate',
        'address',
        'avatar',
      ];
    case USER_ROLES.player:
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
    case USER_ROLES.president:
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
  CLUB_MEMBERSHIP_REQUEST: 'clubMembershipRequest',
  CLUB_REQUEST: 'clubRequest',

  // Teams
  NEW_TEAM: 'newTeam',
  TEAM_MEMBERSHIP_REQUEST: 'teamMembershipRequest',
  TEAM_REQUEST: 'teamRequest',

  // Events
  EVENT_CANCELLATION: 'eventCancellation',
  EVENT_REMINDER: 'eventReminder',
  NEW_PARTICIPATION: 'newParticipation',
  PARTICIPATION_REQUEST: 'participationRequest',
  FEATURED_REQUEST: 'featuredRequest',
  FEATURED_APPROVED: 'featuredApproved',
  FEATURED_REJECTED: 'featuredRejected',
  OVERBOOKING_REQUEST: 'overbookingRequest',
  RESERVATION_PLAYER_JOINED: 'reservationPlayerJoined',
  RESERVATION_SOS_ALERT: 'reservationSosAlert',
  RESERVATION_COMPLETE: 'reservationComplete',
  SEARCH_ALERT_MATCH: 'searchAlertMatch',

  // Messages
  NEW_TEAM_MESSAGE: 'newTeamMessage',
  NEW_TEAM_PLAYER_MESSAGE: 'newTeamPlayerMessage',
  NEW_WHISPER: 'newWhisper',

  // Matchmaking
  LEAGUE_MATCH_FOUND: 'leagueMatchFound',
  LEAGUE_PROPOSAL_RECEIVED: 'leagueProposalReceived',
  LEAGUE_PROPOSAL_ACCEPTED: 'leagueProposalAccepted',
  LEAGUE_VENUE_BOOKED: 'leagueVenueBooked',
  LEAGUE_SCORE_DUE: 'leagueScoreDue',
  LEAGUE_SCORE_START_INFO: 'leagueScoreStartInfo',
  LEAGUE_SCORE_END_DUE: 'leagueScoreEndDue',
  LEAGUE_SCORE_REMINDER_2H: 'leagueScoreReminder2h',
  LEAGUE_SCORE_DEADLINE_WARNING: 'leagueScoreDeadlineWarning',
  LEAGUE_SCORE_SUBMITTED_BY_OPPONENT: 'leagueScoreSubmittedByOpponent',
  LEAGUE_SCORE_DISPUTED_BY_OPPONENT: 'leagueScoreDisputedByOpponent',
  LEAGUE_SCORE_ADMIN_ESCALATED: 'leagueScoreAdminEscalated',
  LEAGUE_MATCH_VALIDATED: 'leagueMatchValidated',
  LEAGUE_MATCH_FINALIZED: 'leagueMatchFinalized',
  LEAGUE_MATCH_DISPUTED: 'leagueMatchDisputed',
  LEAGUE_SEARCH_RELAUNCH_PROMPT: 'leagueSearchRelaunchPrompt',
  LEAGUE_SQUAD_JOIN_REQUEST: 'leagueSquadJoinRequest',
  LEAGUE_AUTOMATION: 'LEAGUE_AUTOMATION',
  REMATCH_REQUEST: 'REMATCH_REQUEST',
  RSVP_ALERT: 'RSVP_ALERT',
  RECRUITMENT_APPLICATION: 'recruitment_application',
  RECRUITMENT_APPLICATION_AUTO: 'recruitment_application_auto',
  // Legacy alias kept for backward compatibility
  MATCH_FOUND: 'MATCH_FOUND',
};

/**
 * Sanitize user object to prevent storage overflow while keeping essential data
 * @param {User} user
 * @returns {Partial<User>}
 */
export const sanitizeUser = (user) => {
  if (!user) return undefined;

  const {
    documentId, id, email, firstname, lastname, phoneNumber, role, avatar, // basic
    club, // object
    myTeams, trainedTeams, // arrays of teams
    multisportClubs, // array of CMs
    teamMembershipRequests, // array of requests
    isLookingForClub,
    preferredSport,
    birthdate,
    section,
    height,
    weight,
    position,
    bestLevel,
    category,
    address,
  } = user;

  const sanitizedRole = role ? {
    id: role.id,
    documentId: role.documentId,
    name: role.name,
    type: role.type,
  } : role;

  return {
    documentId,
    id,
    email,
    firstname,
    lastname,
    phoneNumber,
    role: sanitizedRole,
    avatar,
    club,
    myTeams,
    trainedTeams,
    multisportClubs,
    teamMembershipRequests,
    isLookingForClub,
    preferredSport,
    birthdate,
    section,
    height,
    weight,
    position,
    bestLevel,
    category,
    address,
  };
};
