import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { Joi } from '@/theme/strings';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import { dateCourte } from '@/components/organisms/invitationDeStaff/textesInvitationDeStaff';
import TrainerInvitedModal from '@/components/organisms/trainerInvitedModal/TrainerInvitedModal';

import { useGetClub } from '@/services/club/clubQueries';
import { sendStaffInvitation } from '@/services/staffInvitation/staffInvitationService';

import { displayErrorAlert } from '@/utils/errors/displayError';
import { getFieldError } from '@/utils/form/formUtils';

// INVITE-STAFF (10/11, « 1A ») : on invite comme coach, on ne crée plus de compte. La
// personne remplit elle-même son nom et sa date de naissance ; le prénom sert au message.
const defaultValues = {
  firstname: '',
  phoneNumber: '',
};

const schema = Joi.object({
  firstname: Joi.string().allow('').optional(),
  phoneNumber: Joi.string().required(),
}).unknown(true);

/**
 * La feuille « Inviter un coach » de la fiche d'équipe et de l'assistant d'équipe.
 * INVITE-STAFF (maquette validée le 10/11) : l'invitation part ; la personne accepte ou refuse.
 * La réponse est la même que le numéro ait un compte ou non : un seul succès à montrer.
 * `onTrainerCreated` n'est plus appelé : personne n'est créé ni ajouté avant son accord.
 * @param {{
 *  clubId?: string | null;
 *  isVisible: boolean;
 *  onClose: () => void;
 *  onTrainerCreated?: (trainer: User) => void;
 *  teamId?: string | null;
 * }} props
 * @returns {import('react').ReactElement} La feuille et son succès.
 */
function CreateTrainerModal({
  clubId,
  isVisible,
  onClose,
  teamId = null,
}) {
  const { t } = useTranslation();
  const { invitationDuStaff, inviteTrainer, userData } = useAuth();
  const [invitationEnvoyee, setInvitationEnvoyee] = useState(
    /** @type {{ expiresAt?: string, firstname?: string, phoneHint?: string, phoneNumber?: string } | null} */
    (null),
  );
  // Le nom du club, pour le SMS : en cache le plus souvent (l'écran d'équipe l'a lu).
  const { data: club } = useGetClub(clubId || undefined, {
    enabled: Boolean(clubId) && (isVisible || Boolean(invitationEnvoyee)),
  });
  const { Alignments, Fonts, Spaces } = useTheme();

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

  const inviteMutation = useMutation({
    meta: { preventToastError: true },
    mutationFn: sendStaffInvitation,
    onError: (error) => {
      // Une seule alerte, traduite, jamais le message brut.
      displayErrorAlert(error);
    },
    onSuccess: (/** @type {any} */ data, /** @type {any} */ variables) => {
      reset(defaultValues);
      onClose();
      setInvitationEnvoyee({ ...variables, ...(data?.invitation || {}) });
    },
  });

  const handleFormSubmit = useCallback(
    (/** @type {typeof defaultValues} */ data) => {
      inviteMutation.mutate({
        clubId: clubId || '',
        firstname: data.firstname,
        phoneNumber: data.phoneNumber,
        role: 'coach',
        teamId,
      });
    },
    [clubId, inviteMutation, teamId],
  );

  const handleClose = useCallback(() => {
    if (inviteMutation.isPending) return;
    reset(defaultValues);
    onClose();
  }, [inviteMutation.isPending, onClose, reset]);

  const clubName = club?.name || userData?.club?.name || t('addCoach.fallbacks.clubName', 'Club');
  const prenom = invitationEnvoyee?.firstname || t('addCoach.fallbacks.inviteFirstname', 'Coach / Prof');

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
              isLoading={inviteMutation.isPending}
              onPress={handleSubmit(handleFormSubmit)}
              style={{ flex: 1 }}
              title={t('staffInvitation.form.send')}
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
            {t('staffInvitation.form.title')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('staffInvitation.form.hint')}
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
                enterKeyHint="done"
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
        </View>
      </BottomModal>
      <TrainerInvitedModal
        isVisible={Boolean(invitationEnvoyee)}
        libelleInviter={t('staffInvitation.sent.actions.sms')}
        // RETOURS-TESTEUR-2 (M0077) : sur ordinateur, ce texte se copie ou part par e-mail.
        messageDInvitation={invitationEnvoyee ? invitationDuStaff?.({
          clubId: clubId || undefined,
          clubName,
          firstname: prenom,
        })?.message : ''}
        onClose={() => setInvitationEnvoyee(null)}
        onInvite={() => {
          if (invitationEnvoyee) {
            inviteTrainer({
              clubId: clubId || undefined,
              clubName,
              firstname: prenom,
              phoneNumber: invitationEnvoyee.phoneNumber,
            });
          }
          setInvitationEnvoyee(null);
        }}
        texte={t('staffInvitation.sent.description', {
          date: dateCourte(invitationEnvoyee?.expiresAt),
          hint: invitationEnvoyee?.phoneHint || '',
          role: t('staffInvitation.roles.coach'),
          ...SANS_ECHAPPEMENT,
        })}
        titre={t('staffInvitation.sent.title', {
          name: invitationEnvoyee?.firstname || t('staffInvitation.sent.fallbackName'),
          ...SANS_ECHAPPEMENT,
        })}
        trainerName={invitationEnvoyee?.firstname || ''}
      />
    </>
  );
}

export default CreateTrainerModal;
