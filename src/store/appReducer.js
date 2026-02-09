import { sanitizeUser } from '@/domains/auth/authUseCases';

/**
 * Reducer for the global application context.
 * @type {AppReducer} appReducer
 */
export default function appReducer(state, action) {
  switch (action.type) {
    case 'DELETE_AUTHENTICATION': {
      // Remove current session from sessions list
      const currentAuth = state.auth;
      const newSessions = (state.authSessions || []).filter(s => s?.user?.documentId && s.user.documentId !== currentAuth?.user?.documentId);

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
      
      // Sanitize user object to prevent storage overflow (RangeError) with multiple accounts
      // We only keep fields necessary for session switching display and basic auth
      let sanitizedAuth = newAuth;
      if (newAuth?.user) {
        sanitizedAuth = {
          token: newAuth.token,
          idToken: newAuth.idToken,
          // We exclude idUser (Firebase SDK Object) as it is not serializable/useful in storage
          user: sanitizeUser(newAuth.user),
        };
      }

      console.log('[appReducer] SET_AUTHENTICATION payload:', JSON.stringify(sanitizedAuth?.user?.documentId || 'NO_USER'));
      // When logging in, add to sessions if not already present, or update if present
      let newSessions = [...(state.authSessions || [])];
      console.log('[appReducer] Current sessions count:', newSessions.length);

      // Check if session already exists for this user
      const existingIndex = newSessions.findIndex(s => s.user?.documentId === sanitizedAuth?.user?.documentId);

      if (existingIndex >= 0) {
        newSessions[existingIndex] = sanitizedAuth;
        console.log('[appReducer] Updated existing session at index:', existingIndex);
      } else if (sanitizedAuth?.user) {
        newSessions.push(sanitizedAuth);
        console.log('[appReducer] Added new session, new count:', newSessions.length);
      }

      return {
        ...state,
        auth: sanitizedAuth,
        authSessions: newSessions,
        isAddingAccount: false,
      };
    }
    case 'CANCEL_ADD_ACCOUNT': {
      console.log('[appReducer] CANCEL_ADD_ACCOUNT dispatched. Setting isAddingAccount to false.');
      return {
        ...state,
        isAddingAccount: false,
      };
    }
    case 'UPDATE_USER_DATA': {
      const updatedUserData = action.payload;
      if (!updatedUserData?.documentId) return state;

      // Sanitize user object similar to SET_AUTHENTICATION
      const sanitizedUser = sanitizeUser(updatedUserData);

      // Update auth if it matches current user
      let newAuth = state.auth;
      if (state.auth?.user?.documentId === sanitizedUser.documentId) {
        newAuth = {
          ...state.auth,
          user: sanitizedUser,
        };
      }

      // Update session in authSessions
      const newSessions = (state.authSessions || []).map(session => {
        if (session?.user?.documentId === sanitizedUser.documentId) {
          return {
            ...session,
            user: sanitizedUser,
          };
        }
        return session;
      });

      return {
        ...state,
        auth: newAuth,
        authSessions: newSessions,
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
      console.log('[appReducer] PREPARE_ADD_ACCOUNT dispatched. Setting isAddingAccount to true, clearing auth temporarily.');
      return {
        ...state,
        auth: undefined, // Clear auth so PublicNavigator shows
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
    case 'SET_PENDING_NOTIFICATION': {
      return { ...state, pendingNotification: action.payload };
    }
    case 'SET_SQUAD_FILTERS': {
      return { ...state, squadFilters: action.payload };
    }
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
}
