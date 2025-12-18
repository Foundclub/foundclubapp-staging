import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useHistoryWizard } from './HistoryWizardContext';
import { useGetLevels } from '@/services/level/levelQueries';
import { RouteNames } from '@/navigation/routeNames';

const HistoryWizardLevel = ({ navigation }) => {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useHistoryWizard();
  const { data: levels, isLoading } = useGetLevels();

  const handleSelectLevel = (level) => {
    dispatch({ type: 'SET_LEVEL', payload: level });
  };

  return (
    <WizardStepLayout
      title="Quel niveau ?"
      subtitle="Sélectionne le niveau de compétition"
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.HistoryWizardPeriod)}
      isNextDisabled={!state.level}
      showSkip
      onSkip={() => navigation.navigate(RouteNames.HistoryWizardPeriod)}
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary500} />
      ) : (
        <View style={[Spaces.gap[12]]}>
          {levels?.map((level) => {
            const isSelected = state.level?.documentId === level.documentId;
            return (
              <TouchableOpacity
                key={level.documentId}
                onPress={() => handleSelectLevel(level)}
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
                  {level.name}
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

export default HistoryWizardLevel;
