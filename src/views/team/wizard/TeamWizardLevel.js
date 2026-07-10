import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WizardOptionCard from '@/components/molecules/wizardOptionCard/WizardOptionCard';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

import { useGetLevels } from '@/services/level/levelQueries';

/**
 * Etape 6/8 du tunnel equipe — niveaux en liste compacte pleine page,
 * la selection avance directement (handoff decision 2).
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardLevel({ navigation }) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);
  const levelsQuery = useGetLevels();
  const { data: levels } = levelsQuery;
  const { isLoading } = levelsQuery;
  const hasError = Boolean(levelsQuery.error);

  const handleSelectLevel = (/** @type {string} */ levelDocumentId) => {
    dispatch({ payload: levelDocumentId, type: 'SET_LEVEL' });
    navigation.navigate(RouteNames.TeamWizardTrainers);
  };

  return (
    <WizardStepLayout
      isNextDisabled={!state.level || isLoading || hasError}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.navigate(RouteNames.TeamWizardCategory)}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.TeamWizardTrainers)}
      stepCount={8}
      stepIndex={6}
      subtitle={t('teamWizard.steps.level.subtitle', "Le niveau de compétition de l'équipe.")}
      title={t('teamWizard.steps.level.title', 'Niveau')}
    >
      <View>
        {isLoading ? (
          <View style={[{ alignItems: 'center', flexDirection: 'row' }, Spaces.gap[12], Spaces.marginBottom[16]]}>
            <ActivityIndicator size="small" />
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              Chargement des niveaux disponibles…
            </Text>
          </View>
        ) : null}

        {hasError ? (
          <View style={[Spaces.gap[12], Spaces.marginBottom[16]]}>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Impossible de charger les niveaux. Réessaie pour continuer.
            </Text>
            <Button onPress={() => levelsQuery.refetch()} title="Réessayer" variant="Secondary" />
          </View>
        ) : null}

        {(levels || []).map((level) => {
          const levelDocumentId = level.documentId || '';
          return (
            <WizardOptionCard
              compact
              key={levelDocumentId || level.name}
              onPress={() => handleSelectLevel(levelDocumentId)}
              selected={state.level === levelDocumentId}
              title={level.name}
            />
          );
        })}
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardLevel;
