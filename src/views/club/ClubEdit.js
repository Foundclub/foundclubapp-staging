import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View,
} from 'react-native';

import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetClub } from '@/services/club/clubQueries';
import { updateClubInfo } from '@/services/club/clubService';

import { getFieldError } from '@/utils/form/formUtils';

/** @type {{ name: string; email: string; phoneNumber: string; addressDetails: string; activites: string[] }} */
const defaultValues = {
  activites: [],
  addressDetails: '',
  email: '',
  name: '',
  phoneNumber: '',
};

const clubSchema = Joi.object({
  activites: Joi.array().items(Joi.string().allow('')).optional(),
  addressDetails: Joi.string().allow('').optional(),
  email: Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  name: Joi.string().required(),
  phoneNumber: Joi.string().allow('').optional(),
}).unknown(true);

/**
 * Club edit screen component. Allows admins to edit club information.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Club edit screen component
 */
function ClubEdit({ navigation, route }) {
  const { clubId } = route?.params ?? {};

  // hooks
  const {
    Alignments, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const {
    data: clubData,
    error,
    isLoading,
    refetch,
  } = useGetClub(clubId);

  // local state
  const [logo, setLogo] = useState(
    /** @type {Avatar | undefined} */
    (undefined),
  );
  const [activitySearch, setActivitySearch] = useState('');

  const { data: allActivities } = useGetActivities();

  const activityOptions = useMemo(() => (allActivities || []).reduce((/** @type {Option[]} */ acc, activity) => {
    const activityName = String(activity?.name || '').trim();
    if (!activityName) return acc;
    if (activitySearch && !activityName.toLowerCase().includes(activitySearch.toLowerCase())) return acc;
    acc.push({
      label: activityName,
      value: activity.documentId || '',
    });
    return acc;
  }, []), [allActivities, activitySearch]);

  useEffect(() => {
    if (clubData?.logo?.url) {
      setLogo(clubData.logo);
    } else if (clubData?.sponsor?.[0]?.logo?.url) {
      // Fallback to first sponsor logo if no club logo?
      // Or maybe we don't want that.
      // Let's stick to club.logo.
    }
  }, [clubData]);

  const updateClubMutation = useMutation({
    mutationFn: updateClubInfo,
    onError: (error) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        error?.message || 'Impossible de mettre a jour ce club pour le moment.',
      );
    },
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
    defaultValues: {
      ...defaultValues,
    },
    mode: 'onBlur',
    resolver: joiResolver(clubSchema),
    shouldFocusError: false,
  });

  useEffect(() => {
    if (clubData) {
      let parsedAddress = '';
      try {
        parsedAddress = clubData.addressDetails ? JSON.parse(clubData.addressDetails)?.address || '' : '';
      } catch (_error) {
        parsedAddress = clubData.addressDetails || '';
      }

      reset({
        activites: (clubData.activites || []).map((activity) => activity.documentId).filter(Boolean),
        addressDetails: parsedAddress,
        email: clubData.email || '',
        name: clubData.name || '',
        phoneNumber: clubData.phoneNumber || '',
      });
    }
  }, [clubData, reset]);

  const isMissingClubId = !clubId;
  const isInitialClubLoading = isLoading && !clubData;
  const isClubLoadingError = Boolean(error) && !clubData;
  const isClubNotFound = Boolean(clubId) && !isLoading && !error && !clubData;

  if (isMissingClubId || isClubNotFound) {
    return (
      <ScreenContainer bgImage="bg2" contentContainerStyle={[Spaces.paddingVertical[24], Alignments.fill, Alignments.justifyCenter]}>
        <View style={[Spaces.gap[12]]}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
            {isMissingClubId ? 'Club introuvable' : 'Ce club est introuvable'}
          </Text>
          <Text style={{ color: '#c9d3dd', fontSize: 15 }}>
            {isMissingClubId
              ? 'Aucun identifiant de club n a ete fourni.'
              : 'Le lien est peut-etre obsolete ou le club a ete supprime.'}
          </Text>
          <Button onPress={() => navigation.navigate(RouteNames.ClubList)} title="Retour aux clubs" variant="Secondary" />
          {!isMissingClubId ? (
            <Button onPress={() => refetch()} title="R\u00E9essayer" variant="Primary" />
          ) : null}
        </View>
      </ScreenContainer>
    );
  }

  if (isInitialClubLoading) {
    return (
      <ScreenContainer bgImage="bg2" contentContainerStyle={[Spaces.paddingVertical[24], Alignments.fill, Alignments.justifyCenter]}>
        <View style={[Alignments.alignCenter, Spaces.gap[12]]}>
          <Loader />
          <Text style={{ color: '#c9d3dd', fontSize: 15 }}>
            Chargement du club...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isClubLoadingError) {
    return (
      <ScreenContainer bgImage="bg2" contentContainerStyle={[Spaces.paddingVertical[24], Alignments.fill, Alignments.justifyCenter]}>
        <View style={[Spaces.gap[12]]}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
            Impossible de charger le club
          </Text>
          <Text style={{ color: '#c9d3dd', fontSize: 15 }}>
            {error?.message || 'Reessayez dans quelques instants.'}
          </Text>
          <Button onPress={() => refetch()} title="R\u00E9essayer" variant="Primary" />
          <Button onPress={() => navigation.navigate(RouteNames.ClubList)} title="Retour aux clubs" variant="Secondary" />
        </View>
      </ScreenContainer>
    );
  }

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = (data) => {
    if (clubData) {
      updateClubMutation.mutate(/** @type {any} */ ({
        documentId: clubData.documentId,
        ...data,
        logo,
        // We need to handle addressDetails specifically if we want to save it as JSON string
        addressDetails: data.addressDetails ? JSON.stringify({ address: data.addressDetails }) : undefined,
      }));
    }
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
            <View style={[Alignments.row, Spaces.marginVertical[24]]}>
              <SelectAvatar
                currentAvatar={logo}
                imageResizeMode="contain"
                onAvatarSelected={setLogo}
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
                  label={t('club.fields.name.label') || 'Nom du club'}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('email')}
                  placeholder={t('club.fields.name.placeholder') || 'Nom du club'}
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
                  label={t('club.fields.email.label') || 'Email'}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('phoneNumber')}
                  placeholder={t('club.fields.email.placeholder') || 'Email'}
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
                  label={t('club.fields.phoneNumber.label') || 'Téléphone'}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('addressDetails')}
                  placeholder={t('club.fields.phoneNumber.placeholder') || 'Téléphone'}
                  ref={ref}
                  value={value}
                />
              )}
            />

            <Controller
              control={control}
              name="addressDetails"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="done"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('club.fields.address.label') || 'Adresse'}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t('club.fields.address.placeholder') || 'Adresse'}
                  ref={ref}
                  value={value}
                />
              )}
            />

            <Controller
              control={control}
              name="activites"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  isMulti
                  isSearchable
                  label={t('clubDetails.titles.activities') || 'Sports'}
                  onBlur={onBlur}
                  options={activityOptions}
                  placeholder={t('clubFilters.fields.activity.placeholder') || 'Sélectionner une activité'}
                  ref={ref}
                  searchValue={activitySearch}
                  setSearchValue={setActivitySearch}
                  setValue={(/** @type {Option[] | null} */ options) => onChange(
                    options?.map((option) => option.value).filter(Boolean) || [],
                  )}
                  value={(Array.isArray(value) ? value : [])
                    .map((activityId) => activityOptions.find((option) => option.value === activityId)?.label)
                    .filter(Boolean)
                    .join(', ')}
                />
              )}
            />
          </View>
        </ScrollView>

        <View style={[Spaces.marginBottom[16]]}>
          <Button
            disabled={!clubData}
            isLoading={updateClubMutation.isPending}
            onPress={handleSubmit(handleFormSubmit)}
            title={t('common.actions.save') || 'Enregistrer'}
            variant="Primary"
          />
          <View style={[Spaces.marginTop[8]]}>
            <Button
              onPress={() => navigation.goBack()}
              title={t('common.cancel', 'Annuler')}
              variant="Secondary"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default ClubEdit;
