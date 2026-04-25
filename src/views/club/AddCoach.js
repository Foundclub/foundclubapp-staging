import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import PhoneInput from '@/components/organisms/phoneInput/PhoneInput';
import TrainerInvitedModal from '@/components/organisms/trainerInvitedModal/TrainerInvitedModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ClubStateView from '@/views/club/components/ClubStateView';

import { createTrainer, linkTrainerToClub } from '@/services/auth/authService';
import { useGetClub } from '@/services/club/clubQueries';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  birthdate: '',
  firstname: '',
  lastname: '',
  phoneNumber: '',
};

const addCoachSchema = Joi.object({
  birthdate: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/).allow('').optional(),
  firstname: Joi.string().allow('').optional(),
  lastname: Joi.string().allow('').optional(),
  phoneNumber: Joi.string().required(),
}).unknown(true);

const sanitizeRouteParam = (value) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue || normalizedValue.startsWith(':')) {
    return '';
  }

  return normalizedValue;
};

/**
 * Add coach screen component. Allows club managers to add a new coach.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Add coach screen component
 */
function AddCoach({ navigation, route }) {
// local state
  const [avatar, setAvatar] = useState(
    /** @type {Avatar | undefined} */
    (undefined),
  );
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [createdTrainer, setCreatedTrainer] = useState(null);

  const { t } = useTranslation();
  const { Alignments, Spaces } = useTheme();
  const { formatBirthdateToDisplay, userData } = useAuth();
  const routeClubId = sanitizeRouteParam(route?.params?.clubId);
  const routeClubName = String(route?.params?.clubName || '').trim();
  const {
    data: clubData,
    error: clubError,
    isLoading: isLoadingClub,
    refetch: refetchClub,
  } = useGetClub(routeClubId, {
    enabled: !!routeClubId,
  });
  const resolvedClubName = routeClubName || clubData?.name || userData?.club?.name || 'Club';

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    setFocus,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(addCoachSchema),
    shouldFocusError: false,
  });

  const linkTrainerToClubMutation = useMutation({
    mutationFn: linkTrainerToClub,
    onError: () => {
      Alert.alert(
        t('common.error', 'Erreur'),
        "Impossible d'ajouter cet entraineur au club pour le moment.",
      );
    },
    onSuccess: () => {
      navigation.goBack();
    },
  });

  const { inviteTrainer } = useAuth();

  const createTrainerMutation = useMutation({
    mutationFn: createTrainer,
    onError: (/** @type {import('axios').AxiosError} */error) => {
      const errorResponse = error?.response?.data?.error;
      if (errorResponse?.message === 'Uniqueness check failed' && errorResponse?.details?.user) {
        const { user } = errorResponse.details;
        if (user?.club) {
          Alert.alert(
            t('addCoach.alerts.alreadyInClub.title'),
            t(
              'addCoach.alerts.alreadyInClub.description',
              {
                firstname: user.firstname,
                lastname: user.lastname,
              },
            ),

          );
        } else if (user) {
          Alert.alert(
            t('addCoach.alerts.alreadyExist.title'),
            t('addCoach.alerts.alreadyExist.description', {
              firstname: user.firstname,
              lastname: user.lastname,
            }),
            [
              {
                style: 'cancel',
                text: t('addCoach.alerts.alreadyExist.actions.cancel'),
              },
              {
                onPress: () => {
                  linkTrainerToClubMutation.mutate(user.documentId);
                },
                text: t('addCoach.alerts.alreadyExist.actions.addToClub'),
              },
            ],
          );
        }
      } else {
        // Fallback generic error
        Alert.alert(
          t('APIerrors.error'), // Or a generic title
          error?.response?.data?.error?.message || error.message || t('APIerrors.unknown'),
        );
      }
    },
    onSuccess: (data, variables) => {
      setCreatedTrainer({ ...(data?.data || {}), ...variables });
      setIsSuccessModalVisible(true);
    },
  });

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = (data) => {
    createTrainerMutation.mutate({
      ...data,
      avatar,
    });
  };

  if (!routeClubId) {
    return (
      <ClubStateView
        description="Impossible d'ouvrir ce formulaire sans club valide. Revenez a la fiche club puis relancez l'ajout."
        title="Club introuvable"
      />
    );
  }

  if (isLoadingClub && !clubData) {
    return (
      <ClubStateView
        description="Nous récupérons les informations du club pour preparer l'ajout du coach."
        isLoading
        title="Chargement du club"
      />
    );
  }

  if (clubError && !clubData) {
    return (
      <ClubStateView
        actionLabel="Réessayer"
        description="Impossible de charger ce club pour le moment."
        onAction={() => refetchClub()}
        title="Ajout indisponible"
      />
    );
  }

  if (!isLoadingClub && !clubError && !clubData) {
    return (
      <ClubStateView
        actionLabel="Actualiser"
        description="Ce club est introuvable ou n'est plus accessible."
        onAction={() => refetchClub()}
        title="Club introuvable"
      />
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
        style={[
          Alignments.fill,
          Alignments.justifySpaceBetween,
        ]}
      >
        <ScrollView
          contentContainerStyle={[
            Spaces.gap[24],
            Spaces.paddingBottom[40],
          ]}
          style={[Alignments.fill]}
        >
          <View style={[Alignments.fill, Spaces.gap[24]]}>
            <View style={[Alignments.row, Spaces.marginVertical[24]]}>
              <SelectAvatar
                currentAvatar={avatar}
                onAvatarSelected={setAvatar}
                size={110}
              />
            </View>

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
                  label={`${t('profile.fields.phoneNumber.label')} *`}
                  onBlur={onBlur}
                  onChange={onChange}
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
                  label={t('profile.fields.firstname.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('lastname')}
                  placeholder={t('profile.fields.firstname.placeholder')}
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
                  label={t('profile.fields.lastname.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('birthdate')}
                  placeholder={t('profile.fields.lastname.placeholder')}
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
                  label={t('profile.fields.birthdate.label')}
                  maxLength={10}
                  onBlur={onBlur}
                  onChangeText={(text) => onChange(formatBirthdateToDisplay(text))}
                  placeholder="JJ/MM/AAAA"
                  ref={ref}
                  value={value}
                />
              )}
            />
          </View>
        </ScrollView>

        <Button
          disabled={!!Object.keys(formErrors).length}
          isLoading={createTrainerMutation.isPending}
          onPress={handleSubmit(handleFormSubmit)}
          title={t('addCoach.actions.save')}
          variant="Primary"
        />
      </KeyboardAvoidingView>
      <TrainerInvitedModal
        isVisible={isSuccessModalVisible}
        onClose={() => {
          setIsSuccessModalVisible(false);
          navigation.goBack();
        }}
        onInvite={() => {
          if (createdTrainer) {
            inviteTrainer({
              clubId: routeClubId || clubData?.documentId || userData?.club?.documentId,
              clubName: resolvedClubName,
              firstname: createdTrainer.firstname || 'Coach',
              phoneNumber: createdTrainer.phoneNumber,
            });
          }
          setIsSuccessModalVisible(false);
          navigation.goBack();
        }}
        trainerName={createdTrainer?.firstname || ''}
      />
    </ScreenContainer>
  );
}

export default AddCoach;
