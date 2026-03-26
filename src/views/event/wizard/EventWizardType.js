import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEventTypes } from '@/services/event/eventQueries';

import { useEventWizard } from './EventWizardContext';
import { getEventWizardStepCount } from './eventWizardDetectionUtils';

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function EventWizardType({ navigation, route }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { dispatch, state } = useEventWizard();
  const { data: eventTypes, isLoading } = useGetEventTypes();
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };

  const handleSelectType = (type) => {
    dispatch({ payload: type, type: 'SET_TYPE' });
    navigation.navigate(RouteNames.EventWizardTeam);
  };

  const hasTypes = Array.isArray(eventTypes) && eventTypes.length > 0;

  return (
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialSource: undefined,
          tutorialStartToken: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.EVENT_WIZARD_TYPE}
      userId={userData?.documentId}
    >
      <WizardStepLayout
        onBack={() => navigation.goBack()}
        stepCount={getEventWizardStepCount(state)}
        stepIndex={1}
        subtitle={t('eventWizard.steps.type.subtitle')}
        title={t('eventWizard.steps.type.title')}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.primary500} size="large" />
        ) : null}

        {!isLoading && !hasTypes ? (
          <View style={[ApplicationStyle.card, Spaces.padding[24], cardSurfaceStyle]}>
            <Text style={[Fonts.p1, Fonts.neutral100]}>
              {t('eventWizard.errors.noTypes')}
            </Text>
          </View>
        ) : null}

        {!isLoading && hasTypes ? (
          <OnboardingWrapper
            description="Choisissez le type d événement avant de continuer le wizard."
            id="event-wizard-type-list"
            order={1}
            spotlight={{
              borderRadius: 16,
              maxHeight: 280,
              overlayOpacity: 0.4,
              paddingX: 2,
              paddingY: 2,
            }}
            title="Selection du type"
          >
            <View style={[Spaces.gap[16]]}>
              {eventTypes.map((type) => (
                <TouchableOpacity
                  key={type.documentId}
                  onPress={() => handleSelectType(type)}
                  style={[
                    ApplicationStyle.card,
                    Spaces.padding[24],
                    Alignments.row,
                    Alignments.alignCenter,
                    Alignments.justifySpaceBetween,
                    cardSurfaceStyle,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[Fonts.h3, Fonts.neutral00]}>{type.name}</Text>
                  </View>
                  <Image
                    source={Images.chevronDown}
                    style={{
                      height: 18,
                      tintColor: Colors.primary500,
                      transform: [{ rotate: '-90deg' }],
                      width: 18,
                    }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </OnboardingWrapper>
        ) : null}
      </WizardStepLayout>
    </TutorialFlowBoundary>
  );
}

export default EventWizardType;
