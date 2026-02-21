import { joiResolver } from '@hookform/resolvers/joi';
import { Controller, useForm } from 'react-hook-form';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';

import { useAppContext } from '@/store/appContext';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';
import { getFieldError } from '@/utils/form/formUtils';

/** @typedef {{ label: string; value: string }} Option */

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
    Spaces,
  } = useTheme();

  const [activitySearch, setActivitySearch] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [levelSearch, setLevelSearch] = useState('');

  const { data: activities } = useGetActivities();
  const { data: sections } = useGetSections();
  const { data: categories } = useGetCategories();
  const { data: levels } = useGetLevels();

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

  const activityOptions = useMemo(() => {
    const options = activities?.map((activity) => ({
      label: activity.name,
      value: activity.documentId || '',
    })) || [];

    if (!activitySearch.trim()) return options;
    return options.filter((option) => option.label.toLowerCase().includes(activitySearch.toLowerCase()));
  }, [activities, activitySearch]);

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

  const getOptionLabel = (/** @type {Option[]} */ options, /** @type {string} */ value) => (
    options.find((option) => option.value === value)?.label || ''
  );

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
      type: 'SET_TEAM_FILTERS',
      payload: {
        name: data.name?.trim() || '',
        activities: data.activities || '',
        section: data.section || '',
        category: data.category ? [data.category] : [],
        level: data.level ? [data.level] : [],
      },
    });
    navigation.goBack();
  };

  const handleClearFilters = () => {
    appDispatch({
      type: 'SET_TEAM_FILTERS',
      payload: {},
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
    >
      <ScrollView
        contentContainerStyle={[Spaces.gap[24]]}
        showsVerticalScrollIndicator={false}
      >
        <Controller
          control={control}
          name="name"
          render={({ field: { name, onBlur, onChange, ref, value } }) => (
            <Input
              error={getFieldError({ errors: formErrors, fieldName: name })}
              label={t('teamFilters.fields.name.label', 'Nom de l equipe')}
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
          render={({ field: { name, onBlur, onChange, ref, value } }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: name })}
              isSearchable
              label={t('teamFilters.fields.activities.label')}
              onBlur={onBlur}
              options={activityOptions}
              placeholder={t('teamFilters.fields.activities.placeholder')}
              ref={ref}
              searchValue={activitySearch}
              setSearchValue={setActivitySearch}
              setValue={(/** @type {Option} */ option) => onChange(option?.value || '')}
              value={getOptionLabel(activityOptions, value)}
            />
          )}
        />

        <Controller
          control={control}
          name="section"
          render={({ field: { name, onBlur, onChange, ref, value } }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: name })}
              isSearchable
              label={t('teamFilters.fields.section.label')}
              onBlur={onBlur}
              options={sectionOptions}
              placeholder={t('teamFilters.fields.section.placeholder')}
              ref={ref}
              searchValue={sectionSearch}
              setSearchValue={setSectionSearch}
              setValue={(/** @type {Option} */ option) => onChange(option?.value || '')}
              value={getOptionLabel(sectionOptions, value)}
            />
          )}
        />

        <Controller
          control={control}
          name="category"
          render={({ field: { name, onBlur, onChange, ref, value } }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: name })}
              isSearchable
              label={t('teamFilters.fields.category.label')}
              onBlur={onBlur}
              options={categoryOptions}
              placeholder={t('teamFilters.fields.category.placeholder')}
              ref={ref}
              searchValue={categorySearch}
              setSearchValue={setCategorySearch}
              setValue={(/** @type {Option} */ option) => onChange(option?.value || '')}
              value={getOptionLabel(categoryOptions, value)}
            />
          )}
        />

        <Controller
          control={control}
          name="level"
          render={({ field: { name, onBlur, onChange, ref, value } }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: name })}
              isSearchable
              label={t('teamFilters.fields.level.label')}
              onBlur={onBlur}
              options={levelOptions}
              placeholder={t('teamFilters.fields.level.placeholder')}
              ref={ref}
              searchValue={levelSearch}
              setSearchValue={setLevelSearch}
              setValue={(/** @type {Option} */ option) => onChange(option?.value || '')}
              value={getOptionLabel(levelOptions, value)}
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
          onPress={handleSubmit(handleApplyFilters)}
          title={t('teamFilters.actions.apply')}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
}

export default TeamFilters;
