import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useAdWizard } from './AdWizardContext';
import { getAdWizardStepCount } from './adWizardStepUtils';

const VALIDATION_MODES = [
  {
    description: 'Les joueurs sont automatiquement acceptés',
    icon: '⚡',
    label: 'Automatique',
    value: 'auto',
  },
  {
    description: 'Vous validez chaque inscription manuellement',
    icon: '✋',
    label: 'Manuelle',
    value: 'manual',
  },
];

/**
 *
 * @param root0
 * @param root0.navigation
 */
function AdWizardValidation({ navigation }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useAdWizard();

  const handleSelectMode = (mode) => {
    dispatch({ payload: mode, type: 'SET_VALIDATION_MODE' });
  };

  const handleNext = () => {
    navigation.navigate(RouteNames.AdWizardDescription);
  };

  return (
    <WizardStepLayout
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getAdWizardStepCount(state)}
      stepIndex={4}
      subtitle="Comment valider les inscriptions à l'événement ?"
      title="Mode de validation"
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
                  backgroundColor: isSelected ? `${Colors.primary500}20` : Colors.neutral800,
                  borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
            >
              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
                {/* Icon */}
                <View style={[
                  styles.iconContainer,
                  { backgroundColor: isSelected ? Colors.primary500 : Colors.neutral700 },
                ]}
                >
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
}

const styles = StyleSheet.create({
  checkmark: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  iconContainer: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
});

export default AdWizardValidation;
