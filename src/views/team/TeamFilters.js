import { joiResolver } from '@hookform/resolvers/joi';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
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

/** @typedef {{ label: string; value: string }} Option */

const WEB_FILTER_SURFACE_PROPS = {
  contentWidth: 720,
  responsivePadding: true,
  surface: 'card',
};

const filtersSchema = Joi.object({
  activities: Joi.string().allow(''),
  category: Joi.string().allow(''),
  level: Joi.string().allow(''),
  name: Joi.string().allow(''),
  section: Joi.string().allow(''),
});

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamFilters({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [{ teamFilters }, appDispatch] = useAppContext();

  const {
    Alignments,
    Fonts,
    Spaces,
  } = useTheme();

  const [activitySearch, setActivitySearch] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [levelSearch, setLevelSearch] = useState('');

  const {
    data: activities,
    error: activitiesError,
    isLoading: isLoadingActivities,
    refetch: refetchActivities,
  } = useGetActivities();
  const {
    data: sections,
    error: sectionsError,
    isLoading: isLoadingSections,
    refetch: refetchSections,
  } = useGetSections();
  const {
    data: categories,
    error: categoriesError,
    isLoading: isLoadingCategories,
    refetch: refetchCategories,
  } = useGetCategories();
  const {
    data: levels,
    error: levelsError,
    isLoading: isLoadingLevels,
    refetch: refetchLevels,
  } = useGetLevels();

  const defaultValues = useMemo(() => ({
    activities: teamFilters?.activities || '',
    category: Array.isArray(teamFilters?.category) && teamFilters?.category?.length ? teamFilters?.category?.[0] : '',
    level: Array.isArray(teamFilters?.level) && teamFilters?.level?.length ? teamFilters?.level?.[0] : '',
    name: teamFilters?.name || '',
    section: teamFilters?.section || '',
  }), [
    teamFilters?.activities,
    teamFilters?.category,
    teamFilters?.level,
    teamFilters?.name,
    teamFilters?.section,
  ]);

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(filtersSchema),
  });

  const allActivityOptions = useMemo(() => (
    activities?.map((activity) => ({
      label: activity.name,
      value: activity.documentId || '',
    })) || []
  ), [activities]);

  const activityOptions = useMemo(() => {
    if (!activitySearch.trim()) return allActivityOptions;
    return allActivityOptions.filter((option) => option.label.toLowerCase().includes(activitySearch.toLowerCase()));
  }, [activitySearch, allActivityOptions]);

  const allSectionOptions = useMemo(() => (
    sections?.map((section) => ({
      label: section.name,
      value: section.documentId || '',
    })) || []
  ), [sections]);

  const sectionOptions = useMemo(() => {
    if (!sectionSearch.trim()) return allSectionOptions;
    return allSectionOptions.filter((option) => option.label.toLowerCase().includes(sectionSearch.toLowerCase()));
  }, [allSectionOptions, sectionSearch]);

  const allCategoryOptions = useMemo(() => (
    categories?.map((category) => ({
      label: category.name,
      value: category.documentId || '',
    })) || []
  ), [categories]);

  const categoryOptions = useMemo(() => {
    if (!categorySearch.trim()) return allCategoryOptions;
    return allCategoryOptions.filter((option) => option.label.toLowerCase().includes(categorySearch.toLowerCase()));
  }, [allCategoryOptions, categorySearch]);

  const allLevelOptions = useMemo(() => (
    levels?.map((level) => ({
      label: level.name,
      value: level.documentId || '',
    })) || []
  ), [levels]);

  const levelOptions = useMemo(() => {
    if (!levelSearch.trim()) return allLevelOptions;
    return allLevelOptions.filter((option) => option.label.toLowerCase().includes(levelSearch.toLowerCase()));
  }, [allLevelOptions, levelSearch]);

  const getOptionLabel = (/** @type {Option[]} */ options, /** @type {string} */ value) => (
    options.find((option) => option.value === value)?.label || ''
  );

  const hasReferenceError = Boolean(
    activitiesError
    || sectionsError
    || categoriesError
    || levelsError
  );

  const isReferenceLoading = Boolean(
    isLoadingActivities
    || isLoadingSections
    || isLoadingCategories
    || isLoadingLevels
  );

  const handleRetryReferences = () => {
    refetchActivities();
    refetchSections();
    refetchCategories();
    refetchLevels();
  };

  /**
   * @param {{
   *  name: string;
   *  activities: string;
   *  section: string;
   *  category: string;
   *  level: string;
   * }} data
   */
  const handleApplyFilters = (data) => {
    appDispatch({
      payload: {
        activities: data.activities || '',
        category: data.category ? [data.category] : [],
        level: data.level ? [data.level] : [],
        name: data.name?.trim() || '',
        section: data.section || '',
      },
      type: 'SET_TEAM_FILTERS',
    });
    navigation.goBack();
  };

  const handleClearFilters = () => {
    appDispatch({
      payload: {},
      type: 'SET_TEAM_FILTERS',
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
      {...WEB_FILTER_SURFACE_PROPS}
    >
      <ScrollView
        contentContainerStyle={[Spaces.gap[24]]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {hasReferenceError ? (
          <View
            style={[
              Spaces.padding[16],
              Spaces.gap[12],
              {
                backgroundColor: 'rgba(255, 159, 67, 0.12)',
                borderColor: 'rgba(255, 159, 67, 0.4)',
                borderRadius: 16,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('teamFilters.status.referenceErrorTitle', 'Certaines listes n ont pas pu etre chargees.')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral100]}>
              {t('teamFilters.status.referenceErrorBody', 'Vous pouvez quand meme filtrer par nom, ou recharger les listes de reference.')}
            </Text>
            <Button
              onPress={handleRetryReferences}
              title={t('common.retry', 'R\u00E9essayer')}
              variant="Secondary"
            />
          </View>
        ) : null}

        <Controller
          control={control}
          name="name"
          render={({
            field: {
              name, onBlur, onChange, ref, value,
            },
          }) => (
            <Input
              error={getFieldError({ errors: formErrors, fieldName: name })}
              label={t('teamFilters.fields.name.label', 'Nom de l équipe')}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder={t('teamFilters.fields.name.placeholder', 'Rechercher un nom')}
              ref={ref}
              value={value}
            />
          )}
        />

        <Controller
          control={control}
          name="activities"
          render={({
            field: {
              name, onBlur, onChange, ref, value,
            },
          }) => (
            <AutocompleteSelect
              disabled={Boolean(activitiesError)}
              error={getFieldError({ errors: formErrors, fieldName: name })}
              isLoading={isLoadingActivities}
              isSearchable
              label={t('teamFilters.fields.activities.label')}
              onBlur={onBlur}
              options={activityOptions}
              placeholder={t('teamFilters.fields.activities.placeholder')}
              ref={ref}
              searchValue={activitySearch}
              setSearchValue={setActivitySearch}
              setValue={(/** @type {Option} */ option) => onChange(option?.value || '')}
              value={getOptionLabel(allActivityOptions, value)}
            />
          )}
        />

        <Controller
          control={control}
          name="section"
          render={({
            field: {
              name, onBlur, onChange, ref, value,
            },
          }) => (
            <AutocompleteSelect
              disabled={Boolean(sectionsError)}
              error={getFieldError({ errors: formErrors, fieldName: name })}
              isLoading={isLoadingSections}
              isSearchable
              label={t('teamFilters.fields.section.label')}
              onBlur={onBlur}
              options={sectionOptions}
              placeholder={t('teamFilters.fields.section.placeholder')}
              ref={ref}
              searchValue={sectionSearch}
              setSearchValue={setSectionSearch}
              setValue={(/** @type {Option} */ option) => onChange(option?.value || '')}
              value={getOptionLabel(allSectionOptions, value)}
            />
          )}
        />

        <Controller
          control={control}
          name="category"
          render={({
            field: {
              name, onBlur, onChange, ref, value,
            },
          }) => (
            <AutocompleteSelect
              disabled={Boolean(categoriesError)}
              error={getFieldError({ errors: formErrors, fieldName: name })}
              isLoading={isLoadingCategories}
              isSearchable
              label={t('teamFilters.fields.category.label')}
              onBlur={onBlur}
              options={categoryOptions}
              placeholder={t('teamFilters.fields.category.placeholder')}
              ref={ref}
              searchValue={categorySearch}
              setSearchValue={setCategorySearch}
              setValue={(/** @type {Option} */ option) => onChange(option?.value || '')}
              value={getOptionLabel(allCategoryOptions, value)}
            />
          )}
        />

        <Controller
          control={control}
          name="level"
          render={({
            field: {
              name, onBlur, onChange, ref, value,
            },
          }) => (
            <AutocompleteSelect
              disabled={Boolean(levelsError)}
              error={getFieldError({ errors: formErrors, fieldName: name })}
              isLoading={isLoadingLevels}
              isSearchable
              label={t('teamFilters.fields.level.label')}
              onBlur={onBlur}
              options={levelOptions}
              placeholder={t('teamFilters.fields.level.placeholder')}
              ref={ref}
              searchValue={levelSearch}
              setSearchValue={setLevelSearch}
              setValue={(/** @type {Option} */ option) => onChange(option?.value || '')}
              value={getOptionLabel(allLevelOptions, value)}
            />
          )}
        />
      </ScrollView>

      <View style={[Spaces.gap[16]]}>
        <Button
          onPress={handleClearFilters}
          title={t('teamFilters.actions.clear')}
          variant="Secondary"
        />
        <Button
          disabled={isReferenceLoading}
          onPress={handleSubmit(handleApplyFilters)}
          title={t('teamFilters.actions.apply')}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
}

export default TeamFilters;
