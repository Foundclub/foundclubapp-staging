import { joiResolver } from '@hookform/resolvers/joi';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { SESSIONS_STATUS_OPTIONS } from '@/domains/event/eventUseCases';
import { useAppContext } from '@/store/appContext';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetClubs } from '@/services/club/clubQueries';
import { useGetEventTypes } from '@/services/event/eventQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetTeams } from '@/services/team/teamQueries';

import { getFieldError } from '@/utils/form/formUtils';

/** @typedef {{ label: string; value: string }} Option */

const filtersSchema = Joi.object({
  activity: Joi.string().allow(''),
  category: Joi.string().allow(''),
  club: Joi.object({
    label: Joi.string(),
    value: Joi.string(),
  }).allow(null).optional(),
  level: Joi.string().allow(''),
  sessionStatus: Joi.string().allow(''),
  team: Joi.object({
    label: Joi.string(),
    value: Joi.string(),
  }).allow(null).optional(),
  type: Joi.string().allow(''),
});

/**
 * EventFilters component for filtering events
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} EventFilters component
 */
function EventFilters({ navigation }) {
  // local states
  const [activitySearchValue, setActivitySearchValue] = useState('');
  const [categorySearchValue, setCategorySearchValue] = useState('');
  const [clubSearchValue, setClubSearchValue] = useState('');
  const [levelSearchValue, setLevelSearchValue] = useState('');
  const [typeSearchValue, setTypeSearchValue] = useState('');
  const [teamSearchValue, setTeamSearchValue] = useState('');
  const [selectedClub, setSelectedClub] = useState('');

  // hooks
  const { t } = useTranslation();
  const { Alignments, Spaces } = useTheme();
  const [{ eventFilters }, appDispatch] = useAppContext();

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    setValue,
  } = useForm({
    defaultValues: {
      activity: eventFilters?.activities || '',
      category: eventFilters?.category || '',
      club: eventFilters?.club || null,
      level: eventFilters?.level || '',
      sessionStatus: eventFilters?.sessionStatus || '',
      team: eventFilters?.team || null,
      type: eventFilters?.type || '',
    },
    mode: 'onBlur',
    resolver: joiResolver(filtersSchema),
  });

  const { data: allActivities } = useGetActivities();
  const { data: allCategories } = useGetCategories();
  const { data: clubPages } = useGetClubs(
    { name: clubSearchValue || undefined },
    { enabled: true },
  );
  const { data: allLevels } = useGetLevels();
  const { data: allTypes } = useGetEventTypes();
  const { data: teamPages } = useGetTeams(
    { clubId: selectedClub || eventFilters?.club?.value || undefined },
    { enabled: !!selectedClub },
  );

  const activities = useMemo(() => {
    const formattedActivities = allActivities?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
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
      value: documentId || '',
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

  const clubs = useMemo(() => {
    const formattedClubs = clubPages?.pages?.[0]?.data?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || [];
    return formattedClubs;
  }, [clubPages]);

  const levels = useMemo(() => {
    const formattedLevels = allLevels?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
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

  const types = useMemo(() => {
    const formattedTypes = allTypes?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || [];

    if (typeSearchValue) {
      return formattedTypes.filter(
        (type) => type.label.toLowerCase().includes(
          typeSearchValue.toLowerCase(),
        ),
      );
    }
    return formattedTypes;
  }, [allTypes, typeSearchValue]);

  const teams = useMemo(() => {
    const formattedTeams = teamPages?.pages?.[0]?.data?.map(({ documentId, name }) => ({
      label: name,
      value: documentId || '',
    })) || [];

    if (teamSearchValue) {
      return formattedTeams.filter(
        (team) => team.label.toLowerCase().includes(
          teamSearchValue.toLowerCase(),
        ),
      );
    }
    return formattedTeams;
  }, [teamPages, teamSearchValue]);

  /**
   * Gets the label of an option based on its value
   * @param {Option[]} options The array of options
   * @param {string} value The value to find
   * @returns {string} The label of the option
   */
  const getOptionLabel = (options, value) => options.find((option) => option.value === value)?.label || '';

  /**
   * Handles applying the selected filters
   * @param {{
   *   activity: string;
   *   category: string;
   *   club: {label: string; value: string} | null;
   *   level: string;
   *   sessionStatus: string;
   *   team: {label: string; value: string} | null;
   *   type: string;
   * }} data - The filter data
   */
  const handleApplyFilters = (data) => {
    appDispatch({ payload: data, type: 'SET_EVENT_FILTERS' });
    navigation.goBack();
  };

  const handleEmptyFilters = () => {
    appDispatch({ payload: {}, type: 'SET_EVENT_FILTERS' });
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
      ]}
    >
      <ScrollView
        contentContainerStyle={[Spaces.gap[40]]}
        style={[Spaces.marginVertical[16]]}
      >
        <Controller
          control={control}
          name="category"
          render={({
            field: { onChange, value },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'category' })}
              isSearchable
              label={t('eventFilters.fields.category.label')}
              options={categories}
              placeholder={t('eventFilters.fields.category.placeholder')}
              searchValue={categorySearchValue}
              setSearchValue={setCategorySearchValue}
              setValue={(/** @type {Option | undefined} */option) => onChange(option?.value || '')}
              value={getOptionLabel(categories, value)}
            />
          )}
        />

        <Controller
          control={control}
          name="sessionStatus"
          render={({
            field: { onChange, value },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'sessionStatus' })}
              label={t('eventFilters.fields.sessionStatus.label')}
              options={SESSIONS_STATUS_OPTIONS}
              placeholder={t('eventFilters.fields.sessionStatus.placeholder')}
              setValue={(/** @type {Option | undefined} */option) => onChange(option?.value || '')}
              value={getOptionLabel(SESSIONS_STATUS_OPTIONS, value)}
            />
          )}
        />

        <Controller
          control={control}
          name="club"
          render={({
            field: { onChange, value },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'club' })}
              isSearchable
              label={t('eventFilters.fields.club.label')}
              options={clubs}
              placeholder={t('eventFilters.fields.club.placeholder')}
              searchValue={clubSearchValue}
              setSearchValue={setClubSearchValue}
              setValue={(/** @type {Option | undefined} */option) => {
                const clubValue = option?.value || '';
                onChange(option || null);
                setSelectedClub(clubValue);
                setValue('team', null);
              }}
              value={value?.label || ''}
            />
          )}
        />

        <Controller
          control={control}
          name="team"
          render={({
            field: { onChange, value },
          }) => (
            <AutocompleteSelect
              disabled={!selectedClub && !eventFilters?.club}
              error={getFieldError({ errors: formErrors, fieldName: 'team' })}
              isSearchable
              label={t('eventFilters.fields.team.label')}
              options={teams}
              placeholder={selectedClub
                ? t('eventFilters.fields.team.placeholder')
                : t('eventFilters.fields.team.selectClubFirst')}
              searchValue={teamSearchValue}
              setSearchValue={setTeamSearchValue}
              setValue={(/** @type {Option | undefined} */option) => onChange(option || { label: '', value: '' })}
              value={value?.label || ''}
            />
          )}
        />

        <Controller
          control={control}
          name="level"
          render={({
            field: { onChange, value },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'level' })}
              isSearchable
              label={t('eventFilters.fields.level.label')}
              options={levels}
              placeholder={t('eventFilters.fields.level.placeholder')}
              searchValue={levelSearchValue}
              setSearchValue={setLevelSearchValue}
              setValue={(/** @type {Option | undefined} */option) => onChange(option?.value || '')}
              value={getOptionLabel(levels, value)}
            />
          )}
        />

        <Controller
          control={control}
          name="activity"
          render={({
            field: { onChange, value },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'activity' })}
              isSearchable
              label={t('eventFilters.fields.activity.label')}
              options={activities}
              placeholder={t('eventFilters.fields.activity.placeholder')}
              searchValue={activitySearchValue}
              setSearchValue={setActivitySearchValue}
              setValue={(/** @type {Option | undefined} */option) => onChange(option?.value || '')}
              value={getOptionLabel(activities, value)}
            />
          )}
        />

        <Controller
          control={control}
          name="type"
          render={({
            field: { onChange, value },
          }) => (
            <AutocompleteSelect
              error={getFieldError({ errors: formErrors, fieldName: 'type' })}
              isSearchable
              label={t('eventFilters.fields.type.label')}
              options={types}
              placeholder={t('eventFilters.fields.type.placeholder')}
              searchValue={typeSearchValue}
              setSearchValue={setTypeSearchValue}
              setValue={(/** @type {Option | undefined} */option) => onChange(option?.value || '')}
              value={getOptionLabel(types, value)}
            />
          )}
        />
      </ScrollView>

      <View style={[Spaces.gap[24]]}>
        <Button
          onPress={handleEmptyFilters}
          title={t('eventFilters.actions.clear')}
          variant="Secondary"
        />
        <Button
          onPress={handleSubmit(handleApplyFilters)}
          title={t('eventFilters.actions.apply')}
          variant="Primary"
        />
      </View>
    </ScreenContainer>
  );
}

export default EventFilters;
