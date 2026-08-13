import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Text,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import Input from '@/components/molecules/input/Input';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import CreateTrainerModal from '@/components/organisms/createTrainerModal/CreateTrainerModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useGetClub } from '@/services/club/clubQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import { useGetSections } from '@/services/section/sectionQueries';
import { useGetTeam } from '@/services/team/teamQueries';
import { createTeam, deleteTeam, updateTeam } from '@/services/team/teamService';

import { getFieldError } from '@/utils/form/formUtils';
import safeJsonParse from '@/utils/safeJsonParse';

/** @typedef {{ label: string; value: string }} Option */

const defaultValues = {
  activities: '',
  address: null,
  authorizedMembershipManagers: /** @type {string[]} */ ([]),
  category: '',
  city: '',
  description: '',
  geohash: '',
  level: '',
  name: '',
  section: '',
  teamMembershipApprovalEnabledForCoaches: true,
  trainers: /** @type {string[]} */ ([]),
};

const teamSchema = Joi.object({
  activities: Joi.string().allow('', null).optional(),
  address: Joi.object().allow(null).optional(),
  authorizedMembershipManagers: Joi.array().items(Joi.string()).optional(),
  category: Joi.string().required(),
  city: Joi.string().allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
  geohash: Joi.string().allow('', null).optional(),
  level: Joi.string().required(),
  name: Joi.string().required(),
  section: Joi.string().required(),
  teamMembershipApprovalEnabledForCoaches: Joi.boolean().required(),
  trainers: Joi.array().items(Joi.string()).optional(),
}).unknown(true);

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
    const details = safeJsonParse(club.addressDetails, null);

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
  }
  return null;
};

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
  const {
    data: teamData,
    error: teamError,
    isLoading: isTeamLoading,
    refetch: refetchTeam,
  } = useGetTeam(teamId, {
    enabled: !!teamId,
  });

  const effectiveClubId = clubId || teamData?.club?.documentId;
  const {
    data: clubData,
    error: clubError,
    isLoading: isClubLoading,
    refetch: refetchClubData,
  } = useGetClub(effectiveClubId, {
    enabled: Boolean(effectiveClubId),
  });

  // Track if we have already initialized the form to avoid overwrites
  const isInitialized = useRef(false);

  const activitiesQuery = useGetActivities();
  const categoriesQuery = useGetCategories();
  const levelsQuery = useGetLevels();
  const sectionsQuery = useGetSections();
  const { data: activities } = activitiesQuery;
  const { data: categories } = categoriesQuery;
  const { data: levels } = levelsQuery;
  const { data: sections } = sectionsQuery;

  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const queryClient = useQueryClient();
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);

  const teamMutation = useMutation({
    mutationFn: teamId ? updateTeam : createTeam,
    onError: (mutationError) => {
      const subscriptionDecision = extractSubscriptionDecisionFromError(mutationError);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }

      const errorMessage = mutationError?.response?.data?.error?.message
        || mutationError?.response?.data?.error
        || mutationError?.message
        || t('teamEdit.actions.saveError', 'Impossible d enregistrer l équipe.');

      Alert.alert(t('common.error', 'Erreur'), errorMessage);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      await queryClient.invalidateQueries({ queryKey: ['get-me'] });
      await queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] });
      navigation.goBack();
    },
  });
  const deleteTeamMutation = useMutation({
    mutationFn: deleteTeam,
    onError: (mutationError) => {
      const subscriptionDecision = extractSubscriptionDecisionFromError(mutationError);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }

      Alert.alert(
        t('common.error', 'Erreur'),
        t('teamEdit.actions.deleteError', 'Impossible de supprimer l\'équipe.'),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] });
      await queryClient.invalidateQueries({ queryKey: ['get-me'] });
      await queryClient.invalidateQueries({ queryKey: ['app-bootstrap'] });
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

  // Populate form with team data when editing OR pre-fill when creating
  useEffect(() => {
    if (teamId && teamData) {
      const teamAddress = formatAddress(teamData.address)
                       || getClubAddress(teamData.club)
                       || getClubAddress(clubData);

      reset({
        activities: teamData.activities?.[0]?.documentId || '',
        address: teamAddress || null,
        authorizedMembershipManagers: teamData.authorizedMembershipManagers?.map((manager) => manager.documentId) || [],
        category: teamData.category?.documentId || '',
        city: teamData.city || teamData.club?.city || clubData?.city || '',
        description: teamData.description || '',
        geohash: teamData.geohash || teamData.club?.geohash || clubData?.geohash || '',
        level: teamData.level?.documentId || '',
        name: teamData.name || '',
        section: teamData.section?.documentId || '',
        teamMembershipApprovalEnabledForCoaches: teamData.teamMembershipApprovalEnabledForCoaches !== false,
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
          label: `${userData.firstname} ${userData.lastname} (Toi)`,
          value: userData.documentId || '',
        });
      }
    }

    return members;
  }, [clubData?.members, userData]);

  const watchedTrainerIds = useWatch({
    control,
    defaultValue: [],
    name: 'trainers',
  });
  const coachApprovalEnabled = useWatch({
    control,
    defaultValue: true,
    name: 'teamMembershipApprovalEnabledForCoaches',
  });
  const watchedAuthorizedMembershipManagers = useWatch({
    control,
    defaultValue: [],
    name: 'authorizedMembershipManagers',
  });
  const selectedTrainerIds = useMemo(
    () => (Array.isArray(watchedTrainerIds) ? watchedTrainerIds : []),
    [watchedTrainerIds],
  );
  const authorizedMembershipManagers = useMemo(
    () => (Array.isArray(watchedAuthorizedMembershipManagers) ? watchedAuthorizedMembershipManagers : []),
    [watchedAuthorizedMembershipManagers],
  );
  const selectedTrainerOptions = useMemo(
    () => trainerOptions.filter((option) => selectedTrainerIds.includes(option.value)),
    [selectedTrainerIds, trainerOptions],
  );
  const clubUsesOwnerOnlyMembershipApproval = clubData?.membershipRequestManagementMode === 'CLUB_OWNER_ONLY';

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

  useEffect(() => {
    const currentManagers = getValues('authorizedMembershipManagers') || [];
    const nextManagers = currentManagers.filter((managerId) => selectedTrainerIds.includes(managerId));
    if (nextManagers.length !== currentManagers.length) {
      setValue('authorizedMembershipManagers', nextManagers, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [getValues, selectedTrainerIds, setValue]);

  useEffect(() => {
    if (!clubUsesOwnerOnlyMembershipApproval) return;
    if (coachApprovalEnabled) {
      setValue('teamMembershipApprovalEnabledForCoaches', false, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    const currentManagers = getValues('authorizedMembershipManagers') || [];
    if (currentManagers.length > 0) {
      setValue('authorizedMembershipManagers', [], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [clubUsesOwnerOnlyMembershipApproval, coachApprovalEnabled, getValues, setValue]);

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
      authorizedMembershipManagers: Array.isArray(data.authorizedMembershipManagers)
        ? data.authorizedMembershipManagers.filter(Boolean)
        : [],
      category: data.category || undefined,
      city: data.address?.city || data.city,
      geohash: data.address?.geohash || data.geohash,
      level: data.level || undefined,
      section: data.section || undefined,
      teamMembershipApprovalEnabledForCoaches: data.teamMembershipApprovalEnabledForCoaches === true,
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
          defaultValue: `Veux-tu vraiment supprimer l'équipe "${teamDisplayName}" ? Cette action est irréversible.`,
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

  const isBootstrapLoading = isTeamLoading
    || isClubLoading
    || activitiesQuery.isLoading
    || categoriesQuery.isLoading
    || levelsQuery.isLoading
    || sectionsQuery.isLoading;

  const bootstrapError = teamError
    || clubError
    || activitiesQuery.error
    || categoriesQuery.error
    || levelsQuery.error
    || sectionsQuery.error;

  const isMissingTeamId = !teamId;
  const isTeamNotFound = Boolean(teamId) && !isTeamLoading && !teamError && !teamData;
  const isClubNotFound = Boolean(effectiveClubId) && !isClubLoading && !clubError && !clubData;
  const isFormBlocked = isBootstrapLoading || Boolean(bootstrapError) || isMissingTeamId || isTeamNotFound || isClubNotFound;

  useEffect(() => {
    navigation.setOptions({
      headerTitle: teamId
        ? t('teamEdit.titleEdit')
        : t('teamEdit.title'),
    });
  }, [navigation, teamId, t]);

  const handleRetryBootstrap = () => {
    if (teamId) {
      refetchTeam();
    }
    if (effectiveClubId) {
      refetchClubData();
    }
    activitiesQuery.refetch();
    categoriesQuery.refetch();
    levelsQuery.refetch();
    sectionsQuery.refetch();
  };

  if (isFormBlocked) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Spaces.paddingVertical[32]]}
      >
        <View style={[Alignments.fill, Alignments.justifyCenter, Spaces.gap[16]]}>
          {isBootstrapLoading ? (
            <View style={[Alignments.alignCenter, Spaces.gap[12]]}>
              <Loader color={Colors.primary500} size="large" />
              <Text>Chargement des informations de cette équipe...</Text>
            </View>
          ) : null}

          {isMissingTeamId ? (
            <View style={Spaces.gap[12]}>
              <Text>Identifiant d équipe manquant. Ouvre la fiche équipe pour continuer.</Text>
              <Button onPress={() => navigation.navigate(RouteNames.TeamList)} title="Retour aux équipes" variant="Secondary" />
            </View>
          ) : null}

          {isTeamNotFound ? (
            <View style={Spaces.gap[12]}>
              <Text>Équipe introuvable. Vérifie le lien ou retourne à la liste des équipes.</Text>
              <Button onPress={() => navigation.navigate(RouteNames.TeamList)} title="Retour aux équipes" variant="Secondary" />
            </View>
          ) : null}

          {isClubNotFound ? (
            <View style={Spaces.gap[12]}>
              <Text>Club introuvable pour cette équipe. Reessaye ou reviens à la fiche équipe.</Text>
              <Button onPress={handleRetryBootstrap} title="Réessayer" variant="Secondary" />
            </View>
          ) : null}

          {bootstrapError && !isBootstrapLoading ? (
            <View style={Spaces.gap[12]}>
              <Text>{bootstrapError?.message || 'Impossible de charger les informations de l équipe.'}</Text>
              <Button onPress={handleRetryBootstrap} title="Réessayer" variant="Secondary" />
            </View>
          ) : null}
        </View>
      </ScreenContainer>
    );
  }

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

            <Text
              style={[
                Fonts.p4Bold,
                Fonts.neutral300,
                { letterSpacing: 1.2, marginBottom: -16, textTransform: 'uppercase' },
              ]}
            >
              {t('teamEdit.sections.sportProfile', 'Profil sportif')}
            </Text>

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
                  setValue={(/** @type {Option | undefined} */ option) => onChange(
                    option?.value || '',
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
                  setValue={(/** @type {Option | undefined} */ option) => onChange(
                    option?.value || '',
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
                  setValue={(/** @type {Option | undefined} */ option) => onChange(
                    option?.value || '',
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

            <View
              style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                Spaces.gap[12],
                {
                  backgroundColor: 'rgba(4, 31, 44, 0.82)',
                  borderColor: 'rgba(1, 179, 244, 0.24)',
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                {t('teamEdit.membershipRequests.title', "Demandes d'adhésion")}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {clubUsesOwnerOnlyMembershipApproval
                  ? t(
                    'teamEdit.membershipRequests.ownerOnlyDescription',
                    'Le club est configuré pour que le dirigeant traite toutes les demandes. Les entraîneurs de cette équipe ne pourront pas accepter ou refuser directement.',
                  )
                  : t(
                    'teamEdit.membershipRequests.description',
                    'Choisis si les entraîneurs de cette équipe peuvent gérer les demandes, ou si le dirigeant garde la main.',
                  )}
              </Text>

              {!clubUsesOwnerOnlyMembershipApproval ? (
                <>
                  <Controller
                    control={control}
                    name="teamMembershipApprovalEnabledForCoaches"
                    render={({ field: { onChange, value } }) => (
                      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[16]]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                            {t('teamEdit.membershipRequests.allowCoachToggle', "Autoriser l'entraîneur à traiter les demandes")}
                          </Text>
                          <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4]]}>
                            {t(
                              'teamEdit.membershipRequests.allowCoachHint',
                              'Si ce réglage est désactivé, seul le dirigeant pourra accepter ou refuser les demandes pour cette équipe.',
                            )}
                          </Text>
                        </View>
                        <Switch
                          onValueChange={onChange}
                          thumbColor={value ? Colors.primary500 : Colors.neutral300}
                          trackColor={{ false: Colors.neutral500, true: `${Colors.primary500}66` }}
                          value={value === true}
                        />
                      </View>
                    )}
                  />

                  {coachApprovalEnabled ? (
                    <Controller
                      control={control}
                      name="authorizedMembershipManagers"
                      render={({
                        field: {
                          name, onBlur, onChange, ref, value,
                        },
                      }) => (
                        <AutocompleteSelect
                          error={getFieldError({ errors: formErrors, fieldName: name })}
                          isMulti
                          label={t('teamEdit.membershipRequests.authorizedManagers', 'Entraîneurs autorisés')}
                          onBlur={onBlur}
                          options={selectedTrainerOptions}
                          placeholder={t('teamEdit.membershipRequests.authorizedManagersPlaceholder', 'Tous les entraîneurs sélectionnés')}
                          ref={ref}
                          setValue={(/** @type {Option[] | null} */ options) => onChange(
                            options?.map((opt) => opt.value) || [],
                          )}
                          value={(Array.isArray(value) ? value : [])
                            .map((managerId) => selectedTrainerOptions.find((option) => option.value === managerId)?.label)
                            .filter(Boolean)
                            .join(', ')}
                        />
                      )}
                    />
                  ) : null}

                  {coachApprovalEnabled ? (
                    <Text style={[Fonts.p3, Fonts.neutral200]}>
                      {authorizedMembershipManagers.length > 0
                        ? t(
                          'teamEdit.membershipRequests.authorizedManagersHint',
                          'Seuls les entraîneurs sélectionnés pourront gérer les demandes. Le dirigeant gardera toujours une vue complète.',
                        )
                        : t(
                          'teamEdit.membershipRequests.allSelectedHint',
                          "Aucun filtre précis n'est appliqué: tous les entraîneurs de l'équipe pourront traiter les demandes.",
                        )}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          </View>
        </ScrollView>

        <View style={[Spaces.gap[12]]}>
          <Button
            disabled={isFormBlocked}
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
        clubId={effectiveClubId}
        isVisible={isCreateTrainerModalVisible}
        onClose={() => setIsCreateTrainerModalVisible(false)}
        onTrainerCreated={handleTrainerCreated}
      />
      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={effectiveClubId || null}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </ScreenContainer>
  );
}

export default TeamEdit;
