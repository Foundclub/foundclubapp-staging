import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView, Platform, ScrollView,
  View,
} from 'react-native';

import { formatBirthdateToDisplay } from '@/domains/auth/authUseCases';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import PhoneInput from '@/components/organisms/phoneInput/PhoneInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { createTrainer } from '@/services/auth/authService';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  birthdate: '',
  firstname: '',
  lastname: '',
  phoneNumber: '',
};

const addCoachSchema = Joi.object({
  birthdate: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/),
  firstname: Joi.string().required(),
  lastname: Joi.string().required(),
  phoneNumber: Joi.string(),
}).unknown(true);

/**
 * Add coach screen component. Allows club managers to add a new coach.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Add coach screen component
 */
function AddCoach({ navigation }) {
// local state
  const [avatar, setAvatar] = useState(
    /** @type {Avatar | undefined} */
    (undefined),
  );
  const { t } = useTranslation();
  const { Alignments, Spaces } = useTheme();

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    setFocus,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(addCoachSchema),
    shouldFocusError: false,
  });

  const createTrainerMutation = useMutation({
    mutationFn: createTrainer,
    onSuccess: () => {
      navigation.goBack();
    },
  });

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = (data) => {
    createTrainerMutation.mutate({
      ...data,
      avatar,
    });
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
        keyboardVerticalOffset={100}
        style={[
          Alignments.fill,
          Alignments.justifySpaceBetween,
        ]}
      >
        <ScrollView
          contentContainerStyle={[
            Spaces.gap[24],
            Spaces.paddingBottom[40],
          ]}
          style={[Alignments.fill]}
        >
          <View style={[Alignments.fill, Spaces.gap[24]]}>
            <View style={[Alignments.row, Spaces.marginVertical[24]]}>
              <SelectAvatar
                currentAvatar={avatar}
                onAvatarSelected={setAvatar}
                size={110}
              />
            </View>

            <Controller
              control={control}
              name="phoneNumber"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <PhoneInput
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  onBlur={onBlur}
                  onChange={onChange}
                  ref={ref}
                  value={value}
                />
              )}
            />
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
                  enterKeyHint="next"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('profile.fields.lastname.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('birthdate')}
                  placeholder={t('profile.fields.lastname.placeholder')}
                  ref={ref}
                  value={value}
                />
              )}
            />
            <Controller
              control={control}
              name="birthdate"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="done"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  label={t('profile.fields.birthdate.label')}
                  maxLength={10}
                  onBlur={onBlur}
                  onChangeText={(text) => onChange(formatBirthdateToDisplay(text))}
                  placeholder="JJ/MM/AAAA"
                  ref={ref}
                  value={value}
                />
              )}
            />
          </View>
        </ScrollView>

        <Button
          disabled={!!Object.keys(formErrors).length}
          isLoading={createTrainerMutation.isPending}
          onPress={handleSubmit(handleFormSubmit)}
          title={t('addCoach.actions.save')}
          variant="Primary"
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default AddCoach;
