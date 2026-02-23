import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';

import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';

import { RouteNames } from '@/navigation/routeNames';

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardName({ navigation, route }) {
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { dispatch, state } = useTeamWizard();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    dispatch({
      payload: {
        clubId: route?.params?.clubId || userData?.club?.documentId || '',
        preselectedTrainerId: route?.params?.preselectedTrainerId || '',
      },
      type: 'INIT_FROM_PARAMS',
    });
  }, [dispatch, route?.params?.clubId, route?.params?.preselectedTrainerId, userData?.club?.documentId]);

  const handleNext = () => {
    dispatch({ payload: state.name.trim(), type: 'SET_NAME' });
    navigation.navigate(RouteNames.TeamWizardDescription);
  };

  return (
    <WizardStepLayout
      isNextDisabled={!state.name?.trim()}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      onSkip={() => {}}
      stepCount={8}
      stepIndex={1}
      subtitle={t('teamWizard.steps.name.subtitle', 'Donne un nom clair a ton equipe pour la retrouver facilement.')}
      title={t('teamWizard.steps.name.title', 'Nom de l equipe')}
    >
      <View>
        <Input
          autoFocus
          label={t('teamEdit.fields.name.label')}
          onChangeText={(value) => dispatch({ payload: value, type: 'SET_NAME' })}
          placeholder={t('teamEdit.fields.name.placeholder')}
          value={state.name}
        />
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardName;
