import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import { getEventWizardStepCount } from './eventWizardDetectionUtils';

const VISIBILITY_OPTIONS = [
  {
    descriptionKey: 'eventWizard.steps.visibility.publicDesc',
    key: 'open',
    titleKey: 'eventWizard.steps.visibility.public',
  },
  {
    descriptionKey: 'eventWizard.steps.visibility.teamDesc',
    key: 'closed',
    titleKey: 'eventWizard.steps.visibility.team',
  },
];

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardVisibility({ navigation }) {
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { dispatch, state } = useEventWizard();
  const [sessionStatus, setSessionStatus] = useState(state.sessionStatus || 'open');
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
    borderWidth: 1,
  };

  const handleNext = () => {
    dispatch({
      payload: { sessionStatus },
      type: 'SET_META',
    });
    navigation.navigate(RouteNames.EventWizardParticipants);
  };

  return (
    <WizardStepLayout
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(state)}
      stepIndex={6}
      subtitle={t('eventWizard.steps.visibility.subtitle')}
      title={t('eventWizard.steps.visibility.title')}
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
}

export default EventWizardVisibility;
