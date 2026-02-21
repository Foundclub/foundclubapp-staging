import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { RouteNames } from '@/navigation/routeNames';
import { useGetLevels } from '@/services/level/levelQueries';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';

/** @typedef {{ label: string; value: string }} Option */

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardLevel({ navigation }) {
  const { t } = useTranslation();
  const { state, dispatch } = useTeamWizard();
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
      title={t('teamWizard.steps.level.title', 'Niveau')}
      subtitle={t('teamWizard.steps.level.subtitle', 'Selectionne le niveau sportif de l equipe.')}
      stepIndex={6}
      stepCount={8}
      onBack={() => navigation.navigate(RouteNames.TeamWizardCategory)}
      onNext={() => navigation.navigate(RouteNames.TeamWizardTrainers)}
      onSkip={() => {}}
      nextLabel={t('common.next', 'Suivant')}
      isNextDisabled={!state.level}
    >
      <View>
        <AutocompleteSelect
          isSearchable
          label={t('teamEdit.fields.level.label')}
          options={options}
          placeholder={t('teamEdit.fields.level.placeholder')}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          setValue={(/** @type {Option} */ option) => dispatch({ type: 'SET_LEVEL', payload: option?.value || '' })}
          value={selectedLabel}
        />
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardLevel;
