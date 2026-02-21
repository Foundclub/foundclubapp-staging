export const TutorialIds = /** @type {const} */ ({
  ACCOUNT_SWITCHER_MODAL: 'account_switcher_modal',
  CLUB_MEMBERSHIP_REQUESTS: 'club_membership_requests',
  EVENT_WIZARD_TYPE: 'event_wizard_type',
  FEATURED_REQUESTS: 'featured_requests',
  HISTORY_WIZARD: 'history_wizard',
  HOME_HUB: 'home_hub',
  LOGOUT_CONFIRMATION: 'logout_confirmation',
  MESSAGING: 'messaging',
  MY_TEAMS: 'my_teams',
  PLANNING: 'planning',
  PROFILE_EDIT: 'profile_edit',
  PROFILE_MAIN: 'profile_main',
  REQUESTS_DASHBOARD: 'requests_dashboard',
  SEARCH_CLUBS: 'search_clubs',
  SEARCH_EVENTS: 'search_events',
  SEARCH_RECRUITMENT: 'search_recruitment',
  SEARCH_RESERVATIONS: 'search_reservations',
  TEAM_MEMBERSHIP_REQUESTS: 'team_membership_requests',
});

export const TutorialIdList = Object.freeze(Object.values(TutorialIds));

export const TUTORIAL_FLOW_PREFIX = 'fc-tutorial-v1';

/**
 * @param {string} tutorialId
 * @param {string | undefined | null} userId
 * @returns {string}
 */
export const getTutorialFlowId = (tutorialId, userId) => (
  `${TUTORIAL_FLOW_PREFIX}:${tutorialId}:${userId || 'anonymous'}`
);
