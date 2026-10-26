import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { closureRefusalText } from '@/domains/facilityClosure/facilityClosureDisplay';
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
  isStageEventType,
} from './eventWizardDetectionUtils';
import preventionDuCreneau from './preventionDuCreneau';
import useMairieDecideALaCreation from './useMairieDecideALaCreation';

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
  const { Colors, Fonts, Spaces } = useTheme();
  const { userData } = useAuth();
  const { dispatch, state } = useEventWizard();
  // La creation d'installation est refusee cote serveur aux non-dirigeants (403) :
  // on ne propose donc le bouton qu'aux dirigeants (le coach passe par l'adresse exterieure).
  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canManageFacilities = roleKey === 'president' || roleKey === 'superAdmin';

  const [location, setLocation] = useState(state.location);
  const [facilityId, setFacilityId] = useState(state.facility);
  const [facilityShared, setFacilityShared] = useState(Boolean(state.facilityShared));
  const [selectedOccupancy, setSelectedOccupancy] = useState(null);
  // 🗓️ DATESDABORD (25/10, décision d'Adel « 6- B ») — le LIEU D'ABORD : à l'aller, la date n'est
  // pas encore choisie, l'étape « Date & horaire » jugera le créneau (JugementDuCreneau). Le jour
  // est connu seulement au retour du récapitulatif, ou pour un stage (son programme vient avant) :
  // l'étape juge alors comme avant (fermeture, place, mairie).
  const dateConnue = route?.params?.returnTo === RouteNames.EventWizardRecap
    || isStageEventType(state.type?.name);

  const clubId = state.team?.club?.documentId;
  const cmId = state.team?.club?.parentMultisport?.documentId;
  const occupancyWindow = {
    end: dateConnue ? buildDateTimeIso(state.date, state.endTime) : null,
    start: dateConnue ? buildDateTimeIso(state.date, state.startTime) : null,
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
  // 🏛️ COLL-R-APP-CREATION (13/10, COL-003, « D2- A ») — la mairie decidera-t-elle ? Pour
  // l installation COCHEE (avant « Suivant ») ; la carte orange est ecrite par le selecteur.
  const decisionDeLaVille = useMairieDecideALaCreation(state, dateConnue ? facilityId : null);
  const isBlocked = Boolean(facilityId && availability.data?.data?.blocked);
  const isAvailabilityUnknown = Boolean(facilityId && dateConnue && (
    !occupancyWindow.start || !occupancyWindow.end || availability.isFetching
    || availability.isLoading || availability.isError
  ));
  // 🗓️ DATESDABORD (23/10, point 4 d'Adel) — le jour et l'heure sont choisis avant : des que
  // l'installation est cochee, « libre » ou « deja pris, demande a <gestionnaire> pour <le type> ».
  // Sur un gymnase de la Ville, le selecteur dit deja le creneau du club ou la mairie : pas de
  // « libre » ici ; la mairie qui decide l'emporte sur la place (SPEC-PLACE).
  const occupationLue = facilityId && dateConnue && !isBlocked && !isAvailabilityUnknown
    ? selectedOccupancy
    : null;
  const prevention = decisionDeLaVille.deLaVille && !occupationLue?.saturated
    ? null
    : preventionDuCreneau(t, {
      gestionnaire: (decisionDeLaVille.deLaVille && decisionDeLaVille.ville)
        || (occupationLue?.isShared && state.team?.club?.parentMultisport?.name)
        || state.team?.club?.name
        || t('eventWizard.steps.location.prevention.tonClub', 'ton club'),
      mairie: decisionDeLaVille.mairie,
      occupation: occupationLue,
      typeName: state.type?.name,
    });
  const canGoNext = Boolean(location || facilityId) && !isBlocked && !isAvailabilityUnknown;

  const handleNext = () => {
    if (isBlocked || isAvailabilityUnknown) return;
    dispatch({
      payload: { facility: facilityId, facilityShared: Boolean(facilityId && facilityShared), location },
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
          decisionDeLaVille={decisionDeLaVille}
          facilityId={facilityId}
          location={location}
          occupancyWindow={isBlocked || !dateConnue ? undefined : occupancyWindow}
          onAddFacility={canManageFacilities ? handleAddFacility : undefined}
          onChange={({ facilityId: nextFacilityId, isShared, location: nextLocation }) => {
            setLocation(nextLocation || null);
            setFacilityId(nextFacilityId || null);
            setFacilityShared(Boolean(isShared));
            if (!nextFacilityId) {
              setSelectedOccupancy(null);
            }
          }}
          onOccupancyResolved={setSelectedOccupancy}
          // COLL-C2C (02/10) — D32 : les installations de la Ville ou le club a un creneau.
          teamId={state.team?.documentId || null}
          withVilleSlots
        />
        {/* CRFERM (13/10, COL-011) : la phrase dit la fermeture que le serveur rend (`closure` :
            lieu, jours, motif ; jamais le mot de la Ville), au « tu », en ORANGE (attention, pas
            erreur) ; « Changer la date » ramène à l étape « Date & horaire » (le geste de la
            flèche Retour, nommé). */}
        {isBlocked ? (
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p3, { color: Colors.warning500 }]} testID="lieu-fermeture">
              {closureRefusalText(
                t,
                availability.data?.data?.closure || null,
                availability.data?.data?.facility?.name,
              )}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
              testID="lieu-changer-la-date"
            >
              <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                {t('eventWizard.steps.location.changerLaDate', 'Changer la date')}
              </Text>
            </TouchableOpacity>
          </View>
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
        {/* D58 — pack §2.4 : un conflit de creneau tient en UNE ligne orange qui dit la
            CONSEQUENCE ; DATESDABORD : la place libre se dit aussi, en vert (le cyan reste a la selection). */}
        {prevention ? (
          <Text
            style={[Fonts.p3, prevention.pris ? Fonts.warning500 : Fonts.success500]}
            testID={prevention.pris ? 'lieu-creneau-pris' : 'lieu-creneau-libre'}
          >
            {prevention.texte}
          </Text>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default EventWizardLocation;
