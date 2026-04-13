import { joiResolver } from '@hookform/resolvers/joi';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import PhoneInput from '@/components/organisms/phoneInput/PhoneInput';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  phoneNumber: '',
};

const loginSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(/^\+\d{8,15}$/)
    .required(),
});

/**
 * Phone number input form component used for user sign in.
 * @param {object} props - Component props
 * @param {boolean} props.isLoading - Loading state of the form
 * @param {(data: { phoneNumber: string }) => void} props.onSubmit
 * @returns {import('react').ReactElement} Phone form component
 */
function PhoneForm({ isLoading, onSubmit }) {
  const { Alignments, Spaces } = useTheme();
  const { t } = useTranslation();

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(loginSchema),
    shouldFocusError: false,
  });

  return (
    <View style={[
      Alignments.fullWidth,
      Spaces.gap[24],
    ]}
    >
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
      <Button
        disabled={isLoading}
        isLoading={isLoading}
        onPress={handleSubmit(onSubmit)}
        style={Alignments.fullWidth}
        title={t('login.actions.login')}
        variant="Primary"
      />
    </View>
  );
}

export default PhoneForm;
