import React, { useState, useEffect, useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import useTheme from '@/theme/themeContext';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import { getFacilities, getCMFacilities } from '@/services/facility/facilityService';

/**
 * FacilitySelector component
 * @param {object} props
 * @param {string} props.clubId - The club ID to fetch facilities from
 * @param {string} [props.cmId] - Optional CM ID to also fetch CM facilities
 * @param {object} props.location - The current location value
 * @param {string} props.facilityId - The current facility ID
 * @param {Function} props.onChange - Callback({ location, facilityId })
 * @param {string} props.error - Error message
 */
const FacilitySelector = ({ clubId, cmId, location, facilityId, onChange, error }) => {
    const { t } = useTranslation();
    const { Spaces, Fonts, Colors, Alignments } = useTheme();
    const [mode, setMode] = useState(facilityId ? 'club' : 'external');

    // Fetch Club Facilities
    const { data: clubFacilitiesData } = useQuery({
        queryKey: ['facilities', clubId],
        queryFn: () => getFacilities(clubId),
        enabled: !!clubId,
    });
    
    // Fetch CM Facilities (shared installations)
    const { data: cmFacilitiesData } = useQuery({
        queryKey: ['cm-facilities', cmId],
        queryFn: () => getCMFacilities(cmId),
        enabled: !!cmId,
    });

    // Merge club facilities and CM facilities
    const facilities = useMemo(() => {
        const clubFacilities = clubFacilitiesData?.data || [];
        const cmFacilities = cmFacilitiesData?.data || [];
        
        // Avoid duplicates by documentId
        const allFacilities = [...clubFacilities];
        cmFacilities.forEach(cmFac => {
            if (!allFacilities.some(f => f.documentId === cmFac.documentId)) {
                allFacilities.push({ ...cmFac, isShared: true }); // Mark as shared
            }
        });
        
        return allFacilities;
    }, [clubFacilitiesData, cmFacilitiesData]);

    const facilityOptions = facilities.map(f => ({
        label: f.isShared ? `${f.name} (CM)` : f.name,
        value: f.documentId || f.id,
        address: f.address,
    }));

    useEffect(() => {
        if (facilityId) {
            setMode('club');
        } else if (location && !facilityId) {
            setMode('external');
        }
    }, [facilityId, location]);

    const handleModeChange = (newMode) => {
        setMode(newMode);
        if (newMode === 'club') {
            // If switching to club, maybe clear location if no facility selected?
            // Or keep it. Let's clear to force selection.
            onChange({ location: null, facilityId: null });
        } else {
            // If switching to external, clear facility
            onChange({ location: null, facilityId: null });
        }
    };

    const handleFacilityChange = (selectedId) => {
        const selectedFacility = facilities.find(f => (f.documentId || f.id) === selectedId);
        if (selectedFacility) {
            // Construct location object from facility address
            // Note: AutocompleteAddressInput expects { label, value: 'lat|lng' }
            // If facility doesn't have lat/lng, we might have an issue if backend requires it.
            // For now, let's assume facility address is a string.
            // We might need to geocode it or just send the address label.
            const loc = {
                label: selectedFacility.address,
                value: '', // We might not have coords
            };
            onChange({ location: loc, facilityId: selectedId });
        } else {
            onChange({ location: null, facilityId: null });
        }
    };

    const handleAddressChange = (newLocation) => {
        onChange({ location: newLocation, facilityId: null });
    };

    return (
        <View style={[Spaces.gap[16]]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('eventEdit.fields.location.label', 'Lieu')}
            </Text>

            <View style={{ alignItems: 'flex-start' }}>
                <SegmentedControl
                    options={[
                        { label: t('eventEdit.locationMode.club', 'Club'), value: 'club' },
                        { label: t('eventEdit.locationMode.external', 'Extérieur'), value: 'external' },
                    ]}
                    value={mode}
                    onChange={handleModeChange}
                />
            </View>

            {mode === 'club' ? (
                <AutocompleteSelect
                    label={t('eventEdit.fields.facility.label', 'Installation')}
                    placeholder={t('eventEdit.fields.facility.placeholder', 'Sélectionner une installation')}
                    options={facilityOptions}
                    value={facilityOptions.find(o => o.value === facilityId)?.label || ''}
                    setValue={(option) => handleFacilityChange(option?.value)}
                    error={error}
                />
            ) : (
                <AutocompleteAddressInput
                    address={location}
                    label={null} // Already showed label above
                    placeholder={t('eventEdit.fields.location.placeholder')}
                    setAddress={handleAddressChange}
                    error={error}
                />
            )}
        </View>
    );
};

export default FacilitySelector;
