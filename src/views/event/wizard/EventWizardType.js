import React from 'react';
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import { useEventWizard } from './EventWizardContext';
import { useGetEventTypes } from '@/services/event/eventQueries';
import { RouteNames } from '@/navigation/routeNames';

const EventWizardType = ({ navigation, route }) => {
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
  const { dispatch } = useEventWizard();
  const { data: eventTypes, isLoading } = useGetEventTypes();
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
  };

  const handleSelectType = (type) => {
    dispatch({ type: 'SET_TYPE', payload: type });
    navigation.navigate(RouteNames.EventWizardTeam);
  };

  const hasTypes = Array.isArray(eventTypes) && eventTypes.length > 0;

  return (
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialStartToken: undefined,
          tutorialSource: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.EVENT_WIZARD_TYPE}
      userId={userData?.documentId}
    >
      <WizardStepLayout
        stepCount={10}
        stepIndex={1}
        title={t('eventWizard.steps.type.title')}
        subtitle={t('eventWizard.steps.type.subtitle')}
        onBack={() => navigation.goBack()}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.primary500} />
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
            description="Choisissez le type d evenement avant de continuer le wizard."
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
};

export default EventWizardType;
