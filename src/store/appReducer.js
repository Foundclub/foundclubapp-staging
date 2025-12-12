/**
 * Reducer for the global application context.
 * @type {AppReducer} appReducer
 */
export default function appReducer(state, action) {
  switch (action.type) {
    case 'DELETE_AUTHENTICATION': {
      // Remove current session from sessions list
      const currentAuth = state.auth;
      const newSessions = state.authSessions.filter(s => s.user.documentId !== currentAuth?.user?.documentId);

      // If there are other sessions, switch to the next one, otherwise logout completely
      const nextSession = newSessions.length > 0 ? newSessions[0] : undefined;

      return {
        ...state,
        auth: nextSession,
        authSessions: newSessions
      };
    }
    case 'SET_AUTHENTICATION': {
      const newAuth = action.payload;
      console.log('[appReducer] SET_AUTHENTICATION payload:', JSON.stringify(newAuth?.user?.documentId || 'NO_USER'));
      // When logging in, add to sessions if not already present, or update if present
      let newSessions = [...(state.authSessions || [])];
      console.log('[appReducer] Current sessions count:', newSessions.length);

      // Check if session already exists for this user
      const existingIndex = newSessions.findIndex(s => s.user?.documentId === newAuth?.user?.documentId);

      if (existingIndex >= 0) {
        newSessions[existingIndex] = newAuth;
        console.log('[appReducer] Updated existing session at index:', existingIndex);
      } else if (newAuth?.user) {
        newSessions.push(newAuth);
        console.log('[appReducer] Added new session, new count:', newSessions.length);
      }

      return {
        ...state,
        auth: newAuth,
        authSessions: newSessions,
        isAddingAccount: false,
      };
    }
    case 'CANCEL_ADD_ACCOUNT': {
      return {
        ...state,
        isAddingAccount: false,
      };
    }
    case 'SWITCH_ACCOUNT': {
      const targetSession = action.payload;
      return {
        ...state,
        auth: targetSession
      };
    }
    case 'PREPARE_ADD_ACCOUNT': {
      return {
        ...state,
        isAddingAccount: true,
      };
    }
    case 'SET_CLUB_FILTERS': {
      return { ...state, clubFilters: action.payload };
    }
    case 'SET_EVENT_FILTERS': {
      return { ...state, eventFilters: action.payload };
    }
    case 'SET_MERCATO_FILTERS': {
      return { ...state, mercatoFilters: action.payload };
    }
    case 'SET_RESERVATION_FILTERS': {
      return { ...state, reservationFilters: action.payload };
    }
    case 'SET_FCM_TOKEN': {
      return { ...state, fcmToken: action.payload };
    }
    case 'SET_ONBOARDING_VIEWS': {
      return { ...state, onboardingViews: action.payload };
    }
    case 'SET_THEME': {
      return { ...state, theme: action.payload };
    }
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
}
