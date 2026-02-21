import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { RouteNames } from '@/navigation/routeNames';
import { useGetSections } from '@/services/section/sectionQueries';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';

/** @typedef {{ label: string; value: string }} Option */

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardSection({ navigation }) {
  const { t } = useTranslation();
  const { state, dispatch } = useTeamWizard();
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
      title={t('teamWizard.steps.section.title', 'Section')}
      subtitle={t('teamWizard.steps.section.subtitle', 'Selectionne la section de l equipe.')}
      stepIndex={3}
      stepCount={8}
      onBack={() => navigation.navigate(RouteNames.TeamWizardDescription)}
      onNext={() => navigation.navigate(RouteNames.TeamWizardActivity)}
      onSkip={() => {}}
      nextLabel={t('common.next', 'Suivant')}
      isNextDisabled={!state.section}
    >
      <View>
        <AutocompleteSelect
          isSearchable
          label={t('teamEdit.fields.section.label')}
          options={options}
          placeholder={t('teamEdit.fields.section.placeholder')}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          setValue={(/** @type {Option} */ option) => dispatch({ type: 'SET_SECTION', payload: option?.value || '' })}
          value={selectedLabel}
        />
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardSection;
