import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView, Platform, Text, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import OTPForm from '@/components/organisms/otpForm/OTPForm';
import PhoneForm from '@/components/organisms/signinPhoneForm/SigninPhoneForm';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Login screen component for user authentication.
 * Handles phone number input and OTP verification for user login.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Login screen component
 */
function Login({ navigation }) {
  // local states
  const [phone, setPhone] = useState('');
  // hooks
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const {
    cancelAddAccount, canShowCodeButton, confirm, isAddingAccount, isLoading, loginMutation, otpMutation,
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

  /**
   * Handle go to register page
   * @returns {void}
   */
  const handleGoToRegister = () => {
    navigation.navigate(RouteNames.Register);
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
            <Text style={[Fonts.h2Black, Fonts.neutral00]}>{t('login.title')}</Text>
            <Text style={[Fonts.p1, Fonts.neutral00]}>{t('login.subtitle')}</Text>
          </View>
          {isAddingAccount && (
            <Button
              onPress={cancelAddAccount}
              style={[Spaces.marginTop._16, Alignments.selfStart]}
              title={t('common.actions.cancel')}
              variant="SecondaryLight"
            />
          )}
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
        {canShowCodeButton ? null : (
          <View style={[Spaces.gap[16], Spaces.marginTop[16]]}>
            <View style={[
              Alignments.alignCenter,
              Alignments.row,
              Spaces.gap[16],
            ]}
            >
              <View style={[
                Alignments.fill,
                ApplicationStyle.separator,
                ApplicationStyle.backgroundColor.neutral500,
              ]}
              />
              <Text style={[Fonts.p1Bold, Fonts.neutral500]}>
                {t('login.or').toUpperCase()}
              </Text>
              <View style={[
                Alignments.fill,
                ApplicationStyle.separator,
                ApplicationStyle.backgroundColor.neutral500,
              ]}
              />
            </View>
            <Button
              disabled={otpMutation.isPending}
              onPress={handleGoToRegister}
              style={Alignments.fullWidth}
              title={t('login.actions.register')}
              variant="Secondary"
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default Login;
