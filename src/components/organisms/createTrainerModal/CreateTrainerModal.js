import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Text,
  View,
} from 'react-native';

import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';

import { createTrainer } from '@/services/auth/authService';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  birthdate: '',
  firstname: '',
  lastname: '',
  phoneNumber: '',
};

const schema = Joi.object({
  birthdate: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/).allow('').optional(),
  firstname: Joi.string().allow('').optional(),
  lastname: Joi.string().allow('').optional(),
  phoneNumber: Joi.string().required(),
}).unknown(true);

/**
 * @param {{
 *  isVisible: boolean;
 *  onClose: () => void;
 *  onTrainerCreated?: (trainer: User) => void;
 * }} props
 */
function CreateTrainerModal({ isVisible, onClose, onTrainerCreated }) {
  const { t } = useTranslation();
  const {
    Alignments,
    Fonts,
    Spaces,
  } = useTheme();

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    reset,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(schema),
    shouldFocusError: false,
  });

  const createTrainerMutation = useMutation({
    mutationFn: createTrainer,
    onError: (error) => {
      const message = error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : t('APIerrors.unknown');
      Alert.alert(t('common.error', 'Erreur'), message);
    },
    onSuccess: (createdTrainer) => {
      if (onTrainerCreated && createdTrainer?.documentId) {
        onTrainerCreated(createdTrainer);
      }
      reset(defaultValues);
      onClose();
      Alert.alert(
        t('common.success', 'Succes'),
        t('addCoach.alerts.success.title', 'Entraineur ajoute avec succes'),
      );
    },
  });

  const handleFormSubmit = useCallback(
    (data) => {
      createTrainerMutation.mutate(data);
    },
    [createTrainerMutation],
  );

  const handleClose = useCallback(() => {
    if (createTrainerMutation.isPending) return;
    reset(defaultValues);
    onClose();
  }, [createTrainerMutation.isPending, onClose, reset]);

  return (
    <BottomModal
      close={handleClose}
      footerComponent={(
        <View style={[Alignments.row, Spaces.gap[12]]}>
          <Button
            onPress={handleClose}
            style={{ flex: 1 }}
            title={t('common.cancel', 'Annuler')}
            variant="Secondary"
          />
          <Button
            isLoading={createTrainerMutation.isPending}
            onPress={handleSubmit(handleFormSubmit)}
            style={{ flex: 1 }}
            title={t('addCoach.actions.save', 'Ajouter')}
            variant="Primary"
          />
        </View>
      )}
      isVisible={isVisible}
      snapPoints={['82%']}
      style={{ minHeight: 560 }}
    >
      <View style={[Spaces.gap[16]]}>
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t('addCoach.titles.main', 'Ajouter un entraineur')}
        </Text>

        <Controller
          control={control}
          name="phoneNumber"
          render={({
            field: {
              name, onBlur, onChange, ref, value,
            },
          }) => (
            <Input
              enterKeyHint="next"
              error={getFieldError({ errors: formErrors, fieldName: name })}
              inputMode="tel"
              keyboardType="phone-pad"
              label={`${t('profile.fields.phoneNumber.label', 'Telephone')} *`}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder={t('login.fields.phoneNumber.placeholder', '06 00 00 00 00')}
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
              label={t('profile.fields.firstname.label', 'Prenom')}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder={t('profile.fields.firstname.placeholder', 'Prenom')}
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
              label={t('profile.fields.lastname.label', 'Nom')}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder={t('profile.fields.lastname.placeholder', 'Nom')}
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
              label={t('profile.fields.birthdate.label', 'Date de naissance')}
              maxLength={10}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="JJ/MM/AAAA"
              ref={ref}
              value={value}
            />
          )}
        />
      </View>
    </BottomModal>
  );
}

export default CreateTrainerModal;
