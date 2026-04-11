import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert, KeyboardAvoidingView, Platform, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  firstname: '',
  lastname: '',
};

const resolveAvailableRoute = (navigation, ...candidates) => {
  const routeNames = navigation?.getState?.()?.routeNames || [];
  const firstCandidate = candidates.find(Boolean);

  if (!Array.isArray(routeNames) || routeNames.length === 0) {
    return firstCandidate;
  }

  return candidates.find(
    (candidate) => candidate && routeNames.includes(candidate),
  ) || firstCandidate;
};

const nameSchema = Joi.object({
  firstname: Joi.string().required(),
  lastname: Joi.string().required(),
});

/**
 * User name input screen component. Allows users to enter their first and last name.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User name screen component
 */
function UserName({ navigation }) {
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const {
    data: userData,
    error: userDataError,
    isLoading: userDataLoading,
    refetch: refetchUserData,
  } = useGetMe();
  const { getNextOnboardingRoute } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour votre profil.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-me'] });
      const nextRoute = resolveAvailableRoute(
        navigation,
        getNextOnboardingRoute(RouteNames.UserName),
        RouteNames.UserBirthdate,
      );
      if (nextRoute) {
        navigation.navigate(nextRoute);
      }
    },
  });
  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    reset,
    setFocus,
  } = useForm({
    defaultValues: {
      ...defaultValues,
      firstname: userData?.firstname || '',
      lastname: userData?.lastname || '',
    },
    mode: 'onBlur',
    resolver: joiResolver(nameSchema),
    shouldFocusError: false,
  });

  useEffect(() => {
    reset({
      firstname: userData?.firstname || '',
      lastname: userData?.lastname || '',
    });
  }, [reset, userData?.firstname, userData?.lastname]);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous r\u00E9cup\u00E9rons ton profil avant de modifier ton nom."
        isLoading
        title="Chargement du profil"
      />
    );
  }

  if (userDataError) {
    return (
      <OnboardingStateView
        actionLabel="R\u00E9essayer"
        description={userDataError?.message || 'Impossible de charger ton profil.'}
        onAction={refetchUserData}
        title="Chargement impossible"
      />
    );
  }

  /**
   * Handle form submit
   * @param {{firstname: string, lastname: string}} data
   */
  const handleFormSubmit = (data) => {
    if (userData) {
      updateUserMutation.mutate({
        firstname: data.firstname,
        lastname: data.lastname,
      });
    }
  };

  return (
    <FormScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },

      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={110}
        style={[
          Alignments.justifySpaceBetween,
          Alignments.fill,
        ]}
      >
        <View style={[Spaces.gap[40]]}>
          <View style={[Spaces.gap[16]]}>
            <Text style={[Fonts.h2Black, Fonts.neutral00]}>
              {t('profile.titles.name')}
            </Text>
            <Text style={[Fonts.p1, Fonts.neutral00]}>
              {t('profile.subtitles.name')}
            </Text>
          </View>

          <View style={[Spaces.gap[24]]}>
            <Controller
              control={control}
              name="firstname"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="next"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('profile.fields.firstname.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('lastname')}
                  placeholder={t('profile.fields.firstname.placeholder')}
                  ref={ref}
                  value={value}
                />
              )}
            />
            <Controller
              control={control}
              name="lastname"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="done"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('profile.fields.lastname.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t('profile.fields.lastname.placeholder')}
                  ref={ref}
                  value={value}
                />
              )}
            />
          </View>
        </View>

        <Button
          disabled={!!Object.keys(formErrors).length}
          isLoading={updateUserMutation.isPending}
          onPress={handleSubmit(handleFormSubmit)}
          title={t('profile.actions.save')}
          variant="Primary"
        />
      </KeyboardAvoidingView>
    </FormScreenContainer>
  );
}

export default UserName;
