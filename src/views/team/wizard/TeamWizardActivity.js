import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';

/** @typedef {{ label: string; value: string }} Option */

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardActivity({ navigation }) {
  const { t } = useTranslation();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);
  const [searchValue, setSearchValue] = useState('');
  const activitiesQuery = useGetActivities();
  const {
    data: activities,
    error: activitiesError,
    isLoading,
  } = activitiesQuery;
  const hasError = Boolean(activitiesError);
  const isClubMissing = !state.clubId;

  const activityOptions = useMemo(() => {
    const allActivities = Array.isArray(activities) ? activities : [];
    return allActivities.map((activity) => ({
      label: activity.name,
      value: activity.documentId || '',
    }));
  }, [activities]);

  const options = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    if (!normalizedSearch) return activityOptions;
    return activityOptions.filter((option) => option.label.toLowerCase().includes(normalizedSearch));
  }, [activityOptions, searchValue]);

  useEffect(() => {
    if (activityOptions.length === 1) {
      const [{ value: singleSportId }] = activityOptions;
      if (singleSportId && state.activities !== singleSportId) {
        dispatch({ payload: singleSportId, type: 'SET_ACTIVITY' });
      }
      return;
    }

    if (state.activities && !activityOptions.some((option) => option.value === state.activities)) {
      dispatch({ payload: '', type: 'SET_ACTIVITY' });
    }
  }, [activityOptions, dispatch, state.activities]);

  const selectedLabel = useMemo(
    () => activityOptions.find((option) => option.value === state.activities)?.label || '',
    [activityOptions, state.activities],
  );

  return (
    <WizardStepLayout
      isNextDisabled={!state.activities || isLoading || hasError || isClubMissing}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.navigate(RouteNames.TeamWizardSection)}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.TeamWizardCategory)}
      onSkip={() => {}}
      stepCount={8}
      stepIndex={4}
      subtitle={t('teamWizard.steps.activity.subtitle', "Sélectionne le sport principal de l'équipe.")}
      title={t('teamWizard.steps.activity.title', 'Sport')}
    >
      <View>
        {isLoading ? (
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <ActivityIndicator size="small" />
            <Text>Chargement des sports disponibles...</Text>
          </View>
        ) : null}

        {isClubMissing ? (
          <View style={{ marginBottom: 16 }}>
            <Text>Club introuvable pour initialiser la création de l’équipe. Reviens à la liste des équipes puis relance le wizard.</Text>
          </View>
        ) : null}

        {hasError ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ marginBottom: 12 }}>
              Impossible de charger le référentiel des sports. Réessayez pour continuer.
            </Text>
            <Button
              onPress={() => {
                activitiesQuery.refetch();
              }}
              title="Réessayer"
              variant="Secondary"
            />
          </View>
        ) : null}

        <AutocompleteSelect
          isSearchable
          label={t('teamEdit.fields.activities.label')}
          options={options}
          placeholder={t('teamEdit.fields.activities.placeholder')}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          setValue={(/** @type {Option} */ option) => dispatch({ payload: option?.value || '', type: 'SET_ACTIVITY' })}
          value={selectedLabel}
        />

        {!isLoading && !hasError && !isClubMissing && activityOptions.length === 0 ? (
          <View style={{ marginTop: 12 }}>
            <Text>Aucun sport n’est disponible pour le moment.</Text>
          </View>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardActivity;
