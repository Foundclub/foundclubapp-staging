import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { RouteNames } from '@/navigation/routeNames';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardDescription({ navigation }) {
  const { t } = useTranslation();
  const { state, dispatch } = useTeamWizard();

  return (
    <WizardStepLayout
      title={t('teamWizard.steps.description.title', 'Description (optionnel)')}
      subtitle={t('teamWizard.steps.description.subtitle', 'Precise l identite et les objectifs de l equipe.')}
      stepIndex={2}
      stepCount={8}
      onBack={() => navigation.navigate(RouteNames.TeamWizardName)}
      onNext={() => navigation.navigate(RouteNames.TeamWizardSection)}
      onSkip={() => {}}
      nextLabel={t('common.next', 'Suivant')}
    >
      <View>
        <Input
          multiline
          label={t('teamEdit.fields.description.label')}
          placeholder={t('teamEdit.fields.description.placeholder')}
          value={state.description}
          onChangeText={(value) => dispatch({ type: 'SET_DESCRIPTION', payload: value })}
        />
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardDescription;
