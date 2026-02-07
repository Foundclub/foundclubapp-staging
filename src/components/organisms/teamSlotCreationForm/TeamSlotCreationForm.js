import React, { useState, useMemo } from 'react';
import { View, Text, LayoutAnimation, Platform, UIManager } from 'react-native';
import useTheme from '@/theme/themeContext';
import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import { WheelPicker } from '@/components/molecules/dateTimeSelector/DateTimeSelector';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const DAYS = [
  { label: 'Lundi', value: 'monday' },
  { label: 'Mardi', value: 'tuesday' },
  { label: 'Mercredi', value: 'wednesday' },
  { label: 'Jeudi', value: 'thursday' },
  { label: 'Vendredi', value: 'friday' },
  { label: 'Samedi', value: 'saturday' },
  { label: 'Dimanche', value: 'sunday' },
];

/**
 * @param {object} props
 * @param {(slot: { day: string, startTime: string, endTime: string }) => void} props.onAdd
 * @param {() => void} props.onCancel
 */
const TeamSlotCreationForm = ({ onAdd, onCancel, initialValues, onDelete }) => {
  const { Colors, Fonts } = useTheme();
  
  const [selectedDay, setSelectedDay] = useState(() => {
    if (initialValues?.day) {
        return DAYS.find(d => d.value === initialValues.day) || null;
    }
    return null;
  });
  
  // Initialize times with Date objects
  const [startTimeDate, setStartTimeDate] = useState(() => {
    const d = new Date();
    if (initialValues?.startTime) {
        const [h, m] = initialValues.startTime.split(':');
        d.setHours(parseInt(h), parseInt(m), 0, 0);
    } else {
        d.setHours(20, 0, 0, 0);
    }
    return d;
  });

  const [endTimeDate, setEndTimeDate] = useState(() => {
    const d = new Date();
    if (initialValues?.endTime) {
        const [h, m] = initialValues.endTime.split(':');
        d.setHours(parseInt(h), parseInt(m), 0, 0);
    } else {
        d.setHours(22, 0, 0, 0);
    }
    return d;
  });

  // Time Picker Data
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleStartTimeChange = (type, value) => {
    const newStart = new Date(startTimeDate);
    if (type === 'hour') newStart.setHours(value);
    if (type === 'minute') newStart.setMinutes(value);
    setStartTimeDate(newStart);

    // Auto-adjust End Time if it becomes invalid or too close
    const minEnd = new Date(newStart);
    minEnd.setHours(minEnd.getHours() + 1);

    if (endTimeDate <= newStart) {
        setEndTimeDate(minEnd);
    }
  };

  const handleEndTimeChange = (type, value) => {
      const newEnd = new Date(endTimeDate);
      if (type === 'hour') newEnd.setHours(value);
      if (type === 'minute') newEnd.setMinutes(value);
      setEndTimeDate(newEnd);
  };

  const handleAdd = () => {
    if (!selectedDay) return;
    onAdd({
        day: selectedDay.value,
        startTime: formatTime(startTimeDate),
        endTime: formatTime(endTimeDate),
    });
  };

  const isFormValid = useMemo(() => {
     return selectedDay && startTimeDate && endTimeDate && endTimeDate > startTimeDate; 
  }, [selectedDay, startTimeDate, endTimeDate]);

  return (
    <View style={{ 
        backgroundColor: Colors.neutral800, 
        paddingVertical: 16,
        paddingHorizontal: 16,
        paddingTop: 40, // Increased padding top for modal header
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.neutral700
    }}>
        <View style={{ marginBottom: 16 }}>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>Jour</Text>
            <AutocompleteSelect
                placeholder="Sélectionner un jour"
                options={DAYS}
                value={selectedDay?.label}
                setValue={setSelectedDay}
                isSearchable={false}
            />
        </View>

        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>Début</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <WheelPicker
                        data={hours}
                        selectedValue={startTimeDate.getHours()}
                        onValueChange={(h) => handleStartTimeChange('hour', h)}
                        width={40}
                        isOpen={true}
                        visibleItems={3}
                    />
                    <Text style={[Fonts.h2, { color: Colors.neutral00 }]}>:</Text>
                    <WheelPicker
                        data={minutes}
                        selectedValue={startTimeDate.getMinutes()}
                        onValueChange={(m) => handleStartTimeChange('minute', m)}
                        width={40}
                        isOpen={true}
                        visibleItems={3}
                    />
                </View>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>Fin</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <WheelPicker
                        data={hours}
                        selectedValue={endTimeDate.getHours()}
                        onValueChange={(h) => handleEndTimeChange('hour', h)}
                        width={40}
                        isOpen={true}
                        visibleItems={3}
                    />
                    <Text style={[Fonts.h2, { color: Colors.neutral00 }]}>:</Text>
                    <WheelPicker
                        data={minutes}
                        selectedValue={endTimeDate.getMinutes()}
                        onValueChange={(m) => handleEndTimeChange('minute', m)}
                        width={40}
                        isOpen={true}
                        visibleItems={3}
                    />
                </View>

            </View>
        </View>

        <View style={{ gap: 12, marginTop: 24 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
                 <Button
                    title="Annuler"
                    onPress={onCancel}
                    variant="Secondary"
                    style={{ flex: 1 }}
                />
                <Button
                    title={initialValues ? "Modifier" : "Ajouter"}
                    onPress={handleAdd}
                    variant="Primary"
                    disabled={!isFormValid}
                    style={{ flex: 1 }}
                />
            </View>

            {initialValues && onDelete && (
                 <Button
                    title="Supprimer ce créneau"
                    onPress={onDelete}
                    variant="Secondary"
                    style={{ borderColor: Colors.error500, borderWidth: 1 }}
                    textStyle={{ color: Colors.error500 }}
                />
            )}
        </View>
    </View>
  );
};

export default TeamSlotCreationForm;
