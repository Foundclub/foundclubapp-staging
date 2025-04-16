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
  firstname: '',
  lastname: '',
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
function UserName({ navigation, route }) {
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      navigation.navigate(route.params?.nextRoute(RouteNames.UserName) || RouteNames.UserBirthdate);
    },
  });

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
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

  /**
   * Handle form submit
   * @param {{firstname: string, lastname: string}} data
   */
  const handleFormSubmit = (data) => {
    if (userData) {
      updateUserMutation.mutate(Object.assign(userData, {
        firstname: data.firstname,
        lastname: data.lastname,
      }));
    }
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
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
          onPress={handleSubmit(handleFormSubmit)}
          title={t('profile.actions.save')}
          variant="Primary"
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default UserName;
