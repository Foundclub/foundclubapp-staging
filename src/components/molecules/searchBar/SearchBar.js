import { useState } from 'react';
import { Image, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

// Import des icônes PNG
const searchIcon = require('@/assets/icons/search.png');
const calendarIcon = require('@/assets/icons/calendar-days.png');
const filterIcon = require('@/assets/icons/filter.png');

/**
 * SearchBar component - PIXEL-PERFECT Figma design
 * @param {object} props
 * @param {string} props.value - Current search value
 * @param {Function} props.onChangeText - Callback when text changes
 * @param {string} props.placeholder - Placeholder text
 * @param {Function} props.onCalendarPress - Callback when calendar button is pressed
 * @param {Function} props.onFilterPress - Callback when filter button is pressed
 * @returns {import('react').ReactElement}
 */
function SearchBar({
  value,
  onChangeText,
  placeholder = 'Rechercher',
  onCalendarPress,
  onFilterPress,
  withCalendar = true,
  withFilter = true,
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, !withCalendar && !withFilter && { width: '100%' }]}>
      {/* Input avec icône de recherche */}
      <View style={[styles.inputContainer, (!withCalendar && !withFilter) && { width: '100%' }]}>
        {/* Icône de recherche (loupe PNG) */}
        <Image
          source={searchIcon}
          style={styles.searchIcon}
        />

        {/* Input de recherche */}
        <TextInput
          onBlur={() => setIsFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          placeholder={placeholder}
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          style={styles.input}
          value={value}
        />
      </View>

      {/* Bouton Calendrier */}
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

      {/* Bouton Filtres */}
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
          {/* Notification badge (hidden par défaut) */}
          <View style={styles.notificationBadge} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Container principal - Frame 17458
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    // Width can be overridden or handled by flex
    width: '100%', 
    height: 48,
  },
  // Input container
  inputContainer: {
    position: 'relative',
    flex: 1, // Changed from fixed width 231
    height: 48,
    borderBottomWidth: 1.5,
    borderBottomColor: '#FFFFFF',
    borderRadius: 2,
  },
  // Icône de recherche (loupe PNG)
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 12,
    width: 24,
    height: 24,
    tintColor: '#FFFFFF',
    zIndex: 1,
  },
  // Image icône calendrier (blanc)
  iconImage: {
    width: 16,
    height: 16,
    tintColor: '#FFFFFF',
  },
  // Image icône filtres (bleu)
  iconImageBlue: {
    width: 16,
    height: 16,
    tintColor: '#01B3F4',
  },
  // Input de texte
  input: {
    position: 'absolute',
    left: 56,
    top: 12.5,
    right: 0, // Changed width 133 to right 0 for full width
    height: 23,
    fontFamily: 'Montserrat-Regular',
    fontSize: 16,
    lineHeight: 23,
    color: '#FFFFFF',
    padding: 0,
  },
  // Bouton icône (calendrier et filtres)
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  // Bouton filtres (avec bordure bleue)
  filterButton: {
    borderColor: '#01B3F4',
    position: 'relative',
  },
  // Badge de notification (caché par défaut)
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: -2,
    width: 14,
    height: 15,
    backgroundColor: '#01B3F4',
    borderRadius: 16,
    display: 'none', // Hidden par défaut comme dans Figma
  },
});

export default SearchBar;

