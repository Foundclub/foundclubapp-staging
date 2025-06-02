import { storage } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

export const USER_ROLES = /** @type {const} */({
  coach: 'Entraineur',
  new: 'Authenticated',
  player: 'Joueur',
  president: 'Dirigeant',
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
  avatar, birthdate, firstname, lastname, role, section,
}) => {
  const baseViews = (() => {
    switch (role.name) {
      case USER_ROLES.coach:
        return [
          { canShow: true, index: 1, route: RouteNames.UserName },
          { canShow: true, index: 2, route: RouteNames.UserBirthdate },
          { canShow: true, index: 3, route: RouteNames.UserAvatar },
          { canShow: true, index: 4, route: RouteNames.Welcome },
        ];
      case USER_ROLES.player:
        return [
          { canShow: true, index: 1, route: RouteNames.UserName },
          { canShow: true, index: 2, route: RouteNames.UserSection },
          { canShow: true, index: 3, route: RouteNames.UserBirthdate },
          { canShow: true, index: 4, route: RouteNames.UserAvatar },
          { canShow: true, index: 5, route: RouteNames.Welcome },
        ];
      case USER_ROLES.president:
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
          { canShow: true, index: 5, route: RouteNames.UserAvatar },
          { canShow: true, index: 6, route: RouteNames.Welcome },
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
    if (view.route === RouteNames.UserAvatar && avatar) {
      return Object.assign(view, { canShow: false });
    }
    if (view.route === RouteNames.UserRole && role.name !== 'Authenticated') {
      return Object.assign(view, { canShow: false });
    }
    return view;
  });

  const views = filteredViews?.filter((view) => view.canShow)?.length > 1 ? filteredViews
    : [];
  return {
    totalViews,
    views,
  };
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
        'avatar',
      ];
    case USER_ROLES.player:
      return [
        'firstname',
        'lastname',
        'birthdate',
        'avatar',
        'section',
        'height',
        'weight',
        'position',
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
        'avatar',
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

  // Messages
  NEW_TEAM_MESSAGE: 'newTeamMessage',
  NEW_TEAM_PLAYER_MESSAGE: 'newTeamPlayerMessage',
  NEW_WHISPER: 'newWhisper',
};
