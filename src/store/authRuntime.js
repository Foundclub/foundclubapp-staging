let runtimeState = {
  activeSessionDocumentId: undefined,
  auth: undefined,
  authSessions: [],
  dispatch: undefined,
  isAddingAccount: false,
  ready: false,
};

export const syncAuthRuntimeState = (state) => {
  runtimeState = {
    ...runtimeState,
    activeSessionDocumentId: state?.activeSessionDocumentId,
    auth: state?.auth,
    authSessions: Array.isArray(state?.authSessions) ? state.authSessions : [],
    isAddingAccount: Boolean(state?.isAddingAccount),
    ready: true,
  };
};

export const registerAuthRuntimeDispatch = (dispatch) => {
  runtimeState = {
    ...runtimeState,
    dispatch,
  };

  return () => {
    if (runtimeState.dispatch === dispatch) {
      runtimeState = {
        ...runtimeState,
        dispatch: undefined,
      };
    }
  };
};

export const getAuthRuntimeSnapshot = () => ({
  activeSessionDocumentId: runtimeState.activeSessionDocumentId,
  auth: runtimeState.auth,
  authSessions: runtimeState.authSessions,
  isAddingAccount: runtimeState.isAddingAccount,
  ready: runtimeState.ready,
});

export const dispatchAuthRuntimeAction = (action) => {
  if (typeof runtimeState.dispatch !== 'function') {
    return false;
  }

  runtimeState.dispatch(action);
  return true;
};

export const resetAuthRuntimeForTests = () => {
  runtimeState = {
    activeSessionDocumentId: undefined,
    auth: undefined,
    authSessions: [],
    dispatch: undefined,
    isAddingAccount: false,
    ready: false,
  };
};
