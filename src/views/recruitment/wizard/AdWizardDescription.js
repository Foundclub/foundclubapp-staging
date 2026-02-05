import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useAdWizard } from './AdWizardContext';
import { RouteNames } from '@/navigation/routeNames';

const AdWizardDescription = ({ navigation }) => {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useAdWizard();

  const handleChange = (text) => {
    dispatch({ type: 'SET_DESCRIPTION', payload: text });
  };

  const handleNext = () => {
    navigation.navigate(RouteNames.AdWizardRecap);
  };

  const handleSkip = () => {
    dispatch({ type: 'SET_DESCRIPTION', payload: '' });
    navigation.navigate(RouteNames.AdWizardRecap);
  };

  return (
    <WizardStepLayout
      title="Description"
      subtitle="Ajoutez des détails pour attirer les bons joueurs"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      nextLabel="Suivant"
      showSkip={true}
      onSkip={handleSkip}
    >
      {/* Description input card */}
      <View style={[
        Spaces.padding[16],
        {
          backgroundColor: Colors.neutral800,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: Colors.neutral700,
        }
      ]}>
        <TextInput
          value={state.description}
          onChangeText={handleChange}
          placeholder="Ex: Nous recherchons un gardien expérimenté pour notre équipe U20 qui joue en régional 2. Entraînements les mardis et jeudis soir..."
          placeholderTextColor={Colors.neutral500}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          style={[
            Fonts.p1,
            styles.input,
            { 
              color: Colors.neutral00,
              borderColor: state.description.length > 0 ? Colors.primary500 : Colors.neutral700,
            }
          ]}
        />
        
        {/* Character count */}
        <View style={[
          Spaces.marginTop[12],
          { 
            flexDirection: 'row', 
            justifyContent: 'space-between',
            alignItems: 'center',
          }
        ]}>
          <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>
            {state.description.length > 0 ? 'Optionnel' : 'Champ optionnel'}
          </Text>
          <Text style={[
            Fonts.p3, 
            { 
              color: state.description.length > 400 ? Colors.primary500 : Colors.neutral500 
            }
          ]}>
            {state.description.length} / 500
          </Text>
        </View>
      </View>

      {/* Tips section */}
      <View style={[
        Spaces.marginTop[24],
        Spaces.padding[16],
        {
          backgroundColor: Colors.neutral800,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: Colors.neutral700,
        }
      ]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
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
            <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={[Fonts.p2, { color: Colors.primary500, marginRight: 8 }]}>•</Text>
              <Text style={[Fonts.p2, { color: Colors.neutral200, flex: 1 }]}>{tip}</Text>
            </View>
          ))}
        </View>
      </View>
    </WizardStepLayout>
  );
};

const styles = StyleSheet.create({
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    lineHeight: 22,
  },
});

export default AdWizardDescription;
