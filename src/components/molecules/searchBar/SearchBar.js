import { useMemo, useState } from 'react';
import {
  Image, StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import calendarIcon from '@/assets/icons/calendar-days.png';
import filterIcon from '@/assets/icons/filter.png';
import searchIcon from '@/assets/icons/search.png';

/**
 * SearchBar component - themed version.
 * @param {object} props
 * @param {string} props.value
 * @param {(text: string) => void} props.onChangeText
 * @param {string} [props.placeholder]
 * @param {() => void} [props.onCalendarPress]
 * @param {() => void} [props.onFilterPress]
 * @param {boolean} [props.withCalendar]
 * @param {boolean} [props.withFilter]
 * @returns {import('react').ReactElement}
 */
function SearchBar({
  onCalendarPress,
  onChangeText,
  onFilterPress,
  placeholder = 'Rechercher',
  value,
  withCalendar = true,
  withFilter = true,
}) {
  const { Colors, Fonts } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: 8,
      height: 48,
      width: '100%',
    },
    filterButton: {
      borderColor: Colors.primary500,
      position: 'relative',
    },
    iconButton: {
      alignItems: 'center',
      backgroundColor: Colors.transparent,
      borderColor: Colors.neutral00,
      borderRadius: 24,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    iconImage: {
      height: 16,
      tintColor: Colors.neutral00,
      width: 16,
    },
    iconImageBlue: {
      height: 16,
      tintColor: Colors.primary500,
      width: 16,
    },
    input: {
      ...Fonts.p1,
      color: Colors.neutral00,
      height: 23,
      left: 56,
      padding: 0,
      position: 'absolute',
      right: 0,
      top: 12.5,
    },
    inputContainer: {
      borderBottomColor: isFocused ? Colors.primary500 : Colors.neutral00,
      borderBottomWidth: 1.5,
      borderRadius: 2,
      flex: 1,
      height: 48,
      position: 'relative',
    },
    notificationBadge: {
      backgroundColor: Colors.primary500,
      borderRadius: 16,
      display: 'none',
      height: 15,
      position: 'absolute',
      right: -2,
      top: 0,
      width: 14,
    },
    searchIcon: {
      height: 24,
      left: 16,
      position: 'absolute',
      tintColor: Colors.neutral00,
      top: 12,
      width: 24,
      zIndex: 1,
    },
  }), [Colors, Fonts.p1, isFocused]);

  return (
    <View style={[styles.container, !withCalendar && !withFilter && { width: '100%' }]}>
      <View style={[styles.inputContainer, !withCalendar && !withFilter && { width: '100%' }]}>
        <Image
          source={searchIcon}
          style={styles.searchIcon}
        />
        <TextInput
          onBlur={() => setIsFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          placeholderTextColor={Colors.neutral500}
          style={styles.input}
          value={value}
        />
      </View>

      {withCalendar && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onCalendarPress}
          style={styles.iconButton}
        >
          <Image
            source={calendarIcon}
            style={styles.iconImage}
          />
        </TouchableOpacity>
      )}

      {withFilter && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onFilterPress}
          style={[styles.iconButton, styles.filterButton]}
        >
          <Image
            source={filterIcon}
            style={styles.iconImageBlue}
          />
          <View style={styles.notificationBadge} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default SearchBar;
