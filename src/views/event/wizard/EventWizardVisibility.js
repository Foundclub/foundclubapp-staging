import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useEventWizard } from './EventWizardContext';
import { RouteNames } from '@/navigation/routeNames';

const VISIBILITY_OPTIONS = [
  {
    key: 'open',
    titleKey: 'eventWizard.steps.visibility.public',
    descriptionKey: 'eventWizard.steps.visibility.publicDesc',
  },
  {
    key: 'closed',
    titleKey: 'eventWizard.steps.visibility.private',
    descriptionKey: 'eventWizard.steps.visibility.privateDesc',
  },
];

const EventWizardVisibility = ({ navigation }) => {
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { state, dispatch } = useEventWizard();
  const [sessionStatus, setSessionStatus] = useState(state.sessionStatus || 'open');
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
    borderWidth: 1,
  };

  const handleNext = () => {
    dispatch({
      type: 'SET_META',
      payload: { sessionStatus },
    });
    navigation.navigate(RouteNames.EventWizardLocation);
  };

  return (
    <WizardStepLayout
      stepCount={10}
      stepIndex={8}
      title={t('eventWizard.steps.visibility.title')}
      subtitle={t('eventWizard.steps.visibility.subtitle')}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
    >
      <View style={[Spaces.gap[16]]}>
        {VISIBILITY_OPTIONS.map((option) => {
          const selected = sessionStatus === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => setSessionStatus(option.key)}
              style={[
                ApplicationStyle.card,
                Spaces.padding[24],
                {
                  ...(selected
                    ? {
                      backgroundColor: 'rgba(1, 179, 244, 0.16)',
                      borderColor: Colors.primary500,
                      borderWidth: 1,
                    }
                    : cardSurfaceStyle),
                },
              ]}
            >
              <Text style={[Fonts.h3, selected ? Fonts.primary100 : Fonts.neutral00, Spaces.marginBottom[8]]}>
                {t(option.titleKey)}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                {t(option.descriptionKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </WizardStepLayout>
  );
};

export default EventWizardVisibility;
