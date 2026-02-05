import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useAdWizard } from './AdWizardContext';
import { RouteNames } from '@/navigation/routeNames';

const VALIDATION_MODES = [
  { 
    value: 'auto', 
    label: 'Automatique', 
    description: 'Les joueurs sont automatiquement acceptés',
    icon: '⚡',
  },
  { 
    value: 'manual', 
    label: 'Manuelle', 
    description: 'Vous validez chaque inscription manuellement',
    icon: '✋',
  },
];

const AdWizardValidation = ({ navigation }) => {
  const { Colors, Fonts, Spaces, Alignments, ApplicationStyle } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useAdWizard();

  const handleSelectMode = (mode) => {
    dispatch({ type: 'SET_VALIDATION_MODE', payload: mode });
  };

  const handleNext = () => {
    navigation.navigate(RouteNames.AdWizardDescription);
  };

  return (
    <WizardStepLayout
      title="Mode de validation"
      subtitle="Comment valider les inscriptions à l'événement ?"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      nextLabel="Suivant"
    >
      <View style={[Spaces.gap[16]]}>
        {VALIDATION_MODES.map((mode) => {
          const isSelected = state.validationMode === mode.value;
          
          return (
            <TouchableOpacity
              key={mode.value}
              onPress={() => handleSelectMode(mode.value)}
              style={[
                ApplicationStyle.card,
                Spaces.padding[24],
                { 
                  backgroundColor: isSelected ? Colors.primary500 + '20' : Colors.neutral800,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                }
              ]}
            >
              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
                {/* Icon */}
                <View style={[
                  styles.iconContainer,
                  { backgroundColor: isSelected ? Colors.primary500 : Colors.neutral700 }
                ]}>
                  <Text style={{ fontSize: 24 }}>{mode.icon}</Text>
                </View>
                
                {/* Text */}
                <View style={[Alignments.fill]}>
                  <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{mode.label}</Text>
                  <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 4 }]}>
                    {mode.description}
                  </Text>
                </View>
                
                {/* Checkmark */}
                {isSelected && (
                  <View style={[styles.checkmark, { backgroundColor: Colors.primary500 }]}>
                    <Text style={{ color: Colors.neutral00, fontWeight: 'bold' }}>✓</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Event info reminder */}
      {state.event && (
        <View style={[Spaces.marginTop[24], Spaces.padding[16], { backgroundColor: Colors.neutral800, borderRadius: 12 }]}>
          <Text style={[Fonts.p2, { color: Colors.neutral400 }]}>
            Cette annonce est liée à l'événement :
          </Text>
          <Text style={[Fonts.p1Bold, { color: Colors.primary500, marginTop: 4 }]}>
            {state.event.name || state.event.type?.name || 'Événement'}
          </Text>
        </View>
      )}
    </WizardStepLayout>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AdWizardValidation;
