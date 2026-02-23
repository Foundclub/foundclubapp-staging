import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Switch, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useHistoryWizard } from './HistoryWizardContext';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function HistoryWizardPeriod({ navigation }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useHistoryWizard();

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= 1990; y--) {
      years.push(y);
    }
    return years;
  }, []);

  return (
    <WizardStepLayout
      nextLabel="Continuer"
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.HistoryWizardRecap)}
      subtitle="Indique les années de ta présence dans ce club"
      title="Quelle période ?"
    >
      <View style={[Spaces.gap[24]]}>
        {/* Start Year */}
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral300 }]}>Année de début</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[Alignments.row, Spaces.gap[8]]}>
              {yearOptions.map((year) => {
                const isSelected = state.startYear === year;
                return (
                  <TouchableOpacity
                    key={`start-${year}`}
                    onPress={() => dispatch({ payload: year, type: 'SET_START_YEAR' })}
                    style={{
                      backgroundColor: isSelected ? Colors.primary500 : Colors.neutral800,
                      borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                      borderRadius: 12,
                      borderWidth: 1,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                    }}
                  >
                    <Text style={[Fonts.p1, { color: isSelected ? '#FFF' : Colors.neutral300 }]}>
                      {year}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Currently Active Toggle */}
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
          <Switch
            onValueChange={(value) => dispatch({ payload: value, type: 'SET_CURRENTLY_ACTIVE' })}
            thumbColor="#FFF"
            trackColor={{ false: Colors.neutral700, true: Colors.primary500 }}
            value={state.isCurrentlyActive}
          />
          <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>J'y suis toujours</Text>
        </View>

        {/* End Year (if not currently active) */}
        {!state.isCurrentlyActive && (
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral300 }]}>Année de fin</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[Alignments.row, Spaces.gap[8]]}>
                {yearOptions.filter((y) => y >= state.startYear).map((year) => {
                  const isSelected = state.endYear === year;
                  return (
                    <TouchableOpacity
                      key={`end-${year}`}
                      onPress={() => dispatch({ payload: year, type: 'SET_END_YEAR' })}
                      style={{
                        backgroundColor: isSelected ? Colors.primary500 : Colors.neutral800,
                        borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                        borderRadius: 12,
                        borderWidth: 1,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                      }}
                    >
                      <Text style={[Fonts.p1, { color: isSelected ? '#FFF' : Colors.neutral300 }]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </WizardStepLayout>
  );
}

export default HistoryWizardPeriod;
