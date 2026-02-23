import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useGetLevels } from '@/services/level/levelQueries';

import { useHistoryWizard } from './HistoryWizardContext';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function HistoryWizardLevel({ navigation }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useHistoryWizard();
  const { data: levels, isLoading } = useGetLevels();

  const handleSelectLevel = (level) => {
    dispatch({ payload: level, type: 'SET_LEVEL' });
  };

  return (
    <WizardStepLayout
      isNextDisabled={!state.level}
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.HistoryWizardPeriod)}
      onSkip={() => navigation.navigate(RouteNames.HistoryWizardPeriod)}
      showSkip
      subtitle="Sélectionne le niveau de compétition"
      title="Quel niveau ?"
    >
      {isLoading ? (
        <ActivityIndicator color={Colors.primary500} size="large" />
      ) : (
        <View style={[Spaces.gap[12]]}>
          {levels?.map((level) => {
            const isSelected = state.level?.documentId === level.documentId;
            return (
              <TouchableOpacity
                key={level.documentId}
                onPress={() => handleSelectLevel(level)}
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
}

export default HistoryWizardLevel;
