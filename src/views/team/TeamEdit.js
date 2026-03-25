import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView, Platform, View,
  Alert,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { RouteNames } from '@/navigation/routeNames';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import CreateTrainerModal from '@/components/organisms/createTrainerModal/CreateTrainerModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetClub } from '@/services/club/clubQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';
import { useGetTeam } from '@/services/team/teamQueries';
import { createTeam, deleteTeam, updateTeam } from '@/services/team/teamService';

import { getFieldError } from '@/utils/form/formUtils';

/** @typedef {{ label: string; value: string }} Option */

const defaultValues = {
  activities: '',
  address: null,
  category: '',
  city: '',
  description: '',
  geohash: '',
  level: '',
  name: '',
  section: '',
  trainers: /** @type {string[]} */ ([]),
};

const teamSchema = Joi.object({
  activities: Joi.string().allow('', null).optional(),
  address: Joi.object().allow(null).optional(),
  category: Joi.string().required(),
  city: Joi.string().allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
  geohash: Joi.string().allow('', null).optional(),
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
  const { clubId, preselectedTrainerId, teamId } = route?.params ?? {};
  // local state
  const [activitySearch, setActivitySearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [isCreateTrainerModalVisible, setIsCreateTrainerModalVisible] = useState(false);
  const [levelSearch, setLevelSearch] = useState('');
  const preselectionAppliedRef = useRef(false);

  // hooks
  // Determine effective club ID (from params or team data)
  const { data: teamData } = useGetTeam(teamId, {
    enabled: !!teamId,
  });

  const effectiveClubId = clubId || teamData?.club?.documentId;
  const { data: clubData, refetch: refetchClubData } = useGetClub(effectiveClubId);

  // Track if we have already initialized the form to avoid overwrites
  const isInitialized = useRef(false);

  const { data: activities } = useGetActivities();
  const { data: categories } = useGetCategories();
  const { data: levels } = useGetLevels();
  const { data: sections } = useGetSections();

  const {
    Alignments, Colors, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();

  const teamMutation = useMutation({
    mutationFn: teamId ? updateTeam : createTeam,
    onSuccess: () => {
      navigation.goBack();
    },
  });
  const deleteTeamMutation = useMutation({
    mutationFn: deleteTeam,
    onError: () => {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('teamEdit.actions.deleteError', 'Impossible de supprimer l\'équipe.'),
      );
    },
    onSuccess: () => {
      navigation.navigate(RouteNames.TeamList);
    },
  });

  const {
    control,
    formState: { errors: formErrors },
    getValues,
    handleSubmit,
    reset,
    setFocus,
    setValue,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(teamSchema),
    shouldFocusError: false,
  });

  // Helper to normalize address structure (GeoJSON vs Flat)
  const formatAddress = (addr) => {
    if (!addr) return null;
    if (addr.label && !addr.properties) return addr;
    if (addr.properties?.label) {
      return {
        label: addr.properties.label,
        value: addr.geometry?.coordinates ? addr.geometry.coordinates.join('|') : '',
        ...addr,
      };
    }
    return null;
  };

  const getClubAddress = (club) => {
    if (!club) return null;
    const formatted = formatAddress(club.address);
    if (formatted) return formatted;
    if (club.addressDetails) {
      try {
        const details = typeof club.addressDetails === 'string'
          ? JSON.parse(club.addressDetails)
          : club.addressDetails;

        if (details?.address) {
          return {
            city: details.city,
            label: details.address,
            postcode: details.postcode,
            value: club.address?.lat && club.address?.lng
              ? `${club.address.lng}|${club.address.lat}`
              : '',
            ...club.address,
          };
        }
      } catch (e) {
        console.warn('Failed to parse club addressDetails', e);
      }
    }
    return null;
  };

  // Populate form with team data when editing OR pre-fill when creating
  useEffect(() => {
    if (teamId && teamData) {
      const teamAddress = formatAddress(teamData.address)
                       || getClubAddress(teamData.club)
                       || getClubAddress(clubData);

      reset({
        activities: teamData.activities?.[0]?.documentId || '',
        address: teamAddress || null,
        category: teamData.category?.documentId || '',
        city: teamData.city || teamData.club?.city || clubData?.city || '',
        description: teamData.description || '',
        geohash: teamData.geohash || teamData.club?.geohash || clubData?.geohash || '',
        level: teamData.level?.documentId || '',
        name: teamData.name || '',
        section: teamData.section?.documentId || '',
        trainers: teamData.trainers?.map((trainer) => trainer.documentId) || [],
      });
      isInitialized.current = true;
    } else if (!teamId && clubData && !isInitialized.current) {
      const clubAddress = getClubAddress(clubData);
      if (clubAddress) {
        reset({
          ...defaultValues,
          address: clubAddress,
          city: clubData.city || '',
          geohash: clubData.geohash || '',
        });
        isInitialized.current = true;
      }
    }
  }, [teamData, clubData, reset, teamId]);

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

  const trainerOptions = useMemo(() => {
    const members = clubData?.members
      ?.filter((member) => member.role?.name === USER_ROLES.coach
      || member.role?.name === USER_ROLES.president)
      .map((trainer) => ({
        label: `${trainer.firstname} ${trainer.lastname}`,
        value: trainer.documentId || '',
      })) || [];

    if (userData && (userData.role?.name === USER_ROLES.president || userData.role?.name === USER_ROLES.coach)) {
      const userAlreadyInList = members.some((m) => m.value === userData.documentId);
      if (!userAlreadyInList) {
        members.unshift({
          label: `${userData.firstname} ${userData.lastname} (Vous)`,
          value: userData.documentId || '',
        });
      }
    }

    return members;
  }, [clubData?.members, userData]);

  useEffect(() => {
    if (teamId || !preselectedTrainerId || preselectionAppliedRef.current) return;
    const trainerExists = trainerOptions.some((option) => option.value === preselectedTrainerId);
    if (!trainerExists) return;

    const currentTrainers = getValues('trainers') || [];
    if (!currentTrainers.includes(preselectedTrainerId)) {
      setValue('trainers', [...currentTrainers, preselectedTrainerId], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    preselectionAppliedRef.current = true;
  }, [getValues, preselectedTrainerId, setValue, teamId, trainerOptions]);

  const handleTrainerCreated = useCallback((createdTrainer) => {
    if (!createdTrainer?.documentId) return;

    const currentTrainers = getValues('trainers') || [];
    if (!currentTrainers.includes(createdTrainer.documentId)) {
      setValue(
        'trainers',
        [...currentTrainers, createdTrainer.documentId],
        { shouldDirty: true, shouldValidate: true },
      );
    }

    refetchClubData();
  }, [getValues, refetchClubData, setValue]);

  const handleFormSubmit = (data) => {
    // Keep relation payload as raw IDs for /teams REST API.
    // Backend controller handles relation normalization.
    const formattedTrainers = Array.isArray(data.trainers)
      ? data.trainers.filter(Boolean)
      : [];

    // Activities is single-select in form, but backend expects an array of IDs
    const formattedActivities = data.activities ? [data.activities] : [];

    const finalData = {
      ...data,
      activities: formattedActivities,
      category: data.category || undefined,
      city: data.address?.city || data.city,
      geohash: data.address?.geohash || data.geohash,
      level: data.level || undefined,
      section: data.section || undefined,
      trainers: formattedTrainers,
    };

    if (teamId) {
      teamMutation.mutate({
        ...finalData,
        documentId: teamId,
      });
    } else {
      teamMutation.mutate({
        ...finalData,
        club: clubId,
      });
    }
  };

  const canDeleteTeam = useMemo(
    () => !!teamId && userData?.role?.name === USER_ROLES.president,
    [teamId, userData?.role?.name],
  );

  const handleDeleteTeam = useCallback(() => {
    if (!teamId || deleteTeamMutation.isPending) return;

    const teamDisplayName = String(teamData?.name || '').trim() || t('teamDetails.title', 'Équipe');
    Alert.alert(
      t('teamEdit.actions.deleteTitle', "Supprimer l'équipe"),
      t(
        'teamEdit.actions.deleteConfirmWithName',
        {
          defaultValue: `Voulez-vous vraiment supprimer l'équipe "${teamDisplayName}" ? Cette action est irréversible.`,
          teamName: teamDisplayName,
        },
      ),
      [
        {
          style: 'cancel',
          text: t('common.cancel', 'Annuler'),
        },
        {
          onPress: () => deleteTeamMutation.mutate(teamId),
          style: 'destructive',
          text: t('teamEdit.actions.deleteConfirmAction', 'Oui, supprimer'),
        },
      ],
    );
  }, [deleteTeamMutation, t, teamData?.name, teamId]);

  useEffect(() => {
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
              name="address"
              render={({ field: { onChange, value } }) => (
                <AutocompleteAddressInput
                  address={value}
                  label={t('teamEdit.fields.address.label', 'Adresse de l\'équipe')}
                  placeholder={t('teamEdit.fields.address.placeholder', 'Rechercher une adresse')}
                  setAddress={(newAddress) => {
                    onChange(newAddress);
                  }}
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
                  actionLabel={t('teamEdit.fields.trainers.actions.add', 'Ajouter un entraîneur')}
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  isMulti
                  label={t('teamEdit.fields.trainers.label')}
                  onActionPress={() => setIsCreateTrainerModalVisible(true)}
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

        <View style={[Spaces.gap[12]]}>
          <Button
            isLoading={teamMutation.isPending}
            onPress={handleSubmit(handleFormSubmit)}
            title={t('teamEdit.actions.save')}
            variant="Primary"
          />
          {canDeleteTeam ? (
            <Button
              disabled={teamMutation.isPending}
              isLoading={deleteTeamMutation.isPending}
              onPress={handleDeleteTeam}
              style={{ backgroundColor: `${Colors.error500}12`, borderColor: Colors.error500 }}
              textStyle={{ color: Colors.error500 }}
              title={t('teamEdit.actions.deleteTeam', 'Supprimer l\'équipe')}
              variant="Secondary"
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
      <CreateTrainerModal
        isVisible={isCreateTrainerModalVisible}
        onClose={() => setIsCreateTrainerModalVisible(false)}
        onTrainerCreated={handleTrainerCreated}
      />
    </ScreenContainer>
  );
}

export default TeamEdit;
