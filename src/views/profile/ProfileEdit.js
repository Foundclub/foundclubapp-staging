import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView, Platform, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import useAuth from '@/domains/auth/useAuth';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';
import { useGetSections } from '@/services/section/sectionQueries';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  birthdate: '',
  firstname: '',
  height: '',
  lastname: '',
  phoneNumber: '',
  position: '',
  section: '',
  weight: '',
};

const profileSchema = Joi.object({
  birthdate: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/).allow('').optional(),
  documentId: Joi.string().allow(null, '').optional(),
  firstname: Joi.string().required(),
  height: Joi.string().allow(null, '').optional(),
  lastname: Joi.string().required(),
  phoneNumber: Joi.string(),
  position: Joi.string().allow(null, '').optional(),
  section: Joi.string().allow(null, '').optional(),
  weight: Joi.string().allow(null, '').optional(),
}).unknown(true);

/**
 * Profile edit screen component. Allows users to edit their profile information.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Profile edit screen component
 */
function ProfileEdit({ navigation }) {
  // hooks
  const {
    Alignments, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const { data: sections } = useGetSections();
  const {
    formatBirthdateToDisplay, formatBirthdateToSend, profileFields,
  } = useAuth();

  // local state
  const [avatar, setAvatar] = useState(
    /** @type {Avatar | undefined} */
    (userData?.avatar?.url ? { url: userData.avatar.url } : undefined),
  );

  const sectionOptions = sections?.map((section) => ({
    label: section.name,
    value: section.documentId,
  })) || [];

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      navigation.goBack();
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
      ...userData,
      birthdate: formatBirthdateToDisplay(userData?.birthdate || ''),
      section: userData?.section?.documentId || '',
    },
    mode: 'onBlur',
    resolver: joiResolver(profileSchema),
    shouldFocusError: false,
  });

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = (data) => {
    if (userData) {
      updateUserMutation.mutate({
        ...userData,
        ...data,
        avatar,
        birthdate: formatBirthdateToSend(data.birthdate || ''),
        section: sections?.find((section) => section.documentId === data.section),
      });
    }
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingVertical[24]]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
        style={[Alignments.justifySpaceBetween, Alignments.fill]}
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
                <Input
                  editable={false}
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('profile.fields.phoneNumber.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t('profile.fields.phoneNumber.placeholder')}
                  readOnly
                  ref={ref}
                  value={value}
                />
              )}
            />

            {profileFields?.includes('firstname') ? (
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
            ) : null}
            {profileFields?.includes('lastname') ? (
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
            ) : null}
            {profileFields?.includes('birthdate') ? (
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
            ) : null}
            {profileFields?.includes('section') ? (
              <Controller
                control={control}
                name="section"
                render={({
                  field: {
                    name, onBlur, onChange, ref, value,
                  },
                }) => (
                  <AutocompleteSelect
                    error={getFieldError({ errors: formErrors, fieldName: name })}
                    label={t('profile.fields.section.label')}
                    onBlur={onBlur}
                    options={sectionOptions}
                    placeholder={t('profile.fields.section.placeholder')}
                    ref={ref}
                    setValue={
                    (/** @type {{value: string, label: string}} */option) => { onChange(option?.value || ''); }
                  }
                    value={sectionOptions.find((option) => option.value === value)?.label || ''}
                  />
                )}
              />
            ) : null}
            {profileFields?.includes('weight') ? (
              <Controller
                control={control}
                name="weight"
                render={({
                  field: {
                    name, onBlur, onChange, ref, value,
                  },
                }) => (
                  <Input
                    enterKeyHint="next"
                    error={getFieldError({ errors: formErrors, fieldName: name })}
                    inputMode="decimal"
                    keyboardType="number-pad"
                    label={t('profile.fields.weight.label')}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    onSubmitEditing={() => setFocus('height')}
                    placeholder={t('profile.fields.weight.placeholder')}
                    ref={ref}
                    value={value}
                  />
                )}
              />
            ) : null}

            {profileFields?.includes('height') ? (
              <Controller
                control={control}
                name="height"
                render={({
                  field: {
                    name, onBlur, onChange, ref, value,
                  },
                }) => (
                  <Input
                    enterKeyHint="next"
                    error={getFieldError({ errors: formErrors, fieldName: name })}
                    inputMode="decimal"
                    keyboardType="number-pad"
                    label={t('profile.fields.height.label')}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    onSubmitEditing={() => setFocus('position')}
                    placeholder={t('profile.fields.height.placeholder')}
                    ref={ref}
                    value={value}
                  />
                )}
              />
            ) : null}
            {profileFields?.includes('position') ? (
              <Controller
                control={control}
                name="position"
                render={({
                  field: {
                    name, onBlur, onChange, ref, value,
                  },
                }) => (
                  <Input
                    enterKeyHint="done"
                    error={getFieldError({ errors: formErrors, fieldName: name })}
                    label={t('profile.fields.position.label')}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder={t('profile.fields.position.placeholder')}
                    ref={ref}
                    value={value}
                  />
                )}
              />
            ) : null}
          </View>
        </ScrollView>

        <Button
          isLoading={updateUserMutation.isPending}
          onPress={handleSubmit(handleFormSubmit)}
          title={t('profile.actions.save')}
          variant="Primary"
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default ProfileEdit;
