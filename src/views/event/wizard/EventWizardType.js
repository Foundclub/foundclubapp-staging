
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useEventWizard } from './EventWizardContext';
import { useGetEventTypes } from '@/services/event/eventQueries';
import { RouteNames } from '@/navigation/routeNames';

const EventWizardType = ({ navigation }) => {
  const { Colors, Fonts, Spaces, Alignments, ApplicationStyle } = useTheme();
  const { t } = useTranslation();
  const { dispatch } = useEventWizard();
  const { data: eventTypes, isLoading } = useGetEventTypes();
  const insets = useSafeAreaInsets();

  const handleSelectType = (type) => {
    dispatch({ type: 'SET_TYPE', payload: type });
    navigation.navigate(RouteNames.EventWizardTeam);
  };

  return (
    <WizardStepLayout
      title={t('eventWizard.steps.type.title', 'Quel type d\'événement ?')}
      subtitle={t('eventWizard.steps.type.subtitle', 'Choisissez la catégorie qui correspond le mieux.')}
      onBack={() => navigation.goBack()}
    >
      {isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary500} />
      ) : (
        <View style={[Spaces.gap[16]]}>
          {eventTypes?.map((type) => (
            <TouchableOpacity
              key={type.documentId}
              onPress={() => handleSelectType(type)}
              style={[
                ApplicationStyle.card,
                Spaces.padding[24],
                Alignments.row,
                Alignments.alignCenter,
                Alignments.justifySpaceBetween,
                { backgroundColor: Colors.neutral800 }
              ]}
            >
              <View>
                <Text style={[Fonts.h3, Fonts.neutral00]}>{type.name}</Text>
                {/* We could add description or icons here if available in the type object */}
              </View>
              <Text style={[Fonts.h3, Fonts.primary500]}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </WizardStepLayout>
  );
};

export default EventWizardType;
