import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

import { useGetSections } from '@/services/section/sectionQueries';

/** @typedef {{ label: string; value: string }} Option */

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardSection({ navigation }) {
  const { t } = useTranslation();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);
  const [searchValue, setSearchValue] = useState('');
  const { data: sections } = useGetSections();

  const options = useMemo(() => {
    const all = sections?.map((section) => ({
      label: section.name,
      value: section.documentId || '',
    })) || [];

    if (!searchValue.trim()) return all;
    return all.filter((option) => option.label.toLowerCase().includes(searchValue.toLowerCase()));
  }, [searchValue, sections]);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === state.section)?.label || '',
    [options, state.section],
  );

  return (
    <WizardStepLayout
      isNextDisabled={!state.section}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.navigate(RouteNames.TeamWizardDescription)}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.TeamWizardActivity)}
      onSkip={() => {}}
      stepCount={8}
      stepIndex={3}
      subtitle={t('teamWizard.steps.section.subtitle', "Selectionne la section de l'equipe.")}
      title={t('teamWizard.steps.section.title', 'Section')}
    >
      <View>
        <AutocompleteSelect
          isSearchable
          label={t('teamEdit.fields.section.label')}
          options={options}
          placeholder={t('teamEdit.fields.section.placeholder')}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          setValue={(/** @type {Option} */ option) => dispatch({ payload: option?.value || '', type: 'SET_SECTION' })}
          value={selectedLabel}
        />
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardSection;
