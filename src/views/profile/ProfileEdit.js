import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView, Platform, Switch, Text, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import useAuth from '@/domains/auth/useAuth';
import usePlaces from '@/domains/places/usePlaces';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ParentalDeclarationCard from '@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { updateMe } from '@/services/auth/authService';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';

import { getFieldError } from '@/utils/form/formUtils';

import {
  buildMinorParentalDeclarationPayload,
  isBirthdateUnder13,
} from '@/constants/parentalDeclaration';
import { SPORTS_POSITIONS } from '@/constants/sportsPositions';

const defaultValues = {
  address: null,
  bestLevel: '',
  birthdate: '',
  category: '',
  firstname: '',
  height: '',
  isLookingForClub: false,
  jerseyNumber: '',
  lastname: '',
  nationality: '',
  phoneNumber: '',
  position: '',
  preferredSport: '',
  section: '',
  weight: '',
};

// Champs specifiques carte de collection : forces en plus du gating par role
// quand l'edition est ouverte depuis la carte (source: 'player_card').
const CARD_EXTRA_FIELDS = ['position', 'preferredSport', 'nationality', 'jerseyNumber', 'isLookingForClub'];

const buildProfileFormValues = (userData, formatBirthdateToDisplay) => ({
  ...defaultValues,
  ...userData,
  address: userData?.address || null,
  bestLevel: userData?.bestLevel || '',
  birthdate: formatBirthdateToDisplay(userData?.birthdate || ''),
  category: userData?.category || '',
  height: userData?.height ? String(userData.height) : '',
  jerseyNumber: userData?.jerseyNumber != null ? String(userData.jerseyNumber) : '',
  nationality: userData?.nationality || '',
  preferredSport: userData?.preferredSport || '',
  section: userData?.section?.documentId || '',
  weight: userData?.weight ? String(userData.weight) : '',
});

const profileSchema = Joi.object({
  address: Joi.object().allow(null).optional(),
  bestLevel: Joi.string().allow(null, '').optional(),
  birthdate: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/).allow('').optional(),
  category: Joi.string().allow(null, '').optional(),
  documentId: Joi.string().allow(null, '').optional(),
  firstname: Joi.string().required(),
  height: Joi.string().allow(null, '').optional(),
  isLookingForClub: Joi.boolean().optional(),
  jerseyNumber: Joi.string().pattern(/^([0-9]{1,2})?$/).allow('').optional(),
  lastname: Joi.string().required(),
  nationality: Joi.string().allow(null, '').optional(),
  phoneNumber: Joi.string(),
  position: Joi.string().allow(null, '').optional(),
  preferredSport: Joi.string().allow(null, '').optional(),
  section: Joi.string().allow(null, '').optional(),
  weight: Joi.string().allow(null, '').optional(),
}).unknown(true);

/**
 * Profile edit screen component. Allows users to edit their profile information.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Profile edit screen component
 */
