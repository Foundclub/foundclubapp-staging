import { joiResolver } from '@hookform/resolvers/joi';
// import DateTimePicker from '@react-native-community/datetimepicker';

import Slider from '@react-native-community/slider';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import usePlaces from '@/domains/places/usePlaces';
import { useAppContext } from '@/store/appContext';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetActivities } from '@/services/activity/activityQueries';

import { getFieldError } from '@/utils/form/formUtils';

const WEB_FILTER_SURFACE_PROPS = {
  contentWidth: 720,
  responsivePadding: true,
  surface: 'card',
};

/** @typedef {{ label: string; value: string }} Option */

const filtersSchema = Joi.object({
  activity: Joi.string().allow(''),
  city: Joi.object().allow(''),
  maxPrice: Joi.number().allow('').optional(),
  radius: Joi.number().allow(''),
});

/**
 * ReservationFilters component for filtering reservations
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} ReservationFilters component
 */
function ReservationFilters({ navigation }) {
  // local states
  const [activitySearchValue, setActivitySearchValue] = useState('');
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [infoModalContent, setInfoModalContent] = useState({ content: '', title: '' });

  // hooks
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const [{ reservationFilters }, appDispatch] = useAppContext();
  const { getGeohashForPointAndRadius } = usePlaces();
  const insets = useSafeAreaInsets();

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    watch,
  } = useForm({
    defaultValues: {
      activity: reservationFilters?.activity || '',
      city: reservationFilters?.city || { label: '', value: '' },
      maxPrice: reservationFilters?.maxPrice || '',
      radius: reservationFilters?.radius || 20,
    },
    mode: 'onBlur',
    resolver: joiResolver(filtersSchema),
  });

  // queries
  const { data: allActivities } = useGetActivities();

  // computed
  const city = watch('city');

  const activities = useMemo(() => {
    const formattedActivities = allActivities?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
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
   * Get the label for a given option value
   * @param {Option[]} options - The options
   * @param {string} value - The value
   * @returns {Option | null} The option label
   */
  const getOptionLabel = (options, value) => {
    if (!value || !options) return null;
    const option = options.find((opt) => opt.value === value);
    return option || null;
  };

  /**
   * Handle apply filters
   * @param {{
   *   activity: string;
   *   city: { label: string; value: string };
   *   maxPrice: string | number;
   *   radius: number;
   * }} data - The filter data
   */
  const handleApplyFilters = (data) => {
    // Format place params
    const coordinates = data.city?.value?.split('|');
    const geohash = (coordinates && data.city?.value) ? getGeohashForPointAndRadius(
      parseFloat(coordinates[1]),
      parseFloat(coordinates[0]),
      data.radius,
    ) : undefined;

    const payload = {
      ...data,
      ...(geohash && { geohash }),
    };

    appDispatch({
      payload,
      type: 'SET_RESERVATION_FILTERS',
    });
    navigation.goBack();
  };

  /**
   * Handle empty filters
   */
  const handleEmptyFilters = () => {
    appDispatch({ payload: {}, type: 'SET_RESERVATION_FILTERS' });
    navigation.goBack();
  };

  const openInfoModal = (title, content) => {
    setInfoModalContent({ content, title });
    setInfoModalVisible(true);
  };

  const renderLabel = (label, infoKey) => (
    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], Spaces.marginBottom[8]]}>
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{label}</Text>
      <TouchableOpacity
        hitSlop={{
          bottom: 10, left: 10, right: 10, top: 10,
        }}
        onPress={() => openInfoModal(label, t(`reservationFilters.infos.${infoKey}`))}
        style={{
          alignItems: 'center',
          backgroundColor: `${Colors.primary500}20`,
          borderColor: Colors.primary500,
          borderRadius: 11,
          borderWidth: 1.5,
          height: 22,
          justifyContent: 'center',
          width: 22,
        }}
      >
        <Text style={{ color: Colors.primary500, fontSize: 13, fontWeight: '700' }}>i</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Spaces.gap[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
        { paddingBottom: insets.bottom },
      ]}
      {...WEB_FILTER_SURFACE_PROPS}
    >
      {/* Info Modal */}
      <BottomModal
        close={() => setInfoModalVisible(false)}
        isVisible={infoModalVisible}
      >
        <View style={[Spaces.gap[16], Spaces.paddingTop[16]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{infoModalContent.title}</Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>{infoModalContent.content}</Text>
        </View>
      </BottomModal>

      <ScrollView
        contentContainerStyle={[Spaces.gap[40]]}
        style={[Spaces.marginVertical[16]]}
      >
        {/* City */}
        <View>
          {renderLabel(t('clubFilters.fields.city.label', 'Ville'), 'city')}
          <Controller
            control={control}
            name="city"
            render={({ field: { onChange, value } }) => (
              <AutocompleteAddressInput
                address={value}
                error={getFieldError({ errors: formErrors, fieldName: 'city' })}
                placeholder={t('clubFilters.fields.city.placeholder', 'Entrez une ville')}
                setAddress={onChange}
              />
            )}
          />
        </View>

        {/* Radius */}
        <Controller
          control={control}
          name="radius"
          render={({ field: { onChange, value } }) => (
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                {`${t('clubFilters.fields.radius.label', 'Dans un rayon autour de : ')}${value}km`}
              </Text>
              <Slider
                disabled={!city?.value}
                maximumTrackTintColor={Colors.primary700}
                maximumValue={50}
                minimumTrackTintColor={Colors.primary500}
                minimumValue={20}
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

        {/* Activity */}
        <Controller
          control={control}
          name="activity"
          render={({ field: { onChange, value } }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'activity' })}
              label={t('eventFilters.fields.activity.label', 'Sport')}
              options={activities}
              placeholder={t('eventFilters.fields.activity.placeholder', 'Sélectionnez un sport')}
              searchValue={activitySearchValue}
              setSearchValue={setActivitySearchValue}
              setValue={(option) => onChange(option?.value || '')}
              value={getOptionLabel(activities, value)}
            />
          )}
        />

        {/* Max Price */}
        <Controller
          control={control}
          name="maxPrice"
          render={({ field: { onChange, value } }) => (
            <Input
              error={getFieldError({ errors: formErrors, fieldName: 'maxPrice' })}
              keyboardType="numeric"
              label={t('reservationFilters.fields.maxPrice.label', 'Prix maximum')}
              onChangeText={onChange}
              placeholder={t('reservationFilters.fields.maxPrice.placeholder', 'Ex: 50')}
              value={value?.toString() || ''}
            />
          )}
        />

      </ScrollView>

      {/* Buttons */}
      <View style={[Spaces.gap[24]]}>
        <Button
          onPress={handleEmptyFilters}
          title={t('eventFilters.actions.empty', 'Effacer les filtres')}
          variant="Secondary"
        />
        <Button
          onPress={handleSubmit(handleApplyFilters)}
          title={t('eventFilters.actions.submit', 'Appliquer')}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
}

export default ReservationFilters;
