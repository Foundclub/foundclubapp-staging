import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Button from '@/components/atoms/button/Button';
import useTheme from '@/theme/themeContext';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import DateTimeSelector from '@/components/molecules/dateTimeSelector/DateTimeSelector';
import Input from '@/components/molecules/input/Input';

const VenueProposalModal = ({ isVisible, onClose, onSend, onSkip }) => {
    const { Colors, Fonts, Spaces } = useTheme();
    
    // Form State
    const [venueName, setVenueName] = useState('');
    const [venueAddress, setVenueAddress] = useState(null); // { address: '', location: { lat, lng }, label: '' }
    
    // Date & Time State
    const [date, setDate] = useState(new Date());
    const [startTime, setStartTime] = useState(() => {
        const d = new Date();
        d.setHours(20, 0, 0, 0); // Default 20:00
        return d;
    });
    const [endTime, setEndTime] = useState(() => {
        const d = new Date();
        d.setHours(21, 0, 0, 0); // Default 21:00
        return d;
    });

    const handleSend = () => {
        // Validation: Need at least a location (Name OR Address) and valid times
        if ((!venueName && !venueAddress)) return;
        
        // Merge Date and Time to create ISO strings
        const finalStartDate = new Date(date);
        finalStartDate.setHours(startTime.getHours());
        finalStartDate.setMinutes(startTime.getMinutes());

        const finalEndDate = new Date(date);
        finalEndDate.setHours(endTime.getHours());
        finalEndDate.setMinutes(endTime.getMinutes());
        
        // Safety: If end < start, assumed next day? No, match usually same day. 
        // Just enforce end > start or ignore. User responsibility for now or visual validation.

        onSend({
            venue: venueName || venueAddress?.label || "Terrain", // Priority to custom name
            address: venueAddress,
            date: finalStartDate.toISOString(),
            endDate: finalEndDate.toISOString()
        });
        
        // Cleanup and Close
        onClose();
        setVenueName('');
        setVenueAddress(null);
    };

    return (
        <BottomModal
            isVisible={isVisible}
            close={onClose}
            snapPoints={['85%']}
            contentContainerStyle={{ paddingBottom: 32, gap: 24 }}
            headerComponent={
                <View>
                    <Text style={[Fonts.h3, { color: Colors.gold500, textAlign: 'center', marginBottom: 4 }]}>
                        📍 Où jouer ?
                    </Text>
                    <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center', marginBottom: 16 }]}>
                        Proposez un terrain et un créneau à votre adversaire.
                    </Text>
                </View>
            }
        >
            {/* 1. Lieu */}
            <View style={{ zIndex: 100 }}>
                <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 12 }]}>Lieu</Text>
                
                <Input
                    placeholder="Nom du lieu (ex: Urban Soccer)"
                    value={venueName}
                    onChangeText={setVenueName}
                    wrapperStyle={{ marginBottom: 16 }}
                />
                
                <View style={{ zIndex: 100 }}>
                    <AutocompleteAddressInput
                        placeholder="Adresse précise (si nécessaire)"
                        setAddress={setVenueAddress}
                        address={venueAddress}
                    />
                </View>
            </View>

            {/* 2. Date & Heure */}
            <View>
                <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 12 }]}>Créneau</Text>
                
                {/* Date Picker */}
                <DateTimeSelector
                    label="Date"
                    value={date}
                    onChange={setDate}
                    mode="date"
                    display="inline"
                />

                {/* Time Range Row */}
                <View style={{ flexDirection: 'row', gap: 16 }}>
                    <View style={{ flex: 1 }}>
                        <DateTimeSelector
                            label="Début"
                            value={startTime}
                            onChange={setStartTime}
                            mode="time"
                            display="inline"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                            <DateTimeSelector
                            label="Fin"
                            value={endTime}
                            onChange={setEndTime}
                            mode="time"
                            display="inline"
                        />
                    </View>
                </View>
            </View>

            {/* Actions */}
            <View style={{ gap: 12, marginTop: 16 }}>
                <Button 
                    title="ENVOYER LA PROPOSITION"
                    variant="Primary"
                    onPress={handleSend}
                    disabled={!venueName && !venueAddress}
                    style={{ backgroundColor: Colors.gold500 }}
                    textStyle={{ color: Colors.neutral900, fontWeight: 'bold' }}
                />
                
                {onSkip && (
                    <TouchableOpacity onPress={onSkip} style={{ padding: 12, alignItems: 'center' }}>
                        <Text style={[Fonts.p2, { color: Colors.neutral400, textDecorationLine: 'underline' }]}>
                            Passer et accéder au chat
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </BottomModal>
    );
};

export default VenueProposalModal;
