import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardDescription({ navigation }) {
  const { t } = useTranslation();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);

  return (
    <WizardStepLayout
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.navigate(RouteNames.TeamWizardName)}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.TeamWizardSection)}
      onSkip={() => {}}
      stepCount={8}
      stepIndex={2}
      subtitle={t('teamWizard.steps.description.subtitle', 'Précise l\'identité et les objectifs de l\'équipe.')}
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
