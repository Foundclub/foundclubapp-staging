import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, KeyboardAvoidingView, Platform, ScrollView, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import OTPForm from '@/components/organisms/otpForm/OTPForm';
import PhoneForm from '@/components/organisms/signinPhoneForm/SigninPhoneForm';
import FormScreenContainer from '@/components/templates/FormScreenContainer';

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
    Alignments, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    canShowCodeButton, confirm, isLoading, loginMutation, otpMutation,
  } = useAuth();
  const renderBrandLogo = () => {
    if (Platform.OS === 'web') {
      return (
        <img
          alt="FoundClub"
          src="/foundclub-logo.png"
          style={{ height: 24, objectFit: 'contain', width: 220 }}
        />
      );
    }

    return (
      <Image
        resizeMode="contain"
        source={Images.logo}
        style={{ height: 24, width: 220 }}
      />
    );
  };

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
    <FormScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Platform.OS === 'web' ? Spaces.paddingTop[80] : Spaces.paddingTop[32],
        Spaces.paddingBottom[24],
      ]}
      desktopAlignment={Platform.OS === 'web' ? 'top' : 'center'}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={30}
        style={Alignments.fill}
      >
        <ScrollView
          contentContainerStyle={[
            Alignments.grow1,
            {
              paddingBottom: insets.bottom + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[Spaces.gap[32], Alignments.fill]}>
            <View style={Spaces.gap[24]}>
              <View style={Alignments.alignCenter}>
                {renderBrandLogo()}
              </View>
              <View style={[Spaces.gap[16], Alignments.fullWidth]}>
                <Text style={[Fonts.h2Black, Fonts.neutral00]}>{t('register.title')}</Text>
                <Text style={[Fonts.p1, Fonts.neutral00]}>{t('register.subtitle')}</Text>
              </View>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </FormScreenContainer>
  );
}

export default Register;
