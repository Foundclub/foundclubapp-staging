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
  const sectionsQuery = useGetSections();
  const { data: sections } = sectionsQuery;
  const isLoading = sectionsQuery.isLoading;
  const hasError = Boolean(sectionsQuery.error);

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
      isNextDisabled={!state.section || isLoading || hasError}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.navigate(RouteNames.TeamWizardDescription)}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.TeamWizardActivity)}
      onSkip={() => {}}
      stepCount={8}
      stepIndex={3}
      subtitle={t('teamWizard.steps.section.subtitle', "Sélectionne la section de l'équipe.")}
      title={t('teamWizard.steps.section.title', 'Section')}
    >
      <View>
        {isLoading ? (
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <ActivityIndicator size="small" />
            <Text>Chargement des sections disponibles...</Text>
          </View>
        ) : null}

        {hasError ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ marginBottom: 12 }}>
              Impossible de charger les sections. Reessayez pour continuer.
            </Text>
            <Button onPress={() => sectionsQuery.refetch()} title="Reessayer" variant="Secondary" />
          </View>
        ) : null}

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
