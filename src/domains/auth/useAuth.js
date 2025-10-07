import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Linking, Platform, Share,
} from 'react-native';

import { storage, useAppContext } from '@/store/appContext';

import {
  deleteDeviceToken,
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
  // local sta
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
    onError: (error) => {
      Alert.alert(t('APIerrors.OTP_ERROR'), error.message || error.toString());
    },
    onSuccess: (data) => {
      setConfirm(data);
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onError: (error) => {
      Alert.alert(t('APIerrors.OTP_ERROR'), error.message || error.toString());
    },
    onSuccess: async (data) => {
      queryClient.clear();
      appDispatch({
        payload: data,
        type: 'SET_AUTHENTICATION',
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async (/** @type {string} */token) => {
      deleteDeviceToken(token).then(() => {
        appDispatch({ payload: undefined, type: 'SET_FCM_TOKEN' });
        return logout();
      }).catch(() => {
        appDispatch({ payload: undefined, type: 'SET_FCM_TOKEN' });
        return logout();
      });
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
    const shareMessage = t('clubDetails.alerts.inviteTrainer.message', {
      clubName,
      coachName: firstname,
    });

    const urls = `\n\n${
      t('teamDetails.alerts.invitePlayers.downloadOnIOS')} :  \n${
      appStoreUrl}
      \n${t('teamDetails.alerts.invitePlayers.downloadOnAndroid')} :  \n${
  googlePlayUrl}
      `;

    const encodedMessage = `${shareMessage}${urls}`;
    const smsUrl = `sms:${phoneNumber}${Platform.OS === 'ios' ? '&' : '?'}body=${encodedMessage}`;

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
   * @param {string} [param.teamId]
   * @returns {void}
   */
  const inviteTeamPlayers = ({ clubName, teamId, teamName }) => {
    // Create an invitation message with download links
    const appStoreUrl = process.env.APP_STORE_URL;
    const googlePlayUrl = process.env.GOOGLE_PLAY_URL;
    const deeplinkUrl = `foundclub://team/${teamId}`;

    // Construct the message
    const shareMessage = t('teamDetails.alerts.invitePlayers.message', {
      clubName,
      teamName,
    });

    const urls = `\n\n${
      t('teamDetails.alerts.invitePlayers.alreadyHaveTheApp')} :  \n${
      deeplinkUrl}
      \n${
  t('teamDetails.alerts.invitePlayers.downloadOnIOS')} :  \n${
  appStoreUrl}
      \n${t('teamDetails.alerts.invitePlayers.downloadOnAndroid')} :  \n${
  googlePlayUrl}
      `;

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
    return onboardingViews?.views?.find((view) => view.index === currentIndex + 1)?.route;
  }, [onboardingViews]);

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

  return {
    allMyTeams,
    canContactAdmin,
    canEditClub,
    canEditEvent,
    canJoinClub,
    canJoinTeam,
    canManageEvents,
    canManageTeam,
    canSendMessageToUser,
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
