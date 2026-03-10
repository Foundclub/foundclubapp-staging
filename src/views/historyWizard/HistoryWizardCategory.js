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
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any> }} props
 */
function HistoryWizardCategory({ navigation }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { dispatch, state } = useHistoryWizard();
  const { data: categories, isLoading } = useGetCategories();
  const isEditing = Boolean(state.editingEntry);

  const handleSelectCategory = (category) => {
    if (isEditing) {
      dispatch({ payload: [category], type: 'SET_CATEGORIES' });
      return;
    }

    dispatch({ payload: category, type: 'TOGGLE_CATEGORY' });
  };

  return (
    <WizardStepLayout
      isNextDisabled={state.categories.length === 0}
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.HistoryWizardClub)}
      onSkip={() => navigation.navigate(RouteNames.HistoryWizardClub)}
      showSkip
      subtitle="Selectionne une ou plusieurs categories"
      title="Quelles categories ?"
    >
      {isLoading ? (
        <ActivityIndicator color={Colors.primary500} size="large" />
      ) : (
        <View style={[Spaces.gap[12]]}>
          {categories?.map((category) => {
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
                <Text style={[Fonts.p1Bold, { color: isSelected ? Colors.primary500 : Colors.neutral00 }]}>
                  {category.name}
                </Text>
                {isSelected ? (
                  <Text style={{ color: Colors.primary500, fontSize: 18 }}>OK</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </WizardStepLayout>
  );
}

export default HistoryWizardCategory;
