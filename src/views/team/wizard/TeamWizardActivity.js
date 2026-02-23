import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';

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
  const [searchValue, setSearchValue] = useState('');
  const { data: activities } = useGetActivities();

  const options = useMemo(() => {
    const all = activities?.map((activity) => ({
      label: activity.name,
      value: activity.documentId || '',
    })) || [];

    if (!searchValue.trim()) return all;
    return all.filter((option) => option.label.toLowerCase().includes(searchValue.toLowerCase()));
  }, [activities, searchValue]);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === state.activities)?.label || '',
    [options, state.activities],
  );

  return (
    <WizardStepLayout
      isNextDisabled={!state.activities}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.navigate(RouteNames.TeamWizardSection)}
      onNext={() => navigation.navigate(RouteNames.TeamWizardCategory)}
      onSkip={() => {}}
      stepCount={8}
      stepIndex={4}
      subtitle={t('teamWizard.steps.activity.subtitle', 'Selectionne le sport principal de l equipe.')}
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
