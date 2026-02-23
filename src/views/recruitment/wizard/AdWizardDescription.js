import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useAdWizard } from './AdWizardContext';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function AdWizardDescription({ navigation }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useAdWizard();

  const handleChange = (text) => {
    dispatch({ payload: text, type: 'SET_DESCRIPTION' });
  };

  const handleNext = () => {
    navigation.navigate(RouteNames.AdWizardRecap);
  };

  const handleSkip = () => {
    dispatch({ payload: '', type: 'SET_DESCRIPTION' });
    navigation.navigate(RouteNames.AdWizardRecap);
  };

  return (
    <WizardStepLayout
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      onSkip={handleSkip}
      showSkip
      subtitle="Ajoutez des détails pour attirer les bons joueurs"
      title="Description"
    >
      {/* Description input card */}
      <View style={[
        Spaces.padding[16],
        {
          backgroundColor: Colors.neutral800,
          borderColor: Colors.neutral700,
          borderRadius: 16,
          borderWidth: 1,
        },
      ]}
      >
        <TextInput
          multiline
          numberOfLines={6}
          onChangeText={handleChange}
          placeholder="Ex: Nous recherchons un gardien expérimenté pour notre équipe U20 qui joue en régional 2. Entraînements les mardis et jeudis soir..."
          placeholderTextColor={Colors.neutral500}
          style={[
            Fonts.p1,
            styles.input,
            {
              borderColor: state.description.length > 0 ? Colors.primary500 : Colors.neutral700,
              color: Colors.neutral00,
            },
          ]}
          textAlignVertical="top"
          value={state.description}
        />

        {/* Character count */}
        <View style={[
          Spaces.marginTop[12],
          {
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
          },
        ]}
        >
          <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>
            {state.description.length > 0 ? 'Optionnel' : 'Champ optionnel'}
          </Text>
          <Text style={[
            Fonts.p3,
            {
              color: state.description.length > 400 ? Colors.primary500 : Colors.neutral500,
            },
          ]}
          >
            {state.description.length}
            {' '}
            / 500
          </Text>
        </View>
      </View>

      {/* Tips section */}
      <View style={[
        Spaces.marginTop[24],
        Spaces.padding[16],
        {
          backgroundColor: Colors.neutral800,
          borderColor: Colors.neutral700,
          borderRadius: 16,
          borderWidth: 1,
        },
      ]}
      >
        <View style={{ alignItems: 'center', flexDirection: 'row', marginBottom: 12 }}>
          <Text style={{ fontSize: 16 }}>💡</Text>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00, marginLeft: 8 }]}>
            Conseils
          </Text>
        </View>

        <View style={[Spaces.gap[8]]}>
          {[
            'Précisez le niveau de jeu attendu',
            'Mentionnez les horaires d\'entraînement',
            'Indiquez si un essai est prévu',
            'Décrivez l\'ambiance de l\'équipe',
          ].map((tip, index) => (
            <View key={index} style={{ alignItems: 'flex-start', flexDirection: 'row' }}>
              <Text style={[Fonts.p2, { color: Colors.primary500, marginRight: 8 }]}>•</Text>
              <Text style={[Fonts.p2, { color: Colors.neutral200, flex: 1 }]}>{tip}</Text>
            </View>
          ))}
        </View>
      </View>
    </WizardStepLayout>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 12,
    borderWidth: 1,
    lineHeight: 22,
    minHeight: 140,
    padding: 16,
  },
});

export default AdWizardDescription;
