import { joiResolver } from '@hookform/resolvers/joi';
import Slider from '@react-native-community/slider';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import usePlaces from '@/domains/places/usePlaces';
import { ENABLE_AFFILIATION_ONBOARDING_TUTORIAL } from '@/domains/tutorial/tutorialFeatureFlags';
import { useAppContext } from '@/store/appContext';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import OnboardingOverlay from '@/components/molecules/onboardingOverlay/OnboardingOverlay';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetActivities } from '@/services/activity/activityQueries';

import { getFieldError } from '@/utils/form/formUtils';

import {
  OnboardingProvider,
  useOnboarding,
} from '@/context/OnboardingContext';

const filtersSchema = Joi.object({
  activity: Joi.string().allow(''),
  city: Joi.object().allow(''),
  name: Joi.string().allow(''),
  radius: Joi.number().allow(''),
});
const AFFILIATION_TUTORIAL_FLOW_PREFIX = 'onboarding-affiliation-v2';
const WEB_FILTER_SURFACE_PROPS = {
  contentWidth: 720,
  responsivePadding: true,
  surface: 'card',
};

function AffiliationTutorialStep({
  children,
  description,
  id,
  nextAction,
  nextLabel,
  nextTargetStepId,
  onNext,
  order,
  spotlight,
  style,
  targetNodeResolver,
  title,
}) {
  if (!ENABLE_AFFILIATION_ONBOARDING_TUTORIAL) {
    return children;
  }

  return (
    <OnboardingWrapper
      description={description}
      id={id}
      nextAction={nextAction}
      nextLabel={nextLabel}
      nextTargetStepId={nextTargetStepId}
      onNext={onNext}
      order={order}
      spotlight={spotlight}
      style={style}
      targetNodeResolver={targetNodeResolver}
      title={title}
    >
      {children}
    </OnboardingWrapper>
  );
}

/**
 * ClubFilters component for filtering clubs by location and activity
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} ClubFilters component
 */
