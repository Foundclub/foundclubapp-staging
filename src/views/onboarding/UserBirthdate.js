import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
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
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  day: '',
  month: '',
  year: '',
};

const birthdateSchema = Joi.object({
  day: Joi.string()
    .pattern(/^\d{2}$/)
    .custom((value, helper) => {
      const num = Number(value);
      if (Number.isNaN(num) || num < 1 || num > 31) return helper.error('any.invalid');
      return value;
    })
    .required(),
  month: Joi.string()
    .pattern(/^\d{2}$/)
    .custom((value, helper) => {
      const num = Number(value);
      if (Number.isNaN(num) || num < 1 || num > 12) return helper.error('any.invalid');
      return value;
    })
    .required(),
  year: Joi.string()
    .pattern(/^\d{4}$/)
    .custom((value, helper) => {
      const num = Number(value);
      if (Number.isNaN(num) || num < 1920 || num > new Date().getFullYear()) return helper.error('any.invalid');
      return value;
    })
    .required(),
}).custom((value, helper) => {
  const day = Number(value.day);
  const month = Number(value.month);
  const year = Number(value.year);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime())
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return helper.error('any.invalid');
  }

  return value;
});

/**
 * User birthdate input screen component. Allows users to enter their date of birth.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User birthdate screen component
 */
function UserBirthdate({ navigation }) {
  const { Alignments, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const { getNextOnboardingRoute } = useAuth();
  const insets = useSafeAreaInsets();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour votre profil.');
    },
    onSuccess: () => {
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserBirthdate)
        || RouteNames.UserAvatar);
    },
  });

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    setFocus,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(birthdateSchema),
    shouldFocusError: false,
  });

  /**
   * Handle form submit
   * @param {{ day: string, month: string, year: string }} data
   */
  const handleFormSubmit = (data) => {
    if (userData && data.year && data.month && data.day) {
      const birthdate = `${data.year}-${data.month}-${data.day}`;
      updateUserMutation.mutate({ birthdate });
    }
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={110}
        style={[Alignments.justifySpaceBetween, Alignments.fill]}
      >
        <View style={[Spaces.gap[40]]}>
          <View style={[Spaces.gap[16]]}>
            <Text style={[Fonts.h2Black, Fonts.neutral00]}>
              {t('profile.titles.birthdate')}
            </Text>
            <Text style={[Fonts.p1, Fonts.neutral00]}>
              {t('profile.subtitles.birthdate')}
            </Text>
          </View>

          <View style={[
            Alignments.row,
            Alignments.alignEnd,
            Alignments.justifyCenter,
            Spaces.gap[16]]}
          >
            <Controller
              control={control}
              name="day"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="next"
                  error={getFieldError({ errors: formErrors, fieldName: name }) ? ' ' : undefined}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxLength={2}
                  onBlur={onBlur}
                  onChangeText={(text) => {
                    onChange(text);
                    if (text.length === 2) {
                      setFocus('month');
                    }
                  }}
                  onSubmitEditing={() => setFocus('month')}
                  placeholder="JJ"
                  ref={ref}
                  value={value}
                  wrapperStyle={{ width: 60 }}
                />
              )}
            />
            <Text style={[Fonts.h1Bold, Fonts.neutral00, Spaces.paddingHorizontal[4]]}>
              /
            </Text>
            <Controller
              control={control}
              name="month"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="next"
                  error={getFieldError({ errors: formErrors, fieldName: name }) ? ' ' : undefined}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxLength={2}
                  onBlur={onBlur}
                  onChangeText={(text) => {
                    onChange(text);
                    if (text.length === 2) {
                      setFocus('year');
                    }
                  }}
                  onSubmitEditing={() => setFocus('year')}
                  placeholder="MM"
                  ref={ref}
                  value={value}
                  wrapperStyle={{ width: 60 }}
                />
              )}
            />
            <Text style={[Fonts.h1Bold, Fonts.neutral00, Spaces.paddingHorizontal[4]]}>
              /
            </Text>
            <Controller
              control={control}
              name="year"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="done"
                  error={getFieldError({ errors: formErrors, fieldName: name }) ? ' ' : undefined}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxLength={4}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder="AAAA"
                  ref={ref}
                  value={value}
                  wrapperStyle={{ width: 80 }}
                />
              )}
            />
          </View>
        </View>

        <Button
          disabled={!!Object.keys(formErrors).length}
          onPress={handleSubmit(handleFormSubmit)}
          title={t('profile.actions.save')}
          variant="Primary"
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default UserBirthdate;
