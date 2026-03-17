import { sanitizeUser } from '@/domains/auth/authSanitizer';

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

const buildSessionState = (state, sessions, activeSessionDocumentId, overrides = {}) => {
  const orderedSessions = orderSessionsByActive(sessions, activeSessionDocumentId);
  const resolvedActiveSession = orderedSessions[0];
  const resolvedActiveDocumentId = getSessionDocumentId(resolvedActiveSession);

  return {
    ...state,
    ...overrides,
    activeSessionDocumentId: resolvedActiveDocumentId,
    auth: resolvedActiveSession,
    authSessions: orderedSessions,
  };
};

/**
 * Reducer for the global application context.
 * @type {AppReducer} appReducer
 */
export default function appReducer(state, action) {
  switch (action.type) {
    case 'CANCEL_ADD_ACCOUNT': {
      const targetDocumentId = normalizeDocumentId(state.returnSessionDocumentId)
        || normalizeDocumentId(state.activeSessionDocumentId)
        || getSessionDocumentId(state.auth);
      const matchingSession = (state.authSessions || []).find(
        (session) => getSessionDocumentId(session) === targetDocumentId,
      );

      if (!matchingSession) {
        return {
          ...state,
          isAddingAccount: false,
          returnSessionDocumentId: undefined,
        };
      }

      return {
        ...state,
        activeSessionDocumentId: getSessionDocumentId(matchingSession),
        auth: matchingSession,
        authSessions: orderSessionsByActive(state.authSessions || [], getSessionDocumentId(matchingSession)),
        isAddingAccount: false,
        returnSessionDocumentId: undefined,
      };
    }
    case 'DELETE_AUTHENTICATION': {
      const currentDocumentId = normalizeDocumentId(state.activeSessionDocumentId)
        || getSessionDocumentId(state.auth);
      const remainingSessions = (state.authSessions || []).filter(
        (session) => getSessionDocumentId(session) !== currentDocumentId,
      );

      return buildSessionState(state, remainingSessions, getSessionDocumentId(remainingSessions[0]), {
        isAddingAccount: false,
        returnSessionDocumentId: undefined,
      });
    }
    case 'LOGOUT_CURRENT_SESSION': {
      const currentDocumentId = normalizeDocumentId(state.activeSessionDocumentId)
        || getSessionDocumentId(state.auth);
      const remainingSessions = (state.authSessions || []).filter(
        (session) => getSessionDocumentId(session) !== currentDocumentId,
      );

      return buildSessionState(state, remainingSessions, getSessionDocumentId(remainingSessions[0]), {
        isAddingAccount: false,
        returnSessionDocumentId: undefined,
      });
    }
    case 'PREPARE_ADD_ACCOUNT': {
      return {
        ...state,
        isAddingAccount: true,
        returnSessionDocumentId: normalizeDocumentId(state.activeSessionDocumentId)
          || getSessionDocumentId(state.auth),
      };
    }
    case 'REMOVE_SESSION_BY_DOCUMENT_ID': {
      const targetDocumentId = normalizeDocumentId(
        typeof action.payload === 'string' ? action.payload : action.payload?.documentId,
      );
      if (!targetDocumentId) {
        return state;
      }

      const remainingSessions = (state.authSessions || []).filter(
        (session) => getSessionDocumentId(session) !== targetDocumentId,
      );
      const nextActiveDocumentId = targetDocumentId === normalizeDocumentId(state.activeSessionDocumentId)
        ? getSessionDocumentId(remainingSessions[0])
        : normalizeDocumentId(state.activeSessionDocumentId);

      return buildSessionState(state, remainingSessions, nextActiveDocumentId, {
        returnSessionDocumentId: targetDocumentId === normalizeDocumentId(state.returnSessionDocumentId)
          ? undefined
          : state.returnSessionDocumentId,
      });
    }
    case 'SET_ACTIVE_SESSION':
    case 'SWITCH_ACCOUNT': {
      const targetDocumentId = normalizeDocumentId(
        typeof action.payload === 'string'
          ? action.payload
          : action.payload?.documentId || action.payload?.user?.documentId,
      );
      if (!targetDocumentId) {
        return state;
      }

      const targetSession = (state.authSessions || []).find(
        (session) => getSessionDocumentId(session) === targetDocumentId,
      );
      if (!targetSession) {
        return state;
      }

      return {
        ...state,
        activeSessionDocumentId: targetDocumentId,
        auth: targetSession,
        authSessions: orderSessionsByActive(state.authSessions || [], targetDocumentId),
      };
    }
    case 'SET_AUTHENTICATION': {
      const newAuth = action.payload;

      // Sanitize user object to prevent storage overflow (RangeError) with multiple accounts
      // We only keep fields necessary for session switching display and basic auth
      let sanitizedAuth = newAuth;
      if (newAuth?.user) {
        sanitizedAuth = {
          idToken: newAuth.idToken,
          token: newAuth.token,
          // We exclude idUser (Firebase SDK Object) as it is not serializable/useful in storage
          user: sanitizeUser(newAuth.user),
        };
      }

      // When logging in, add to sessions if not already present, or update if present
      const newSessions = [...(state.authSessions || [])];
      const nextActiveDocumentId = getSessionDocumentId(sanitizedAuth);

      if (!nextActiveDocumentId) {
        return {
          ...state,
          auth: sanitizedAuth,
          isAddingAccount: false,
          returnSessionDocumentId: undefined,
        };
      }

      // Check if session already exists for this user
      const existingIndex = newSessions.findIndex(
        (session) => getSessionDocumentId(session) === nextActiveDocumentId,
      );

      if (existingIndex >= 0) {
        newSessions[existingIndex] = sanitizedAuth;
      } else if (sanitizedAuth?.user) {
        newSessions.push(sanitizedAuth);
      }

      return buildSessionState(state, newSessions, nextActiveDocumentId, {
        isAddingAccount: false,
        returnSessionDocumentId: undefined,
      });
    }
    case 'SET_CLUB_FILTERS': {
      return { ...state, clubFilters: action.payload };
    }
    case 'SET_EVENT_FILTERS': {
      return { ...state, eventFilters: action.payload };
    }
    case 'SET_FCM_TOKEN': {
      const token = typeof action.payload === 'string' ? action.payload.trim() : '';
      const safeToken = token.length > 0 && token.length <= 8192 ? token : undefined;
      return { ...state, fcmToken: safeToken };
    }
    case 'SET_MERCATO_FILTERS': {
      return { ...state, mercatoFilters: action.payload };
    }
    case 'SET_ONBOARDING_VIEWS': {
      return { ...state, onboardingViews: action.payload };
    }
    case 'SET_PENDING_NOTIFICATION': {
      return { ...state, pendingNotification: action.payload };
    }
    case 'SET_RESERVATION_FILTERS': {
      return { ...state, reservationFilters: action.payload };
    }
    case 'SET_SQUAD_FILTERS': {
      return { ...state, squadFilters: action.payload };
    }
    case 'SET_TEAM_FILTERS': {
      return { ...state, teamFilters: action.payload };
    }
    case 'SET_THEME': {
      return { ...state, theme: action.payload };
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
      const newSessions = (state.authSessions || []).map((session) => {
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
        activeSessionDocumentId: normalizeDocumentId(state.activeSessionDocumentId)
          || getSessionDocumentId(newAuth),
        auth: newAuth,
        authSessions: newSessions,
      };
    }
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
}
