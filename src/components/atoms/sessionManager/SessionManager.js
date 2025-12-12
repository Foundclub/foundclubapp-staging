import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { login, subscribeToAuthState } from '@/services/auth/authService';
import { useAppContext } from '@/store/appContext';

/**
 * Component to handle session restoration Logic.
 * This should be placed at the root of the app, inside Providers but outside Navigation.
 */
const SessionManager = () => {
    const [{ isAddingAccount }, appDispatch] = useAppContext();
    const queryClient = useQueryClient();

    useEffect(() => {
        // Skip session restoration via API in these cases:
        // - Bypass mode: session is already loaded from MMKV storage, no Firebase to subscribe to
        // - Adding account: to not overwrite the new login
        if (process.env.BYPASS_FIREBASE_AUTH === 'true') {
            console.log('[SessionManager] Bypass mode: session loaded from storage, skipping API');
            return undefined;
        }
        if (isAddingAccount) {
            console.log('[SessionManager] Skipping: Adding account mode');
            return undefined;
        }

        const unsubscribe = subscribeToAuthState(async (user) => {
            if (user) {
                // User is authenticated in Firebase, restore Strapi session
                try {
                    // Direct login call to avoid triggering UI alerts from useAuth
                    // We pass an empty object because the service handles getting currentUser if verify params are missing
                    const data = await login({});

                    // Replication of useAuth success logic
                    queryClient.clear();
                    appDispatch({
                        payload: data,
                        type: 'SET_AUTHENTICATION',
                    });
                } catch (error) {
                    console.warn('[SessionManager] Session restoration failed:', error);
                    // Optional: clear auth state if restoration fails
                    appDispatch({ type: 'DELETE_AUTHENTICATION' });
                }
            }
        });

        return () => unsubscribe();
    }, [appDispatch, queryClient, isAddingAccount]); // Run when component mounts or isAddingAccount changes

    return null;
};

export default SessionManager;
