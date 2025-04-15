import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Share } from 'react-native';

import { useAppContext } from '@/store/appContext';

import {
  getMe, login, logout, signInWithPhoneNumber,
} from '@/services/auth/authService';

import { getAuthTokens, getOnboardingViews, profileFieldToDisplay } from './authUseCases';

/**
 * Custom hook to manage authentication
 * @inheritdoc
 */
export const useAuth = () => {
  // local states
  const [confirm, setConfirm] = useState(/**
     @type {import('@react-native-firebase/auth')
    .FirebaseAuthTypes.ConfirmationResult | undefined} */(undefined),
  );
  // hooks
  const [, appDispatch] = useAppContext();
  const { t } = useTranslation();

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
      appDispatch({
        payload: data,
        type: 'SET_AUTHENTICATION',
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
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
    userData ? getOnboardingViews(userData) : []
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

  return {
    canShowCodeButton: !!confirm,
    confirm,
    getAuthTokens,
    inviteTrainer,
    isLoading: otpMutation.isPending || loginMutation.isPending,
    loginMutation,
    logoutMutation,
    onboardingViews,
    otpMutation,
    profileFields,
    refetchUserData,
    setConfirm,
    userData,
    userDataError,
    userDataLoading,
  };
};
