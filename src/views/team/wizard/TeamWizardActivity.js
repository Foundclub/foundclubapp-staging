import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useGetClub } from '@/services/club/clubQueries';

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
  const { data: activities } = useGetActivities();
  const { data: clubData } = useGetClub(state.clubId, { enabled: Boolean(state.clubId) });

  const allowedActivityIds = useMemo(() => {
    const ids = (clubData?.activites || [])
      .map((activity) => String(activity?.documentId || '').trim())
      .filter(Boolean);
    return new Set(ids);
  }, [clubData?.activites]);

  const clubActivityOptions = useMemo(() => {
    const allActivities = activities || [];
    const filteredByClub = allowedActivityIds.size > 0
      ? allActivities.filter((activity) => allowedActivityIds.has(String(activity.documentId || '')))
      : allActivities;

    return filteredByClub.map((activity) => ({
      label: activity.name,
      value: activity.documentId || '',
    }));
  }, [activities, allowedActivityIds]);

  const options = useMemo(() => {
    if (!searchValue.trim()) return clubActivityOptions;
    return clubActivityOptions.filter((option) => option.label.toLowerCase().includes(searchValue.toLowerCase()));
  }, [clubActivityOptions, searchValue]);

  useEffect(() => {
    if (clubActivityOptions.length === 1) {
      const singleSportId = clubActivityOptions[0].value;
      if (singleSportId && state.activities !== singleSportId) {
        dispatch({ payload: singleSportId, type: 'SET_ACTIVITY' });
      }
      return;
    }

    if (state.activities && !clubActivityOptions.some((option) => option.value === state.activities)) {
      dispatch({ payload: '', type: 'SET_ACTIVITY' });
    }
  }, [clubActivityOptions, dispatch, state.activities]);

  const selectedLabel = useMemo(
    () => clubActivityOptions.find((option) => option.value === state.activities)?.label || '',
    [clubActivityOptions, state.activities],
  );

  return (
    <WizardStepLayout
      isNextDisabled={!state.activities}
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
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardActivity;
