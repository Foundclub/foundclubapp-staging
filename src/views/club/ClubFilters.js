import { joiResolver } from '@hookform/resolvers/joi';
import Slider from '@react-native-community/slider';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import usePlaces from '@/domains/places/usePlaces';
import { useAppContext } from '@/store/appContext';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetActivities } from '@/services/activity/activityQueries';

import { getFieldError } from '@/utils/form/formUtils';

const filtersSchema = Joi.object({
  activity: Joi.string().allow(''),
  city: Joi.object().allow(''),
  name: Joi.string().allow(''),
  radius: Joi.number().allow(''),
});

/**
 * ClubFilters component for filtering clubs by location and activity
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} ClubFilters component
 */
function ClubFilters({ navigation }) {
  // local states
  const [activitySearchValue, setActivitySearchValue] = useState('');

  // hooks
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const [{ clubFilters }, appDispatch] = useAppContext();
  const { getGeohashForPointAndRadius } = usePlaces();
  const insets = useSafeAreaInsets();

  const {
    data: allActivities,
  } = useGetActivities();

  const initialValues = useMemo(() => ({
    activity: clubFilters?.activity || '',
    city: clubFilters?.city || { label: '', value: '' },
    name: clubFilters?.name || '',
    radius: clubFilters?.radius || 10,
  }), [clubFilters]);

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    watch,
  } = useForm({
    defaultValues: initialValues,
    mode: 'onBlur',
    resolver: joiResolver(filtersSchema),
  });

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
    const geohash = coordinates ? getGeohashForPointAndRadius(
      parseFloat(coordinates[1]),
      parseFloat(coordinates[0]),
      data.radius,
    ) : undefined;

    appDispatch({ payload: Object.assign(data, { geohash }), type: 'SET_CLUB_FILTERS' });
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
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
        { paddingBottom: insets.bottom },
      ]}
    >
      <View style={[Spaces.gap[40], Spaces.marginTop[16]]}>
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
              error={getFieldError({ errors: formErrors, fieldName: 'address' })}
              label={t('clubFilters.fields.city.label')}
              placeholder={t('clubFilters.fields.city.placeholder')}
              setAddress={onChange}
            />
          )}
        />

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
                {`${t('clubFilters.fields.radius.label')}${value}km`}
              </Text>
              <Slider
                disabled={!watch('city')?.value}
                maximumTrackTintColor={Colors.primary700}
                maximumValue={50}
                minimumTrackTintColor={Colors.primary500}
                minimumValue={10}
                onValueChange={onChange}
                step={2}
                style={[Alignments.fullWidth, { height: 50 }]}
                tapToSeek
                thumbTintColor={Colors.primary500}
                value={value}
              />
            </View>
          )}
        />

        <Controller
          control={control}
          name="activity"
          render={({
            field: { onChange, ref, value },
          }) => (
            <AutocompleteSelect
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
          )}
        />
      </View>
      <View style={[Spaces.gap[24]]}>
        <Button
          onPress={handleEmptyFilters}
          title={t('clubFilters.actions.clear')}
          variant="Secondary"
        />
        <Button
          onPress={handleSubmit(handleApplyFilters)}
          title={t('clubFilters.actions.apply')}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
}

export default ClubFilters;
