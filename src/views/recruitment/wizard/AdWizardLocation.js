import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/* eslint-disable perfectionist/sort-imports */
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import FacilitySelector from '@/components/organisms/facilitySelector/FacilitySelector';
import { useAppFeedback } from '@/context/AppFeedbackContext';

import { RouteNames } from '@/navigation/routeNames';

import { useClubFacilityContext } from '@/services/facility/facilityQueries';

import { useAdWizard } from './AdWizardContext';
import {
  getAdWizardLocationStepIndex,
  getAdWizardStepCount,
  hasAdWizardValidationStep,
  isAdWizardLocationComplete,
} from './adWizardStepUtils';
/* eslint-enable perfectionist/sort-imports */

const getFacilityAddressLabel = (address) => {
  if (!address) return 'Adresse non renseignee';
  if (typeof address === 'string') return address;
  return (
    address?.label
    || address?.description
    || address?.address
    || 'Adresse non renseignee'
  );
};

const getSelectedFacilityIdFromState = (state) => {
  const facilityValue = state?.facility;
  if (facilityValue && typeof facilityValue === 'object') {
    return facilityValue.documentId || facilityValue.id || null;
  }
  if (facilityValue) {
    return facilityValue;
  }
  return state?.address?.facilityDocumentId || null;
};

const buildFacilitySelectionAddress = (facility, fallbackLocation) => {
  const sourceAddress = facility?.address || fallbackLocation;
  const sourceObject = sourceAddress && typeof sourceAddress === 'object' && !Array.isArray(sourceAddress)
    ? sourceAddress
    : {};
  const addressLabel = getFacilityAddressLabel(sourceAddress);
  const facilityLabel = String(facility?.name || '').trim();

  return {
    ...sourceObject,
    address: typeof sourceAddress === 'string'
      ? sourceAddress
      : (sourceObject.address || sourceObject.label || sourceObject.description || addressLabel),
    facilityDocumentId: facility?.documentId || facility?.id || null,
    facilityName: facilityLabel,
    label: [facilityLabel, addressLabel].filter(Boolean).join(' - ') || addressLabel,
    source: 'club_facility',
  };
};

/**
 * Wizard step for selecting the publication location.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function AdWizardLocation({ navigation }) {
  const { Fonts, Spaces } = useTheme();
  const { showBanner } = useAppFeedback();
  const { dispatch, state } = useAdWizard();

  const clubId = state.team?.club?.documentId || state.team?.club?.id || null;
  const cmId = state.team?.club?.parentMultisport?.documentId || null;
  const [location, setLocation] = useState(state.address || null);
  const [facilityId, setFacilityId] = useState(() => getSelectedFacilityIdFromState(state));

  const { data: facilityContext } = useClubFacilityContext(
    { clubId, cmId },
    { enabled: Boolean(clubId || cmId) },
  );

  const allFacilities = useMemo(
    () => (Array.isArray(facilityContext?.allFacilities) ? facilityContext.allFacilities : []),
    [facilityContext?.allFacilities],
  );
  const selectedFacility = useMemo(
    () => allFacilities.find((facility) => (facility?.documentId || facility?.id) === facilityId) || null,
    [allFacilities, facilityId],
  );
  const canGoNext = isAdWizardLocationComplete({ address: location }) || Boolean(facilityId);

  const handleNext = () => {
    if (!canGoNext) {
      showBanner({
        body: 'Selectionnez une installation du club ou saisissez une adresse pour continuer.',
        title: 'Lieu requis',
        tone: 'error',
      });
      return;
    }

    const nextAddress = facilityId
      ? buildFacilitySelectionAddress(selectedFacility, location)
      : (location || null);

    dispatch({
      payload: {
        address: nextAddress,
        facility: facilityId ? (selectedFacility || { documentId: facilityId, id: facilityId }) : null,
      },
      type: 'SET_LOCATION_SELECTION',
    });

    if (hasAdWizardValidationStep(state)) {
      navigation.navigate(RouteNames.AdWizardValidation);
      return;
    }

    navigation.navigate(RouteNames.AdWizardDescription);
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
      nextLabel="Suivant"
      onBack={() => navigation.goBack()}
      onNext={handleNext}
      stepCount={getAdWizardStepCount(state)}
      stepIndex={getAdWizardLocationStepIndex(state)}
      subtitle="Selectionnez une installation du club ou renseignez une adresse claire pour situer votre annonce."
      title="Lieu de publication"
    >
      <View style={[Spaces.gap[12], Spaces.paddingBottom[32]]}>
        <FacilitySelector
          clubId={clubId}
          cmId={cmId}
          facilityId={facilityId}
          location={location}
          onAddFacility={clubId || cmId ? handleAddFacility : undefined}
          onChange={({ facilityId: nextFacilityId, location: nextLocation }) => {
            setLocation(nextLocation || null);
            setFacilityId(nextFacilityId || null);
          }}
        />

        {!canGoNext ? (
          <Text style={[Fonts.p3, Fonts.warning500]}>
            Selectionnez une installation du club ou saisissez une adresse exterieure pour continuer.
          </Text>
        ) : null}
      </View>
    </WizardStepLayout>
  );
}

export default AdWizardLocation;
