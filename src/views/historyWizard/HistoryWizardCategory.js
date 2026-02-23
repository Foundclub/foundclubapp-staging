import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useGetCategories } from '@/services/category/categoryQueries';

import { useHistoryWizard } from './HistoryWizardContext';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function HistoryWizardCategory({ navigation }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useHistoryWizard();
  const { data: categories, isLoading } = useGetCategories();

  const handleSelectCategory = (category) => {
    dispatch({ payload: category, type: 'SET_CATEGORY' });
  };

  return (
    <WizardStepLayout
      isNextDisabled={!state.category}
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.HistoryWizardLevel)}
      onSkip={() => navigation.navigate(RouteNames.HistoryWizardLevel)}
      showSkip
      subtitle="Sélectionne la catégorie d'âge"
      title="Quelle catégorie ?"
    >
      {isLoading ? (
        <ActivityIndicator color={Colors.primary500} size="large" />
      ) : (
        <View style={[Spaces.gap[12]]}>
          {categories?.map((category) => {
            const isSelected = state.category?.documentId === category.documentId;
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
                <Text style={[Fonts.p1Bold, { color: isSelected ? Colors.primary500 : Colors.neutral00 }]}>
                  {category.name}
                </Text>
                {isSelected && (
                  <Text style={{ color: Colors.primary500, fontSize: 18 }}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </WizardStepLayout>
  );
}

export default HistoryWizardCategory;
