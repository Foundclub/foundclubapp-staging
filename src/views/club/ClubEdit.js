// @ts-nocheck
import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView, Switch, Text, TouchableOpacity, View,
} from 'react-native';

import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetClub } from '@/services/club/clubQueries';
import { updateClubInfo } from '@/services/club/clubService';

import { getFieldError } from '@/utils/form/formUtils';
import safeJsonParse from '@/utils/safeJsonParse';

/** @type {{ name: string; email: string; phoneNumber: string; addressDetails: string; activites: string[]; clubMembersPublicVisibility: boolean; membershipRequestManagementMode: 'CLUB_OWNER_ONLY'|'COACH_ALLOWED_BY_TEAM' }} */
const defaultValues = {
  activites: [],
  addressDetails: '',
  clubMembersPublicVisibility: true,
  email: '',
  membershipRequestManagementMode: 'COACH_ALLOWED_BY_TEAM',
  name: '',
  phoneNumber: '',
};

const clubSchema = Joi.object({
  activites: Joi.array().items(Joi.string().allow('')).optional(),
  addressDetails: Joi.string().allow('').optional(),
  clubMembersPublicVisibility: Joi.boolean().required(),
  email: Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  membershipRequestManagementMode: Joi.string().valid('CLUB_OWNER_ONLY', 'COACH_ALLOWED_BY_TEAM').required(),
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
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const membershipModeOptions = useMemo(() => ([
    {
      description: t(
        'clubEdit.membership.mode.ownerOnlyDescription',
        "Le dirigeant garde la main sur toutes les demandes d'adhésion des équipes du club.",
      ),
      label: t('clubEdit.membership.mode.ownerOnly', 'Gestion par le dirigeant'),
      value: 'CLUB_OWNER_ONLY',
    },
    {
      description: t(
        'clubEdit.membership.mode.coachAllowedDescription',
        'Le dirigeant peut déléguer équipe par équipe aux entraîneurs autorisés, tout en gardant une vue complète.',
      ),
      label: t('clubEdit.membership.mode.coachAllowed', "Délégation à l'entraîneur"),
      value: 'COACH_ALLOWED_BY_TEAM',
    },
  ]), [t]);

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
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);

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
    onError: (mutationError) => {
      const subscriptionDecision = extractSubscriptionDecisionFromError(mutationError);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }
      Alert.alert(
        t('common.error', 'Erreur'),
        mutationError?.message || 'Impossible de mettre a jour ce club pour le moment.',
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
      const parsedDetails = safeJsonParse(clubData.addressDetails, null);
      const parsedAddress = typeof parsedDetails?.address === 'object'
        ? parsedDetails.address?.description || parsedDetails.address?.label || ''
        : parsedDetails?.address || clubData.addressDetails || '';

      reset({
        activites: (clubData.activites || []).map((activity) => activity.documentId).filter(Boolean),
        addressDetails: parsedAddress,
        clubMembersPublicVisibility: clubData.clubMembersPublicVisibility !== false,
        email: clubData.email || '',
        membershipRequestManagementMode: clubData.membershipRequestManagementMode || 'COACH_ALLOWED_BY_TEAM',
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
            <Button onPress={() => refetch()} title="Réessayer" variant="Primary" />
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
          <Button onPress={() => refetch()} title="Réessayer" variant="Primary" />
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
    <>
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

              <View
                style={[
                  ApplicationStyle.card,
                  Spaces.padding[16],
                  Spaces.gap[12],
                  {
                    backgroundColor: 'rgba(4, 31, 44, 0.82)',
                    borderColor: 'rgba(1, 179, 244, 0.24)',
                    borderWidth: 1,
                  },
                ]}
              >
                <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[16]]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                      {t('clubEdit.publicMembers.title', 'Visibilité des membres')}
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4]]}>
                      {t(
                        'clubEdit.publicMembers.description',
                        'Choisissez si les membres du club peuvent apparaître publiquement sur la page du club.',
                      )}
                    </Text>
                  </View>
                  <Controller
                    control={control}
                    name="clubMembersPublicVisibility"
                    render={({ field: { onChange, value } }) => (
                      <Switch
                        onValueChange={onChange}
                        thumbColor={value ? Colors.primary500 : Colors.neutral300}
                        trackColor={{ false: Colors.neutral500, true: `${Colors.primary500}66` }}
                        value={value === true}
                      />
                    )}
                  />
                </View>
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                  {t('clubEdit.publicMembers.switchLabel', 'Afficher les membres publiquement')}
                </Text>
              </View>

              <View
                style={[
                  ApplicationStyle.card,
                  Spaces.padding[16],
                  Spaces.gap[12],
                  {
                    backgroundColor: 'rgba(4, 31, 44, 0.82)',
                    borderColor: 'rgba(1, 179, 244, 0.24)',
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                  {t('clubEdit.membership.title', "Demandes d'adhésion aux équipes")}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {t(
                    'clubEdit.membership.description',
                    'Choisissez si toutes les demandes doivent être traitées par le dirigeant, ou si les entraîneurs peuvent être autorisés à gérer celles de leur équipe.',
                  )}
                </Text>
                <Controller
                  control={control}
                  name="membershipRequestManagementMode"
                  render={({ field: { onChange, value } }) => (
                    <View style={[Spaces.gap[12]]}>
                      {membershipModeOptions.map((option) => {
                        const isSelected = (value || 'COACH_ALLOWED_BY_TEAM') === option.value;

                        return (
                          <TouchableOpacity
                            activeOpacity={0.9}
                            key={option.value}
                            onPress={() => onChange(option.value)}
                            style={[
                              Spaces.padding[16],
                              Spaces.gap[10],
                              {
                                backgroundColor: isSelected ? 'rgba(1, 179, 244, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                                borderColor: isSelected ? Colors.primary500 : 'rgba(255, 255, 255, 0.12)',
                                borderRadius: 18,
                                borderWidth: 1,
                              },
                            ]}
                          >
                            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                              <Text style={[isSelected ? Fonts.p2Bold : Fonts.p2, Fonts.neutral00, { flex: 1 }]}>
                                {option.label}
                              </Text>
                              <View
                                style={[
                                  Alignments.alignCenter,
                                  Alignments.justifyCenter,
                                  {
                                    backgroundColor: isSelected ? `${Colors.primary500}22` : 'transparent',
                                    borderColor: isSelected ? Colors.primary500 : Colors.neutral500,
                                    borderRadius: 11,
                                    borderWidth: 2,
                                    height: 22,
                                    width: 22,
                                  },
                                ]}
                              >
                                {isSelected ? (
                                  <View
                                    style={{
                                      backgroundColor: Colors.primary500,
                                      borderRadius: 4,
                                      height: 8,
                                      width: 8,
                                    }}
                                  />
                                ) : null}
                              </View>
                            </View>
                            <Text style={[Fonts.p3, Fonts.neutral200]}>
                              {option.description}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                />
              </View>
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

      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={clubData?.documentId || clubId || null}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </>
  );
}

export default ClubEdit;
