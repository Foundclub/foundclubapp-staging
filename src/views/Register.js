import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView, Platform, Text, View,
} from 'react-native';

import { useAuth } from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import OTPForm from '@/components/organisms/otpForm/OTPForm';
import PhoneForm from '@/components/organisms/signinPhoneForm/SigninPhoneForm';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * Registration screen component for new user sign-up.
 * Handles phone number input and OTP verification for user registration.
 * @returns {import('react').ReactElement} Registration screen component
 */
function Register() {
  // local states
  const [phone, setPhone] = useState('');
  // hooks
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const {
    canShowCodeButton, confirm, isLoading, loginMutation, otpMutation,
  } = useAuth();

  /**
   * Handle form submit
   * @param {{phoneNumber: string}} data - The data to submit
   * @returns {void}
   */
  const handleFormSubmit = (data) => {
    setPhone(data.phoneNumber);
    otpMutation.mutate(data.phoneNumber);
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingTop[32],
        Spaces.paddingBottom[24],
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={30}
        style={[
          Alignments.justifySpaceBetween,
          Alignments.fill,
        ]}
      >
        <View style={[Spaces.gap[40], Alignments.fill]}>
          <View style={[Spaces.gap[16]]}>
            <Text style={[Fonts.h2Black, Fonts.neutral00]}>{t('register.title')}</Text>
            <Text style={[Fonts.p1, Fonts.neutral00]}>{t('register.subtitle')}</Text>
          </View>
          {canShowCodeButton
            ? (
              <OTPForm
                confirm={confirm}
                isLoading={isLoading}
                loginMutation={loginMutation}
                phoneNumber={phone}
              />
            )
            : (
              <PhoneForm
                isLoading={isLoading}
                onSubmit={handleFormSubmit}
              />
            )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default Register;
