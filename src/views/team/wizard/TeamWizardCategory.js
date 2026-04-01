import { useMemo, useState } from 'react';
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

import { useGetCategories } from '@/services/category/categoryQueries';

/** @typedef {{ label: string; value: string }} Option */

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardCategory({ navigation }) {
  const { t } = useTranslation();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);
  const [searchValue, setSearchValue] = useState('');
  const categoriesQuery = useGetCategories();
  const { data: categories } = categoriesQuery;
  const isLoading = categoriesQuery.isLoading;
  const hasError = Boolean(categoriesQuery.error);

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
      isNextDisabled={!state.category || isLoading || hasError}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.navigate(RouteNames.TeamWizardActivity)}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.TeamWizardLevel)}
      onSkip={() => {}}
      stepCount={8}
      stepIndex={5}
      subtitle={t('teamWizard.steps.category.subtitle', 'Sélectionné la catégorie de ton équipe.')}
      title={t('teamWizard.steps.category.title', 'Catégorie')}
    >
      <View>
        {isLoading ? (
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <ActivityIndicator size="small" />
            <Text>Chargement des categories disponibles...</Text>
          </View>
        ) : null}

        {hasError ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ marginBottom: 12 }}>
              Impossible de charger les categories. Reessayez pour continuer.
            </Text>
            <Button onPress={() => categoriesQuery.refetch()} title="R\u00E9essayer" variant="Secondary" />
          </View>
        ) : null}

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
