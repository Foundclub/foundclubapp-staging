import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

import { useGetLevels } from '@/services/level/levelQueries';

/** @typedef {{ label: string; value: string }} Option */

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardLevel({ navigation }) {
  const { t } = useTranslation();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);
  const [searchValue, setSearchValue] = useState('');
  const { data: levels } = useGetLevels();

  const options = useMemo(() => {
    const all = levels?.map((level) => ({
      label: level.name,
      value: level.documentId || '',
    })) || [];

    if (!searchValue.trim()) return all;
    return all.filter((option) => option.label.toLowerCase().includes(searchValue.toLowerCase()));
  }, [levels, searchValue]);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === state.level)?.label || '',
    [options, state.level],
  );

  return (
    <WizardStepLayout
      isNextDisabled={!state.level}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.navigate(RouteNames.TeamWizardCategory)}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.TeamWizardTrainers)}
      onSkip={() => {}}
      stepCount={8}
      stepIndex={6}
      subtitle={t('teamWizard.steps.level.subtitle', 'Sélectionné le niveau sportif de l équipe.')}
      title={t('teamWizard.steps.level.title', 'Niveau')}
    >
      <View>
        <AutocompleteSelect
          isSearchable
          label={t('teamEdit.fields.level.label')}
          options={options}
          placeholder={t('teamEdit.fields.level.placeholder')}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          setValue={(/** @type {Option} */ option) => dispatch({ payload: option?.value || '', type: 'SET_LEVEL' })}
          value={selectedLabel}
        />
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardLevel;
