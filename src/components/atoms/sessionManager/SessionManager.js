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
  const [{ auth, isAddingAccount }, appDispatch] = useAppContext();
  const queryClient = useQueryClient();

  // Use ref to track adding account state and prevent race conditions
  // This prevents the subscription from firing when isAddingAccount changes from true to false
  const isAddingAccountRef = useRef(isAddingAccount);
  const hasRestoredRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isAddingAccountRef.current = isAddingAccount;
    // When adding account is completed (goes from true to false), mark as restored
    // to prevent the subscription from overwriting the new session
    if (!isAddingAccount && hasRestoredRef.current === false && auth?.token) {
      hasRestoredRef.current = true;
    }
  }, [isAddingAccount, auth]);

  useEffect(() => {
    // Skip session restoration via API in these cases:
    // - Bypass mode: session is already loaded from MMKV storage, no Firebase to subscribe to
    if (isFirebaseBypassEnabled()) {
      sessionLogger.debug('Bypass mode enabled, skipping session restoration');
      return undefined;
    }

    const unsubscribe = subscribeToAuthState(async (user) => {
      // Skip if we're adding an account or already have a session
      if (isAddingAccountRef.current) {
        sessionLogger.debug('Skipping auth subscription callback (adding account mode)');
        return;
      }
      if (hasRestoredRef.current) {
        sessionLogger.debug('Skipping auth subscription callback (session already restored)');
        return;
      }

      if (user) {
        // User is authenticated in Firebase, restore Strapi session
        try {
          sessionLogger.debug('Restoring session from Firebase auth state');
          const data = await login({});

          queryClient.clear();
          appDispatch({
            payload: data,
            type: 'SET_AUTHENTICATION',
          });
          hasRestoredRef.current = true;
        } catch (error) {
          sessionLogger.warn('Session restoration failed', error);
          appDispatch({ type: 'DELETE_AUTHENTICATION' });
        }
      }
    });

    return () => unsubscribe();
  }, [appDispatch, queryClient]); // Removed isAddingAccount to prevent re-subscription

  return null;
}

export default SessionManager;
