
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useEventWizard } from './EventWizardContext';
import { RouteNames } from '@/navigation/routeNames';

const EventWizardDescription = ({ navigation }) => {
  const { Colors, Fonts, Spaces, ApplicationStyle, Alignments } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useEventWizard();
  const [description, setDescription] = useState(state.description || '');

  const handleNext = () => {
    dispatch({ 
      type: 'SET_META', 
      payload: { description } 
    });
    navigation.navigate(RouteNames.EventWizardVisibility);
  };

  return (
    <WizardStepLayout
      title={t('eventWizard.steps.description.title', 'Détails de l\'événement')}
      subtitle={t('eventWizard.steps.description.subtitle', 'Ajoutez une description pour vos invités.')}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      onSkip={handleNext} 
      showSkip={true}
    >
      <View style={[Spaces.gap[16], Alignments.fill]}>
        <View style={[Alignments.fill]}>
            <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginBottom[8]]}>{t('eventWizard.steps.description.label', 'Description (optionnel)')}</Text>
            <TextInput
                style={[
                ApplicationStyle.card,
                Spaces.padding[16],
                Fonts.p1,
                { 
                    backgroundColor: Colors.neutral800, 
                    color: Colors.neutral00, 
                    borderRadius: 8,
                    textAlignVertical: 'top',
                    minHeight: 150
                }
                ]}
                placeholder={t('eventWizard.steps.description.placeholder', 'Précisez le lieu de rendez-vous, le matériel à apporter, ou des consignes spécifiques...')}
                placeholderTextColor={Colors.neutral500}
                multiline
                numberOfLines={6}
                value={description}
                onChangeText={setDescription}
            />
        </View>
      </View>
    </WizardStepLayout>
  );
};

export default EventWizardDescription;
