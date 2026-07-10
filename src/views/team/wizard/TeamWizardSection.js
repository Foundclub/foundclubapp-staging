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

import { useGetSections } from '@/services/section/sectionQueries';

// Sous-titres d'aide des sections (handoff tunnel 3/8).
/** @type {Record<string, string>} */
const SECTION_SUBTITLES = {
  mixte: 'Ouverte à toutes et tous',
};

/**
 * Etape 3/8 du tunnel equipe — « choisir = toucher » : les sections en liste
 * pleine page, la selection avance directement (handoff decision 2).
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardSection({ navigation }) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);
  const sectionsQuery = useGetSections();
  const { data: sections } = sectionsQuery;
  const { isLoading } = sectionsQuery;
  const hasError = Boolean(sectionsQuery.error);

  const handleSelectSection = (/** @type {string} */ sectionDocumentId) => {
    dispatch({ payload: sectionDocumentId, type: 'SET_SECTION' });
    navigation.navigate(RouteNames.TeamWizardActivity);
  };

  return (
    <WizardStepLayout
      isNextDisabled={!state.section || isLoading || hasError}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.navigate(RouteNames.TeamWizardDescription)}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.TeamWizardActivity)}
      stepCount={8}
      stepIndex={3}
      subtitle={t('teamWizard.steps.section.subtitle', 'Dans quelle section joue cette équipe ?')}
      title={t('teamWizard.steps.section.title', 'Section')}
    >
      <View>
        {isLoading ? (
          <View style={[{ alignItems: 'center', flexDirection: 'row' }, Spaces.gap[12], Spaces.marginBottom[16]]}>
            <ActivityIndicator size="small" />
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              Chargement des sections disponibles…
            </Text>
          </View>
        ) : null}

        {hasError ? (
          <View style={[Spaces.gap[12], Spaces.marginBottom[16]]}>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Impossible de charger les sections. Réessaie pour continuer.
            </Text>
            <Button onPress={() => sectionsQuery.refetch()} title="Réessayer" variant="Secondary" />
          </View>
        ) : null}

        {(sections || []).map((section) => {
          const sectionDocumentId = section.documentId || '';
          const normalizedName = String(section.name || '').trim().toLowerCase();
          return (
            <WizardOptionCard
              key={sectionDocumentId || section.name}
              onPress={() => handleSelectSection(sectionDocumentId)}
              selected={state.section === sectionDocumentId}
              subtitle={SECTION_SUBTITLES[normalizedName]}
              title={section.name}
            />
          );
        })}
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardSection;
