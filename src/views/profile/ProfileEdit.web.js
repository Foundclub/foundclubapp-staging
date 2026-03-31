import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import usePlaces from '@/domains/places/usePlaces';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';

import { SPORTS_POSITIONS } from '@/constants/sportsPositions';

const defaultValues = {
  address: null,
  bestLevel: '',
  birthdate: '',
  category: '',
  firstname: '',
  height: '',
  isLookingForClub: false,
  lastname: '',
  phoneNumber: '',
  position: '',
  preferredSport: '',
  section: '',
  weight: '',
};

const categoryOptions = [
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
  { label: 'Veteran', value: 'Veteran' },
];

const buildProfileFormValues = (userData, formatBirthdateToDisplay) => ({
  ...defaultValues,
  ...userData,
  address: userData?.address || null,
  bestLevel: userData?.bestLevel || '',
  birthdate: formatBirthdateToDisplay(userData?.birthdate || ''),
  category: userData?.category || '',
  height: userData?.height ? String(userData.height) : '',
  preferredSport: userData?.preferredSport || '',
  section: userData?.section?.documentId || '',
  weight: userData?.weight ? String(userData.weight) : '',
});

const hasAnyFormError = (errors) => Object.values(errors).some(Boolean);

/**
 * @param {string} value
 * @returns {boolean}
 */
const isBirthdateDisplayValid = (value) => {
  if (!value) return true;
  return /^(\d{2}\/\d{2}\/\d{4})$/.test(String(value).trim());
};

/**
 * @param {typeof defaultValues} values
 * @returns {Record<string, string>}
 */
const validateValues = (values) => {
  /** @type {Record<string, string>} */
  const nextErrors = {};

  if (!String(values.firstname || '').trim()) {
    nextErrors.firstname = 'Champ obligatoire';
  }
  if (!String(values.lastname || '').trim()) {
    nextErrors.lastname = 'Champ obligatoire';
  }
  if (!isBirthdateDisplayValid(values.birthdate)) {
    nextErrors.birthdate = 'Format attendu: JJ/MM/AAAA';
  }

  return nextErrors;
};

