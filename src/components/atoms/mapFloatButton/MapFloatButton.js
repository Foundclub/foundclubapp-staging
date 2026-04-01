import { useTranslation } from 'react-i18next';
import {
  Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import { getFloatingActionBottomOffset } from '@/navigation/commonOptions';

/**
 * Floating button to toggle between Map and List views
 * @param {object} props
 * @param {boolean} props.isMapView - Whether the current view is Map
 * @param {Function} props.onPress - Handler for button press
 * @param {'event' | 'club'} [props.type] - Type of content (affects List icon)
 * @returns {import('react').ReactElement}
 */
function MapFloatButton({ isMapView, onPress, type = 'event' }) {
  const {
    ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const listIcon = type === 'club' ? Images.stadium : Images.calendar;
  const icon = isMapView ? listIcon : Images.pin;
  const label = isMapView ? t('common.list', 'Liste') : t('common.map', 'Carte');
  const bottomOffset = getFloatingActionBottomOffset(insets.bottom, 12);

  return (
    <View pointerEvents="box-none" style={[styles.container, { bottom: bottomOffset }]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        style={[
          styles.button,
          { backgroundColor: Colors.primary500 }, // Primary Blue
          ApplicationStyle.shadow200, // Shadow
        ]}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.primary900, marginRight: 8 }]}>
          {label}
        </Text>
        <Image
          resizeMode="contain"
          source={icon}
          style={{ height: 16, tintColor: Colors.primary900, width: 16 }}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 30,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 100,
  },
});

export default MapFloatButton;
