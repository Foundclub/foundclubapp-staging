import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView, Platform, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetClub } from '@/services/club/clubQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';
import { useGetTeam } from '@/services/team/teamQueries';
import { createTeam, updateTeam } from '@/services/team/teamService';

import { getFieldError } from '@/utils/form/formUtils';

/** @typedef {{ label: string; value: string }} Option */

const defaultValues = {
  activities: '',
  category: '',
  description: '',
  level: '',
  name: '',
  section: '',
  trainers: /** @type {string[]} */ ([]),
};

const teamSchema = Joi.object({
  activities: Joi.string().allow('', null).optional(),
  category: Joi.string().required(),
  description: Joi.string().allow('', null).optional(),
  level: Joi.string().required(),
  name: Joi.string().required(),
  section: Joi.string().required(),
  trainers: Joi.array().items(Joi.string()).optional(),
}).unknown(true);

/**
 * Team edit screen component. Allows users to create or edit a team.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Team edit screen component
 */
function TeamEdit({ navigation, route }) {
  const { clubId, teamId } = route?.params ?? {};
  // local state
  const [activitySearch, setActivitySearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [levelSearch, setLevelSearch] = useState('');
  // hooks
  const { data: clubData } = useGetClub(clubId);
  const { data: activities } = useGetActivities();
  const { data: categories } = useGetCategories();
  const { data: levels } = useGetLevels();
  const { data: sections } = useGetSections();
  const { data: teamData } = useGetTeam(teamId, {
    enabled: !!teamId,
  });
  const {
    Alignments, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const teamMutation = useMutation({
    mutationFn: teamId ? updateTeam : createTeam,
    onSuccess: () => {
      navigation.goBack();
    },
  });

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    reset,
    setFocus,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(teamSchema),
    shouldFocusError: false,
  });

  // Populate form with team data when editing
  useEffect(() => {
    if (teamData) {
      reset({
        activities: teamData.activities?.[0]?.documentId || '',
        category: teamData.category?.documentId || '',
        description: teamData.description || '',
        level: teamData.level?.documentId || '',
        name: teamData.name || '',
        section: teamData.section?.documentId || '',
        trainers: teamData.trainers?.map((trainer) => trainer.documentId) || [],
      });
    }
  }, [teamData, reset]);

  const sectionOptions = useMemo(() => (
    sections?.map((section) => ({
      label: section.name,
      value: section.documentId || '',
    }))
    || []
  ), [sections]);

  const activityOptions = useMemo(() => (
    activities?.reduce((/** @type {Option[]} */acc, activity) => {
      if (activity.name.toLowerCase().includes(activitySearch.toLowerCase())) {
        acc.push({
          label: activity.name,
          value: activity.documentId || '',
        });
      }
      return acc;
    }, [])
  ), [activities, activitySearch]);

  const categoryOptions = useMemo(() => (
    categories?.reduce((/** @type {Option[]} */acc, category) => {
      if (category.name.toLowerCase().includes(categorySearch.toLowerCase())) {
        acc.push({
          label: category.name,
          value: category.documentId || '',
        });
      }
      return acc;
    }, [])
  ), [categories, categorySearch]);

  const levelOptions = useMemo(() => (
    levels?.reduce((/** @type {Option[]} */acc, level) => {
      if (level.name.toLowerCase().includes(levelSearch.toLowerCase())) {
        acc.push({
          label: level.name,
          value: level.documentId || '',
        });
      }
      return acc;
    }, [])
  ), [levels, levelSearch]);

  const trainerOptions = clubData?.members
    ?.filter((member) => member.role.name === 'Entraineur')
    .map((trainer) => ({
      label: `${trainer.firstname} ${trainer.lastname}`,
      value: trainer.documentId || '',
    })) || [];

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = (data) => {
    if (teamId) {
      teamMutation.mutate({
        ...data,
        activities: [data.activities],
        documentId: teamId,
        trainers: data.trainers,
      });
    } else {
      teamMutation.mutate({
        ...data,
        activities: [data.activities],
        club: clubId,
      });
    }
  };

  // Set navigation options to change the header title based on whether editing or creating
  useMemo(() => {
    navigation.setOptions({
      headerTitle: teamId
        ? t('teamEdit.titleEdit')
        : t('teamEdit.title'),
    });
  }, [navigation, teamId, t]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingVertical[32]]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
        style={[Alignments.justifySpaceBetween, Alignments.fill]}
      >
        <ScrollView
          contentContainerStyle={[
            Spaces.gap[24],
            Spaces.paddingBottom[40],
          ]}
          style={[Alignments.fill]}
        >
          <View style={[Alignments.fill, Spaces.gap[32]]}>
            <Controller
              control={control}
              name="name"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="next"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('teamEdit.fields.name.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('description')}
                  placeholder={t('teamEdit.fields.name.placeholder')}
                  ref={ref}
                  value={value}
                />
              )}
            />

            <Controller
              control={control}
              name="description"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="enter"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('teamEdit.fields.description.label')}
                  multiline
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t('teamEdit.fields.description.placeholder')}
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
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('teamEdit.fields.section.label')}
                  onBlur={onBlur}
                  options={sectionOptions}
                  placeholder={t('teamEdit.fields.section.placeholder')}
                  ref={ref}
                  setValue={(/** @type {Option | null} */ option) => onChange(option?.value || '')}
                  value={sectionOptions.find((option) => option.value === value)?.label || ''}
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
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  isSearchable
                  label={t('teamEdit.fields.activities.label')}
                  onBlur={onBlur}
                  options={activityOptions || []}
                  placeholder={t('teamEdit.fields.activities.placeholder')}
                  ref={ref}
                  searchValue={activitySearch}
                  setSearchValue={setActivitySearch}
                  setValue={(/** @type {Option} */ option) => onChange(
                    option.value || '',
                  )}
                  value={activities?.find((opt) => opt.documentId === value)?.name || ''}
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
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  isSearchable
                  label={t('teamEdit.fields.category.label')}
                  onBlur={onBlur}
                  options={categoryOptions || []}
                  placeholder={t('teamEdit.fields.category.placeholder')}
                  ref={ref}
                  searchValue={categorySearch}
                  setSearchValue={setCategorySearch}
                  setValue={(/** @type {Option} */ option) => onChange(
                    option.value || '',
                  )}
                  value={categories?.find((opt) => opt.documentId === value)?.name || ''}
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
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  isSearchable
                  label={t('teamEdit.fields.level.label')}
                  onBlur={onBlur}
                  options={levelOptions || []}
                  placeholder={t('teamEdit.fields.level.placeholder')}
                  ref={ref}
                  searchValue={levelSearch}
                  setSearchValue={setLevelSearch}
                  setValue={(/** @type {Option} */ option) => onChange(
                    option.value || '',
                  )}
                  value={levels?.find((opt) => opt.documentId === value)?.name || ''}
                />
              )}
            />

            <Controller
              control={control}
              name="trainers"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  isMulti
                  label={t('teamEdit.fields.trainers.label')}
                  onBlur={onBlur}
                  options={trainerOptions}
                  placeholder={t('teamEdit.fields.trainers.placeholder')}
                  ref={ref}
                  setValue={(/** @type {Option[] | null} */ options) => onChange(
                    options?.map((opt) => opt.value) || [],
                  )}
                  value={value?.map((v) => trainerOptions.find((opt) => opt.value === v)?.label).join(', ')}
                />
              )}
            />
          </View>
        </ScrollView>

        <Button
          isLoading={teamMutation.isPending}
          onPress={handleSubmit(handleFormSubmit)}
          title={t('teamEdit.actions.save')}
          variant="Primary"
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default TeamEdit;
