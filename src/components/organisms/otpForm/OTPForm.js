import { joiResolver } from '@hookform/resolvers/joi';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  code: '',
};

const otpSchema = Joi.object({
  code: Joi.string().length(6).required(),
});

/**
 * OTPForm component.
 * @param {object} props - The props
 * @param {import('@react-native-firebase/auth').FirebaseAuthTypes.ConfirmationResult
 * | undefined} props.confirm
 * @param {any} props.loginMutation
 * @param {boolean} props.isLoading - The loading state
 * @param {string} props.phoneNumber - The phone number
 * @returns {import('react').ReactElement}
 */
function OTPForm({
  confirm, isLoading, loginMutation, phoneNumber,
}) {
  const { Alignments, Spaces } = useTheme();
  const { t } = useTranslation();

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(otpSchema),
    shouldFocusError: false,
  });

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = async (data) => {
    console.log('[OTPForm] handleFormSubmit called, confirm:', JSON.stringify(confirm));
    console.log('[OTPForm] phoneNumber prop:', phoneNumber);
    if (confirm && phoneNumber) {
      await loginMutation.mutate({ code: data.code, confirm });
    }
  };

  return (
    <View style={[Spaces.gap[40], Alignments.fill, Alignments.justifySpaceBetween]}>
      <Controller
        control={control}
        name="code"
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
            label={t('otp.fields.code.label')}
            maxLength={6}
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder={t('otp.fields.code.placeholder')}
            ref={ref}
            value={value}
          />
        )}
      />
      <Button
        disabled={isLoading}
        isLoading={isLoading}
        onPress={handleSubmit(handleFormSubmit)}
        style={Alignments.fullWidth}
        title={t('otp.actions.confirm')}
        variant="Primary"
      />
    </View>
  );
}

export default OTPForm;
