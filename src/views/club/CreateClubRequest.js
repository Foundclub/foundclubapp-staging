import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView, Platform, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import PhoneInput from '@/components/organisms/phoneInput/PhoneInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { createClubRequest } from '@/services/clubRequest/clubRequestService';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  clubName: '',
  holderFirstname: '',
  holderLastname: '',
  holderPhone: '',
};

const clubRequestSchema = Joi.object({
  clubName: Joi.string().required(),
  holderFirstname: Joi.string().required(),
  holderLastname: Joi.string().required(),
  holderPhone: Joi.string().required(),
});

/**
 * Club creation screen component. Allows users to create a new club.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Club creation screen component
 */
function CreateClubRequest({ navigation }) {
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
    resolver: joiResolver(clubRequestSchema),
    shouldFocusError: false,
  });

  const createClubMutation = useMutation({
    mutationFn: createClubRequest,
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
    createClubMutation.mutate(data);
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
          </View>
        </ScrollView>

        <Button
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
