import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { login, subscribeToAuthState } from '@/services/auth/authService';
import { useAppContext } from '@/store/appContext';

/**
 * Component to handle session restoration Logic.
 * This should be placed at the root of the app, inside Providers but outside Navigation.
 */
const SessionManager = () => {
    const [{ isAddingAccount, auth }, appDispatch] = useAppContext();
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
        if (process.env.BYPASS_FIREBASE_AUTH === 'true') {
            console.log('[SessionManager] Bypass mode: session loaded from storage, skipping API');
            return undefined;
        }

        const unsubscribe = subscribeToAuthState(async (user) => {
            // Skip if we're adding an account or already have a session
            if (isAddingAccountRef.current) {
                console.log('[SessionManager] Skipping: Adding account mode');
                return;
            }
            if (hasRestoredRef.current) {
                console.log('[SessionManager] Skipping: Session already restored');
                return;
            }

            if (user) {
                // User is authenticated in Firebase, restore Strapi session
                try {
                    console.log('[SessionManager] Restoring session...');
                    const data = await login({});

                    queryClient.clear();
                    appDispatch({
                        payload: data,
                        type: 'SET_AUTHENTICATION',
                    });
                    hasRestoredRef.current = true;
                } catch (error) {
                    console.warn('[SessionManager] Session restoration failed:', error);
                    appDispatch({ type: 'DELETE_AUTHENTICATION' });
                }
            }
        });

        return () => unsubscribe();
    }, [appDispatch, queryClient]); // Removed isAddingAccount to prevent re-subscription

    return null;
};

export default SessionManager;
