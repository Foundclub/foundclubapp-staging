import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import FacilitySelector from '@/components/organisms/facilitySelector/FacilitySelector';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function EventWizardLocation({ navigation }) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  const { dispatch, state } = useEventWizard();

  const [location, setLocation] = useState(state.location);
  const [facilityId, setFacilityId] = useState(state.facility);

  const clubId = state.team?.club?.documentId;
  const cmId = state.team?.club?.parentMultisport?.documentId;

  const canGoNext = Boolean(location || facilityId);

  const handleNext = () => {
    dispatch({
      payload: { facility: facilityId, location },
      type: 'SET_LOCATION',
    });
    navigation.navigate(RouteNames.EventWizardVisibility);
  };

  const handleAddFacility = () => {
    navigation.navigate(RouteNames.FacilityForm, {
      clubId,
      cmId,
    });
  };

  return (
    <WizardStepLayout
      isNextDisabled={!canGoNext}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={10}
      stepIndex={5}
      subtitle={t('eventWizard.steps.location.subtitle')}
      title={t('eventWizard.steps.location.title')}
    >
      <View style={[Spaces.gap[12]]}>
        <FacilitySelector
          clubId={clubId}
          cmId={cmId}
          facilityId={facilityId}
          location={location}
          onAddFacility={handleAddFacility}
          onChange={({ facilityId: nextFacilityId, location: nextLocation }) => {
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
}

export default EventWizardLocation;
