import {
  ActivityIndicator, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useHistoryWizard } from '@/views/historyWizard/HistoryWizardContext';

import { RouteNames } from '@/navigation/routeNames';

import { useGetLevels } from '@/services/level/levelQueries';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function HistoryWizardLevel({ navigation }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { dispatch, state } = useHistoryWizard();
  const {
    data: levels,
    error,
    isLoading,
    refetch,
  } = useGetLevels();

  const handleSelectLevel = (level) => {
    dispatch({ payload: level, type: 'SET_LEVEL' });
  };

  return (
    <WizardStepLayout
      isNextDisabled={!state.level}
      onBack={() => navigation.goBack()}
      onNext={() => navigation.navigate(RouteNames.HistoryWizardRecap)}
      onSkip={() => navigation.navigate(RouteNames.HistoryWizardRecap)}
      showSkip
      subtitle="Sélectionne le meilleur niveau joué"
      title="Quel niveau ?"
    >
      {isLoading ? (
        <ActivityIndicator color={Colors.primary500} size="large" />
      ) : error ? (
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.p1, { color: Colors.neutral100 }]}>
            Impossible de charger les niveaux pour le moment.
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
              Réessayer
            </Text>
          </TouchableOpacity>
        </View>
      ) : !Array.isArray(levels) || levels.length === 0 ? (
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.p1, { color: Colors.neutral100 }]}>
            Aucun niveau disponible pour le moment.
          </Text>
        </View>
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
