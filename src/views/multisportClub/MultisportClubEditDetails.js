import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView, Platform, ScrollView, View,
} from 'react-native';

import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetMe } from '@/services/auth/authQueries';
import { getMultisportClubById, updateMultisportClub } from '@/services/multisportClub/multisportClubService';

import { getFieldError } from '@/utils/form/formUtils';

import MultisportStateView from './components/MultisportStateView';

/** @typedef {import('@/domains/auth/types').Avatar} Avatar */
/** @typedef {import('@/components/molecules/autocompleteSelect/types').Option} Option */
/**
 * @typedef {object} CMUpdatePayload
 * @property {string} [name]
 * @property {string} [email]
 * @property {string} [phoneNumber]
 * @property {Avatar | undefined} [logo]
 * @property {string} [addressLabel]
 * @property {string | number | null} [coordinates]
 */

const defaultValues = {
  email: '',
  name: '',
  phoneNumber: '',
};

const clubSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  name: Joi.string().required(),
  phoneNumber: Joi.string().allow('').optional(),
}).unknown(true);

/**
 * Multisport Club edit screen component. Allows admins to edit CM information.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Multisport Club edit screen component
 */
function MultisportClubEditDetails({ navigation, route }) {
  const { cmId } = route?.params ?? {};
  const {
    data: userData,
    error: userDataError,
    isLoading: isLoadingUserData,
    refetch: refetchUserData,
  } = useGetMe();
  const resolvedCmId = cmId || userData?.multisportClubs?.[0]?.documentId;

  // hooks
  const {
    Alignments, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const {
    data: cmData,
    error: cmError,
    isLoading: isLoadingCmData,
    refetch,
  } = useQuery({
    enabled: !!resolvedCmId,
    queryFn: () => getMultisportClubById(resolvedCmId),
    queryKey: ['multisport-club', resolvedCmId],
  });

  // local state
  const [logo, setLogo] = useState(/** @type {Avatar | undefined} */ (undefined));
  const [address, setAddress] = useState(/** @type {Option | undefined} */ (undefined));

  useEffect(() => {
    if (cmData?.logo?.url) {
      setLogo({ url: cmData.logo.url });
    }
  }, [cmData]);

  // Pre-fill address
  useEffect(() => {
    if (cmData && !address) {
      if (cmData.address) {
        // If address object exists (Location Picker format from backend)
        setAddress({
          label: cmData.addressDetails || cmData.address.label,
          value: `${cmData.address.lng}|${cmData.address.lat}`,
        });
      } else if (cmData.addressDetails) {
        // Fallback text only
        setAddress({
          label: cmData.addressDetails,
          value: null,
        });
      }
    }
  }, [cmData, address]);

  const updateCMMutation = useMutation({
    mutationFn: (/** @type {CMUpdatePayload} */ data) => updateMultisportClub(resolvedCmId, data),
    onSuccess: () => {
      refetch();
      navigation.goBack();
    },
  });

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    reset,
    setFocus,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(clubSchema),
    shouldFocusError: false,
  });

  useEffect(() => {
    if (cmData) {
      reset({
        email: cmData.email || '',
        name: cmData.name || '',
        phoneNumber: cmData.phoneNumber || '',
      });
    }
  }, [cmData, reset]);

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = (data) => {
    if (cmData && resolvedCmId) {
      updateCMMutation.mutate({
        ...data,
        addressLabel: address?.label,
        coordinates: address?.value, // "lon|lat" or null
        logo,
      });
    }
  };

  if (isLoadingUserData && !resolvedCmId) {
    return (
      <MultisportStateView
        description={t('multisport.edit.loadingUser', 'Nous preparons les informations de votre club multisport.')}
        isLoading
        title={t('multisport.edit.loadingUserTitle', 'Chargement du club')}
      />
    );
  }

  if (userDataError && !resolvedCmId) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'R\u00E9essayer')}
        description={t('multisport.edit.userError', "Impossible de retrouver votre structure multisport pour le moment.")}
        onAction={() => refetchUserData()}
        title={t('multisport.edit.userErrorTitle', 'Edition indisponible')}
      />
    );
  }

  if (!resolvedCmId) {
    return (
      <MultisportStateView
        description={t('multisport.fallback.noClub', 'Aucun club multisport associe a ce compte.')}
        title={t('multisport.fallback.noClubTitle', 'Aucun club multisport')}
      />
    );
  }

  if (isLoadingCmData && !cmData) {
    return (
      <MultisportStateView
        description={t('multisport.edit.loading', 'Nous chargeons les informations a modifier.')}
        isLoading
        title={t('multisport.edit.loadingTitle', 'Chargement de la fiche')}
      />
    );
  }

  if (cmError && !cmData) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'R\u00E9essayer')}
        description={t('multisport.edit.error', "Impossible de charger cette fiche multisport pour le moment.")}
        onAction={() => refetch()}
        title={t('multisport.edit.errorTitle', 'Edition indisponible')}
      />
    );
  }

  if (!isLoadingCmData && !cmError && !cmData) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'Actualiser')}
        description={t('multisport.edit.notFound', "Cette structure multisport est introuvable ou n est plus accessible.")}
        onAction={() => refetch()}
        title={t('multisport.edit.notFoundTitle', 'Club introuvable')}
      />
    );
  }

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
          keyboardShouldPersistTaps="handled"
          style={[Alignments.fill]}
        >
          <View style={[Alignments.fill, Spaces.gap[24]]}>
            <View style={[Alignments.row, Spaces.marginVertical[24]]}>
              <SelectAvatar
                currentAvatar={logo}
                imageResizeMode="contain"
                onAvatarSelected={(avatar) => setLogo(avatar)}
                size={110}
              />
            </View>

            <Controller
              control={control}
              name="name"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="next"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label="Nom du club"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('email')}
                  placeholder="Nom du club"
                  ref={ref}
                  value={value}
                />
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="next"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  inputMode="email"
                  keyboardType="email-address"
                  label="Email"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('phoneNumber')}
                  placeholder="Email"
                  ref={ref}
                  value={value}
                />
              )}
            />

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
                  label={t('multisport.edit.fields.phone.label', 'Téléphone')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t('multisport.edit.fields.phone.placeholder', 'Téléphone')}
                  ref={ref}
                  value={value}
                />
              )}
            />

            <View style={[Spaces.gap[8]]}>
              {/* Manual Label for consistency since AddressInput handles internal label differently sometimes */}
              <AutocompleteAddressInput
                address={address}
                label="Adresse / Ville"
                placeholder="Rechercher une adresse..."
                setAddress={(value) => setAddress(value)}
              />
            </View>
          </View>
        </ScrollView>

        <View style={[Spaces.marginBottom[16]]}>
          <Button
            disabled={isLoadingCmData || !cmData}
            isLoading={updateCMMutation.isPending}
            onPress={handleSubmit(handleFormSubmit)}
            title={t('common.actions.save') || 'Enregistrer'}
            variant="Primary"
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default MultisportClubEditDetails;
