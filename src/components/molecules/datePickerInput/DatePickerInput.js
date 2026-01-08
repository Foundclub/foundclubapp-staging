import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parse, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import useTheme from '@/theme/themeContext';

/**
 * DatePickerInput - A date input component with native iOS picker
 * @param {Object} props
 * @param {string} props.label - Input label
 * @param {string} props.value - Date value in DD/MM/YYYY format
 * @param {function} props.onChange - Callback when date changes
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.error] - Error message
 * @param {Date} [props.minimumDate] - Minimum selectable date
 * @param {Date} [props.maximumDate] - Maximum selectable date
 */
const DatePickerInput = ({ 
  label, 
  value, 
  onChange, 
  placeholder = 'JJ/MM/AAAA', 
  error,
  minimumDate,
  maximumDate,
}) => {
  const { Colors, Fonts, Spaces, ApplicationStyle, Alignments } = useTheme();
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
  const formatDate = (date) => {
    return format(date, 'dd/MM/yyyy');
  };

  // Format for display (more readable)
  const formatDisplayDate = (date) => {
    return format(date, 'EEEE d MMMM yyyy', { locale: fr });
  };

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
                mode="date"
                display="spinner"
                onChange={handleChange}
                textColor={Colors.neutral00}
                locale="fr-FR"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
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
          mode="date"
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
};

export default DatePickerInput;
