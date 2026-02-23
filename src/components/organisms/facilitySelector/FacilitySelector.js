import { useIsFocused } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';

import { getCMFacilities, getFacilities } from '@/services/facility/facilityService';

/**
 * FacilitySelector component
 * @param {object} props
 * @param {string} props.clubId - The club ID to fetch facilities from
 * @param {string} [props.cmId] - Optional CM ID to also fetch CM facilities
 * @param {object} props.location - The current location value
 * @param {string} props.facilityId - The current facility ID
 * @param {Function} props.onChange - Callback({ location, facilityId })
 * @param {string} props.error - Error message
 * @param {Function} [props.onAddFacility] - Optional callback when pressing "add facility"
 */
function FacilitySelector({
  clubId,
  cmId,
  error,
  facilityId,
  location,
  onAddFacility,
  onChange,
}) {
  const { t } = useTranslation();
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const [mode, setMode] = useState('club');
  const cardSurfaceStyle = {
    backgroundColor: 'rgba(4, 31, 44, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.24)',
    borderWidth: 1,
  };
  const fieldSurfaceStyle = {
    backgroundColor: 'rgba(1, 179, 244, 0.08)',
    borderColor: 'rgba(1, 179, 244, 0.26)',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  };
  const selectedBadgeStyle = {
    backgroundColor: 'rgba(1, 179, 244, 0.16)',
    borderColor: Colors.primary500,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  };
  const selectedCheckStyle = {
    alignItems: 'center',
    backgroundColor: Colors.primary500,
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    width: 20,
  };

  const {
    data: clubFacilitiesData,
    isFetching: isFetchingClubFacilities,
    isLoading: isLoadingClubFacilities,
    refetch: refetchClubFacilities,
  } = useQuery({
    enabled: !!clubId,
    queryFn: () => getFacilities(clubId),
    queryKey: ['facilities', clubId],
  });

  const {
    data: cmFacilitiesData,
    isFetching: isFetchingCmFacilities,
    isLoading: isLoadingCmFacilities,
    refetch: refetchCmFacilities,
  } = useQuery({
    enabled: !!cmId,
    queryFn: () => getCMFacilities(cmId),
    queryKey: ['cm-facilities', cmId],
  });

  const isLoadingFacilities = (
    (Boolean(clubId) && (isLoadingClubFacilities || isFetchingClubFacilities))
    || (Boolean(cmId) && (isLoadingCmFacilities || isFetchingCmFacilities))
  );

  const facilities = useMemo(() => {
    const clubFacilities = clubFacilitiesData?.data || [];
    const cmFacilities = cmFacilitiesData?.data || [];

    const allFacilities = [...clubFacilities];
    cmFacilities.forEach((cmFacility) => {
      if (!allFacilities.some((facility) => facility.documentId === cmFacility.documentId)) {
        allFacilities.push({ ...cmFacility, isShared: true });
      }
    });

    return allFacilities;
  }, [clubFacilitiesData, cmFacilitiesData]);
  const isFocused = useIsFocused();

  const getFacilityAddressLabel = (address) => {
    if (!address) return t('eventWizard.steps.location.addressMissing', 'Adresse non renseignee');
    if (typeof address === 'string') return address;
    if (typeof address === 'object') {
      return (
        address?.label
        || address?.description
        || address?.address
        || t('eventWizard.steps.location.addressMissing', 'Adresse non renseignee')
      );
    }
    return t('eventWizard.steps.location.addressMissing', 'Adresse non renseignee');
  };

  useEffect(() => {
    if (facilityId) {
      setMode('club');
    }
  }, [facilityId]);

  useEffect(() => {
    if (!isFocused || mode !== 'club') return;
    if (clubId) refetchClubFacilities();
    if (cmId) refetchCmFacilities();
  }, [clubId, cmId, isFocused, mode, refetchClubFacilities, refetchCmFacilities]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    onChange({ facilityId: null, location: null });
  };

  const handleFacilityChange = (selectedId) => {
    const selectedFacility = facilities.find(
      (facility) => (facility.documentId || facility.id) === selectedId,
    );

    if (!selectedFacility) {
      onChange({ facilityId: null, location: null });
      return;
    }

    onChange({
      facilityId: selectedId,
      location: {
        label: selectedFacility.address,
        value: '',
      },
    });
  };

  const handleAddressChange = (newLocation) => {
    onChange({ facilityId: null, location: newLocation });
  };

  return (
    <View style={[Spaces.gap[16]]}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('eventEdit.fields.location.label', 'Lieu')}
      </Text>

      <View style={{ alignItems: 'flex-start' }}>
        <SegmentedControl
          onChange={handleModeChange}
          options={[
            { label: t('eventEdit.locationMode.club', 'Club'), value: 'club' },
            { label: t('eventEdit.locationMode.external', 'Exterieur'), value: 'external' },
          ]}
          value={mode}
        />
      </View>

      {mode === 'club' ? (
        <View style={[Spaces.gap[16]]}>
          <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[16], cardSurfaceStyle]}>
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('eventEdit.fields.facility.label', 'Installation')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t('eventWizard.steps.location.installationHelper', 'Choisis une installation de ton club.')}
              </Text>
            </View>

            {isLoadingFacilities ? (
              <View style={[Spaces.paddingVertical[12]]}>
                <ActivityIndicator color={Colors.primary500} />
              </View>
            ) : null}

            {!isLoadingFacilities && facilities.length === 0 ? (
              <View style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], fieldSurfaceStyle]}>
                <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                  {t('eventWizard.steps.location.noInstallationsTitle', 'Aucune installation pour le moment')}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {t(
                    'eventWizard.steps.location.noInstallations',
                    'Ajoute une installation ou passe en mode Exterieur pour saisir une adresse.',
                  )}
                </Text>
              </View>
            ) : null}

            {!isLoadingFacilities && facilities.length > 0 ? (
              <ScrollView
                contentContainerStyle={[Spaces.gap[12], { paddingBottom: 2, paddingRight: 2 }]}
                nestedScrollEnabled
                showsVerticalScrollIndicator={facilities.length > 3}
                style={{ maxHeight: 280 }}
              >
                {facilities.map((facility) => {
                  const id = facility.documentId || facility.id;
                  const isSelected = facilityId === id;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.86}
                      key={`wizard-facility-${id}`}
                      onPress={() => handleFacilityChange(id)}
                      style={[
                        ApplicationStyle.card,
                        Spaces.padding[16],
                        Spaces.gap[8],
                        {
                          backgroundColor: isSelected ? 'rgba(1, 179, 244, 0.22)' : 'rgba(1, 179, 244, 0.10)',
                          borderColor: isSelected ? Colors.primary500 : 'rgba(1, 179, 244, 0.24)',
                          minHeight: 84,
                          shadowColor: isSelected ? Colors.primary500 : 'transparent',
                          shadowOpacity: isSelected ? 0.24 : 0,
                          shadowRadius: isSelected ? 8 : 0,
                        },
                      ]}
                    >
                      <View
                        style={{
                          alignItems: 'center',
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={[Fonts.p2Bold, isSelected ? Fonts.primary100 : Fonts.neutral00, { flex: 1, marginRight: 12 }]}
                        >
                          {facility.isShared ? `${facility.name} (CM)` : facility.name}
                        </Text>
                        {isSelected ? (
                          <View style={{ alignItems: 'center', flexDirection: 'row' }}>
                            <View style={selectedCheckStyle}>
                              <Image
                                source={Images.check}
                                style={{ height: 11, tintColor: Colors.neutral900, width: 11 }}
                              />
                            </View>
                            <View style={[selectedBadgeStyle, { marginLeft: 8 }]}>
                              <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                                {t('common.selected', 'Selectionnee')}
                              </Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                      <Text numberOfLines={2} style={[Fonts.p2, Fonts.neutral200]}>
                        {getFacilityAddressLabel(facility.address)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>

          {onAddFacility ? (
            <Button
              onPress={() => onAddFacility()}
              style={{ marginTop: 2 }}
              title={`+ ${t('eventWizard.steps.location.addInstallation', 'Ajouter une installation')}`}
              variant="Secondary"
            />
          ) : null}
        </View>
      ) : (
        <AutocompleteAddressInput
          address={location}
          error={error}
          label={null}
          placeholder={t('eventEdit.fields.location.placeholder')}
          setAddress={handleAddressChange}
          wrapperStyle={fieldSurfaceStyle}
        />
      )}

      {error ? (
        <Text style={[Fonts.p3, Fonts.error700]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export default FacilitySelector;
