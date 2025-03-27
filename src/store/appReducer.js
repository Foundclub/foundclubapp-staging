/**
 * Reducer for the global application context.
 * @type {AppReducer} appReducer
 */
export default function appReducer(state, action) {
  switch (action.type) {
    // AUTH REDUCERS
    case 'SET_AUTHENTICATION': {
      return { ...state, auth: action.payload };
    }
    case 'SET_THEME': {
      return { ...state, theme: action.payload };
    }
    case 'DELETE_AUTHENTICATION': {
      return { ...state, auth: null, fcmToken: null };
    }
    case 'SET_FCM_TOKEN': {
      return { ...state, fcmToken: action.payload };
    }
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }
}
