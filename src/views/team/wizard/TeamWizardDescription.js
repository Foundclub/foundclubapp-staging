import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';

import { RouteNames } from '@/navigation/routeNames';

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardDescription({ navigation }) {
  const { t } = useTranslation();
  const { dispatch, state } = useTeamWizard();

  return (
    <WizardStepLayout
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.navigate(RouteNames.TeamWizardName)}
      onNext={() => navigation.navigate(RouteNames.TeamWizardSection)}
      onSkip={() => {}}
      stepCount={8}
      stepIndex={2}
      subtitle={t('teamWizard.steps.description.subtitle', 'Precise l identite et les objectifs de l equipe.')}
      title={t('teamWizard.steps.description.title', 'Description (optionnel)')}
    >
      <View>
        <Input
          label={t('teamEdit.fields.description.label')}
          multiline
          onChangeText={(value) => dispatch({ payload: value, type: 'SET_DESCRIPTION' })}
          placeholder={t('teamEdit.fields.description.placeholder')}
          value={state.description}
        />
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardDescription;
