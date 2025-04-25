import { joiResolver } from '@hookform/resolvers/joi';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useAppContext } from '@/store/appContext';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';

import { getFieldError } from '@/utils/form/formUtils';

const filtersSchema = Joi.object({
  activities: Joi.string().allow(''),
  category: Joi.array().items(Joi.string()).allow(null),
  level: Joi.array().items(Joi.string()).allow(null),
  name: Joi.string().allow(''),
  section: Joi.string().allow(''),
});

/**
 * TeamFilters component for filtering teams
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} TeamFilters component
 */
function TeamFilters({ navigation }) {
  // hooks
  const { t } = useTranslation();
  const {
    Alignments,
    Spaces,
  } = useTheme();
  const [{ teamFilters }, appDispatch] = useAppContext();

  // local states
  const [activitySearchValue, setActivitySearchValue] = useState('');
  const [categorySearchValue, setCategorySearchValue] = useState('');
  const [levelSearchValue, setLevelSearchValue] = useState('');

  const { data: allActivities } = useGetActivities();
  const { data: allCategories } = useGetCategories();
  const { data: allLevels } = useGetLevels();
  const { data: allSections } = useGetSections();

  const initialValues = useMemo(() => ({
    activities: teamFilters?.activities || '',
    category: teamFilters?.category || [],
    level: teamFilters?.level || [],
    name: teamFilters?.name || '',
    section: teamFilters?.section || '',
  }), [teamFilters]);

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
  } = useForm({
    defaultValues: initialValues,
    mode: 'onBlur',
    resolver: joiResolver(filtersSchema),
  });

  /**
   * Handles the application of filters
   * @param {typeof initialValues} data
   */
  const handleApplyFilters = (data) => {
    appDispatch({ payload: data, type: 'SET_TEAM_FILTERS' });
    navigation.goBack();
  };

  const handleEmptyFilters = () => {
    appDispatch({ payload: {}, type: 'SET_TEAM_FILTERS' });
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
          activitySearchValue.toLowerCase(),
        ),
      );
    }

    return formattedActivities;
  }, [allActivities, activitySearchValue]);

  const categories = useMemo(() => {
    const formattedCategories = allCategories?.map(({ documentId, name }) => ({
      label: name,
      value: documentId,
    })) || [];

    if (categorySearchValue) {
      return formattedCategories.filter(
        (category) => category.label.toLowerCase().includes(
          categorySearchValue.toLowerCase(),
        ),
      );
    }

    return formattedCategories;
  }, [allCategories, categorySearchValue]);

  const levels = useMemo(() => {
    const formattedLevels = allLevels?.map(({ documentId, name }) => ({
      label: name,
      value: documentId,
    })) || [];

    if (levelSearchValue) {
      return formattedLevels.filter(
        (level) => level.label.toLowerCase().includes(
          levelSearchValue.toLowerCase(),
        ),
      );
    }

    return formattedLevels;
  }, [allLevels, levelSearchValue]);

  const sections = useMemo(() => {
    const formattedSections = allSections?.map(({ documentId, name }) => ({
      label: name,
      value: documentId,
    })) || [];

    return formattedSections;
  }, [allSections]);

  /**
   * Get the label of an activity based on its value
   * @param {string} value
   * @returns {string} The label of the activity
   */
  const getActivityLabel = (value) => activities.find((activity) => activity.value === value)?.label || '';

  /**
   * Get the labels of categories based on their values
   * @param {string[]} values
   * @returns {string} The labels of the categories
   */
  const getCategoryLabels = (values) => values?.map((value) => categories.find((cat) => cat.value === value)?.label).filter(Boolean).join(', ') || '';

  /**
   * Get the labels of levels based on their values
   * @param {string[]} values
   * @returns {string} The labels of the levels
   */
  const getLevelLabels = (values) => values?.map((value) => levels.find((lvl) => lvl.value === value)?.label).filter(Boolean).join(', ') || '';

  /**
   * Get the label of a section based on its value
   * @param {string} value
   * @returns {string} The label of the section
   */
  const getSectionLabel = (value) => sections.find((section) => section.value === value)?.label || '';

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[Spaces.gap[40], Spaces.marginTop[16]]}>
        <Controller
          control={control}
          name="section"
          render={({
            field: { onChange, ref, value },
          }) => (
            <AutocompleteSelect
              label={t('teamFilters.fields.section.label')}
              options={sections}
              placeholder={t('teamFilters.fields.section.placeholder')}
              ref={ref}
              setValue={(/** @type {{ value: string } | null} */ option) => onChange(option?.value || '')}
              value={getSectionLabel(value)}
            />
          )}
        />

        <Controller
          control={control}
          name="activities"
          render={({
            field: { onChange, ref, value },
          }) => (
            <AutocompleteSelect
              isSearchable
              label={t('teamFilters.fields.activities.label')}
              options={activities}
              placeholder={t('teamFilters.fields.activities.placeholder')}
              ref={ref}
              searchValue={activitySearchValue}
              setSearchValue={setActivitySearchValue}
              setValue={(/** @type {{ value: string } | null} */ option) => onChange(option?.value || '')}
              value={getActivityLabel(value)}
            />
          )}
        />

        <Controller
          control={control}
          name="category"
          render={({
            field: { onChange, ref, value },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'category' })}
              isMulti
              isSearchable
              label={t('teamFilters.fields.category.label')}
              options={categories}
              placeholder={t('teamFilters.fields.category.placeholder')}
              ref={ref}
              searchValue={categorySearchValue}
              setSearchValue={setCategorySearchValue}
              setValue={(/** @type {Array<{value: string}>} */ options) => onChange(
                (options || []).map((opt) => opt.value),
              )}
              value={getCategoryLabels(/** @type {Array<string>} */(value) || [])}
            />
          )}
        />

        <Controller
          control={control}
          name="level"
          render={({
            field: { onChange, ref, value },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'level' })}
              isMulti
              isSearchable
              label={t('teamFilters.fields.level.label')}
              options={levels}
              placeholder={t('teamFilters.fields.level.placeholder')}
              ref={ref}
              searchValue={levelSearchValue}
              setSearchValue={setLevelSearchValue}
              setValue={(/** @type {Array<{value: string}>} */ options) => onChange(
                (options || []).map((opt) => opt.value),
              )}
              value={getLevelLabels(/** @type {Array<string>} */(value) || [])}
            />
          )}
        />
      </View>
      <View style={[Spaces.gap[24]]}>
        <Button
          onPress={handleEmptyFilters}
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
