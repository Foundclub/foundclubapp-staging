import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';

import { RouteNames } from '@/navigation/routeNames';

import { useGetCategories } from '@/services/category/categoryQueries';

/** @typedef {{ label: string; value: string }} Option */

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardCategory({ navigation }) {
  const { t } = useTranslation();
  const { dispatch, state } = useTeamWizard();
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
      isNextDisabled={!state.category}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.navigate(RouteNames.TeamWizardActivity)}
      onNext={() => navigation.navigate(RouteNames.TeamWizardLevel)}
      onSkip={() => {}}
      stepCount={8}
      stepIndex={5}
      subtitle={t('teamWizard.steps.category.subtitle', 'Selectionne la categorie de ton equipe.')}
      title={t('teamWizard.steps.category.title', 'Categorie')}
    >
      <View>
        <AutocompleteSelect
          isSearchable
          label={t('teamEdit.fields.category.label')}
          options={options}
          placeholder={t('teamEdit.fields.category.placeholder')}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          setValue={(/** @type {Option} */ option) => dispatch({ payload: option?.value || '', type: 'SET_CATEGORY' })}
          value={selectedLabel}
        />
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardCategory;
