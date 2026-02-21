import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useEventWizard } from './EventWizardContext';
import { RouteNames } from '@/navigation/routeNames';
import FacilitySelector from '@/components/organisms/facilitySelector/FacilitySelector';

const EventWizardLocation = ({ navigation }) => {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  const { state, dispatch } = useEventWizard();

  const [location, setLocation] = useState(state.location);
  const [facilityId, setFacilityId] = useState(state.facility);

  const clubId = state.team?.club?.documentId;
  const cmId = state.team?.club?.parentMultisport?.documentId;

  const canGoNext = Boolean(location || facilityId);

  const handleNext = () => {
    dispatch({
      type: 'SET_LOCATION',
      payload: { location, facility: facilityId },
    });
    navigation.navigate(RouteNames.EventWizardRecap);
  };

  const handleAddFacility = () => {
    navigation.navigate(RouteNames.FacilityForm, {
      clubId,
      cmId,
    });
  };

  return (
    <WizardStepLayout
      stepCount={10}
      stepIndex={9}
      title={t('eventWizard.steps.location.title')}
      subtitle={t('eventWizard.steps.location.subtitle')}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      isNextDisabled={!canGoNext}
    >
      <View style={[Spaces.gap[12]]}>
        <FacilitySelector
          clubId={clubId}
          cmId={cmId}
          location={location}
          facilityId={facilityId}
          onAddFacility={handleAddFacility}
          onChange={({ location: nextLocation, facilityId: nextFacilityId }) => {
            setLocation(nextLocation || null);
            setFacilityId(nextFacilityId || null);
          }}
        />
        {!canGoNext ? (
          <Text style={[Fonts.p3, Fonts.warning500]}>
            {t(
              'eventWizard.steps.location.disabledNextHint',
              'Selectionne une installation du club ou saisis une adresse exterieure pour continuer.',
            )}
          </Text>
        ) : null}
      </View>
    </WizardStepLayout>
  );
};

export default EventWizardLocation;
