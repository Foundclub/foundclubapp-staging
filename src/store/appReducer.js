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
        const {
          documentId, id, email, firstname, lastname, phoneNumber, role, avatar
        } = newAuth.user;
        
        // Sanitize role to avoid large permissions arrays
        const sanitizedRole = role ? {
            id: role.id,
            documentId: role.documentId,
            name: role.name,
            type: role.type,
        } : role;

        sanitizedAuth = {
          token: newAuth.token,
          idToken: newAuth.idToken,
          // We exclude idUser (Firebase SDK Object) as it is not serializable/useful in storage
          user: {
            documentId, id, email, firstname, lastname, phoneNumber, role: sanitizedRole, avatar
          },
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
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
}
