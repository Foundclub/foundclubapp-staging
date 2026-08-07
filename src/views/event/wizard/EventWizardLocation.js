import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import FacilitySelector from '@/components/organisms/facilitySelector/FacilitySelector';

import { RouteNames } from '@/navigation/routeNames';

import { useEventWizard } from './EventWizardContext';
import {
  getEventWizardExitRoute,
  getEventWizardLocationStepIndex,
  getEventWizardNextRoute,
  getEventWizardStepCount,
} from './eventWizardDetectionUtils';

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
 * @param root0.route
 */
function EventWizardLocation({ navigation, route }) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  const { userData } = useAuth();
  const { dispatch, state } = useEventWizard();
  // La creation d'installation est refusee cote serveur aux non-dirigeants (403) :
  // on ne propose donc le bouton qu'aux dirigeants (le coach passe par l'adresse exterieure).
  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canManageFacilities = roleKey === 'president' || roleKey === 'superAdmin';

  const [location, setLocation] = useState(state.location);
  const [facilityId, setFacilityId] = useState(state.facility);
  const [selectedOccupancy, setSelectedOccupancy] = useState(null);

  const clubId = state.team?.club?.documentId;
  const cmId = state.team?.club?.parentMultisport?.documentId;
  const occupancyWindow = {
    end: buildDateTimeIso(state.date, state.endTime),
    start: buildDateTimeIso(state.date, state.startTime),
  };
  const requiresApproval = Boolean(
    facilityId
    && selectedOccupancy?.saturated
    && selectedOccupancy?.requiresApproval,
  );
  const allowsImmediateConfirmation = Boolean(
    facilityId
    && selectedOccupancy?.saturated
    && selectedOccupancy?.allowsImmediateConfirmation,
  );
  const canGoNext = Boolean(location || facilityId);

  const handleNext = () => {
    dispatch({
      payload: { facility: facilityId, location },
      type: 'SET_LOCATION',
    });
    navigation.navigate(getEventWizardExitRoute(
      getEventWizardNextRoute(RouteNames.EventWizardLocation, state),
      route?.params,
    ));
  };

  const handleAddFacility = () => {
    navigation.navigate(RouteNames.FacilityForm, {
      clubId,
      cmId,
    });
  };

  return (
    <WizardStepLayout
      headerVariant="focus"
      isNextDisabled={!canGoNext}
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getEventWizardStepCount(state)}
      stepIndex={getEventWizardLocationStepIndex(state)}
      subtitle={t('eventWizard.steps.location.focusSubtitle', "Où se déroule l'événement ?")}
      title={t('eventWizard.steps.location.title')}
    >
      <View style={[Spaces.gap[12]]}>
        <FacilitySelector
          clubId={clubId}
          cmId={cmId}
          facilityId={facilityId}
          location={location}
          occupancyWindow={occupancyWindow}
          onAddFacility={canManageFacilities ? handleAddFacility : undefined}
          onChange={({ facilityId: nextFacilityId, location: nextLocation }) => {
            setLocation(nextLocation || null);
            setFacilityId(nextFacilityId || null);
            if (!nextFacilityId) {
              setSelectedOccupancy(null);
            }
          }}
          onOccupancyResolved={setSelectedOccupancy}
        />
        {!canGoNext ? (
          <Text style={[Fonts.p3, Fonts.warning500]}>
            {t(
              'eventWizard.steps.location.disabledNextHint',
              'Sélectionne une installation du club ou saisis une adresse extérieure pour continuer.',
            )}
          </Text>
        ) : null}
        {requiresApproval ? (
          <Text style={[Fonts.p3, Fonts.warning500]}>
            {t(
              'eventWizard.steps.location.pendingValidationHint',
              "Cette installation dépasse sa capacité sur ce créneau. L'événement sera créé en demande en attente jusqu'a validation d'un dirigeant.",
            )}
          </Text>
        ) : null}
        {allowsImmediateConfirmation ? (
          <Text style={[Fonts.p3, Fonts.primary500]}>
            {t(
              'eventWizard.steps.location.allowAndNotifyHint',
              "Cette installation dépasse sa capacité sur ce créneau, mais elle est configuree en 'Autorise et notifier'. L'événement restera confirme.",
            )}
          </Text>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardLocation;
