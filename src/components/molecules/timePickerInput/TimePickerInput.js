import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import useTheme from '@/theme/themeContext';

/**
 * TimePickerInput - A time input component with native iOS picker
 * @param {Object} props
 * @param {string} props.label - Input label
 * @param {string} props.value - Time value in HH:mm format
 * @param {function} props.onChange - Callback when time changes
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.error] - Error message
 */
const TimePickerInput = ({ label, value, onChange, placeholder = 'HH:mm', error }) => {
  const { Colors, Fonts, Spaces, ApplicationStyle, Alignments } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  // Parse the value to a Date object for the picker
  const getDateFromValue = () => {
    if (value) {
      const [hours, minutes] = value.split(':').map(Number);
      const date = new Date();
      date.setHours(hours || 0, minutes || 0, 0, 0);
      return date;
    }
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now;
  };

  // Format the time from Date to HH:mm string
  const formatTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      onChange(formatTime(selectedDate));
    }
  };

  const handleConfirm = () => {
    setShowPicker(false);
  };

  const displayValue = value || placeholder;

  return (
    <View style={[Spaces.gap[4]]}>
      {label && (
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {label}
        </Text>
      )}
      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        style={[
          ApplicationStyle.borderRadius12,
          ApplicationStyle.backgroundColor.primary700,
          Spaces.padding[16],
          error && { borderWidth: 1, borderColor: Colors.error500 },
        ]}
      >
        <Text style={[
          Fonts.p1,
          value ? Fonts.neutral00 : { color: Colors.neutral300 }
        ]}>
          {displayValue}
        </Text>
      </TouchableOpacity>

      {error && (
        <Text style={[Fonts.p3, { color: Colors.error500 }]}>
          {error}
        </Text>
      )}

      {/* iOS: Show modal with picker */}
      {Platform.OS === 'ios' && showPicker && (
        <Modal
          transparent
          animationType="slide"
          visible={showPicker}
          onRequestClose={() => setShowPicker(false)}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
            activeOpacity={1}
            onPress={() => setShowPicker(false)}
          >
            <View style={{ flex: 1 }} />
            <View style={{
              backgroundColor: Colors.primary700,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 34,
            }}>
              {/* Header with Done button */}
              <View style={[
                Alignments.row,
                Alignments.justifySpaceBetween,
                Spaces.paddingHorizontal[16],
                Spaces.paddingVertical[12],
                { borderBottomWidth: 1, borderBottomColor: Colors.neutral100 }
              ]}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>Annuler</Text>
                </TouchableOpacity>
                <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{label}</Text>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>OK</Text>
                </TouchableOpacity>
              </View>
              
              <DateTimePicker
                value={getDateFromValue()}
                mode="time"
                display="spinner"
                onChange={handleChange}
                textColor={Colors.neutral00}
                locale="fr-FR"
                minuteInterval={5}
                style={{ height: 200 }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Android: Show inline picker */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={getDateFromValue()}
          mode="time"
          display="spinner"
          onChange={handleChange}
          is24Hour={true}
        />
      )}
    </View>
  );
};

export default TimePickerInput;
