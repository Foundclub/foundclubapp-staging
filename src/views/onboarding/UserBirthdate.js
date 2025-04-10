import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView, Platform, Text, View,
} from 'react-native';

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
});

/**
 * User birthdate input screen component. Allows users to enter their date of birth.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User birthdate screen component
 */
function UserBirthdate({ navigation, route }) {
  const { Alignments, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      navigation.navigate(route.params?.nextRoute || RouteNames.UserAvatar);
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
      updateUserMutation.mutate(Object.assign(userData, { birthdate }));
    }
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingVertical[24]]}
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
                  onChangeText={onChange}
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
                  onChangeText={onChange}
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
