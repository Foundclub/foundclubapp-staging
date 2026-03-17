import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useAppContext } from '@/store/appContext';

import {
  login,
  subscribeToAuthState,
} from '@/services/auth/authService';
import { isFirebaseBypassEnabled } from '@/services/auth/bypassPolicy';

import { createLogger } from '@/utils/logger/logger';

const sessionLogger = createLogger('session-manager');

/**
 * Component to handle session restoration Logic.
 * This should be placed at the root of the app, inside Providers but outside Navigation.
 */
function SessionManager() {
  const [{ activeSessionDocumentId, auth, isAddingAccount }, appDispatch] = useAppContext();
  const queryClient = useQueryClient();

  // Use ref to track adding account state and prevent race conditions
  const isAddingAccountRef = useRef(isAddingAccount);
  const activeSessionDocumentIdRef = useRef(activeSessionDocumentId);
  const authTokenRef = useRef(auth?.token);
  const hasRestoredRef = useRef(Boolean(activeSessionDocumentId || auth?.token));

  // Keep ref in sync with state
  useEffect(() => {
    isAddingAccountRef.current = isAddingAccount;
    activeSessionDocumentIdRef.current = activeSessionDocumentId;
    authTokenRef.current = auth?.token;

    if (activeSessionDocumentId || auth?.token) {
      hasRestoredRef.current = true;
    }
  }, [activeSessionDocumentId, auth?.token, isAddingAccount]);

  useEffect(() => {
    if (isFirebaseBypassEnabled()) {
      sessionLogger.debug('Bypass mode enabled, skipping session restoration');
      return undefined;
    }

    const unsubscribe = subscribeToAuthState(async (user) => {
      if (isAddingAccountRef.current) {
        sessionLogger.debug('Skipping auth subscription callback (adding account mode)');
        return;
      }
      if (activeSessionDocumentIdRef.current || authTokenRef.current || hasRestoredRef.current) {
        sessionLogger.debug('Skipping auth subscription callback (app session already resolved)', {
          activeSessionDocumentId: activeSessionDocumentIdRef.current,
          hasAuthToken: Boolean(authTokenRef.current),
        });
        return;
      }

      if (user) {
        try {
          sessionLogger.debug('Restoring session from Firebase auth state', {
            firebaseUid: user?.uid,
          });
          const data = await login({});

          queryClient.clear();
          appDispatch({
            payload: data,
            type: 'SET_AUTHENTICATION',
          });
          hasRestoredRef.current = true;
        } catch (error) {
          sessionLogger.warn('Session restoration failed', error);
        }
      }
    });

    return () => unsubscribe();
  }, [appDispatch, queryClient]);

  return null;
}

export default SessionManager;
