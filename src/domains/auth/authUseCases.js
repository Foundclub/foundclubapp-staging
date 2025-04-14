import { storage } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

export const USER_TYPES = /** @type {const} */({
  coach: 'Entraineur',
  new: 'new',
  player: 'Joueur',
  president: 'Dirigeant',
});

export const USER_SECTIONS = /** @type {const} */({
  female: 'female',
  male: 'male',
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
 * @returns {string[]} Array of route names representing the onboarding flow
 */
export const getOnboardingViews = ({
  avatar, birthdate, firstname, lastname, role, section,
}) => {
  const baseViews = (() => {
    switch (role.name) {
      case USER_TYPES.coach:
        return [
          RouteNames.UserName,
          RouteNames.UserSection,
          RouteNames.UserBirthdate,
          RouteNames.UserAvatar,
          RouteNames.Welcome,
        ];
      case USER_TYPES.player:
        return [
          RouteNames.UserName,
          RouteNames.UserBirthdate,
          RouteNames.UserAvatar,
          RouteNames.Welcome,
        ];
      case USER_TYPES.president:
        return [
          RouteNames.UserName,
          RouteNames.UserBirthdate,
          RouteNames.UserAvatar,
          RouteNames.Welcome,
        ];
      default:
        return [
          RouteNames.UserType,
          RouteNames.UserName,
          RouteNames.UserSection,
          RouteNames.UserBirthdate,
          RouteNames.UserAvatar,
          RouteNames.Welcome,
        ];
    }
  })();

  const filteredViews = baseViews.filter((view) => {
    if (view === RouteNames.UserName && firstname && lastname) return false;
    if (view === RouteNames.UserSection && section) return false;
    if (view === RouteNames.UserBirthdate && birthdate) return false;
    if (view === RouteNames.UserAvatar && avatar) return false;
    if (view === RouteNames.UserType && role.name !== 'Authenticated') return false;
    return true;
  });
  return filteredViews?.length > 1 ? filteredViews : [RouteNames.Home];
};

/**
 * Format input string to DD/MM/YYYY pattern
 * @param {string} value - The input value to format
 * @returns {string} - The formatted date string
 */
export const formatBirthdateToDisplay = (value) => {
  // Remove any non-digit characters
  const numbers = value.replace(/\D/g, '');

  // Apply mask as DD/MM/YYYY
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