function ClubFilters(props) {
  const { userData } = useAuth();
  const flowId = `${AFFILIATION_TUTORIAL_FLOW_PREFIX}:${userData?.documentId || 'anonymous'}`;
  const { navigation, route } = props;

  return (
    <OnboardingProvider flowId={flowId}>
      <ClubFiltersContent navigation={navigation} route={route} />
    </OnboardingProvider>
  );
}

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function ClubFiltersContent({ navigation, route }) {
  // local states
  const [activitySearchValue, setActivitySearchValue] = useState('');
  const fromOnboardingAffiliation = Boolean(route?.params?.fromOnboardingAffiliation);

  // hooks
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const [{ clubFilters }, appDispatch] = useAppContext();
  const { getGeohashForPointAndRadius } = usePlaces();
  const insets = useSafeAreaInsets();
  const {
    isActive,
    startOnboarding,
    totalSteps,
  } = useOnboarding();

  const {
    data: allActivities,
    error: activitiesError,
    isLoading: isLoadingActivities,
    refetch: refetchActivities,
  } = useGetActivities();

  useEffect(() => {
    if (!ENABLE_AFFILIATION_ONBOARDING_TUTORIAL) return undefined;
    if (!fromOnboardingAffiliation || isActive || totalSteps === 0) return undefined;

    const timer = setTimeout(() => {
      startOnboarding();
    }, 450);

    return () => clearTimeout(timer);
  }, [
    fromOnboardingAffiliation,
    isActive,
    startOnboarding,
    totalSteps,
  ]);

  const initialValues = useMemo(() => ({
    activity: clubFilters?.activity || '',
    city: clubFilters?.city || { label: '', value: '' },
    name: clubFilters?.name || '',
    radius: clubFilters?.radius || 20,
  }), [clubFilters]);

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    reset,
    watch,
  } = useForm({
    defaultValues: initialValues,
    mode: 'onBlur',
    resolver: joiResolver(filtersSchema),
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  /**
   * Handles the application of filters
   * @param {{
   *   activity: string;
   *   city: { label: string; value: string };
   *   name: string;
   *   radius: number;
   * }} data
   */
  const handleApplyFilters = (data) => {
    const coordinates = data.city?.value?.split('|');
    const lat = coordinates ? parseFloat(coordinates[1]) : undefined;
    const lon = coordinates ? parseFloat(coordinates[0]) : undefined;
    const geohash = coordinates ? getGeohashForPointAndRadius(
      lat,
      lon,
      data.radius,
    ) : undefined;

    const payload = {
      ...data,
      ...(geohash ? { geohash } : {}),
      ...(Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, radius: data.radius } : {}),
    };

    appDispatch({ payload, type: 'SET_CLUB_FILTERS' });
    navigation.goBack();
  };

  const handleEmptyFilters = () => {
    appDispatch({ payload: {}, type: 'SET_CLUB_FILTERS' });
    navigation.goBack();
  };

  const activities = useMemo(() => {
    const formattedActivities = allActivities?.map(({ documentId, name }) => ({
      label: name,
      value: documentId,
    })) || [];

    if (activitySearchValue) {
      return formattedActivities.filter(
        (activity) => activity.label.toLowerCase().includes(
          activitySearchValue.trim().toLowerCase(),
        ),
      );
    }

    return formattedActivities;
  }, [allActivities, activitySearchValue]);

  /**
   * Get the label of an activity based on its value
   * @param {string} value
   * @returns {string} The label of the activity
   */
  const getActivityLabel = (value) => activities.find((activity) => activity.value === value)?.label || '';

  return (
    <ScreenContainer
      bgImage="bg2"
      // Retrait bas systeme deja applique au contenu ci-dessous : pas de plancher
      // conteneur, sinon insets.bottom serait compte deux fois.
      bottomInsetMode="edge-to-edge"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Spaces.gap[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
        { paddingBottom: insets.bottom },
      ]}
      contentWidth={WEB_FILTER_SURFACE_PROPS.contentWidth}
      responsivePadding={WEB_FILTER_SURFACE_PROPS.responsivePadding}
      surface={WEB_FILTER_SURFACE_PROPS.surface}
    >
      <ScrollView
        contentContainerStyle={[Spaces.gap[40]]}
        style={[Spaces.marginVertical[16]]}
      >
        <AffiliationTutorialStep
          description={t(
            'onboardingAffiliation.filtersTutorial.cityDescription',
            'Choisis une ville ou une adresse pour centrer la recherche des clubs.',
          )}
          id="club-filters-city"
          order={5}
          spotlight={{
            borderRadius: 14,
            overlayOpacity: 0.38,
            paddingX: 2,
            paddingY: 2,
          }}
          title={t(
            'onboardingAffiliation.filtersTutorial.cityTitle',
            'Localisation',
          )}
        >
          <Controller
            control={control}
            name="city"
            render={({
              field: {
                onChange, value,
              },
            }) => (
              <AutocompleteAddressInput
                address={value}
                error={getFieldError({ errors: formErrors, fieldName: 'city' })}
                label={t('clubFilters.fields.city.label')}
                placeholder={t('clubFilters.fields.city.placeholder')}
                setAddress={onChange}
              />
            )}
          />
        </AffiliationTutorialStep>

        <AffiliationTutorialStep
          description={t(
            'onboardingAffiliation.filtersTutorial.radiusDescription',
            'Ajuste le rayon en kilomêtres autour de ta localisation.',
          )}
          id="club-filters-radius"
          order={6}
          spotlight={{
            borderRadius: 14,
            overlayOpacity: 0.38,
            paddingX: 2,
            paddingY: 2,
          }}
          title={t(
            'onboardingAffiliation.filtersTutorial.radiusTitle',
            'Rayon de recherche',
          )}
        >
          <Controller
            control={control}
            name="radius"
            render={({
              field: { onChange, value },
            }) => (
              <View style={[Spaces.gap[8]]}>
                <Text style={[
                  Fonts.p1Bold,
                  Fonts.neutral00]}
                >
                  {`${t('clubFilters.fields.radius.label')} : ${value}km`}
                </Text>
                <Slider
                  disabled={!watch('city')?.value}
                  maximumTrackTintColor={Colors.primary700}
                  maximumValue={50}
                  minimumTrackTintColor={Colors.primary500}
                  minimumValue={2}
                  onValueChange={onChange}
                  step={1}
                  style={[Alignments.fullWidth, { height: 50 }]}
                  tapToSeek
                  thumbTintColor={Colors.primary500}
                  value={value}
                />
              </View>
            )}
          />
        </AffiliationTutorialStep>

        <AffiliationTutorialStep
          description={t(
            'onboardingAffiliation.filtersTutorial.activityDescription',
            'Sélectionné un sport pour filtrer uniquement les clubs correspondants.',
          )}
          id="club-filters-activity"
          order={7}
          spotlight={{
            borderRadius: 14,
            overlayOpacity: 0.38,
            paddingX: 2,
            paddingY: 2,
          }}
          title={t(
            'onboardingAffiliation.filtersTutorial.activityTitle',
            'Sport',
          )}
        >
          <Controller
            control={control}
            name="activity"
            render={({
              field: { onChange, ref, value },
            }) => (
              <View style={[Spaces.gap[12]]}>
                <AutocompleteSelect
                  disabled={Boolean(activitiesError)}
                  isLoading={isLoadingActivities}
                  isSearchable
                  label={t('clubFilters.fields.activity.label')}
                  options={activities}
                  placeholder={t('clubFilters.fields.activity.placeholder')}
                  ref={ref}
                  searchValue={activitySearchValue}
                  setSearchValue={setActivitySearchValue}
                  setValue={
                    /**
                     * Handles selection of an activity option
                     * @param {{value: string}} option The selected option
                     * @returns {void}
                     */
                    (option) => onChange(option?.value || '')
                  }
                  value={getActivityLabel(value)}
                />
                {activitiesError ? (
                  <View style={[Spaces.gap[8]]}>
                    <Text style={[Fonts.p3, Fonts.error500]}>
                      {t(
                        'clubFilters.fields.activity.error',
                        'Impossible de charger la liste des sports pour le moment.',
                      )}
                    </Text>
                    <Button
                      onPress={() => refetchActivities()}
                      title={t('common.actions.retry', 'Réessayer')}
                      variant="Secondary"
                    />
                  </View>
                ) : null}
              </View>
            )}
          />
        </AffiliationTutorialStep>
      </ScrollView>
      <View style={[Spaces.gap[24]]}>
        <Button
          onPress={handleEmptyFilters}
          title={t('clubFilters.actions.clear')}
          variant="Secondary"
        />
        <AffiliationTutorialStep
          description={t(
            'onboardingAffiliation.filtersTutorial.applyDescription',
            'Applique tes filtres pour revenir à la liste avec des résultats plus précis.',
          )}
          id="club-filters-apply"
          order={8}
          spotlight={{
            borderRadius: 28,
            overlayOpacity: 0.4,
            paddingX: 2,
            paddingY: 2,
          }}
          title={t(
            'onboardingAffiliation.filtersTutorial.applyTitle',
            'Appliquer',
          )}
        >
          <Button
            onPress={handleSubmit(handleApplyFilters)}
            title={t('clubFilters.actions.apply')}
            variant="Primary"
          />
        </AffiliationTutorialStep>
      </View>
      {ENABLE_AFFILIATION_ONBOARDING_TUTORIAL ? <OnboardingOverlay /> : null}
    </ScreenContainer>
  );
}

export default ClubFilters;