function ProfileEdit({ navigation, route }) {
  // hooks
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: sections } = useGetSections();
  const { data: levels } = useGetLevels();
  const {
    formatBirthdateToDisplay,
    formatBirthdateToSend,
    profileFields,
    refetchUserData,
    userData,
  } = useAuth();
  const { getGeohashForPointAndRadius } = usePlaces();

  // Edition depuis la carte de collection : on force les champs de la carte
  // (numero, nationalite, poste, sport, dispo) en plus du gating par role.
  const isCardEdit = route?.params?.source === 'player_card';
  const effectiveFields = isCardEdit
    ? Array.from(new Set([...(profileFields || []), ...CARD_EXTRA_FIELDS]))
    : profileFields;

  // local state
  const [avatar, setAvatar] = useState(
    /** @type {Avatar | undefined} */
    (undefined),
  );
  const [parentalDeclarationChecked, setParentalDeclarationChecked] = useState(false);
  const hydratedUserKeyRef = useRef(null);
  const hydratedSignatureRef = useRef('');

  const sectionOptions = sections?.map((section) => ({
    label: section.name,
    value: section.documentId,
  })) || [];

  const levelOptions = levels?.map((level) => ({
    label: level.name,
    value: level.name,
  })) || [];

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'get-me',
      });
      await refetchUserData?.();
      navigation.goBack();
    },
  });

  const {
    control,
    formState: { errors: formErrors, isDirty },
    handleSubmit,
    reset,
    setFocus,
    setValue,
    watch,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(profileSchema),
    shouldFocusError: false,
  });

  useEffect(() => {
    const nextUserKey = userData?.documentId || userData?.id;
    if (!nextUserKey) {
      return;
    }

    const switchedUser = hydratedUserKeyRef.current !== nextUserKey;
    if (!switchedUser && isDirty) {
      return;
    }

    const nextValues = buildProfileFormValues(userData, formatBirthdateToDisplay);
    const nextSignature = JSON.stringify(nextValues);
    if (!switchedUser && hydratedSignatureRef.current === nextSignature) {
      return;
    }

    reset(nextValues);
    setAvatar(userData?.avatar?.url ? { url: userData.avatar.url } : undefined);
    setParentalDeclarationChecked(false);
    hydratedUserKeyRef.current = nextUserKey;
    hydratedSignatureRef.current = nextSignature;
  }, [formatBirthdateToDisplay, isDirty, reset, userData]);

  const preferredSport = watch('preferredSport');
  const watchedBirthdate = watch('birthdate');
  const requiresParentalDeclaration = Boolean(
    watchedBirthdate
    && isBirthdateUnder13(formatBirthdateToSend(watchedBirthdate || ''))
    && userData?.parentalDeclarationAccepted !== true,
  );

  useEffect(() => {
    const focusField = route?.params?.focusField;
    if (!focusField) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setFocus(focusField);
      navigation.setParams({ focusField: undefined });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [navigation, route?.params?.focusField, setFocus]);

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = (data) => {
    if (userData) {
      // Compute geohash
      let geohash = null;
      if (data.address && data.address.value) {
        const coords = data.address.value.split('|');
        if (coords.length === 2) {
          // Value is "lon|lat" based on MercatoFilters usage
          geohash = getGeohashForPointAndRadius(
            parseFloat(coords[1]), // lat
            parseFloat(coords[0]), // lon
            0.001, // High precision (point)
          );
        }
      }

      updateUserMutation.mutate({
        address: data.address,
        avatar,
        bestLevel: data.bestLevel,
        birthdate: formatBirthdateToSend(data.birthdate || ''),
        category: data.category,
        firstname: data.firstname,
        geohash,
        height: data.height,
        isLookingForClub: data.isLookingForClub,
        jerseyNumber: data.jerseyNumber === '' ? null : Number.parseInt(data.jerseyNumber, 10),
        lastname: data.lastname,
        nationality: data.nationality,
        ...(requiresParentalDeclaration ? {
          legalAcceptance: buildMinorParentalDeclarationPayload({
            metadata: {
              birthdate: formatBirthdateToSend(data.birthdate || ''),
              childUserDocumentId: userData?.documentId || null,
            },
            sourceScreen: 'profile_edit_parental_declaration',
            targetDocumentId: userData?.documentId || null,
          }),
          parentalDeclarationAccepted: true,
        } : {}),
        position: data.position,
        preferredSport: data.preferredSport,
        section: data.section,
        weight: data.weight,
      });
    }
  };

  const getSportOptions = () => {
    const defaultSports = [
      { label: 'Football', value: 'football' },
      { label: 'Basketball', value: 'basketball' },
      { label: 'Handball', value: 'handball' },
      { label: 'Volleyball', value: 'volleyball' },
      { label: 'Autre', value: 'other' },
    ];

    // Add current user sport if not in list
    if (userData?.preferredSport && !defaultSports.find((s) => s.value === userData.preferredSport)) {
      // Format label (capitalize first letter)
      const label = userData.preferredSport.charAt(0).toUpperCase() + userData.preferredSport.slice(1);
      defaultSports.unshift({ label, value: userData.preferredSport });
    }

    return defaultSports;
  };

  return (
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialSource: undefined,
          tutorialStartToken: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.PROFILE_EDIT}
      userId={userData?.documentId}
    >
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
            <OnboardingWrapper
              description="Mettez à jour vos informations personnelles, sportives et votre visibilité."
              id="profile-edit-form"
              order={1}
              spotlight={{
                borderRadius: 16,
                maxHeight: 280,
                overlayOpacity: 0.4,
                paddingX: 2,
                paddingY: 2,
              }}
              title="Edition du profil"
            >
              <View style={[Alignments.fill, Spaces.gap[24]]}>
                <View style={[Alignments.row, Spaces.marginVertical[24]]}>
                  <SelectAvatar
                    currentAvatar={avatar}
                    onAvatarSelected={setAvatar}
                    onDelete={() => setAvatar(undefined)}
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
                    <Input
                      editable={false}
                      error={getFieldError({ errors: formErrors, fieldName: name })}
                      label={t('profile.fields.phoneNumber.label')}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      placeholder={t('profile.fields.phoneNumber.placeholder')}
                      readOnly
                      ref={ref}
                      value={value}
                    />
                  )}
                />

                {profileFields?.includes('firstname') ? (
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
                ) : null}
                {profileFields?.includes('lastname') ? (
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
                ) : null}
                {profileFields?.includes('birthdate') ? (
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
                ) : null}
                {profileFields?.includes('section') ? (
                  <Controller
                    control={control}
                    name="section"
                    render={({
                      field: {
                        name, onBlur, onChange, ref, value,
                      },
                    }) => (
                      <AutocompleteSelect
                        error={getFieldError({ errors: formErrors, fieldName: name })}
                        label={t('profile.fields.section.label')}
                        onBlur={onBlur}
                        options={sectionOptions}
                        placeholder={t('profile.fields.section.placeholder')}
                        ref={ref}
                        setValue={
                      (/** @type {{value: string, label: string}} */option) => { onChange(option?.value || ''); }
                    }
                        value={sectionOptions.find((option) => option.value === value)?.label || ''}
                      />
                    )}
                  />
                ) : null}

                {profileFields?.includes('weight') ? (
                  <Controller
                    control={control}
                    name="weight"
                    render={({
                      field: {
                        name, onBlur, onChange, ref, value,
                      },
                    }) => (
                      <Input
                        enterKeyHint="next"
                        error={getFieldError({ errors: formErrors, fieldName: name })}
                        inputMode="decimal"
                        keyboardType="number-pad"
                        label={t('profile.fields.weight.label')}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        onSubmitEditing={() => setFocus('height')}
                        placeholder={t('profile.fields.weight.placeholder')}
                        ref={ref}
                        value={value}
                      />
                    )}
                  />
                ) : null}

                {profileFields?.includes('bestLevel') ? (
                  <Controller
                    control={control}
                    name="bestLevel"
                    render={({
                      field: {
                        name, onBlur, onChange, ref, value,
                      },
                    }) => (
                      <AutocompleteSelect
                        error={getFieldError({ errors: formErrors, fieldName: name })}
                        label={t('profile.fields.bestLevel.label', 'Meilleur niveau')}
                        onBlur={onBlur}
                        options={levelOptions}
                        placeholder={t('profile.fields.bestLevel.placeholder', 'Sélectionner un niveau')}
                        ref={ref}
                        setValue={
                      (/** @type {{value: string, label: string}} */option) => { onChange(option?.value || ''); }
                    }
                        value={value}
                      />
                    )}
                  />
                ) : null}

                {/* Category Selector */}
                <Controller
                  control={control}
                  name="category"
                  render={({
                    field: {
                      name, onBlur, onChange, ref, value,
                    },
                  }) => (
                    <AutocompleteSelect
                      error={getFieldError({ errors: formErrors, fieldName: name })}
                      isMulti
                      label={t('profile.fields.category.label', 'Catégorie')}
                      onBlur={onBlur}
                      options={[
                        { label: 'U7', value: 'U7' },
                        { label: 'U8', value: 'U8' },
                        { label: 'U9', value: 'U9' },
                        { label: 'U10', value: 'U10' },
                        { label: 'U11', value: 'U11' },
                        { label: 'U12', value: 'U12' },
                        { label: 'U13', value: 'U13' },
                        { label: 'U14', value: 'U14' },
                        { label: 'U15', value: 'U15' },
                        { label: 'U16', value: 'U16' },
                        { label: 'U17', value: 'U17' },
                        { label: 'U18', value: 'U18' },
                        { label: 'U19', value: 'U19' },
                        { label: 'U20', value: 'U20' },
                        { label: 'U21', value: 'U21' },
                        { label: 'U23', value: 'U23' },
                        { label: 'Senior', value: 'Senior' },
                        { label: 'Vétéran', value: 'Veteran' },
                      ]}
                      placeholder={t('profile.fields.category.placeholder', 'Sélectionner une catégorie')}
                      ref={ref}
                      setValue={
                    (/** @type {{value: string, label: string}[]} */options) => {
                      onChange(options?.map((o) => o.value).join(', ') || '');
                    }
                  }
                      value={value ? value.split(', ') : []}
                    />
                  )}
                />

                {profileFields?.includes('height') ? (
                  <Controller
                    control={control}
                    name="height"
                    render={({
                      field: {
                        name, onBlur, onChange, ref, value,
                      },
                    }) => (
                      <Input
                        enterKeyHint="next"
                        error={getFieldError({ errors: formErrors, fieldName: name })}
                        inputMode="decimal"
                        keyboardType="number-pad"
                        label={t('profile.fields.height.label')}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        onSubmitEditing={() => setFocus('preferredSport')}
                        placeholder={t('profile.fields.height.placeholder')}
                        ref={ref}
                        value={value}
                      />
                    )}
                  />
                ) : null}

                <Controller
                  control={control}
                  name="preferredSport"
                  render={({
                    field: {
                      name, onBlur, onChange, ref, value,
                    },
                  }) => (
                    <AutocompleteSelect
                      error={getFieldError({ errors: formErrors, fieldName: name })}
                      label={t('profile.fields.preferredSport.label', 'Sport de préférence')}
                      onBlur={onBlur}
                      options={getSportOptions()}
                      placeholder={t('profile.fields.preferredSport.placeholder', 'Sélectionner un sport')}
                      ref={ref}
                      setValue={
                    (/** @type {{value: string, label: string}} */option) => {
                      onChange(option?.value || '');
                      setValue('position', '');
                    }
                  }
                      value={value}
                    />
                  )}
                />

                {effectiveFields?.includes('position') ? (
                  <Controller
                    control={control}
                    name="position"
                    render={({
                      field: {
                        name, onBlur, onChange, ref, value,
                      },
                    }) => {
                      const sportKey = Object.keys(SPORTS_POSITIONS).find((k) => k.toLowerCase() === preferredSport);
                      const positions = sportKey ? SPORTS_POSITIONS[sportKey] : [];

                      if (positions.length > 0) {
                        return (
                          <AutocompleteSelect
                            error={getFieldError({ errors: formErrors, fieldName: name })}
                            label={t('profile.fields.position.label')}
                            onBlur={onBlur}
                            options={positions.map((p) => ({ label: p, value: p }))}
                            placeholder={t('profile.fields.position.placeholder')}
                            ref={ref}
                            setValue={
                          (/** @type {{value: string, label: string}} */option) => { onChange(option?.value || ''); }
                        }
                            value={value}
                          />
                        );
                      }

                      return (
                        <Input
                          enterKeyHint="done"
                          error={getFieldError({ errors: formErrors, fieldName: name })}
                          label={t('profile.fields.position.label')}
                          onBlur={onBlur}
                          onChangeText={onChange}
                          placeholder={t('profile.fields.position.placeholder')}
                          ref={ref}
                          value={value}
                        />
                      );
                    }}
                  />
                ) : null}

                {effectiveFields?.includes('nationality') ? (
                  <Controller
                    control={control}
                    name="nationality"
                    render={({
                      field: {
                        name, onBlur, onChange, ref, value,
                      },
                    }) => (
                      <Input
                        enterKeyHint="next"
                        error={getFieldError({ errors: formErrors, fieldName: name })}
                        label={t('profile.fields.nationality.label', 'Nationalité')}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        placeholder={t('profile.fields.nationality.placeholder', 'Ex. Française, FRA…')}
                        ref={ref}
                        value={value}
                      />
                    )}
                  />
                ) : null}

                {effectiveFields?.includes('jerseyNumber') ? (
                  <Controller
                    control={control}
                    name="jerseyNumber"
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
                        label={t('profile.fields.jerseyNumber.label', 'Numéro de maillot')}
                        maxLength={2}
                        onBlur={onBlur}
                        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
                        placeholder={t('profile.fields.jerseyNumber.placeholder', 'Ex. 10 (vide = automatique)')}
                        ref={ref}
                        value={value}
                      />
                    )}
                  />
                ) : null}

                <Controller
                  control={control}
                  name="address"
                  render={({
                    field: {
                      onChange, value,
                    },
                  }) => (
                    <AutocompleteAddressInput
                      address={value}
                      error={getFieldError({ errors: formErrors, fieldName: 'address' })}
                      label={t('profile.fields.city.label', 'Ville')}
                      placeholder={t('profile.fields.city.placeholder', 'Rechercher une ville')}
                      setAddress={onChange}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="isLookingForClub"
                  render={({
                    field: {
                      onChange, value,
                    },
                  }) => (
                    <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.paddingVertical[8]]}>
                      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                        {t('profile.fields.isLookingForClub.label', 'Profil visible')}
                      </Text>
                      <Switch
                        onValueChange={onChange}
                        trackColor={{ false: '#767577', true: '#81b0ff' }} // TODO: Use theme colors
                        value={value}
                      />
                    </View>
                  )}
                />

                {requiresParentalDeclaration ? (
                  <ParentalDeclarationCard
                    checked={parentalDeclarationChecked}
                    helperText={!parentalDeclarationChecked ? 'Cette confirmation est obligatoire pour enregistrer un profil de moins de 13 ans.' : ''}
                    onChange={setParentalDeclarationChecked}
                  />
                ) : null}
              </View>
            </OnboardingWrapper>
          </ScrollView>

          <OnboardingWrapper
            description="Enregistrez vos modifications pour mettre à jour votre profil."
            id="profile-edit-save"
            order={2}
            spotlight={{
              borderRadius: 30, overlayOpacity: 0.4, paddingX: 2, paddingY: 2,
            }}
            title="Enregistrer"
          >
            <Button
              disabled={requiresParentalDeclaration && !parentalDeclarationChecked}
              isLoading={updateUserMutation.isPending}
              onPress={handleSubmit(handleFormSubmit)}
              title={t('profile.actions.save')}
              variant="Primary"
            />
          </OnboardingWrapper>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default ProfileEdit;
