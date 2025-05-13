/**
 * Reducer for the global application context.
 * @type {AppReducer} appReducer
 */
export default function appReducer(state, action) {
  switch (action.type) {
    case 'DELETE_AUTHENTICATION': {
      return { ...state, auth: undefined };
    }
    case 'SET_AUTHENTICATION': {
      return { ...state, auth: action.payload };
    }
    case 'SET_CLUB_FILTERS': {
      return { ...state, clubFilters: action.payload };
    }
    case 'SET_EVENT_FILTERS': {
      return { ...state, eventFilters: action.payload };
    }
    case 'SET_FCM_TOKEN': {
      return { ...state, fcmToken: action.payload };
    }
    case 'SET_ONBOARDING_VIEWS': {
      return { ...state, onboardingViews: action.payload };
    }
    case 'SET_TEAM_FILTERS': {
      return { ...state, teamFilters: action.payload };
    }
    case 'SET_THEME': {
      return { ...state, theme: action.payload };
    }
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
}
