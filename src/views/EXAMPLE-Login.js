import {
  Alert,
  KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { joiResolver } from '@hookform/resolvers/joi';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
// services
import { useMutation } from '@tanstack/react-query';
// utils
import { Joi } from '../theme/strings';
import { getFieldError } from '../utils/form/formUtils';
// hooks
import useTheme from '../theme/themeContext';
import { useAuth } from '../domains/EXAMPLE-auth/EXAMPLE-useAuth';
// components
import Button from '../components/atoms/EXAMPLE-button/EXAMPLE-Button';
import Input from '../components/molecules/EXAMPLE-input/EXAMPLE-Input';
import ScreenContainer from '../components/templates/ScreenContainer';
// services
import { login } from '../services/EXAMPLE-auth/EXAMPLE-authService';

const defaultValues = {
  username: 'emilys',
  password: 'emilyspass',
};

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

/**
 * Login screen component.
 * @returns {import('react').ReactElement}
 */
function Login() {
  // hooks
  const {
    Alignments, Spaces, Fonts,
  } = useTheme();
  const { t } = useTranslation();
  const { saveAuthTokens } = useAuth();

  // form
  const {
    control,
    handleSubmit,
    formState: { errors: formErrors },
    setFocus,
  } = useForm({
    defaultValues,
    resolver: joiResolver(loginSchema),
    mode: 'onBlur',
    shouldFocusError: false,
  });

  // mutations
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: saveAuthTokens,
  });

  /**
   * Handle form submit
   * @param {typeof defaultValues} data - The data to submit
   * @returns {void}
   */
  const handleFormSubmit = (data) => {
    loginMutation.mutate(data);
  };

  const goToForgotPassword = () => {
    Alert.alert("T'as oublié ??", 'Tu vas devoir te souvenir ! Sinon essaye avec emilys / emilyspass ');
  };

  return (
    <ScreenContainer
      style={[
        Alignments.justifySpaceBetween,
        Alignments.alignStart,
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={30}
        style={[
          Alignments.fill,
          Alignments.fullWidth,
          Spaces.gap[24],
          Spaces.paddingVertical[24],
        ]}
      >
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutralFFF]}>{t('signin.title')}</Text>
        </View>
        <ScrollView
          style={[
            Alignments.fullWidth,
            Alignments.fill,
          ]}
          contentContainerStyle={[Spaces.gap[24]]}
        >
          <Controller
            name="username"
            control={control}
            render={({
              field: {
                onChange, onBlur, value, ref, name,
              },
            }) => (
              <Input
                ref={ref}
                label={t('signin.fields.username')}
                placeholder={t('signin.fields.username')}
                value={value}
                onChangeText={(val) => onChange(val?.toLowerCase())}
                onBlur={onBlur}
                onSubmitEditing={() => setFocus('password')}
                enterKeyHint="next"
                error={getFieldError({ errors: formErrors, fieldName: name })}
                inputMode="email"
                keyboardType="email-address"
              />
            )}
          />
          <Controller
            name="password"
            control={control}
            render={({
              field: {
                onChange, onBlur, value, ref, name,
              },
            }) => (
              <Input
                ref={ref}
                label={t('signin.fields.password')}
                placeholder={t('signin.fields.password')}
                value={value}
                onChangeText={(val) => onChange(val)}
                onBlur={onBlur}
                enterKeyHint="done"
                error={getFieldError({ errors: formErrors, fieldName: name })}
                secureTextEntry
              />
            )}
          />
          <TouchableOpacity onPress={goToForgotPassword}>
            <Text style={[Fonts.p2, Fonts.neutralB3B, Fonts.underlineText]}>
              {t('signin.actions.forgotPassword')}
            </Text>
          </TouchableOpacity>

        </ScrollView>
        <View
          style={[
            Alignments.fullWidth,
          ]}
        >
          <Button
            disabled={loginMutation.isPending}
            variant="PrimaryLight"
            onPress={handleSubmit(handleFormSubmit)}
            // onPress={handleFormSubmit}
            title={t('signin.actions.login')}
            style={Alignments.fullWidth}
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default Login;
