import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import useAuth from '@/domains/auth/useAuth';
import { RouteNames } from '@/navigation/routeNames';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardName({ navigation, route }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { state, dispatch } = useTeamWizard();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    dispatch({
      type: 'INIT_FROM_PARAMS',
      payload: {
        clubId: route?.params?.clubId || userData?.club?.documentId || '',
        preselectedTrainerId: route?.params?.preselectedTrainerId || '',
      },
    });
  }, [dispatch, route?.params?.clubId, route?.params?.preselectedTrainerId, userData?.club?.documentId]);

  const handleNext = () => {
    dispatch({ type: 'SET_NAME', payload: state.name.trim() });
    navigation.navigate(RouteNames.TeamWizardDescription);
  };

  return (
    <WizardStepLayout
      title={t('teamWizard.steps.name.title', 'Nom de l equipe')}
      subtitle={t('teamWizard.steps.name.subtitle', 'Donne un nom clair a ton equipe pour la retrouver facilement.')}
      stepIndex={1}
      stepCount={8}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      onSkip={() => {}}
      nextLabel={t('common.next', 'Suivant')}
      isNextDisabled={!state.name?.trim()}
    >
      <View>
        <Input
          autoFocus
          label={t('teamEdit.fields.name.label')}
          placeholder={t('teamEdit.fields.name.placeholder')}
          value={state.name}
          onChangeText={(value) => dispatch({ type: 'SET_NAME', payload: value })}
        />
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardName;
