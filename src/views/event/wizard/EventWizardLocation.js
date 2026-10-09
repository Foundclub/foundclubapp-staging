import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import FacilitySelector from '@/components/organisms/facilitySelector/FacilitySelector';

import { RouteNames } from '@/navigation/routeNames';

import { useGetFacilityOccupancy } from '@/services/facility/facilityQueries';

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
 * @param {{ navigation: any, route: any }} props Proprietes d'ecran.
 * @returns {import('react').ReactElement} L'etape rendue.
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
  if (occupancyWindow.end && occupancyWindow.start
    && occupancyWindow.end <= occupancyWindow.start) {
    const end = new Date(occupancyWindow.end);
    end.setDate(end.getDate() + 1);
    occupancyWindow.end = end.toISOString();
  }
  // The shared selector skips occupancy inside a club allocation. An absolute closure
  // still applies there. The same query key deduplicates requests outside allocations.
  const availability = useGetFacilityOccupancy(facilityId, occupancyWindow, {
    refetchOnMount: 'always',
    staleTime: 0,
  });
  const isBlocked = Boolean(facilityId && availability.data?.data?.blocked);
  const isAvailabilityUnknown = Boolean(facilityId && (
    !occupancyWindow.start || !occupancyWindow.end || availability.isFetching
    || availability.isLoading || availability.isError
  ));
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
  const canGoNext = Boolean(location || facilityId) && !isBlocked && !isAvailabilityUnknown;

  const handleNext = () => {
    if (isBlocked || isAvailabilityUnknown) return;
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
          occupancyWindow={isBlocked ? undefined : occupancyWindow}
          onAddFacility={canManageFacilities ? handleAddFacility : undefined}
          onChange={({ facilityId: nextFacilityId, location: nextLocation }) => {
            setLocation(nextLocation || null);
            setFacilityId(nextFacilityId || null);
            if (!nextFacilityId) {
              setSelectedOccupancy(null);
            }
          }}
          onOccupancyResolved={setSelectedOccupancy}
          // COLL-C2C (02/10) — D32 : les installations de la Ville ou le club a un creneau.
          teamId={state.team?.documentId || null}
          withVilleSlots
        />
        {isBlocked ? (
          <Text style={[Fonts.p3, Fonts.error700]}>
            {t(
              'eventWizard.steps.location.facilityClosed',
              'La mairie a rendu cette installation indisponible sur ce créneau. '
                + 'Choisissez un autre horaire ou une autre installation.',
            )}
          </Text>
        ) : null}
        {isAvailabilityUnknown ? (
          <View>
            <Text style={[Fonts.p3, Fonts.warning500]}>
              {availability.isError
                ? t(
                  'eventWizard.steps.location.availabilityFailed',
                  'Impossible de vérifier la disponibilité. Réessayez avant de continuer.',
                )
                : t(
                  'eventWizard.steps.location.checkingAvailability',
                  'Vérification de la disponibilité…',
                )}
            </Text>
            {availability.isError ? (
              <TouchableOpacity accessibilityRole="button" onPress={() => availability.refetch()}>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                  {t('common.actions.retry', 'Réessayer')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        {!location && !facilityId ? (
          <Text style={[Fonts.p3, Fonts.warning500]}>
            {t(
              'eventWizard.steps.location.disabledNextHint',
              'Sélectionne une installation du club ou saisis une adresse extérieure pour continuer.',
            )}
          </Text>
        ) : null}
        {/* D58 — pack §2.4 : un conflit de creneau tient en UNE ligne orange,
            et elle dit la CONSEQUENCE. Les deux cas restent distingues — le
            club valide, ou le club laisse passer — mais dans la meme grammaire.
            ⚠️ Orange des deux cotes : le second etait cyan, or le pack reserve
            le cyan a la selection et a l'action. */}
        {requiresApproval ? (
          <Text style={[Fonts.p3, Fonts.warning500]}>
            {t(
              'eventWizard.steps.location.pendingValidationHint',
              "Créneau complet sur cet horaire — l'événement partira en demande de validation au club.",
            )}
          </Text>
        ) : null}
        {allowsImmediateConfirmation ? (
          <Text style={[Fonts.p3, Fonts.warning500]}>
            {t(
              'eventWizard.steps.location.allowAndNotifyHint',
              "Créneau complet sur cet horaire — le club l'autorise quand même, l'événement reste confirmé.",
            )}
          </Text>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardLocation;
