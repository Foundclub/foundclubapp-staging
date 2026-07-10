import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useTeamWizard } from '@/views/team/wizard/TeamWizardContext';
import useTeamWizardExit from '@/views/team/wizard/useTeamWizardExit';

import { RouteNames } from '@/navigation/routeNames';

import { useGetCategories } from '@/services/category/categoryQueries';

/**
 * Etape 5/8 du tunnel equipe — grille de categories « choisir = toucher »
 * (handoff decision 2) : tuiles 4 colonnes, la selection avance directement.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function TeamWizardCategory({ navigation }) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const { dispatch, state } = useTeamWizard();
  const handleExitWizard = useTeamWizardExit(navigation);
  const categoriesQuery = useGetCategories();
  const { data: categories } = categoriesQuery;
  const { isLoading } = categoriesQuery;
  const hasError = Boolean(categoriesQuery.error);

  const handleSelectCategory = (/** @type {string} */ categoryDocumentId) => {
    dispatch({ payload: categoryDocumentId, type: 'SET_CATEGORY' });
    navigation.navigate(RouteNames.TeamWizardLevel);
  };

  return (
    <WizardStepLayout
      isNextDisabled={!state.category || isLoading || hasError}
      nextLabel={t('common.next', 'Suivant')}
      onBack={() => navigation.navigate(RouteNames.TeamWizardActivity)}
      onClose={handleExitWizard}
      onNext={() => navigation.navigate(RouteNames.TeamWizardLevel)}
      stepCount={8}
      stepIndex={5}
      subtitle={t('teamWizard.steps.category.subtitle', "La catégorie d'âge de l'équipe.")}
      title={t('teamWizard.steps.category.title', 'Catégorie')}
    >
      <View>
        {isLoading ? (
          <View style={[{ alignItems: 'center', flexDirection: 'row' }, Spaces.gap[12], Spaces.marginBottom[16]]}>
            <ActivityIndicator size="small" />
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              Chargement des catégories disponibles…
            </Text>
          </View>
        ) : null}

        {hasError ? (
          <View style={[Spaces.gap[12], Spaces.marginBottom[16]]}>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Impossible de charger les catégories. Réessaie pour continuer.
            </Text>
            <Button onPress={() => categoriesQuery.refetch()} title="Réessayer" variant="Secondary" />
          </View>
        ) : null}

        <View
          style={{
            columnGap: 10,
            flexDirection: 'row',
            flexWrap: 'wrap',
            rowGap: 10,
          }}
        >
          {(categories || []).map((category) => {
            const categoryDocumentId = category.documentId || '';
            const isSelected = state.category === categoryDocumentId;
            return (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={categoryDocumentId || category.name}
                onPress={() => handleSelectCategory(categoryDocumentId)}
                style={{
                  alignItems: 'center',
                  backgroundColor: isSelected ? 'rgba(1,179,244,0.12)' : 'rgba(255,255,255,0.03)',
                  borderColor: isSelected ? Colors.primary500 : 'rgba(255,255,255,0.10)',
                  borderRadius: 14,
                  borderWidth: 1.5,
                  height: 54,
                  justifyContent: 'center',
                  paddingHorizontal: 6,
                  width: '22.7%',
                }}
              >
                <Text
                  numberOfLines={1}
                  style={[Fonts.p2Bold, isSelected ? Fonts.primary500 : Fonts.neutral00]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default TeamWizardCategory;
