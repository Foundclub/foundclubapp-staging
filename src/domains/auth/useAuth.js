import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useAppContext } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

import {
  getMe, login, logout, signInWithPhoneNumber,
} from '@/services/auth/authService';

import { getAuthTokens, getOnboardingViews } from './authUseCases';

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
    userData ? getOnboardingViews(userData) : [RouteNames.Home]
  ), [userData]);

  return {
    canShowCodeButton: !!confirm,
    confirm,
    getAuthTokens,
    isLoading: otpMutation.isPending || loginMutation.isPending,
    loginMutation,
    logoutMutation,
    onboardingViews,
    otpMutation,
    refetchUserData,
    setConfirm,
    userData,
    userDataError,
    userDataLoading,
  };
};
