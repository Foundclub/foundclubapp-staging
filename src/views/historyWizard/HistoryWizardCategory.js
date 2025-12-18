import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useHistoryWizard } from './HistoryWizardContext';
import { useGetCategories } from '@/services/category/categoryQueries';
import { RouteNames } from '@/navigation/routeNames';

const HistoryWizardCategory = ({ navigation }) => {
  const { Colors, Fonts, Spaces, Alignments } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useHistoryWizard();
  const { data: categories, isLoading } = useGetCategories();

  const handleSelectCategory = (category) => {
    dispatch({ type: 'SET_CATEGORY', payload: category });
  };

  return (
    <WizardStepLayout
      title="Quelle catégorie ?"
      subtitle="Sélectionne la catégorie d'âge"
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.HistoryWizardLevel)}
      isNextDisabled={!state.category}
      showSkip
      onSkip={() => navigation.navigate(RouteNames.HistoryWizardLevel)}
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary500} />
      ) : (
        <View style={[Spaces.gap[12]]}>
          {categories?.map((category) => {
            const isSelected = state.category?.documentId === category.documentId;
            return (
              <TouchableOpacity
                key={category.documentId}
                onPress={() => handleSelectCategory(category)}
                style={{
                  backgroundColor: isSelected ? Colors.primary500 + '20' : Colors.neutral800,
                  borderRadius: 12,
                  padding: 20,
                  borderWidth: 2,
                  borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
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
};

export default HistoryWizardCategory;
