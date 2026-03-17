import appReducer from '@/store/appReducer';

const buildSession = (documentId, token = `${documentId}-token`) => ({
  idToken: `${documentId}-id-token`,
  token,
  user: {
    documentId,
    id: documentId,
  },
});

describe('appReducer auth session flow', () => {
  it('keeps the current auth while preparing add-account flow', () => {
    const currentSession = buildSession('session-a');
    const state = {
      activeSessionDocumentId: 'session-a',
      auth: currentSession,
      authSessions: [currentSession],
      isAddingAccount: false,
      returnSessionDocumentId: undefined,
    };

    const nextState = appReducer(state, { type: 'PREPARE_ADD_ACCOUNT' });

    expect(nextState.auth).toEqual(currentSession);
    expect(nextState.isAddingAccount).toBe(true);
    expect(nextState.returnSessionDocumentId).toBe('session-a');
  });

  it('restores the memorized session when add-account is cancelled', () => {
    const originalSession = buildSession('session-a');
    const otherSession = buildSession('session-b');
    const state = {
      activeSessionDocumentId: 'session-b',
      auth: otherSession,
      authSessions: [otherSession, originalSession],
      isAddingAccount: true,
      returnSessionDocumentId: 'session-a',
    };

    const nextState = appReducer(state, { type: 'CANCEL_ADD_ACCOUNT' });

    expect(nextState.activeSessionDocumentId).toBe('session-a');
    expect(nextState.auth).toEqual(originalSession);
    expect(nextState.authSessions.map((session) => session.user.documentId)).toEqual([
      'session-a',
      'session-b',
    ]);
    expect(nextState.isAddingAccount).toBe(false);
    expect(nextState.returnSessionDocumentId).toBeUndefined();
  });

  it('moves the active session to the front when switching account', () => {
    const sessionA = buildSession('session-a');
    const sessionB = buildSession('session-b');
    const state = {
      activeSessionDocumentId: 'session-a',
      auth: sessionA,
      authSessions: [sessionA, sessionB],
      isAddingAccount: false,
      returnSessionDocumentId: undefined,
    };

    const nextState = appReducer(state, {
      payload: 'session-b',
      type: 'SET_ACTIVE_SESSION',
    });

    expect(nextState.activeSessionDocumentId).toBe('session-b');
    expect(nextState.auth).toEqual(sessionB);
    expect(nextState.authSessions.map((session) => session.user.documentId)).toEqual([
      'session-b',
      'session-a',
    ]);
  });

  it('logs out only the current session and activates the next most recent one', () => {
    const sessionA = buildSession('session-a');
    const sessionB = buildSession('session-b');
    const state = {
      activeSessionDocumentId: 'session-a',
      auth: sessionA,
      authSessions: [sessionA, sessionB],
      isAddingAccount: false,
      returnSessionDocumentId: undefined,
    };

    const nextState = appReducer(state, { type: 'LOGOUT_CURRENT_SESSION' });

    expect(nextState.activeSessionDocumentId).toBe('session-b');
    expect(nextState.auth).toEqual(sessionB);
    expect(nextState.authSessions).toEqual([sessionB]);
  });
});
