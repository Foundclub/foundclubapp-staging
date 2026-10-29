import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Text,
  View,
} from 'react-native';

import { formatBirthdateToDisplay, isExistingBirthdate } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import TrainerInvitedModal from '@/components/organisms/trainerInvitedModal/TrainerInvitedModal';

import { createTrainer } from '@/services/auth/authService';
import { useGetClub } from '@/services/club/clubQueries';

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
 *  clubId?: string | null;
 *  isVisible: boolean;
 *  onClose: () => void;
 *  onTrainerCreated?: (trainer: User) => void;
 * }} props
 */
function CreateTrainerModal({
  clubId,
  isVisible,
  onClose,
  onTrainerCreated,
}) {
  const { t } = useTranslation();
  const { inviteTrainer, userData } = useAuth();
  // INVITESMS (29/10/2026, decision d'Adel « 2- A ») — l'entraineur cree ici n'etait prevenu par
  // personne. La feuille d'invitation d'AddCoach (SMS pre-rempli) s'ouvre apres la creation.
  const [entraineurCree, setEntraineurCree] = useState(
    /** @type {{ firstname?: string, phoneNumber?: string } | null} */ (null),
  );
  // Le nom du club, pour le SMS : en cache le plus souvent (l'ecran d'equipe l'a lu).
  const { data: club } = useGetClub(clubId || undefined, {
    enabled: Boolean(clubId) && (isVisible || Boolean(entraineurCree)),
  });
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
    setError,
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
    onSuccess: (/** @type {any} */ createdTrainer, /** @type {any} */ variables) => {
      if (onTrainerCreated && createdTrainer?.documentId) {
        onTrainerCreated(createdTrainer);
      }
      reset(defaultValues);
      onClose();
      setEntraineurCree({ ...variables, ...(createdTrainer || {}) });
    },
  });

  const handleFormSubmit = useCallback(
    (/** @type {typeof defaultValues & { clubId?: string }} */ data) => {
      // C04 Q2-06 — un jour qui n'existe pas (« 31/02/2010 ») est refusé ici, pas par le
      // schéma : sur le site, la doublure de Joi valide tout.
      if (data.birthdate && !isExistingBirthdate(data.birthdate)) {
        setError('birthdate', {
          message: t(
            'profile.errors.birthdateIncomplete',
            'Renseigne une date de naissance valide pour continuer.',
          ),
          type: 'date',
        });
        return;
      }
      createTrainerMutation.mutate({
        ...data,
        ...(clubId ? { clubId } : {}),
      });
    },
    [clubId, createTrainerMutation, setError, t],
  );

  const handleClose = useCallback(() => {
    if (createTrainerMutation.isPending) return;
    reset(defaultValues);
    onClose();
  }, [createTrainerMutation.isPending, onClose, reset]);

  return (
    <>
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
            {t('addCoach.titles.main', 'Ajouter un entraîneur')}
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
                // C04 Q2-13 — le pavé numérique n'a pas de « / » : la saisie se met en forme seule.
                onChangeText={(/** @type {string} */ texte) => (
                  onChange(formatBirthdateToDisplay(texte))
                )}
                placeholder="JJ/MM/AAAA"
                ref={ref}
                value={value}
              />
            )}
          />
        </View>
      </BottomModal>
      <TrainerInvitedModal
        isVisible={Boolean(entraineurCree)}
        onClose={() => setEntraineurCree(null)}
        onInvite={() => {
          if (entraineurCree) {
            inviteTrainer({
              clubId: clubId || undefined,
              clubName: club?.name || userData?.club?.name
                || t('addCoach.fallbacks.clubName', 'Club'),
              firstname: entraineurCree.firstname
                || t('addCoach.fallbacks.inviteFirstname', 'Coach / Prof'),
              phoneNumber: entraineurCree.phoneNumber,
            });
          }
          setEntraineurCree(null);
        }}
        trainerName={entraineurCree?.firstname || ''}
      />
    </>
  );
}

export default CreateTrainerModal;
