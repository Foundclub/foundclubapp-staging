
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useEventWizard } from './EventWizardContext';
import { RouteNames } from '@/navigation/routeNames';

/**
 * Step to select visibility (Public vs Private/Team-only)
 * Handles sessionStatus: 'open' | 'closed'
 */
const EventWizardVisibility = ({ navigation }) => {
  const { Colors, Fonts, Spaces, Alignments, ApplicationStyle } = useTheme();
  const { t } = useTranslation();
  const { dispatch } = useEventWizard();

  const handleSelect = (status) => {
    dispatch({ 
      type: 'SET_META', 
      payload: { sessionStatus: status } 
    });
    // Navigate to next step (Location)
    navigation.navigate(RouteNames.EventWizardLocation);
  };

  return (
    <WizardStepLayout
      title={t('eventWizard.steps.visibility.title', 'Visibilité de l\'événement')}
      subtitle={t('eventWizard.steps.visibility.subtitle', 'Qui peut voir et répondre à cet événement ?')}
      onBack={() => navigation.goBack()}
    >
      <View style={[Spaces.gap[16]]}>
        
        {/* OPEN / PUBLIC Option */}
        <TouchableOpacity
          onPress={() => handleSelect('open')}
          style={[
            ApplicationStyle.card,
            Spaces.padding[24],
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            { backgroundColor: Colors.neutral800 }
          ]}
        >
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[8]]}>
              {t('eventWizard.steps.visibility.public', 'Événement Public / Ouvert')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t('eventWizard.steps.visibility.publicDesc', 'Les joueurs peuvent voir l\'événement et indiquer leur présence/absence.')}
            </Text>
          </View>
          <Text style={[Fonts.h2, Fonts.primary500]}>→</Text>
        </TouchableOpacity>

        {/* CLOSED / TEAM ONLY Option */}
        <TouchableOpacity
          onPress={() => handleSelect('closed')}
          style={[
            ApplicationStyle.card,
            Spaces.padding[24],
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            { backgroundColor: Colors.neutral800 }
          ]}
        >
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[8]]}>
              {t('eventWizard.steps.visibility.private', 'Événement Privé / Fermé')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t('eventWizard.steps.visibility.privateDesc', 'Seul le coach gère les présences. Idéal pour les convocations.')}
            </Text>
          </View>
          <Text style={[Fonts.h2, Fonts.primary500]}>→</Text>
        </TouchableOpacity>

      </View>
    </WizardStepLayout>
  );
};

export default EventWizardVisibility;
