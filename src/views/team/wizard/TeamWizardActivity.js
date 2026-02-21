import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { RouteNames } from '@/navigation/routeNames';
import { useGetActivities } from '@/services/activity/activityQueries';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';

/** @typedef {{ label: string; value: string }} Option */

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardActivity({ navigation }) {
  const { t } = useTranslation();
  const { state, dispatch } = useTeamWizard();
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
      title={t('teamWizard.steps.activity.title', 'Sport')}
      subtitle={t('teamWizard.steps.activity.subtitle', 'Selectionne le sport principal de l equipe.')}
      stepIndex={4}
      stepCount={8}
      onBack={() => navigation.navigate(RouteNames.TeamWizardSection)}
      onNext={() => navigation.navigate(RouteNames.TeamWizardCategory)}
      onSkip={() => {}}
      nextLabel={t('common.next', 'Suivant')}
      isNextDisabled={!state.activities}
    >
      <View>
        <AutocompleteSelect
          isSearchable
          label={t('teamEdit.fields.activities.label')}
          options={options}
          placeholder={t('teamEdit.fields.activities.placeholder')}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          setValue={(/** @type {Option} */ option) => dispatch({ type: 'SET_ACTIVITY', payload: option?.value || '' })}
          value={selectedLabel}
        />
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardActivity;
