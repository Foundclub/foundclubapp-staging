import DateTimePicker from '@react-native-community/datetimepicker';
import { format, isValid, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal, Platform, Text, TouchableOpacity, View,
} from 'react-native';

import localeDesFormats from '@/theme/strings/localeDesFormats';
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
  placeholder = undefined,
  value,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
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

  // FINITIONS16 · POINT 3 (T15) — le champ du navigateur parle AAAA-MM-JJ, en date LOCALE
  // (`format`, jamais `toISOString` : minuit a Paris est la veille en UTC).
  const formatInputDate = (/** @type {Date} */ date) => format(date, 'yyyy-MM-dd');
  const handleWebChange = (/** @type {{ currentTarget?: { value?: string } }} */ event) => {
    const saisie = event?.currentTarget?.value || '';
    if (!saisie) {
      onChange('');
      return;
    }
    const parsed = parse(saisie, 'yyyy-MM-dd', new Date());
    if (isValid(parsed)) {
      onChange(formatDate(parsed));
    }
  };
  const getWebInputValue = () => {
    const parsed = value ? parse(value, 'dd/MM/yyyy', new Date()) : null;
    return parsed && isValid(parsed) ? formatInputDate(parsed) : '';
  };

  // Format for display (more readable)
  const formatDisplayDate = (date) => format(date, 'EEEE d MMMM yyyy', { locale: fr });

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    // T19 (08/10) — Android rappelle onChange a la fermeture (« Annuler ») avec
    // { type: 'dismissed' } et la valeur d'origine : annuler ne doit rien ecrire.
    if (event?.type === 'dismissed') return;
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
      {/* FINITIONS16 · POINT 3 (T15) — SUR LE SITE, LE CHAMP DE DATE DU NAVIGATEUR. Le
          calendrier ne se montait que sur iOS et Android : l'appui n'ouvrait rien, et « Fermer
          une installation » comme « Demander un creneau » etaient impossibles depuis un
          ordinateur. Meme boite, meme valeur JJ/MM/AAAA rendue aux ecrans ; la police vient du
          site (`input { font: inherit }`, web/src/index.css). */}
      {Platform.OS === 'web' ? (
        <View style={[
          ApplicationStyle.borderRadius12,
          ApplicationStyle.backgroundColor.primary700,
          Spaces.padding[16],
          error && { borderColor: Colors.error500, borderWidth: 1 },
        ]}
        >
          <input
            aria-label={label || placeholder}
            max={maximumDate ? formatInputDate(maximumDate) : undefined}
            min={minimumDate ? formatInputDate(minimumDate) : undefined}
            onChange={handleWebChange}
            style={{
              background: 'transparent',
              border: 0,
              color: Colors.neutral00,
              colorScheme: 'dark',
              fontSize: 16,
              outline: 'none',
              padding: 0,
              width: '100%',
            }}
            type="date"
            value={getWebInputValue()}
          />
        </View>
      ) : (
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
      )}

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
                  <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>
                    {t('datePickerInput.cancel', 'Annuler')}
                  </Text>
                </TouchableOpacity>
                <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{label}</Text>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={[Fonts.p1Bold, { color: Colors.primary500 }]}>OK</Text>
                </TouchableOpacity>
              </View>

              <DateTimePicker
                display="spinner"
                locale={localeDesFormats()}
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
