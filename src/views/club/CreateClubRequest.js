import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView, Platform, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import useAuth from '@/domains/auth/useAuth';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import PhoneInput from '@/components/organisms/phoneInput/PhoneInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { createClubRequest } from '@/services/clubRequest/clubRequestService';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  clubName: '',
  holderEmail: '',
  holderFirstname: '',
  holderLastname: '',
  holderPhone: '',
};

const clubRequestSchema = Joi.object({
  clubName: Joi.string().required(),
  holderEmail: Joi.string().allow(''),
  holderFirstname: Joi.string().required(),
  holderLastname: Joi.string().required(),
  holderPhone: Joi.string().allow(''),
});

const isValidEmail = (value) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue);
};

/**
 * Club creation screen component. Allows users to create a new club.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Club creation screen component
 */
function CreateClubRequest({ navigation }) {
  const { t } = useTranslation();
  const { Alignments, Spaces } = useTheme();
  const { userData } = useAuth();

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    setFocus,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(clubRequestSchema),
    shouldFocusError: false,
  });

  const createClubMutation = useMutation({
    mutationFn: createClubRequest,
    onError: (mutationError) => {
      const errorMessage = mutationError?.response?.data?.error?.message
        || mutationError?.response?.data?.error
        || mutationError?.message
        || t('APIerrors.unknown');

      Alert.alert(t('common.error', 'Erreur'), String(errorMessage));
    },
    onSuccess: () => {
      Alert.alert(
        t('createClubRequest.alerts.title'),
        t('createClubRequest.alerts.description'),
        [{ onPress: () => navigation.goBack(), text: t('createClubRequest.actions.ok') }],
      );
    },
  });

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = (data) => {
    const holderPhone = String(data?.holderPhone || '').trim();
    const holderEmail = String(data?.holderEmail || '').trim().toLowerCase();

    if (!holderPhone && !holderEmail) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t(
          'createClubRequest.alerts.contactRequired',
          'Ajoutez au moins un numero de telephone ou un email pour le dirigeant.',
        ),
      );
      return;
    }

    if (!isValidEmail(holderEmail)) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('createClubRequest.alerts.invalidEmail', 'L\'adresse email du dirigeant est invalide.'),
      );
      return;
    }

    createClubMutation.mutate({
      ...data,
      holderEmail,
      holderPhone,
      requestKind: 'club_creation',
      searchContext: {
        clubId: null,
        role: String(userData?.role?.name || 'unknown').trim(),
        screen: RouteNames.CreateClub,
        target: 'manual_club_creation',
      },
      source: 'manual',
    });
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
            <Controller
              control={control}
              name="clubName"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="next"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('createClubRequest.fields.clubName.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('holderFirstname')}
                  placeholder={t('createClubRequest.fields.clubName.placeholder')}
                  ref={ref}
                  value={value}
                />
              )}
            />
            <Controller
              control={control}
              name="holderFirstname"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="next"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('createClubRequest.fields.holderFirstname.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('holderLastname')}
                  placeholder={t('createClubRequest.fields.holderFirstname.placeholder')}
                  ref={ref}
                  value={value}
                />
              )}
            />
            <Controller
              control={control}
              name="holderLastname"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="next"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('createClubRequest.fields.holderLastname.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('holderPhone')}
                  placeholder={t('createClubRequest.fields.holderLastname.placeholder')}
                  ref={ref}
                  value={value}
                />
              )}
            />
            <Controller
              control={control}
              name="holderPhone"
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
              name="holderEmail"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  autoCapitalize="none"
                  autoComplete="email"
                  enterKeyHint="done"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  inputMode="email"
                  keyboardType="email-address"
                  label={t('createClubRequest.fields.holderEmail.label', 'Email du dirigeant')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={handleSubmit(handleFormSubmit)}
                  placeholder={t('createClubRequest.fields.holderEmail.placeholder', 'Email du dirigeant')}
                  ref={ref}
                  value={value}
                />
              )}
            />
          </View>
        </ScrollView>

        <Button
          disabled={createClubMutation.isPending}
          isLoading={createClubMutation.isPending}
          onPress={handleSubmit(handleFormSubmit)}
          title={t('createClubRequest.actions.create')}
          variant="Primary"
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default CreateClubRequest;
