import { joiResolver } from '@hookform/resolvers/joi';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppContext } from '@/store/appContext';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';

import { getFieldError } from '@/utils/form/formUtils';

import { getPositionsForSport } from '@/constants/positions';

const WEB_FILTER_SURFACE_PROPS = {
  contentWidth: 720,
  responsivePadding: true,
  surface: 'card',
};

/** @typedef {{ label: string; value: string }} Option */

const filtersSchema = Joi.object({
  category: Joi.string().allow(''),
  city: Joi.string().allow(''),
  level: Joi.string().allow(''),
  position: Joi.string().allow(''),
  section: Joi.string().allow(''),
  sport: Joi.string().allow(''),
});

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function RecruitmentAdFilters({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [{ recruitmentAdFilters }, appDispatch] = useAppContext();
  const { Alignments, Spaces } = useTheme();

  const [sportSearch, setSportSearch] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [levelSearch, setLevelSearch] = useState('');
  const [positionSearch, setPositionSearch] = useState('');

  const { data: activities } = useGetActivities();
  const { data: sections } = useGetSections();
  const { data: categories } = useGetCategories();
  const { data: levels } = useGetLevels();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: t('recruitmentAdFilters.headerTitle', 'Filtres annonces'),
    });
  }, [navigation, t]);

  const defaultValues = useMemo(() => ({
    category: Array.isArray(recruitmentAdFilters?.category) && recruitmentAdFilters.category.length
      ? recruitmentAdFilters.category[0]
      : '',
    city: recruitmentAdFilters?.city || '',
    level: Array.isArray(recruitmentAdFilters?.level) && recruitmentAdFilters.level.length
      ? recruitmentAdFilters.level[0]
      : '',
    position: Array.isArray(recruitmentAdFilters?.position) && recruitmentAdFilters.position.length
      ? recruitmentAdFilters.position[0]
      : recruitmentAdFilters?.position || '',
    section: recruitmentAdFilters?.section || '',
    sport: recruitmentAdFilters?.sport || '',
  }), [
    recruitmentAdFilters?.category,
    recruitmentAdFilters?.city,
    recruitmentAdFilters?.level,
    recruitmentAdFilters?.position,
    recruitmentAdFilters?.section,
    recruitmentAdFilters?.sport,
  ]);

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    setValue,
    watch,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(filtersSchema),
  });

  const selectedSport = watch('sport');
  const selectedPosition = watch('position');

  const sportOptions = useMemo(() => {
    const options = activities?.map((activity) => ({
      label: activity.name,
      value: activity.name,
    })) || [];

    if (!sportSearch.trim()) return options;
    return options.filter((option) => option.label.toLowerCase().includes(sportSearch.toLowerCase()));
  }, [activities, sportSearch]);

  const sectionOptions = useMemo(() => {
    const options = sections?.map((section) => ({
      label: section.name,
      value: section.documentId || '',
    })) || [];

    if (!sectionSearch.trim()) return options;
    return options.filter((option) => option.label.toLowerCase().includes(sectionSearch.toLowerCase()));
  }, [sections, sectionSearch]);

  const categoryOptions = useMemo(() => {
    const options = categories?.map((category) => ({
      label: category.name,
      value: category.documentId || '',
    })) || [];

    if (!categorySearch.trim()) return options;
    return options.filter((option) => option.label.toLowerCase().includes(categorySearch.toLowerCase()));
  }, [categories, categorySearch]);

  const levelOptions = useMemo(() => {
    const options = levels?.map((level) => ({
      label: level.name,
      value: level.documentId || '',
    })) || [];

    if (!levelSearch.trim()) return options;
    return options.filter((option) => option.label.toLowerCase().includes(levelSearch.toLowerCase()));
  }, [levels, levelSearch]);

  const positionBaseOptions = useMemo(() => (
    getPositionsForSport(selectedSport).map((position) => ({
      label: position.label,
      value: position.value,
    }))
  ), [selectedSport]);

  const positionOptions = useMemo(() => {
    if (!positionSearch.trim()) return positionBaseOptions;
    return positionBaseOptions.filter((option) => option.label.toLowerCase().includes(positionSearch.toLowerCase()));
  }, [positionBaseOptions, positionSearch]);

  useEffect(() => {
    setPositionSearch('');
  }, [selectedSport]);

  useEffect(() => {
    if (!selectedPosition || positionBaseOptions.length === 0) return;

    const isSelectedPositionAvailable = positionBaseOptions.some(
      (option) => option.value === selectedPosition,
    );

    if (!isSelectedPositionAvailable) {
      setValue('position', '');
    }
  }, [positionBaseOptions, selectedPosition, setValue]);

  const getOptionLabel = (options, value) => options.find((option) => option.value === value)?.label || '';

  const handleApplyFilters = (data) => {
    appDispatch({
      payload: {
        category: data.category ? [data.category] : [],
        city: data.city?.trim() || '',
        level: data.level ? [data.level] : [],
        position: data.position?.trim() || '',
        section: data.section || '',
        sport: data.sport || '',
      },
      type: 'SET_RECRUITMENT_AD_FILTERS',
    });
    navigation.goBack();
  };

  const handleClearFilters = () => {
    appDispatch({
      payload: {},
      type: 'SET_RECRUITMENT_AD_FILTERS',
    });
    navigation.goBack();
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.fill,
        Alignments.justifySpaceBetween,
        Spaces.paddingVertical[24],
        { paddingBottom: insets.bottom + 16 },
      ]}
      contentWidth={WEB_FILTER_SURFACE_PROPS.contentWidth}
      responsivePadding={WEB_FILTER_SURFACE_PROPS.responsivePadding}
      surface={WEB_FILTER_SURFACE_PROPS.surface}
    >
      <ScrollView
        contentContainerStyle={[Spaces.gap[24]]}
        showsVerticalScrollIndicator={false}
      >
        <Controller
          control={control}
          name="sport"
          render={({
            field: {
              name,
              onBlur,
              onChange,
              ref,
              value,
            },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: name })}
              isSearchable
              label={t('recruitmentAdFilters.fields.sport.label', 'Sport')}
              onBlur={onBlur}
              options={sportOptions}
              placeholder={t('recruitmentAdFilters.fields.sport.placeholder', 'Selectionner un sport')}
              ref={ref}
              searchValue={sportSearch}
              setSearchValue={setSportSearch}
              setValue={(option) => onChange(option?.value || '')}
              value={getOptionLabel(sportOptions, value)}
            />
          )}
        />

        <Controller
          control={control}
          name="position"
          render={({
            field: {
              name,
              onBlur,
              onChange,
              ref,
              value,
            },
          }) => (
            positionBaseOptions.length > 0 ? (
              <AutocompleteSelect
                error={getFieldError({ errors: formErrors, fieldName: name })}
                isSearchable
                label={t('recruitmentAdFilters.fields.position.label', 'Poste')}
                onBlur={onBlur}
                options={positionOptions}
                placeholder={t('recruitmentAdFilters.fields.position.placeholder', 'Selectionner un poste')}
                ref={ref}
                searchValue={positionSearch}
                setSearchValue={setPositionSearch}
                setValue={(option) => onChange(option?.value || '')}
                value={getOptionLabel(positionBaseOptions, value)}
              />
            ) : (
              <Input
                error={getFieldError({ errors: formErrors, fieldName: name })}
                label={t('recruitmentAdFilters.fields.position.label', 'Poste')}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder={t('recruitmentAdFilters.fields.position.placeholderFallback', 'Ex: Avant-centre')}
                ref={ref}
                value={value}
              />
            )
          )}
        />

        <Controller
          control={control}
          name="city"
          render={({
            field: {
              name,
              onBlur,
              onChange,
              ref,
              value,
            },
          }) => (
            <Input
              error={getFieldError({ errors: formErrors, fieldName: name })}
              label={t('recruitmentAdFilters.fields.city.label', 'Ville')}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder={t('recruitmentAdFilters.fields.city.placeholder', 'Ex: Marseille')}
              ref={ref}
              value={value}
            />
          )}
        />

        <Controller
          control={control}
          name="section"
          render={({
            field: {
              name,
              onBlur,
              onChange,
              ref,
              value,
            },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: name })}
              isSearchable
              label={t('recruitmentAdFilters.fields.section.label', 'Section')}
              onBlur={onBlur}
              options={sectionOptions}
              placeholder={t('recruitmentAdFilters.fields.section.placeholder', 'Selectionner une section')}
              ref={ref}
              searchValue={sectionSearch}
              setSearchValue={setSectionSearch}
              setValue={(option) => onChange(option?.value || '')}
              value={getOptionLabel(sectionOptions, value)}
            />
          )}
        />

        <Controller
          control={control}
          name="category"
          render={({
            field: {
              name,
              onBlur,
              onChange,
              ref,
              value,
            },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: name })}
              isSearchable
              label={t('recruitmentAdFilters.fields.category.label', 'Categorie')}
              onBlur={onBlur}
              options={categoryOptions}
              placeholder={t('recruitmentAdFilters.fields.category.placeholder', 'Selectionner une categorie')}
              ref={ref}
              searchValue={categorySearch}
              setSearchValue={setCategorySearch}
              setValue={(option) => onChange(option?.value || '')}
              value={getOptionLabel(categoryOptions, value)}
            />
          )}
        />

        <Controller
          control={control}
          name="level"
          render={({
            field: {
              name,
              onBlur,
              onChange,
              ref,
              value,
            },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: name })}
              isSearchable
              label={t('recruitmentAdFilters.fields.level.label', 'Niveau')}
              onBlur={onBlur}
              options={levelOptions}
              placeholder={t('recruitmentAdFilters.fields.level.placeholder', 'Selectionner un niveau')}
              ref={ref}
              searchValue={levelSearch}
              setSearchValue={setLevelSearch}
              setValue={(option) => onChange(option?.value || '')}
              value={getOptionLabel(levelOptions, value)}
            />
          )}
        />
      </ScrollView>

      <View style={[Spaces.gap[16]]}>
        <Button
          onPress={handleClearFilters}
          title={t('recruitmentAdFilters.actions.clear', 'Effacer')}
          variant="Secondary"
        />
        <Button
          onPress={handleSubmit(handleApplyFilters)}
          title={t('recruitmentAdFilters.actions.apply', 'Appliquer')}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
}

export default RecruitmentAdFilters;
