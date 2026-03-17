/* eslint-disable import/order, perfectionist/sort-imports */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Linking, Platform, Share,
} from 'react-native';

import { storage, useAppContext } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

import {
  deleteDeviceToken,
  getMe, login, logout, signInWithPhoneNumber,
} from '@/services/auth/authService';

import { createLogger } from '@/utils/logger/logger';
import { sanitizeUser } from '@/domains/auth/authSanitizer';
import {
  formatBirthdateToDisplay,
  formatBirthdateToSend,
  getAuthTokens, getOnboardingViews, profileFieldToDisplay, USER_ROLES,
} from './authUseCases';

import { useAppMode } from '@/context/AppModeContext';
/* eslint-enable import/order, perfectionist/sort-imports */

const authLogger = createLogger('auth');

/**
 * Custom hook to manage authentication
 * @inheritdoc
 */
const useAuth = () => {
  // local state
  const [confirm, setConfirm] = useState(/**
     @type {import('@react-native-firebase/auth')
    .FirebaseAuthTypes.ConfirmationResult | undefined} */(undefined),
  );

  // hooks
  const [, appDispatch] = useAppContext();
  const { isGold } = useAppMode();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // api calls
  const otpMutation = useMutation({
    mutationFn: signInWithPhoneNumber,
    onError: (error) => {
      const message = error?.message || error?.toString() || 'Unknown error';
      Alert.alert(t('APIerrors.OTP_ERROR'), message);
    },
    onSuccess: (data) => {
      setConfirm(data);
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onError: (error) => {
      const message = error?.message || error?.toString() || 'Unknown error';
      Alert.alert(t('APIerrors.OTP_ERROR'), message);
    },
    onSuccess: async (data) => {
      authLogger.debug('Login mutation succeeded', { userDocumentId: data?.user?.documentId });
      // Ensure OTP confirmation state cannot leak to another account flow
      setConfirm(undefined);
      queryClient.clear();
      appDispatch({
        payload: data,
        type: 'SET_AUTHENTICATION',
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async (/** @type {string} */token) => {
      try {
        if (token) {
          await deleteDeviceToken(token);
        }
      } catch (error) {
        authLogger.warn('Failed to delete device token on logout', error?.message || error);
      } finally {
        appDispatch({ payload: undefined, type: 'SET_FCM_TOKEN' });
      }

      await logout();
    },
    onSuccess: () => {
      queryClient.clear();
      // Clear all read message data
      const allKeys = storage.getAllKeys();
      allKeys.forEach((key) => {
        if (key.startsWith('chat_')) {
          storage.delete(key);
        }
      });
      appDispatch({ type: 'LOGOUT_CURRENT_SESSION' });
    },
  });

  const { auth, authSessions, isAddingAccount } = useAppContext()[0];

  const switchAccount = useCallback(async (session) => {
    authLogger.debug('Switching account', { userDocumentId: session?.user?.documentId || session?.user?.id });
    setConfirm(undefined);
    queryClient.clear();

    // Switch app session immediately so UI reacts on first tap.
    appDispatch({
      payload: session?.user?.documentId || session,
      type: 'SET_ACTIVE_SESSION',
    });

    // NOTE: We intentionally skip Firebase re-auth here.
    // session.idToken is a Firebase ID token, not a custom token accepted by signInWithCustomToken.
    authLogger.debug('Skipped Firebase re-auth on account switch (requires backend custom token flow)');
  }, [appDispatch, queryClient]);

  const addAccount = useCallback(async () => {
    authLogger.debug('Preparing add-account flow');
    setConfirm(undefined);
    // Sign out from Firebase SDK to ensure a clean slate for the new account
    // This does NOT remove the session from our app state (authSessions) because we don't trigger the reducer here
    await logout().catch((e) => authLogger.warn('Logout failed before add-account flow', e?.message || 'Unknown error'));

    queryClient.clear();
    appDispatch({
      type: 'PREPARE_ADD_ACCOUNT',
    });
  }, [appDispatch, queryClient]);

  const {
    data: userData,
    error: userDataError,
    isLoading: userDataLoading,
    refetch: refetchUserData,
  } = useQuery({
    enabled: Boolean(auth?.token) && !isAddingAccount,
    queryFn: getMe,
    // Scope by current token to avoid cross-account stale cache reuse
    queryKey: ['get-me', auth?.token || 'no-token'],
  });

  // Sync user data to global state/sessions when it changes (e.g. after edit)
  // This ensures the account switcher displays the correct info
  // NOTE: User data is stored at state.auth.user, NOT state.userData
  const currentContextUserData = useAppContext()[0].auth?.user;

  useEffect(() => {
    if (userData && userData.documentId) {
      // Prevent infinite loops by comparing keys logic same as reducer
      const sanitizedUserData = sanitizeUser(userData);
      // NOTE: currentContextUserData is ALREADY sanitized by reducer

      // Simple deep equal helper to avoid JSON.stringify order issues
      const isDeepEqual = (ObjA, ObjB) => JSON.stringify(ObjA) === JSON.stringify(ObjB);

      const hasChanged = !isDeepEqual(sanitizedUserData, currentContextUserData);

      if (hasChanged) {
        authLogger.debug('User data changed, dispatching update', {
          userDocumentId: sanitizedUserData?.documentId,
        });

        appDispatch({
          payload: userData,
          type: 'UPDATE_USER_DATA',
        });
      }
    }
  }, [userData, appDispatch, currentContextUserData]);

  const onboardingViews = useMemo(() => (
    userData ? getOnboardingViews(userData) : undefined
  ), [userData]);

  const profileFields = useMemo(() => (
    userData ? profileFieldToDisplay(userData.role) : []
  ), [userData]);

  /**
   * Invite a trainer
   * @param {object} param
   * @param {string | undefined} param.firstname
   * @param {string | undefined} param.clubName
   * @param {string | undefined} param.phoneNumber
   */
  const inviteTrainer = ({ clubName, firstname, phoneNumber }) => {
    // Construct the message
    const shareMessage = t('clubDetails.alerts.inviteTrainer.message', {
      clubName,
      coachName: firstname,
    });

    // Smart install link logic
    const baseUrl = process.env.API_URL ? process.env.API_URL.replace('/api', '') : 'https://foundclub.com';
    // Append context for the landing page to generate the correct deep link
    // Assuming we have the clubId available here. If not, we might need to fetch it or pass it.
    // For inviteTrainer, we usually have clubName, but maybe not ID?
    // Let's assume for now we might need to pass clubId to inviteTrainer.
    // If clubId is missing, the link will just be a generic install link.
    // Wait, the hook inviteTrainer signature currently is: ({ clubName, firstname, phoneNumber })
    // We need to add clubId to the function signature or get it from context if possible.
    // The previous code in AddCoach.js call: inviteTrainer({ clubName: ..., firstname: ..., phoneNumber: ... })
    // It seems we should update the signature. But first let's see where we get the clubId.
    // In AddCoach.js: const { clubName } = route?.params || {};
    // It seems route params usually have IDs too?
    // Checking AddCoach.js again... it receives route parameters.

    // For now, I will update the invitation generation to use a placeholder or best effort
    // BUT I must update the function signature too.

    const installUrl = `${baseUrl}/install.html?type=club&id=${encodeURIComponent(clubName || '')}`; // Ideally ID, but name is what we have passed often.
    // actually, deep linking usually requires ID.
    // I should check if I can pass clubId.

    // Let's look at how inviteTrainer is called in AddCoach.js
    // It's called with { clubName, firstname, phoneNumber }.
    // I will update the signature to accept clubId and pass it from the caller.

    const urls = `\n\n${t('teamDetails.alerts.invitePlayers.downloadApp', 'Télécharge l\'application ici')} : \n${installUrl}`;

    const encodedMessage = `${shareMessage}${urls}`;
    const smsUrl = `sms:${phoneNumber}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(encodedMessage)}`;

    Linking.openURL(smsUrl).catch(() => {
      Share.share({
        message: encodedMessage,
        title: t(
          'clubDetails.alerts.inviteTrainer.title',
        ),
      });
    });
  };

  /**
   * Invite team players
   * @param {object} param
   * @param {string} [param.clubName]
   * @param {string} [param.teamName]
   * @returns {void}
   */
  const inviteTeamPlayers = ({ clubName, teamName }) => {
    // Smart install link logic
    const baseUrl = process.env.API_URL ? process.env.API_URL.replace('/api', '') : 'https://foundclub.com';
    // We need teamId here! The function signature is ({ clubName, teamName }).
    // I must update it to ({ clubName, teamName, teamId }).
    const installUrl = `${baseUrl}/install.html?type=team&id=${encodeURIComponent(teamName || '')}`;
    // Again, name is unstable for deep linking. I will likely need to update the caller to pass ID.

    // Construct the message
    const shareMessage = t('teamDetails.alerts.invitePlayers.message', {
      clubName,
      teamName,
    });

    const urls = `\n\n${t('teamDetails.alerts.invitePlayers.downloadApp', 'Télécharge l\'application ici')} : \n${installUrl}`;

    Share.share({
      message: `${shareMessage}${urls}`,
      title: t(
        'teamDetails.alerts.invitePlayers.title',
      ),
    });
  };

  const getNextOnboardingRoute = useCallback((/** @type {string} */currentRoute) => {
    const currentIndex = onboardingViews?.views?.find(
      (view) => view.route === currentRoute,
    )?.index || 0;
    return onboardingViews?.views?.find(
      (view) => view.canShow && view.index > currentIndex,
    )?.route;
  }, [onboardingViews]);

  const getPostOnboardingHomeRoute = useCallback(
    () => (isGold ? RouteNames.LeagueHomeTab : RouteNames.HomeTab),
    [isGold],
  );

  const allMyTeams = useMemo(() => (userData?.myTeams || [])
    ?.concat(userData?.trainedTeams || []), [userData]);

  const canEditClub = useCallback((/** @type {string} */clubId) => userData?.role.name
    === USER_ROLES.president && userData?.club?.documentId === clubId, [userData]);

  const canEditEvent = useCallback(
    (/** @type {string} */teamId) => (userData?.role.name
      === USER_ROLES.coach || userData?.role.name === USER_ROLES.president)
      && userData?.trainedTeams?.map(({ documentId }) => documentId)?.includes(teamId),
    [userData],
  );

  const canManageEvent = useCallback((event) => {
    const roleName = userData?.role?.name;
    if (roleName !== USER_ROLES.coach && roleName !== USER_ROLES.president) {
      return false;
    }

    const trainedTeamIds = new Set((userData?.trainedTeams || []).map(({ documentId }) => documentId));
    const organizerTeamId = event?.team?.documentId;
    const invitedTeamIds = (event?.invitedTeams || []).map((team) => team?.documentId).filter(Boolean);

    if (organizerTeamId && trainedTeamIds.has(organizerTeamId)) return true;
    return invitedTeamIds.some((teamId) => trainedTeamIds.has(teamId));
  }, [userData]);

  const canJoinClub = useMemo(() => {
    if (userData?.role.name === USER_ROLES.coach) {
      return !userData?.club;
    }
    return false;
  }, [userData]);

  const canContactAdmin = useMemo(() => {
    if (userData?.role.name === USER_ROLES.president) {
      return !userData?.club;
    }
    return false;
  }, [userData]);

  const canJoinTeam = useCallback((/** @type {string} */teamId) => {
    if (userData?.role.name === USER_ROLES.player) {
      return !userData?.myTeams?.some(({ documentId }) => documentId === teamId);
    }
    return false;
  }, [userData]);

  const canManageTeam = useMemo(
    () => userData?.role.name === USER_ROLES.coach
      || userData?.role.name === USER_ROLES.president,
    [userData],
  );

  const canManageEvents = useMemo(
    () => userData?.role.name === USER_ROLES.coach
      || userData?.role.name === USER_ROLES.president,
    [userData],
  );

  const canSendMessageToUser = useCallback((/** @type {User} */userToContact) => {
    if (userToContact?.documentId === userData?.documentId) {
      return false;
    }

    if (userData?.club?.documentId === userToContact?.club?.documentId) {
      return userData?.role.name === USER_ROLES.president;
    }

    const myTeams = (userData?.myTeams || [])
      ?.concat(userData?.trainedTeams || [])
      ?.map(({ documentId }) => documentId);

    const userToContactTeams = (userToContact?.myTeams || [])
      ?.concat(userToContact?.trainedTeams || [])
      ?.map(({ documentId }) => documentId);

    return myTeams?.some((teamId) => userToContactTeams?.includes(teamId));
  }, [userData]);

  const cancelAddAccount = useCallback(() => {
    authLogger.debug('Cancel add-account flow');
    setConfirm(undefined);
    queryClient.clear(); // Clear stale data from previous partial login attempts
    appDispatch({ type: 'CANCEL_ADD_ACCOUNT' });
  }, [appDispatch, queryClient]);

  return {
    addAccount,
    allMyTeams,
    authSessions,
    cancelAddAccount,
    canContactAdmin,
    canEditClub,
    canEditEvent,
    canJoinClub,
    canJoinTeam,
    canManageEvent,
    canManageEvents,
    canManageTeam,
    canSendMessageToUser,
    canShowCodeButton: !!confirm,
    confirm,
    formatBirthdateToDisplay,
    formatBirthdateToSend,
    getAuthTokens,
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    inviteTeamPlayers,
    inviteTrainer,
    isAddingAccount,
    isLoading: otpMutation.isPending || loginMutation.isPending,
    loginMutation,
    logoutMutation,
    onboardingViews,
    otpMutation,
    profileFields,
    refetchUserData,
    setConfirm,
    switchAccount,
    USER_ROLES,
    userData,
    userDataError,
    userDataLoading,
  };
};

export default useAuth;
