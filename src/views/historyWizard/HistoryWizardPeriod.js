import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useHistoryWizard } from './HistoryWizardContext';
import { RouteNames } from '@/navigation/routeNames';

const HistoryWizardPeriod = ({ navigation }) => {
  const { Colors, Fonts, Spaces, Alignments } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useHistoryWizard();

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
      title="Quelle période ?"
      subtitle="Indique les années de ta présence dans ce club"
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.HistoryWizardRecap)}
      nextLabel="Continuer"
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
                    onPress={() => dispatch({ type: 'SET_START_YEAR', payload: year })}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: isSelected ? Colors.primary500 : Colors.neutral800,
                      borderWidth: 1,
                      borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
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
            value={state.isCurrentlyActive}
            onValueChange={(value) => dispatch({ type: 'SET_CURRENTLY_ACTIVE', payload: value })}
            trackColor={{ false: Colors.neutral700, true: Colors.primary500 }}
            thumbColor="#FFF"
          />
          <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>J'y suis toujours</Text>
        </View>

        {/* End Year (if not currently active) */}
        {!state.isCurrentlyActive && (
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral300 }]}>Année de fin</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[Alignments.row, Spaces.gap[8]]}>
                {yearOptions.filter(y => y >= state.startYear).map((year) => {
                  const isSelected = state.endYear === year;
                  return (
                    <TouchableOpacity
                      key={`end-${year}`}
                      onPress={() => dispatch({ type: 'SET_END_YEAR', payload: year })}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: isSelected ? Colors.primary500 : Colors.neutral800,
                        borderWidth: 1,
                        borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
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
};

export default HistoryWizardPeriod;
