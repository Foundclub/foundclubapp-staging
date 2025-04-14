import { joiResolver } from '@hookform/resolvers/joi';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView, Platform, ScrollView, Share,
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

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = (data) => {
    // TODO: Implement coach creation mutation
    // Create an invitation message with download links
    const appStoreUrl = process.env.APP_STORE_URL || 'https://apps.apple.com/app/your-app-id';
    const googlePlayUrl = process.env.GOOGLE_PLAY_URL || 'https://play.google.com/store/apps/details?id=your.app.id';

    // Construct the message
    const inviteMessage = t('inviteCoach.message', {
      appStoreUrl,
      coachName: `${data.firstname} ${data.lastname}`,
      defaultValue: `Hello ${data.firstname}, you've been added as a coach. Download the app: iOS: ${appStoreUrl} Android: ${googlePlayUrl}`,
      googlePlayUrl,
    });
    // Use Linking API to open SMS with the message and phone number
    if (data.phoneNumber) {
      const encodedMessage = encodeURIComponent(inviteMessage);
      const smsUrl = `sms:${data.phoneNumber}${Platform.OS === 'ios' ? '&' : '?'}body=${encodedMessage}`;

      import('react-native').then(({ Linking }) => {
        Linking.openURL(smsUrl).catch(() => {
          // Fallback to sharing if SMS fails
          Share.share({
            message: inviteMessage,
            title: t('inviteCoach.title', { defaultValue: 'Join as coach' }),
          });
        });
      });
    } else {
      // Fallback to share dialog if no phone number
      Share.share({
        message: inviteMessage,
        title: t('inviteCoach.title', { defaultValue: 'Join as coach' }),
      });
    }
    navigation.goBack();
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
          onPress={handleSubmit(handleFormSubmit)}
          title={t('addCoach.actions.save')}
          variant="Primary"
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default AddCoach;
