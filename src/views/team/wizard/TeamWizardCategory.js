import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { RouteNames } from '@/navigation/routeNames';
import { useGetCategories } from '@/services/category/categoryQueries';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';

/** @typedef {{ label: string; value: string }} Option */

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardCategory({ navigation }) {
  const { t } = useTranslation();
  const { state, dispatch } = useTeamWizard();
  const [searchValue, setSearchValue] = useState('');
  const { data: categories } = useGetCategories();

  const options = useMemo(() => {
    const all = categories?.map((category) => ({
      label: category.name,
      value: category.documentId || '',
    })) || [];

    if (!searchValue.trim()) return all;
    return all.filter((option) => option.label.toLowerCase().includes(searchValue.toLowerCase()));
  }, [categories, searchValue]);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === state.category)?.label || '',
    [options, state.category],
  );

  return (
    <WizardStepLayout
      title={t('teamWizard.steps.category.title', 'Categorie')}
      subtitle={t('teamWizard.steps.category.subtitle', 'Selectionne la categorie de ton equipe.')}
      stepIndex={5}
      stepCount={8}
      onBack={() => navigation.navigate(RouteNames.TeamWizardActivity)}
      onNext={() => navigation.navigate(RouteNames.TeamWizardLevel)}
      onSkip={() => {}}
      nextLabel={t('common.next', 'Suivant')}
      isNextDisabled={!state.category}
    >
      <View>
        <AutocompleteSelect
          isSearchable
          label={t('teamEdit.fields.category.label')}
          options={options}
          placeholder={t('teamEdit.fields.category.placeholder')}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          setValue={(/** @type {Option} */ option) => dispatch({ type: 'SET_CATEGORY', payload: option?.value || '' })}
          value={selectedLabel}
        />
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardCategory;
