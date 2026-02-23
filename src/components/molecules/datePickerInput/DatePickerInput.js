import DateTimePicker from '@react-native-community/datetimepicker';
import { format, isValid, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useState } from 'react';
import {
  Modal, Platform, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * DatePickerInput - A date input component with native iOS picker
 * @param {object} props
 * @param {string} props.label - Input label
 * @param {string} props.value - Date value in DD/MM/YYYY format
 * @param {Function} props.onChange - Callback when date changes
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.error] - Error message
 * @param {Date} [props.minimumDate] - Minimum selectable date
 * @param {Date} [props.maximumDate] - Maximum selectable date
 */
function DatePickerInput({
  error,
  label,
  maximumDate,
  minimumDate,
  onChange,
  placeholder = 'JJ/MM/AAAA',
  value,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  // Parse the value (DD/MM/YYYY) to a Date object for the picker
  const getDateFromValue = () => {
    if (value) {
      const parsed = parse(value, 'dd/MM/yyyy', new Date());
      if (isValid(parsed)) {
        return parsed;
      }
    }
    return new Date();
  };

  // Format the date from Date to DD/MM/YYYY string
  const formatDate = (date) => format(date, 'dd/MM/yyyy');

  // Format for display (more readable)
  const formatDisplayDate = (date) => format(date, 'EEEE d MMMM yyyy', { locale: fr });

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      onChange(formatDate(selectedDate));
    }
  };

  const handleConfirm = () => {
    setShowPicker(false);
  };

  // Display formatted date or placeholder
  const getDisplayValue = () => {
    if (value) {
      const parsed = parse(value, 'dd/MM/yyyy', new Date());
      if (isValid(parsed)) {
        return formatDisplayDate(parsed);
      }
      return value;
    }
    return placeholder;
  };

  return (
    <View style={[Spaces.gap[4], { zIndex: 1 }]}>
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
          error && { borderColor: Colors.error500, borderWidth: 1 },
        ]}
      >
        <Text style={[
          Fonts.p1,
          value ? Fonts.neutral00 : { color: Colors.neutral300 },
        ]}
        >
          {getDisplayValue()}
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
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}
          transparent
          visible={showPicker}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowPicker(false)}
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', flex: 1 }}
          >
            <View style={{ flex: 1 }} />
            <View style={{
              backgroundColor: Colors.primary700,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 34,
            }}
            >
              {/* Header with Done button */}
              <View style={[
                Alignments.row,
                Alignments.justifySpaceBetween,
                Spaces.paddingHorizontal[16],
                Spaces.paddingVertical[12],
                { borderBottomColor: Colors.neutral100, borderBottomWidth: 1 },
              ]}
              >
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>Annuler</Text>
                </TouchableOpacity>
                <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{label}</Text>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>OK</Text>
                </TouchableOpacity>
              </View>

              <DateTimePicker
                display="spinner"
                locale="fr-FR"
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                mode="date"
                onChange={handleChange}
                style={{ height: 200 }}
                textColor={Colors.neutral00}
                value={getDateFromValue()}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Android: Show inline picker */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          display="default"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          mode="date"
          onChange={handleChange}
          value={getDateFromValue()}
        />
      )}
    </View>
  );
}

export default DatePickerInput;
