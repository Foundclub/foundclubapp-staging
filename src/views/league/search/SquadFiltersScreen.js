import { joiResolver } from '@hookform/resolvers/joi';
import Slider from '@react-native-community/slider';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppContext } from '@/store/appContext';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { useGetCategories } from '@/services/category/categoryQueries';
import { getFieldError } from '@/utils/form/formUtils';

const DEFAULT_RADIUS_KM = 20;
const DIVISION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const SPORT_OPTIONS = [
  { label: 'Football a 5', value: 'football5' },
  { label: 'Padel', value: 'padel' },
];

const SECTION_OPTIONS = [
  { label: 'Masculin', value: 'Male' },
  { label: 'Feminin', value: 'Female' },
  { label: 'Mixte', value: 'Mixed' },
];

const filtersSchema = Joi.object({
  city: Joi.object().allow(''),
  radius: Joi.number().allow(''),
  sport: Joi.object().allow(null),
  section: Joi.object().allow(null),
  category: Joi.object().allow(null),
  division: Joi.number().allow(null),
});

/**
 * @param {unknown} value
 * @returns {{label: string, value: string} | null}
 */
const normalizeObjectFilter = (value) => {
  if (!value) return null;
  if (typeof value === 'object') {
    const safeValue = /** @type {Record<string, any>} */ (value);
    const label = safeValue.label || safeValue.value;
    const id = safeValue.value || safeValue.label;
    if (!label || !id) return null;
    return { label, value: id };
  }
  return { label: String(value), value: String(value) };
};

/**
 * @param {unknown} value
 * @returns {{label: string, value: string, [key: string]: any}}
 */
const normalizeCityFilter = (value) => {
  if (!value || typeof value !== 'object') return { label: '', value: '' };
  const safeValue = /** @type {Record<string, any>} */ (value);
  return {
    ...safeValue,
    label: safeValue.label || '',
    value: safeValue.value || '',
  };
};

/**
 * @param {unknown} value
 * @returns {number | null}
 */
const toDivisionValue = (value) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1 || parsed > 10) return null;
  return parsed;
};

/**
 * @param {Record<string, any> | null | undefined} rawData
 * @returns {Record<string, any>}
 */
const buildCleanFilters = (rawData) => {
  const data = rawData || {};
  const city = normalizeCityFilter(data.city);
  const hasCity = Boolean(city?.value);
  const radius = Number.parseInt(String(data.radius || ''), 10);
  const cleanPayload = {};

  if (hasCity) {
    cleanPayload.city = city;
    cleanPayload.radius = Number.isFinite(radius) ? radius : DEFAULT_RADIUS_KM;
  }

  const sport = normalizeObjectFilter(data.sport);
  const section = normalizeObjectFilter(data.section);
  const category = normalizeObjectFilter(data.category);
  const division = toDivisionValue(data.division);

  if (sport) cleanPayload.sport = sport;
  if (section) cleanPayload.section = section;
  if (category) cleanPayload.category = category;
  if (division) cleanPayload.division = division;

  return cleanPayload;
};

/**
 * @param {{ navigation: any }} props
 */
const SquadFiltersScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts, Spaces } = useTheme();
  const [{ squadFilters }, appDispatch] = useAppContext();
  const insets = useSafeAreaInsets();
  const { data: categoriesData, isLoading: isCategoriesLoading } = useGetCategories();
  const [categorySearchValue, setCategorySearchValue] = useState('');

  const categoryOptions = useMemo(() => {
    const apiOptions = (categoriesData || []).map((item) => ({
      label: item?.name || '',
      value: item?.name || '',
    })).filter((item) => item.label && item.value);

    if (!apiOptions.length) {
      return [{ label: 'Senior', value: 'Senior' }];
    }

    if (!categorySearchValue.trim()) {
      return apiOptions;
    }

    const query = categorySearchValue.trim().toLowerCase();
    return apiOptions.filter((item) => item.label.toLowerCase().includes(query));
  }, [categoriesData, categorySearchValue]);

  const initialValues = useMemo(() => ({
    city: normalizeCityFilter(squadFilters?.city),
    radius: Number.parseInt(String(squadFilters?.radius || ''), 10) || DEFAULT_RADIUS_KM,
    sport: normalizeObjectFilter(squadFilters?.sport),
    section: normalizeObjectFilter(squadFilters?.section),
    category: normalizeObjectFilter(squadFilters?.category),
    division: toDivisionValue(squadFilters?.division),
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

  const watchedValues = watch();
  const hasCity = Boolean(watchedValues?.city?.value);
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (watchedValues?.city?.value) count += 1;
    if (watchedValues?.sport?.value) count += 1;
    if (watchedValues?.section?.value) count += 1;
    if (watchedValues?.category?.value) count += 1;
    if (toDivisionValue(watchedValues?.division)) count += 1;
    const radius = Number.parseInt(String(watchedValues?.radius || ''), 10);
    if (watchedValues?.city?.value && Number.isFinite(radius) && radius !== DEFAULT_RADIUS_KM) count += 1;
    return count;
  }, [watchedValues]);

  const handleApplyFilters = (/** @type {Record<string, any>} */ data) => {
    const payload = buildCleanFilters(data);
    appDispatch({ payload, type: 'SET_SQUAD_FILTERS' });
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
        Spaces.paddingTop[8],
        Alignments.fill,
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
        <HeaderBackButton
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 0 }}
          withDefaultMargin={false}
        />
        <View style={[Alignments.alignCenter, { flex: 1 }]}>
          <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>
            {t('squad.filters.title', 'Filtres Squad')}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 2 }]}>
            {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} actif{activeFiltersCount > 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleEmptyFilters}
          style={{
            alignItems: 'center',
            borderColor: 'rgba(1, 179, 244, 0.45)',
            borderRadius: 16,
            borderWidth: 1,
            height: 36,
            justifyContent: 'center',
            minWidth: 86,
            paddingHorizontal: 10,
          }}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
            {t('squad.filters.clear', 'Effacer')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ gap: 22, paddingBottom: 180, paddingTop: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Controller
          control={control}
          name="city"
          render={({ field: { onChange, value } }) => (
            <AutocompleteAddressInput
              address={value}
              error={getFieldError({ errors: formErrors, fieldName: 'city' })}
              label={t('squad.filters.city', 'Ville de reference')}
              placeholder={t('squad.filters.cityPlaceholder', 'Ex: Marseille')}
              setAddress={onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="radius"
          render={({ field: { onChange, value } }) => (
            <View style={{ gap: 8 }}>
              <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                {`Dans un rayon de ${value || DEFAULT_RADIUS_KM} km`}
              </Text>
              <Slider
                disabled={!hasCity}
                maximumTrackTintColor={Colors.primary700}
                maximumValue={50}
                minimumTrackTintColor={Colors.primary500}
                minimumValue={2}
                onValueChange={onChange}
                step={1}
                style={[Alignments.fullWidth, { height: 44 }]}
                tapToSeek
                thumbTintColor={Colors.primary500}
                value={Number(value) || DEFAULT_RADIUS_KM}
              />
              {!hasCity ? (
                <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                  Choisis une ville pour activer le rayon.
                </Text>
              ) : null}
            </View>
          )}
        />

        <Controller
          control={control}
          name="sport"
          render={({ field: { onChange, value } }) => (
            <View style={{ gap: 8 }}>
              <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>Sport</Text>
              <View style={[Alignments.row, { flexWrap: 'wrap', gap: 10 }]}>
                {SPORT_OPTIONS.map((option) => {
                  const isActive = value?.value === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => onChange(isActive ? null : option)}
                      style={{
                        backgroundColor: isActive ? 'rgba(250, 204, 21, 0.16)' : 'rgba(255, 255, 255, 0.06)',
                        borderColor: isActive ? 'rgba(250, 204, 21, 0.65)' : 'rgba(255, 255, 255, 0.22)',
                        borderRadius: 999,
                        borderWidth: 1,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={[Fonts.p2Bold, { color: isActive ? Colors.gold500 : Colors.neutral200 }]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        />

        <Controller
          control={control}
          name="section"
          render={({ field: { onChange, value } }) => (
            <View style={{ gap: 8 }}>
              <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>Section</Text>
              <View style={[Alignments.row, { flexWrap: 'wrap', gap: 10 }]}>
                {SECTION_OPTIONS.map((option) => {
                  const isActive = value?.value === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => onChange(isActive ? null : option)}
                      style={{
                        backgroundColor: isActive ? 'rgba(1, 179, 244, 0.16)' : 'rgba(255, 255, 255, 0.06)',
                        borderColor: isActive ? 'rgba(1, 179, 244, 0.65)' : 'rgba(255, 255, 255, 0.22)',
                        borderRadius: 999,
                        borderWidth: 1,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={[Fonts.p2Bold, { color: isActive ? Colors.primary500 : Colors.neutral200 }]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        />

        <Controller
          control={control}
          name="category"
          render={({ field: { onChange, value } }) => (
            <View style={{ gap: 8 }}>
              <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>Categorie</Text>
              {isCategoriesLoading ? (
                <View style={[Alignments.row, Alignments.alignCenter, { gap: 10 }]}>
                  <ActivityIndicator color={Colors.primary500} size="small" />
                  <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>Chargement des categories...</Text>
                </View>
              ) : (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: 'category' })}
                  isSearchable
                  options={categoryOptions}
                  placeholder="Selectionner une categorie"
                  searchValue={categorySearchValue}
                  setSearchValue={setCategorySearchValue}
                  setValue={(/** @type {{label?: string, value?: string} | null} */ option) => {
                    if (!option) {
                      onChange(null);
                      return;
                    }
                    onChange({ label: option.label, value: option.value });
                  }}
                  value={value?.label || ''}
                />
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="division"
          render={({ field: { onChange, value } }) => (
            <View style={{ gap: 8 }}>
              <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>Division</Text>
              <View style={[Alignments.row, { flexWrap: 'wrap', gap: 10 }]}>
                {DIVISION_OPTIONS.map((divisionOption) => {
                  const isActive = Number(value) === divisionOption;
                  return (
                    <TouchableOpacity
                      key={divisionOption}
                      onPress={() => onChange(isActive ? null : divisionOption)}
                      style={{
                        backgroundColor: isActive ? 'rgba(250, 204, 21, 0.16)' : 'rgba(255, 255, 255, 0.06)',
                        borderColor: isActive ? 'rgba(250, 204, 21, 0.65)' : 'rgba(255, 255, 255, 0.22)',
                        borderRadius: 999,
                        borderWidth: 1,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                      }}
                    >
                      <Text style={[Fonts.p2Bold, { color: isActive ? Colors.gold500 : Colors.neutral200 }]}>
                        DIV {divisionOption}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        />
      </ScrollView>

      <View
        style={{
          borderColor: 'rgba(1, 179, 244, 0.25)',
          borderTopWidth: 1,
          marginHorizontal: -24,
          marginTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingHorizontal: 24,
          paddingTop: 12,
        }}
      >
        <Button
          onPress={handleSubmit(handleApplyFilters)}
          style={{ width: '100%' }}
          title={`Appliquer les filtres${activeFiltersCount ? ` (${activeFiltersCount})` : ''}`}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
};

export default SquadFiltersScreen;