/**
 * Profile edit web screen.
 * Keeps the same business mutation as native while avoiding the fragile form resolver path on web.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function ProfileEditWeb({ navigation, route }) {
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { data: fetchedUserData } = useGetMe();
  const { data: sections } = useGetSections();
  const { data: levels } = useGetLevels();
  const {
    formatBirthdateToDisplay, formatBirthdateToSend, profileFields, userData: authUserData,
  } = useAuth();
  const userData = fetchedUserData || authUserData;
  const { getGeohashForPointAndRadius } = usePlaces();

  const [avatar, setAvatar] = useState(
    /** @type {Avatar | undefined} */
    (undefined),
  );
  const [formValues, setFormValues] = useState(defaultValues);
  const [formErrors, setFormErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');
  const hydratedUserKeyRef = useRef(null);
  const hydratedSignatureRef = useRef('');
  const inputRefs = useRef({});

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
    onError: (error) => {
      setSubmitErrorMessage(error?.message || 'Impossible de mettre a jour votre profil.');
    },
    onSuccess: () => {
      setSubmitErrorMessage('');
      navigation.goBack();
    },
  });

  useEffect(() => {
    const nextUserKey = userData?.documentId || userData?.id;
    if (!nextUserKey) {
      return;
    }

    const nextValues = buildProfileFormValues(userData, formatBirthdateToDisplay);
    const nextSignature = JSON.stringify(nextValues);
    if (
      hydratedUserKeyRef.current === nextUserKey
      && hydratedSignatureRef.current === nextSignature
    ) {
      return;
    }

    setFormValues(nextValues);
    setFormErrors({});
    setSubmitErrorMessage('');
    setAvatar(userData?.avatar?.url ? { url: userData.avatar.url } : undefined);
    hydratedUserKeyRef.current = nextUserKey;
    hydratedSignatureRef.current = nextSignature;
  }, [formatBirthdateToDisplay, userData]);

  useEffect(() => {
    const focusField = route?.params?.focusField;
    if (!focusField) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      inputRefs.current?.[focusField]?.focus?.();
      navigation.setParams({ focusField: undefined });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [navigation, route?.params?.focusField]);

  const preferredSport = formValues.preferredSport;

  const setFieldValue = (fieldName, value) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
    setFormErrors((currentErrors) => {
      if (!currentErrors[fieldName]) return currentErrors;
      return {
        ...currentErrors,
        [fieldName]: '',
      };
    });
    setSubmitErrorMessage('');
  };

  const setInputRef = (fieldName) => (ref) => {
    inputRefs.current[fieldName] = ref;
  };

  const getSportOptions = useMemo(() => {
    const defaultSports = [
      { label: 'Football', value: 'football' },
      { label: 'Basketball', value: 'basketball' },
      { label: 'Handball', value: 'handball' },
      { label: 'Volleyball', value: 'volleyball' },
      { label: 'Autre', value: 'other' },
    ];

    if (
      userData?.preferredSport
      && !defaultSports.find((sport) => sport.value === userData.preferredSport)
    ) {
      const label = userData.preferredSport.charAt(0).toUpperCase()
        + userData.preferredSport.slice(1);
      defaultSports.unshift({ label, value: userData.preferredSport });
    }

    return defaultSports;
  }, [userData?.preferredSport]);

  const sportPositions = useMemo(() => {
    const sportKey = Object.keys(SPORTS_POSITIONS).find(
      (key) => key.toLowerCase() === preferredSport,
    );
    return sportKey ? SPORTS_POSITIONS[sportKey] : [];
  }, [preferredSport]);

  const handleFormSubmit = () => {
    const nextErrors = validateValues(formValues);
    setFormErrors(nextErrors);

    if (hasAnyFormError(nextErrors) || !userData) {
      return;
    }

    let geohash = null;
    if (formValues.address?.value) {
      const coords = String(formValues.address.value).split('|');
      if (coords.length === 2) {
        geohash = getGeohashForPointAndRadius(
          parseFloat(coords[1]),
          parseFloat(coords[0]),
          0.001,
        );
      }
    }

    updateUserMutation.mutate({
      address: formValues.address,
      avatar,
      bestLevel: formValues.bestLevel,
      birthdate: formatBirthdateToSend(formValues.birthdate || ''),
      category: formValues.category,
      firstname: formValues.firstname,
      geohash,
      height: formValues.height,
      isLookingForClub: formValues.isLookingForClub,
      lastname: formValues.lastname,
      position: formValues.position,
      preferredSport: formValues.preferredSport,
      section: formValues.section,
      weight: formValues.weight,
    });
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
              description="Mettez a jour vos informations personnelles, sportives et votre visibilite."
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

                <Input
                  editable={false}
                  error={formErrors.phoneNumber}
                  label={t('profile.fields.phoneNumber.label')}
                  onChangeText={(value) => setFieldValue('phoneNumber', value)}
                  placeholder={t('profile.fields.phoneNumber.placeholder')}
                  readOnly
                  ref={setInputRef('phoneNumber')}
                  value={formValues.phoneNumber}
                />

                {profileFields?.includes('firstname') ? (
                  <Input
                    enterKeyHint="next"
                    error={formErrors.firstname}
                    label={t('profile.fields.firstname.label')}
                    onChangeText={(value) => setFieldValue('firstname', value)}
                    onSubmitEditing={() => inputRefs.current?.lastname?.focus?.()}
                    placeholder={t('profile.fields.firstname.placeholder')}
                    ref={setInputRef('firstname')}
                    value={formValues.firstname}
                  />
                ) : null}

                {profileFields?.includes('lastname') ? (
                  <Input
                    enterKeyHint="next"
                    error={formErrors.lastname}
                    label={t('profile.fields.lastname.label')}
                    onChangeText={(value) => setFieldValue('lastname', value)}
                    onSubmitEditing={() => inputRefs.current?.birthdate?.focus?.()}
                    placeholder={t('profile.fields.lastname.placeholder')}
                    ref={setInputRef('lastname')}
                    value={formValues.lastname}
                  />
                ) : null}

                {profileFields?.includes('birthdate') ? (
                  <Input
                    enterKeyHint="done"
                    error={formErrors.birthdate}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    label={t('profile.fields.birthdate.label')}
                    maxLength={10}
                    onChangeText={(text) => setFieldValue('birthdate', formatBirthdateToDisplay(text))}
                    placeholder="JJ/MM/AAAA"
                    ref={setInputRef('birthdate')}
                    value={formValues.birthdate}
                  />
                ) : null}

                {profileFields?.includes('section') ? (
                  <AutocompleteSelect
                    error={formErrors.section}
                    label={t('profile.fields.section.label')}
                    options={sectionOptions}
                    placeholder={t('profile.fields.section.placeholder')}
                    setValue={(option) => setFieldValue('section', option?.value || '')}
                    value={sectionOptions.find((option) => option.value === formValues.section)?.label || ''}
                  />
                ) : null}

                {profileFields?.includes('weight') ? (
                  <Input
                    enterKeyHint="next"
                    error={formErrors.weight}
                    inputMode="decimal"
                    keyboardType="number-pad"
                    label={t('profile.fields.weight.label')}
                    onChangeText={(value) => setFieldValue('weight', value)}
                    onSubmitEditing={() => inputRefs.current?.height?.focus?.()}
                    placeholder={t('profile.fields.weight.placeholder')}
                    ref={setInputRef('weight')}
                    value={formValues.weight}
                  />
                ) : null}

                {profileFields?.includes('bestLevel') ? (
                  <AutocompleteSelect
                    error={formErrors.bestLevel}
                    label={t('profile.fields.bestLevel.label', 'Meilleur niveau')}
                    options={levelOptions}
                    placeholder={t('profile.fields.bestLevel.placeholder', 'Selectionner un niveau')}
                    setValue={(option) => setFieldValue('bestLevel', option?.value || '')}
                    value={formValues.bestLevel}
                  />
                ) : null}

                <AutocompleteSelect
                  error={formErrors.category}
                  isMulti
                  label={t('profile.fields.category.label', 'Categorie')}
                  options={categoryOptions}
                  placeholder={t('profile.fields.category.placeholder', 'Selectionner une categorie')}
                  setValue={(options) => {
                    setFieldValue('category', options?.map((option) => option.value).join(', ') || '');
                  }}
                  value={formValues.category ? formValues.category.split(', ').filter(Boolean) : []}
                />

                {profileFields?.includes('height') ? (
                  <Input
                    enterKeyHint="next"
                    error={formErrors.height}
                    inputMode="decimal"
                    keyboardType="number-pad"
                    label={t('profile.fields.height.label')}
                    onChangeText={(value) => setFieldValue('height', value)}
                    onSubmitEditing={() => inputRefs.current?.preferredSport?.focus?.()}
                    placeholder={t('profile.fields.height.placeholder')}
                    ref={setInputRef('height')}
                    value={formValues.height}
                  />
                ) : null}

                <AutocompleteSelect
                  error={formErrors.preferredSport}
                  label={t('profile.fields.preferredSport.label', 'Sport de preference')}
                  options={getSportOptions}
                  placeholder={t('profile.fields.preferredSport.placeholder', 'Selectionner un sport')}
                  setValue={(option) => {
                    setFieldValue('preferredSport', option?.value || '');
                    setFieldValue('position', '');
                  }}
                  value={formValues.preferredSport}
                />

                {profileFields?.includes('position') ? (
                  sportPositions.length > 0 ? (
                    <AutocompleteSelect
                      error={formErrors.position}
                      label={t('profile.fields.position.label')}
                      options={sportPositions.map((position) => ({ label: position, value: position }))}
                      placeholder={t('profile.fields.position.placeholder')}
                      setValue={(option) => setFieldValue('position', option?.value || '')}
                      value={formValues.position}
                    />
                  ) : (
                    <Input
                      enterKeyHint="done"
                      error={formErrors.position}
                      label={t('profile.fields.position.label')}
                      onChangeText={(value) => setFieldValue('position', value)}
                      placeholder={t('profile.fields.position.placeholder')}
                      ref={setInputRef('position')}
                      value={formValues.position}
                    />
                  )
                ) : null}

                <AutocompleteAddressInput
                  address={formValues.address}
                  error={formErrors.address}
                  label={t('profile.fields.city.label', 'Ville')}
                  placeholder={t('profile.fields.city.placeholder', 'Rechercher une ville')}
                  setAddress={(value) => setFieldValue('address', value)}
                />

                <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.paddingVertical[8]]}>
                  <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                    {t('profile.fields.isLookingForClub.label', 'Profil visible')}
                  </Text>
                  <Switch
                    onValueChange={(value) => setFieldValue('isLookingForClub', value)}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    value={Boolean(formValues.isLookingForClub)}
                  />
                </View>

                {submitErrorMessage ? (
                  <Text style={[Fonts.p2, Fonts.error700]}>
                    {submitErrorMessage}
                  </Text>
                ) : null}
              </View>
            </OnboardingWrapper>
          </ScrollView>

          <OnboardingWrapper
            description="Enregistrez vos modifications pour mettre a jour votre profil."
            id="profile-edit-save"
            order={2}
            spotlight={{
              borderRadius: 30, overlayOpacity: 0.4, paddingX: 2, paddingY: 2,
            }}
            title="Enregistrer"
          >
            <Button
              isLoading={updateUserMutation.isPending}
              onPress={handleFormSubmit}
              title={t('profile.actions.save')}
              variant="Primary"
            />
          </OnboardingWrapper>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default ProfileEditWeb;
