import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Button from '@/components/atoms/button/Button';
import useTheme from '@/theme/themeContext';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import DateTimeSelector from '@/components/molecules/dateTimeSelector/DateTimeSelector';

const VenueProposalModal = ({ isVisible, onClose, onSend, onSkip }) => {
    const { Colors, Fonts, Spaces } = useTheme();
    const [venue, setVenue] = useState(null); // { address: '', location: { lat, lng }, label: '' }
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(new Date());

    const handleSend = () => {
        if (!venue || !venue.label) return;
        
        // Merge Date and Time
        const finalDate = new Date(date);
        finalDate.setHours(time.getHours());
        finalDate.setMinutes(time.getMinutes());

        onSend({
            venue: venue.label,
            address: venue,
            date: finalDate.toISOString()
        });
        onClose();
        
        // Reset (optional, or keep for next time)
        setVenue(null);
        setDate(new Date());
    };

    return (
        <BottomModal
            isVisible={isVisible}
            close={onClose}
            snapPoints={['85%']}
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
            <ScrollView contentContainerStyle={{ paddingBottom: 32, gap: 24 }} keyboardShouldPersistTaps="handled">
                {/* 1. Lieu */}
                <View style={{ zIndex: 100 }}>
                    <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>Lieu proposé</Text>
                    <AutocompleteAddressInput
                        placeholder="Ex: Stade Municipal, Urban Soccer..."
                        setAddress={setVenue}
                        value={venue}
                        isDark
                    />
                </View>

                {/* 2. Date */}
                <View>
                    <DateTimeSelector
                        label="Date"
                        value={date}
                        onChange={setDate}
                        mode="date"
                    />
                </View>

                {/* 3. Heure */}
                <View>
                    <DateTimeSelector
                        label="Heure"
                        value={time}
                        onChange={setTime}
                        mode="time"
                    />
                </View>

                {/* Actions */}
                <View style={{ gap: 12, marginTop: 16 }}>
                    <Button 
                        title="ENVOYER LA PROPOSITION"
                        variant="Primary"
                        onPress={handleSend}
                        disabled={!venue}
                        style={{ backgroundColor: Colors.gold500 }}
                        textStyle={{ color: Colors.neutral900, fontWeight: 'bold' }}
                    />
                    
                    <TouchableOpacity onPress={onSkip} style={{ padding: 12, alignItems: 'center' }}>
                        <Text style={[Fonts.p2, { color: Colors.neutral400, textDecorationLine: 'underline' }]}>
                            Passer et accéder au chat
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </BottomModal>
    );
};

export default VenueProposalModal;
