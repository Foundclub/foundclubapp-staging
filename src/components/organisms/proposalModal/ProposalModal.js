import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform, Linking } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Button from '@/components/atoms/button/Button';
import useTheme from '@/theme/themeContext';

const ProposalModal = ({ isVisible, onClose, onSend }) => {
    const { Colors, Fonts, Spaces } = useTheme();
    const [venueName, setVenueName] = useState('');
    const [venueAddress, setVenueAddress] = useState('');
    const [date, setDate] = useState(new Date());
    const [startTime, setStartTime] = useState(new Date());
    const [endTime, setEndTime] = useState(() => {
        const end = new Date();
        end.setHours(end.getHours() + 1);
        return end;
    });
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);

    const handleSend = () => {
        if (!venueName.trim()) return;
        
        // Merge Date and Start Time
        const finalStartDate = new Date(date);
        finalStartDate.setHours(startTime.getHours());
        finalStartDate.setMinutes(startTime.getMinutes());
        
        // Merge Date and End Time
        const finalEndDate = new Date(date);
        finalEndDate.setHours(endTime.getHours());
        finalEndDate.setMinutes(endTime.getMinutes());
        
        onSend({
            venue: venueName,
            address: venueAddress,
            date: finalStartDate.toISOString(),
            endDate: finalEndDate.toISOString(),
            type: 'proposal',
            status: 'pending'
        });
        onClose();
        // Reset
        setVenueName('');
        setVenueAddress('');
        setDate(new Date());
        setStartTime(new Date());
        const newEnd = new Date();
        newEnd.setHours(newEnd.getHours() + 1);
        setEndTime(newEnd);
    };

    const onChangeDate = (event, selectedDate) => {
        const currentDate = selectedDate || date;
        setShowDatePicker(Platform.OS === 'ios');
        setDate(currentDate);
    };

    const onChangeStartTime = (event, selectedDate) => {
        const currentDate = selectedDate || startTime;
        setShowStartTimePicker(Platform.OS === 'ios');
        setStartTime(currentDate);
        // Auto-set end time to 1 hour later
        const newEnd = new Date(currentDate);
        newEnd.setHours(newEnd.getHours() + 1);
        setEndTime(newEnd);
    };

    const onChangeEndTime = (event, selectedDate) => {
        const currentDate = selectedDate || endTime;
        setShowEndTimePicker(Platform.OS === 'ios');
        setEndTime(currentDate);
    };

    const inputStyle = {
        backgroundColor: Colors.neutral800,
        color: Colors.neutral00,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.neutral700
    };

    const timeButtonStyle = {
        backgroundColor: Colors.neutral800,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.neutral700,
        flex: 1
    };

    return (
        <BottomModal
            isVisible={isVisible}
            close={onClose}
            snapPoints={['75%']}
            headerComponent={
                <Text style={[Fonts.h3, { color: Colors.gold500, textAlign: 'center', marginBottom: 16 }]}>
                    📍 Proposer un Match
                </Text>
            }
        >
            <View style={{ paddingBottom: 32, gap: 16 }}>
                {/* 1. Nom du Lieu */}
                <View>
                    <Text style={[Fonts.p2Bold, { color: Colors.neutral300, marginBottom: 8 }]}>Nom du lieu</Text>
                    <TextInput 
                        placeholder="Ex: Urban Soccer, Le Z5..."
                        placeholderTextColor={Colors.neutral500}
                        style={[Fonts.p1, inputStyle]}
                        value={venueName}
                        onChangeText={setVenueName}
                    />
                </View>

                {/* 2. Adresse */}
                <View>
                    <Text style={[Fonts.p2Bold, { color: Colors.neutral300, marginBottom: 8 }]}>Adresse précise</Text>
                    <TextInput 
                        placeholder="Ex: 123 Avenue du Stade, 75000 Paris"
                        placeholderTextColor={Colors.neutral500}
                        style={[Fonts.p1, inputStyle]}
                        value={venueAddress}
                        onChangeText={setVenueAddress}
                        multiline
                    />
                </View>

                {/* 3. Date */}
                <View>
                    <Text style={[Fonts.p2Bold, { color: Colors.neutral300, marginBottom: 8 }]}>Date</Text>
                    <TouchableOpacity 
                        onPress={() => setShowDatePicker(true)}
                        style={timeButtonStyle}
                    >
                        <Text style={[Fonts.p1, { color: Colors.primary500 }]}>
                            {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                        <DateTimePicker
                            testID="dateTimePicker"
                            value={date}
                            mode="date"
                            display="default"
                            minimumDate={new Date()}
                            onChange={onChangeDate}
                        />
                    )}
                </View>

                {/* 4. Créneau Horaire */}
                <View>
                    <Text style={[Fonts.p2Bold, { color: Colors.neutral300, marginBottom: 8 }]}>Créneau horaire</Text>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <TouchableOpacity
                            onPress={() => setShowStartTimePicker(true)}
                            style={timeButtonStyle}
                        >
                            <Text style={[Fonts.p1, { color: Colors.primary500 }]}>
                                {startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </TouchableOpacity>
                        
                        <Text style={[Fonts.p2Bold, { color: Colors.neutral400 }]}>→</Text>
                        
                        <TouchableOpacity
                            onPress={() => setShowEndTimePicker(true)}
                            style={timeButtonStyle}
                        >
                            <Text style={[Fonts.p1, { color: Colors.primary500 }]}>
                                {endTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    
                    {showStartTimePicker && (
                        <DateTimePicker
                            testID="startTimePicker"
                            value={startTime}
                            mode="time"
                            is24Hour={true}
                            display="default"
                            onChange={onChangeStartTime}
                        />
                    )}
                    {showEndTimePicker && (
                        <DateTimePicker
                            testID="endTimePicker"
                            value={endTime}
                            mode="time"
                            is24Hour={true}
                            display="default"
                            onChange={onChangeEndTime}
                        />
                    )}
                </View>

                {/* Submit */}
                <Button 
                    title="ENVOYER LA PROPOSITION"
                    variant="Primary"
                    onPress={handleSend}
                    disabled={!venueName.trim()}
                    style={{ marginTop: 16, backgroundColor: Colors.gold500 }}
                    textStyle={{ color: Colors.neutral900, fontWeight: 'bold' }}
                />
            </View>
        </BottomModal>
    );
};

export default ProposalModal;
