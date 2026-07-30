import { joiResolver } from '@hookform/resolvers/joi';
import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';

import { getOtpCooldownRemainingSeconds } from '@/services/auth/otpSendThrottle';

import { getFieldError } from '@/utils/form/formUtils';
import { createLogger } from '@/utils/logger/logger';

import useSafeTimers from '@/hooks/useSafeTimers';

const otpLogger = createLogger('otp-form');

const defaultValues = {
  code: '',
};

const WEB_QA_BYPASS_FLAG = '__webQaBypass';
const LOCAL_FIREBASE_FALLBACK_FLAG = '__localFirebaseFallbackBypass';

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
 * @param {() => void} [props.onResend] - Redemande un SMS pour le même numéro.
 * @param {string} props.phoneNumber - The phone number
 * @returns {import('react').ReactElement}
 */
function OTPForm({
  confirm, isLoading, loginMutation, onResend = undefined, phoneNumber,
}) {
  const { Alignments, Spaces } = useTheme();
  const { t } = useTranslation();
  const { clearSafeTimer, setSafeInterval } = useSafeTimers();
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);
  // Avant, la seule façon de redemander un code était de quitter l'écran puis de
  // revenir : le hook se remontait, `confirm` repartait à vide, et un nouveau
  // SMS partait sans aucun délai. C'est ce chemin détourné qui a brûlé le quota
  // Firebase le 2026-07-29. On rend le renvoi explicite ET compté.
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(
    () => getOtpCooldownRemainingSeconds(phoneNumber),
  );
  const hasAutoSubmittedRef = useRef(false);
  const bypassConfirmation = /** @type {any} */ (confirm);
  const bypassPrefilledCode = (
    bypassConfirmation?.[WEB_QA_BYPASS_FLAG] === true
    || bypassConfirmation?.[LOCAL_FIREBASE_FALLBACK_FLAG] === true
  )
    ? '123456'
    : '';

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    setValue,
  } = useForm({
    defaultValues: {
      ...defaultValues,
      code: bypassPrefilledCode,
    },
    mode: 'onBlur',
    resolver: joiResolver(otpSchema),
    shouldFocusError: false,
  });

  useEffect(() => {
    setResendCooldownSeconds(getOtpCooldownRemainingSeconds(phoneNumber));
    const intervalId = setSafeInterval(() => {
      setResendCooldownSeconds(getOtpCooldownRemainingSeconds(phoneNumber));
    }, 1000);

    return () => clearSafeTimer(intervalId);
  }, [clearSafeTimer, phoneNumber, setSafeInterval]);

  useEffect(() => {
    if (!bypassPrefilledCode) return;
    setValue('code', bypassPrefilledCode, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [bypassPrefilledCode, setValue]);

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = useCallback(async (data) => {
    if (isLocalSubmitting) return;

    if (confirm && phoneNumber) {
      try {
        setIsLocalSubmitting(true);
        await loginMutation.mutateAsync({ code: data.code, confirm });
      } catch (error) {
        otpLogger.error('Login failed', error);
        // NE PAS remettre hasAutoSubmittedRef a false : l effet d envoi automatique
        // se redeclenche des que ce drapeau et isLocalSubmitting sont faux, ce qui
        // rejouait l envoi en boucle infinie (mesure a 3-5 req/s). L envoi auto ne
        // doit avoir lieu qu une fois ; apres un echec, c est a l utilisateur de
        // relancer via le bouton.
        setIsLocalSubmitting(false);
      }
    }
  }, [confirm, isLocalSubmitting, loginMutation, phoneNumber]);

  useEffect(() => {
    if (!bypassPrefilledCode || hasAutoSubmittedRef.current || isLocalSubmitting) {
      return;
    }

    hasAutoSubmittedRef.current = true;
    handleSubmit(handleFormSubmit)();
  }, [bypassPrefilledCode, handleFormSubmit, handleSubmit, isLocalSubmitting]);

  return (
    <View style={[Spaces.gap[24], Alignments.fullWidth]}>
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
        disabled={isLoading || isLocalSubmitting}
        isLoading={isLoading || isLocalSubmitting}
        onPress={handleSubmit(handleFormSubmit)}
        style={Alignments.fullWidth}
        title={t('otp.actions.confirm')}
        variant="Primary"
      />
      {onResend ? (
        <Button
          disabled={isLoading || isLocalSubmitting || resendCooldownSeconds > 0}
          onPress={onResend}
          style={Alignments.fullWidth}
          title={resendCooldownSeconds > 0
            ? `${t('otp.actions.resend', 'Renvoyer le code')} (${resendCooldownSeconds} s)`
            : t('otp.actions.resend', 'Renvoyer le code')}
          variant="Secondary"
        />
      ) : null}
    </View>
  );
}

export default OTPForm;
