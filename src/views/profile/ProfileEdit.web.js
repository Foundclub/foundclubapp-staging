import { useMutation } from '@tanstack/react-query';
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
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
import ParentalDeclarationCard from '@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';
import {
  buildChoiceOptions,
  resolveChoiceValues,
} from '@/views/profile/profileFormContract';

import { useGetActivities } from '@/services/activity/activityQueries';
import { updateMe } from '@/services/auth/authService';
import { useGetCategories } from '@/services/category/categoryQueries';
import { emitCelebrationBanner } from '@/services/celebrations/celebrationRuntime';
import { useGetLevels } from '@/services/level/levelQueries';
import {
  buildProfileSaveConfirmation,
  listChangedProfileFields,
} from '@/services/profile/profileSaveConfirmation';
import { useGetSections } from '@/services/section/sectionQueries';

import {
  buildMinorParentalDeclarationPayload,
  isBirthdateUnderParentalAge,
} from '@/constants/parentalDeclaration';
import { getPositionsForSport } from '@/constants/positions';

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
  const { data: sections } = useGetSections();
  const { data: levels } = useGetLevels();
  // AC03 — les listes de reference viennent du SERVEUR, comme sur le telephone
  // et comme a l'inscription. Aucune liste n'est plus ecrite ici.
  const { data: activities } = useGetActivities();
  const { data: categories } = useGetCategories();
  const {
    formatBirthdateToDisplay,
    formatBirthdateToSend,
    profileFields,
    refetchUserData,
    userData,
  } = useAuth();
  const { getGeohashForPointAndRadius } = usePlaces();

  const [avatar, setAvatar] = useState(
    /** @type {Avatar | undefined} */
    (undefined),
  );
  const [formValues, setFormValues] = useState(defaultValues);
  const [formErrors, setFormErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [parentalDeclarationChecked, setParentalDeclarationChecked] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');
  const [sportSearch, setSportSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
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

  // AA11 — CE QUI VIENT DE CHANGER, pose juste avant l'envoi et lu seulement
  // apres un succes. Le site monte la MEME banniere que l'app
  // (`web/src/bridge/WebDeferredHosts.tsx`) : une seule phrase, deux surfaces.
  const pendingChangedFieldsRef = useRef(/** @type {string[]} */ ([]));

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      setSubmitErrorMessage(error?.message || 'Impossible de mettre à jour ton profil.');
    },
    onSuccess: async () => {
      setSubmitErrorMessage('');
      await refetchUserData?.();
      // 🎉 AA11 — on n'est ici que si `updateMe` n'a pas leve.
      // ⛔ Rien de tout ceci dans `onError` : on ne felicite jamais un echec.
      const confirmation = buildProfileSaveConfirmation(pendingChangedFieldsRef.current, t);
      pendingChangedFieldsRef.current = [];
      if (confirmation) {
        emitCelebrationBanner({
          body: confirmation.body,
          dedupeKey: `profile-save:${confirmation.body}`,
          eyebrow: confirmation.eyebrow,
          title: confirmation.title,
          tone: 'success',
          variant: 'banner',
        });
      }
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
    setParentalDeclarationChecked(false);
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

  const { preferredSport } = formValues;

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

  // Meme source que l'inscription (`UserPosition`) : sans ca, le poste choisi a
  // l'inscription ne se retrouve pas ici.
  const sportPositions = useMemo(() => getPositionsForSport(preferredSport), [preferredSport]);
  const requiresParentalDeclaration = Boolean(
    formValues.birthdate
    && isBirthdateUnderParentalAge(formatBirthdateToSend(formValues.birthdate || ''))
    && userData?.parentalDeclarationAccepted !== true,
  );

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

    // AA11 — la charge qui PART, comparee aux memes champs tels qu'ils etaient
    // charges : c'est ce qui permet de NOMMER ce qui a change sur un
    // formulaire qui reposte tout.
    pendingChangedFieldsRef.current = listChangedProfileFields(
      { ...buildProfileFormValues(userData, formatBirthdateToDisplay), avatar: userData?.avatar },
      { ...formValues, avatar },
    );
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
      ...(requiresParentalDeclaration ? {
        legalAcceptance: buildMinorParentalDeclarationPayload({
          metadata: {
            birthdate: formatBirthdateToSend(formValues.birthdate || ''),
            childUserDocumentId: userData?.documentId || null,
          },
          sourceScreen: 'profile_edit_web_parental_declaration',
          targetDocumentId: userData?.documentId || null,
        }),
        parentalDeclarationAccepted: true,
      } : {}),
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
              description="Mets à jour tes informations personnelles, sportives et ta visibilité."
              id="profile-edit-form"
              order={1}
              spotlight={{
                borderRadius: 16,
                maxHeight: 280,
                overlayOpacity: 0.4,
                paddingX: 2,
                paddingY: 2,
              }}
              title="Édition du profil"
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
                    placeholder={t('profile.fields.bestLevel.placeholder', 'Sélectionner un niveau')}
                    setValue={(option) => setFieldValue('bestLevel', option?.value || '')}
                    value={formValues.bestLevel}
                  />
                ) : null}

                <AutocompleteSelect
                  error={formErrors.category}
                  isMulti
                  isSearchable
                  label={t('profile.fields.category.label', 'Categorie')}
                  options={buildChoiceOptions(categories, formValues.category, categorySearch)}
                  placeholder={t('profile.fields.category.placeholder', 'Sélectionner une catégorie')}
                  searchValue={categorySearch}
                  setSearchValue={setCategorySearch}
                  setValue={(options) => {
                    setFieldValue('category', options?.map((option) => option.value).join(', ') || '');
                  }}
                  value={resolveChoiceValues(categories, formValues.category)}
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
                  isSearchable
                  label={t('profile.fields.preferredSport.label', 'Sport de préférence')}
                  options={buildChoiceOptions(activities, formValues.preferredSport, sportSearch)}
                  placeholder={t('profile.fields.preferredSport.placeholder', 'Sélectionner un sport')}
                  searchValue={sportSearch}
                  setSearchValue={setSportSearch}
                  setValue={(option) => {
                    setFieldValue('preferredSport', option?.value || '');
                    setFieldValue('position', '');
                  }}
                  value={resolveChoiceValues(activities, formValues.preferredSport)[0] || ''}
                />

                {profileFields?.includes('position') ? (() => {
                  if (sportPositions.length > 0) {
                    return (
                      <AutocompleteSelect
                        error={formErrors.position}
                        label={t('profile.fields.position.label')}
                        options={sportPositions}
                        placeholder={t('profile.fields.position.placeholder')}
                        setValue={(option) => setFieldValue('position', option?.value || '')}
                        value={formValues.position}
                      />
                    );
                  }

                  return (
                    <Input
                      enterKeyHint="done"
                      error={formErrors.position}
                      label={t('profile.fields.position.label')}
                      onChangeText={(value) => setFieldValue('position', value)}
                      placeholder={t('profile.fields.position.placeholder')}
                      ref={setInputRef('position')}
                      value={formValues.position}
                    />
                  );
                })() : null}

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

                {requiresParentalDeclaration ? (
                  <ParentalDeclarationCard
                    checked={parentalDeclarationChecked}
                    helperText={!parentalDeclarationChecked ? 'Cette confirmation est obligatoire pour enregistrer un profil de moins de 13 ans.' : ''}
                    onChange={setParentalDeclarationChecked}
                  />
                ) : null}

                {submitErrorMessage ? (
                  <Text style={[Fonts.p2, Fonts.error700]}>
                    {submitErrorMessage}
                  </Text>
                ) : null}
              </View>
            </OnboardingWrapper>
          </ScrollView>

          <OnboardingWrapper
            description="Enregistre tes modifications pour mettre à jour ton profil."
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
