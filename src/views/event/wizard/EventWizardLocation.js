import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import FacilitySelector from '@/components/organisms/facilitySelector/FacilitySelector';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import { getEventWizardStepCount } from './eventWizardDetectionUtils';

const buildDateTimeIso = (baseDate, timeValue) => {
  if (!baseDate || !timeValue) return null;

  const date = new Date(baseDate);
  const time = new Date(timeValue);
  if (Number.isNaN(date.getTime()) || Number.isNaN(time.getTime())) {
    return null;
  }

  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined.toISOString();
};

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
  const [selectedOccupancy, setSelectedOccupancy] = useState(null);

  const clubId = state.team?.club?.documentId;
  const cmId = state.team?.club?.parentMultisport?.documentId;
  const occupancyWindow = {
    end: buildDateTimeIso(state.date, state.endTime),
    start: buildDateTimeIso(state.date, state.startTime),
  };

  const isStrictlySaturated = Boolean(
    facilityId
    && selectedOccupancy?.saturated
    && selectedOccupancy?.canRequestOverflow === false,
  );
  const canGoNext = Boolean(location || facilityId) && !isStrictlySaturated;

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
      stepCount={getEventWizardStepCount(state)}
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
          occupancyWindow={occupancyWindow}
          onAddFacility={handleAddFacility}
          onChange={({ facilityId: nextFacilityId, location: nextLocation }) => {
            setLocation(nextLocation || null);
            setFacilityId(nextFacilityId || null);
            if (!nextFacilityId) {
              setSelectedOccupancy(null);
            }
          }}
          onOccupancyResolved={setSelectedOccupancy}
        />
        {!canGoNext && !isStrictlySaturated ? (
          <Text style={[Fonts.p3, Fonts.warning500]}>
            {t(
              'eventWizard.steps.location.disabledNextHint',
              'Sélectionné une installation du club ou saisis une adresse exterieure pour continuer.',
            )}
          </Text>
        ) : null}
        {isStrictlySaturated ? (
          <Text style={[Fonts.p3, Fonts.error500]}>
            {t(
              'eventWizard.steps.location.strictCapacityHint',
              "Cette installation est complete sur ce creneau et n'autorise pas de depassement. Choisissez un autre lieu ou un autre horaire.",
            )}
          </Text>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardLocation;
