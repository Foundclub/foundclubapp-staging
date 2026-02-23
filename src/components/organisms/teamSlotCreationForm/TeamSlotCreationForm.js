import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation, Platform, Text, UIManager, View,
} from 'react-native';

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
 * @param {{ day?: string, startTime?: string, endTime?: string } | null} [props.initialValues]
 * @param {() => void} [props.onDelete]
 * @param {(draft: { isValid: boolean, slot: { day: string, startTime: string, endTime: string } | null }) => void} [props.onDraftChange]
 */
function TeamSlotCreationForm({
  initialValues, onAdd, onCancel, onDelete, onDraftChange,
}) {
  const { Colors, Fonts } = useTheme();

  const [selectedDay, setSelectedDay] = useState(() => {
    if (initialValues?.day) {
      return DAYS.find((d) => d.value === initialValues.day) || null;
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

  /**
   * @param {Date} date
   * @returns {string}
   */
  const formatTime = (date) => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  /**
   * @param {'hour' | 'minute'} type
   * @param {number} value
   */
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

  /**
   * @param {'hour' | 'minute'} type
   * @param {number} value
   */
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
      endTime: formatTime(endTimeDate),
      startTime: formatTime(startTimeDate),
    });
  };

  const isFormValid = useMemo(() => selectedDay && startTimeDate && endTimeDate && endTimeDate > startTimeDate, [selectedDay, startTimeDate, endTimeDate]);

  useEffect(() => {
    if (!onDraftChange) return;
    const selectedDayValue = selectedDay?.value;
    onDraftChange({
      isValid: Boolean(isFormValid),
      slot: isFormValid && selectedDayValue
        ? {
          day: selectedDayValue,
          endTime: formatTime(endTimeDate),
          startTime: formatTime(startTimeDate),
        }
        : null,
    });
  }, [onDraftChange, isFormValid, selectedDay, startTimeDate, endTimeDate]);

  return (
    <View style={{
      backgroundColor: Colors.neutral800,
      borderColor: Colors.neutral700,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingTop: 40, // Increased padding top for modal header
      paddingVertical: 16,
    }}
    >
      <View style={{ marginBottom: 16 }}>
        <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>Jour</Text>
        <AutocompleteSelect
          isSearchable={false}
          options={DAYS}
          placeholder="Sélectionner un jour"
          setValue={setSelectedDay}
          value={selectedDay?.label || ''}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>Début</Text>
          <View style={{ alignItems: 'center', flexDirection: 'row' }}>
            <WheelPicker
              data={hours}
              isOpen
              onValueChange={(h) => handleStartTimeChange('hour', h)}
              selectedValue={startTimeDate.getHours()}
              visibleItems={3}
              width={40}
            />
            <Text style={[Fonts.h2, { color: Colors.neutral00 }]}>:</Text>
            <WheelPicker
              data={minutes}
              isOpen
              onValueChange={(m) => handleStartTimeChange('minute', m)}
              selectedValue={startTimeDate.getMinutes()}
              visibleItems={3}
              width={40}
            />
          </View>
        </View>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>Fin</Text>
          <View style={{ alignItems: 'center', flexDirection: 'row' }}>
            <WheelPicker
              data={hours}
              isOpen
              onValueChange={(h) => handleEndTimeChange('hour', h)}
              selectedValue={endTimeDate.getHours()}
              visibleItems={3}
              width={40}
            />
            <Text style={[Fonts.h2, { color: Colors.neutral00 }]}>:</Text>
            <WheelPicker
              data={minutes}
              isOpen
              onValueChange={(m) => handleEndTimeChange('minute', m)}
              selectedValue={endTimeDate.getMinutes()}
              visibleItems={3}
              width={40}
            />
          </View>

        </View>
      </View>

      <View style={{ gap: 12, marginTop: 24 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button
            onPress={onCancel}
            style={{ flex: 1 }}
            title="Annuler"
            variant="Secondary"
          />
          <Button
            disabled={!isFormValid}
            onPress={handleAdd}
            style={{ flex: 1 }}
            title={initialValues ? 'Modifier' : 'Ajouter'}
            variant="Primary"
          />
        </View>

        {initialValues && onDelete && (
          <Button
            onPress={onDelete}
            style={{ borderColor: Colors.error500, borderWidth: 1 }}
            textStyle={{ color: Colors.error500 }}
            title="Supprimer ce créneau"
            variant="Secondary"
          />
        )}
      </View>
    </View>
  );
}

export default TeamSlotCreationForm;
