import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

const sanitizeRouteParam = (value) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue || normalizedValue.startsWith(':')) {
    return '';
  }

  return normalizedValue;
};

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardName({ navigation, route }) {
  const { t } = useTranslation();
  const { Spaces } = useTheme();
  const { userData } = useAuth();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);
  const routeClubId = sanitizeRouteParam(route?.params?.clubId);
  const routePreselectedTrainerId = sanitizeRouteParam(route?.params?.preselectedTrainerId);
  const accountClubId = sanitizeRouteParam(userData?.club?.documentId || userData?.club?.id);
  const hasClubContext = Boolean(state.clubId || routeClubId || accountClubId);

  useEffect(() => {
    const nextClubId = routeClubId || accountClubId;
    const nextPreselectedTrainerId = routePreselectedTrainerId;
    const shouldInitClubId = Boolean(nextClubId) && !state.clubId;
    const shouldInitTrainerId = Boolean(nextPreselectedTrainerId)
      && !state.preselectedTrainerId
      && !state.trainers?.includes(nextPreselectedTrainerId);

    if (!shouldInitClubId && !shouldInitTrainerId) {
      return;
    }

    dispatch({
      payload: {
        clubId: nextClubId,
        preselectedTrainerId: nextPreselectedTrainerId,
      },
      type: 'INIT_FROM_PARAMS',
    });
  }, [
    accountClubId,
    dispatch,
    routeClubId,
    routePreselectedTrainerId,
    state.clubId,
    state.preselectedTrainerId,
    state.trainers,
  ]);

  const handleNext = () => {
    if (!hasClubContext) {
      return;
    }
    dispatch({ payload: state.name.trim(), type: 'SET_NAME' });
    navigation.navigate(RouteNames.TeamWizardDescription);
  };

  return (
    <WizardStepLayout
      isNextDisabled={!state.name?.trim() || !hasClubContext}
      nextLabel={t('common.next', 'Suivant')}
      onBack={handleExitWizard}
      onClose={handleExitWizard}
      onNext={handleNext}
      onSkip={() => {}}
      stepCount={8}
      stepIndex={1}
      subtitle={t('teamWizard.steps.name.subtitle', 'Donne un nom clair à ton équipe pour la retrouver facilement.')}
      title={t('teamWizard.steps.name.title', "Nom de l'équipe")}
    >
      <View>
        {!hasClubContext ? (
          <View style={[Spaces.gap[12], Spaces.marginBottom[16]]}>
            <Text>
              Impossible de demarrer la creation de l'equipe sans club. Reviens a la liste des equipes ou a la fiche club puis relance le wizard.
            </Text>
            <Button
              onPress={handleExitWizard}
              title="Retour a mes equipes"
              variant="Secondary"
            />
          </View>
        ) : null}
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
