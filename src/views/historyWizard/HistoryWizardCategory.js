import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useHistoryWizard } from '@/views/historyWizard/HistoryWizardContext';

import { RouteNames } from '@/navigation/routeNames';

import { useGetCategories } from '@/services/category/categoryQueries';

/**
 * Category step of the history wizard.
 * @param {{
 *  navigation: import('@react-navigation/native').NavigationProp<any>;
 *  route?: { params?: { editingEntry?: any; resetContext?: boolean; returnRoute?: string } };
 * }} props
 * @returns {import('react').ReactElement}
 */
function HistoryWizardCategory({ navigation, route }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useHistoryWizard();
  const {
    data: categories,
    error,
    isLoading,
    refetch,
  } = useGetCategories();
  const isEditing = Boolean(state.editingEntry);
  const categoryOptions = Array.isArray(categories) ? categories : [];

  useEffect(() => {
    if (route?.params?.resetContext) {
      dispatch({ type: 'RESET' });
    }

    if (route?.params?.editingEntry) {
      dispatch({ payload: route.params.editingEntry, type: 'SET_EDITING_ENTRY' });
    }

    if (route?.params?.returnRoute) {
      dispatch({ payload: route.params.returnRoute, type: 'SET_RETURN_ROUTE' });
    }
  }, [dispatch, route?.params]);

  const handleSelectCategory = (category) => {
    if (isEditing) {
      dispatch({ payload: [category], type: 'SET_CATEGORIES' });
      return;
    }

    dispatch({ payload: category, type: 'TOGGLE_CATEGORY' });
  };

  let content = null;

  if (isLoading) {
    content = <ActivityIndicator color={Colors.primary500} size="large" />;
  } else if (error) {
    content = (
      <View style={[Spaces.gap[12]]}>
        <Text style={[Fonts.p1, { color: Colors.neutral100 }]}>
          {t(
            'historyWizard.category.error',
            'Impossible de charger les catégories pour le moment.',
          )}
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
          style={{
            alignItems: 'center',
            alignSelf: 'flex-start',
            borderColor: Colors.primary500,
            borderRadius: 20,
            borderWidth: 1,
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
            {t('common.retry', 'Réessayer')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  } else if (categoryOptions.length === 0) {
    content = (
      <View style={[Spaces.gap[12]]}>
        <Text style={[Fonts.p1, { color: Colors.neutral100 }]}>
          {t(
            'historyWizard.category.empty',
            'Aucune catégorie disponible pour le moment.',
          )}
        </Text>
      </View>
    );
  } else {
    content = (
      <View style={[Spaces.gap[12]]}>
        {categoryOptions.map((category) => {
          const isSelected = state.categories.some(
            (selectedCategory) => selectedCategory?.documentId === category.documentId,
          );

          return (
            <TouchableOpacity
              key={category.documentId}
              onPress={() => handleSelectCategory(category)}
              style={{
                alignItems: 'center',
                backgroundColor: isSelected ? `${Colors.primary500}20` : Colors.neutral800,
                borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                borderRadius: 12,
                borderWidth: 2,
                flexDirection: 'row',
                justifyContent: 'space-between',
                padding: 20,
              }}
            >
              <Text
                style={[Fonts.p1Bold, { color: isSelected ? Colors.primary500 : Colors.neutral00 }]}
              >
                {category.name}
              </Text>
              {isSelected ? (
                <Text style={{ color: Colors.primary500, fontSize: 18 }}>OK</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <WizardStepLayout
      isNextDisabled={state.categories.length === 0}
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.HistoryWizardClub)}
      onSkip={() => navigation.navigate(RouteNames.HistoryWizardClub)}
      showSkip
      subtitle={t('historyWizard.category.subtitle', 'Sélectionne une ou plusieurs catégories')}
      title={t('historyWizard.category.title', 'Quelles catégories ?')}
    >
      {content}
    </WizardStepLayout>
  );
}

export default HistoryWizardCategory;
