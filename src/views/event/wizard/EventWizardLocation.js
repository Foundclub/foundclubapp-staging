
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import useTheme from '@/theme/themeContext';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import { useEventWizard } from './EventWizardContext';
import { RouteNames } from '@/navigation/routeNames';
import FacilitySelector from '@/components/organisms/facilitySelector/FacilitySelector';

const EventWizardLocation = ({ navigation }) => {
  const { state, dispatch } = useEventWizard();
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();

  const [location, setLocation] = useState(state.location);
  const [facilityId, setFacilityId] = useState(state.facility);
  
  // Need clubId for FacilitySelector
  const clubId = state.team?.club?.documentId;

  const handleNext = () => {
    dispatch({ 
      type: 'SET_LOCATION', 
      payload: { location, facility: facilityId } 
    });
    navigation.navigate(RouteNames.EventWizardRecap);
  };

  const canGoNext = !!location || !!facilityId;

  return (
    <WizardStepLayout
      title={t('eventWizard.steps.location.title', 'C\'est où ?')}
      subtitle={t('eventWizard.steps.location.subtitle', 'Choisissez un terrain du club ou une adresse extérieure.')}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      isNextDisabled={!canGoNext}
    >
      <FacilitySelector
         clubId={clubId}
         location={location}
         facilityId={facilityId}
         onChange={({ location: newLocation, facilityId: newFacilityId }) => {
           setLocation(newLocation);
           setFacilityId(newFacilityId);
         }}
      />
    </WizardStepLayout>
  );
};

export default EventWizardLocation;
