
import { joiResolver } from '@hookform/resolvers/joi';
import Slider from '@react-native-community/slider';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import usePlaces from '@/domains/places/usePlaces';
import { useAppContext } from '@/store/appContext';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';


import { getFieldError } from '@/utils/form/formUtils';

const filtersSchema = Joi.object({
  city: Joi.object().allow(''),
  radius: Joi.number().allow(''),
  category: Joi.object().allow(null),
  division: Joi.object().allow(null),
});

const SquadFiltersScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts, Spaces } = useTheme();
  const [{ squadFilters }, appDispatch] = useAppContext(); // Assuming squadFilters exists in context
  const insets = useSafeAreaInsets();

  const initialValues = useMemo(() => ({
    city: squadFilters?.city || { label: '', value: '' },
    radius: squadFilters?.radius || 20,
    category: squadFilters?.category || null,
    division: squadFilters?.division || null,
  }), [squadFilters]);

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

  const handleApplyFilters = (data) => {
    appDispatch({ payload: data, type: 'SET_SQUAD_FILTERS' });
    navigation.goBack();
  };

  const handleEmptyFilters = () => {
    appDispatch({ payload: {}, type: 'SET_SQUAD_FILTERS' });
    navigation.goBack();
  };

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
    >

      <ScrollView
        contentContainerStyle={[Spaces.gap[40]]}
        style={[Spaces.marginVertical[16], { paddingHorizontal: 16 }]}
      >
        <Controller
          control={control}
          name="city"
          render={({ field: { onChange, value } }) => (
            <AutocompleteAddressInput
              address={value}
              error={getFieldError({ errors: formErrors, fieldName: 'city' })}
              label={t('clubFilters.fields.city.label', 'Ville')}
              placeholder={t('clubFilters.fields.city.placeholder', 'Rechercher une ville')}
              setAddress={onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="radius"
          render={({ field: { onChange, value } }) => (
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                {`${t('clubFilters.fields.radius.label', 'Rayon')} : ${value}km`}
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
        
        {/* Placeholder for Category and Division Selectors - To be implemented based on available data sources */}
        
      </ScrollView>
      <View style={[Spaces.gap[24], { paddingHorizontal: 16 }]}>
        <Button
          onPress={handleEmptyFilters}
          title={t('clubFilters.actions.clear', 'Réinitialiser')}
          variant="Secondary"
        />
        <Button
          onPress={handleSubmit(handleApplyFilters)}
          title={t('clubFilters.actions.apply', 'Appliquer')}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
};

export default SquadFiltersScreen;
