import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Share } from 'react-native';

import { storage, useAppContext } from '@/store/appContext';

import {
  getMe, login, logout, signInWithPhoneNumber,
} from '@/services/auth/authService';

import {
  formatBirthdateToDisplay,
  formatBirthdateToSend,
  getAuthTokens, getOnboardingViews, profileFieldToDisplay, USER_ROLES,
} from './authUseCases';

/**
 * Custom hook to manage authentication
 * @inheritdoc
 */
const useAuth = () => {
  // local states
  const [confirm, setConfirm] = useState(/**
     @type {import('@react-native-firebase/auth')
    .FirebaseAuthTypes.ConfirmationResult | undefined} */(undefined),
  );
  // hooks
  const [, appDispatch] = useAppContext();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // api calls
  const otpMutation = useMutation({
    mutationFn: signInWithPhoneNumber,
    onSuccess: (data) => {
      setConfirm(data);
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      queryClient.clear();
      appDispatch({
        payload: data,
        type: 'SET_AUTHENTICATION',
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      // Clear all read message data
      const allKeys = storage.getAllKeys();
      allKeys.forEach((key) => {
        if (key.startsWith('chat_')) {
          storage.delete(key);
        }
      });
      appDispatch({ type: 'DELETE_AUTHENTICATION' });
    },
  });

  const {
    data: userData,
    error: userDataError,
    isLoading: userDataLoading,
    refetch: refetchUserData,
  } = useQuery({
    queryFn: getMe,
    queryKey: ['get-me'],
  });

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
    // Create an invitation message with download links
    const appStoreUrl = process.env.APP_STORE_URL;
    const googlePlayUrl = process.env.GOOGLE_PLAY_URL;

    // Construct the message
    const inviteMessage = t('clubDetails.alerts.inviteTrainer.message', {
      appStoreUrl,
      clubName,
      coachName: firstname,
      googlePlayUrl,
    });
    const encodedMessage = encodeURIComponent(inviteMessage);
    const smsUrl = `sms:${phoneNumber}${Platform.OS === 'ios' ? '&' : '?'}body=${encodedMessage}`;

    Linking.openURL(smsUrl).catch(() => {
      Share.share({
        message: inviteMessage,
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
    // Create an invitation message with download links
    const appStoreUrl = process.env.APP_STORE_URL;
    const googlePlayUrl = process.env.GOOGLE_PLAY_URL;

    // Construct the message
    const shareMessage = t('teamDetails.alerts.invitePlayers.message', {
      appStoreUrl,
      clubName,
      googlePlayUrl,
      teamName,
    });

    Share.share({
      message: shareMessage,
      title: t(
        'teamDetails.alerts.invitePlayers.title',
      ),
    });
  };

  const getNextOnboardingRoute = useCallback((/** @type {string} */currentRoute) => {
    const currentIndex = onboardingViews?.views?.find(
      (view) => view.route === currentRoute,
    )?.index || 0;
    return onboardingViews?.views?.find((view) => view.index === currentIndex + 1)?.route;
  }, [onboardingViews]);

  const canEditClub = useCallback((/** @type {string} */clubId) => userData?.role.name
 === USER_ROLES.president && userData?.club?.documentId === clubId, [userData]);

  const canEditEvent = useCallback(
    (/** @type {string} */teamId) => userData?.role.name
 === USER_ROLES.coach
 && userData?.trainedTeams?.map(({ documentId }) => documentId)?.includes(teamId),
    [userData],
  );

  const canJoinClub = useMemo(() => {
    if (userData?.role.name === USER_ROLES.coach) {
      return !userData?.club;
    }
    return false;
  }, [userData]);

  const canJoinTeam = useMemo(() => {
    if (userData?.role.name === USER_ROLES.player) {
      return !userData?.myTeams?.length;
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

  return {
    canEditClub,
    canEditEvent,
    canJoinClub,
    canJoinTeam,
    canManageEvents,
    canManageTeam,
    canShowCodeButton: !!confirm,
    confirm,
    formatBirthdateToDisplay,
    formatBirthdateToSend,
    getAuthTokens,
    getNextOnboardingRoute,
    inviteTeamPlayers,
    inviteTrainer,
    isLoading: otpMutation.isPending || loginMutation.isPending,
    loginMutation,
    logoutMutation,
    onboardingViews,
    otpMutation,
    profileFields,
    refetchUserData,
    setConfirm,
    USER_ROLES,
    userData,
    userDataError,
    userDataLoading,
  };
};

export default useAuth;
