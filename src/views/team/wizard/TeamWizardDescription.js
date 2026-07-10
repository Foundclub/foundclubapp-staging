import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

const DESCRIPTION_MAX_LENGTH = 280;

/**
 * Etape 2/8 du tunnel equipe — description optionnelle avec « Passer cette
 * étape » reel et compteur de caracteres (handoff decision 2).
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardDescription({ navigation }) {
  const { t } = useTranslation();
  const { Alignments, Fonts, Spaces } = useTheme();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);

  const handleSkip = () => {
    dispatch({ payload: '', type: 'SET_DESCRIPTION' });
    navigation.navigate(RouteNames.TeamWizardSection);
  };

  return (
    <WizardStepLayout
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.navigate(RouteNames.TeamWizardName)}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.TeamWizardSection)}
      onSkip={handleSkip}
      showSkip
      stepCount={8}
      stepIndex={2}
      subtitle={t('teamWizard.steps.description.subtitle', "Optionnel — précise l'identité et les objectifs de l'équipe.")}
      title={t('teamWizard.steps.description.title', 'Description')}
    >
      <View>
        <Input
          maxLength={DESCRIPTION_MAX_LENGTH}
          multiline
          onChangeText={(value) => dispatch({ payload: value, type: 'SET_DESCRIPTION' })}
          placeholder={t(
            'teamWizard.steps.description.placeholder',
            'Ex. : Équipe engagée en championnat départemental. Entraînements mardi et jeudi, matchs le samedi.',
          )}
          value={state.description}
        />
        <View style={[Alignments.row, Alignments.justifyEnd, Spaces.marginTop[8]]}>
          <Text style={[Fonts.p4, Fonts.neutral400]}>
            {`${String(state.description || '').length}/${DESCRIPTION_MAX_LENGTH}`}
          </Text>
        </View>
        <Text style={[Fonts.p4, Fonts.neutral300, Spaces.marginTop[12]]}>
          {t(
            'teamWizard.steps.description.hint',
            "Visible sur la page de l'équipe et dans la recherche — utile pour attirer des joueur·se·s.",
          )}
        </Text>
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardDescription;
