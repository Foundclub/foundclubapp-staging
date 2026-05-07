import { Image, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import { getFloatingActionBottomOffset } from '@/navigation/commonOptions';

/**
 * @param {'events' | 'clubs' | 'reservations'} scope
 * @returns {keyof import('../../../theme/types').AllImages}
 */
const getScopeListIcon = (scope) => {
  if (scope === 'clubs') {
    return 'stadium';
  }
  return 'calendar';
};

/**
 * Floating FAB for the map/list toggle aligned with messaging create action.
 * @param {object} props
 * @param {'list' | 'map'} props.mode
 * @param {(event: import('react-native').GestureResponderEvent) => void} props.onPress
 * @param {'events' | 'clubs' | 'reservations'} props.scope
 * @param {boolean} [props.visible]
 * @returns {import('react').ReactElement | null}
 */
function SearchMapFab({
  mode,
  onPress,
  scope,
  visible = true,
}) {
  const {
    ApplicationStyle,
    Colors,
    Images,
  } = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible) {
    return null;
  }

  const listIconKey = getScopeListIcon(scope);
  const mainIconKey = mode === 'map' ? listIconKey : 'pin';
  const secondaryIconKey = mode === 'map' ? 'pin' : listIconKey;
  const bottomOffset = getFloatingActionBottomOffset(insets.bottom, 14);
  const accessibilityLabel = mode === 'map'
    ? 'Revenir à la liste'
    : 'Passer en mode carte';

  return (
    <View
      pointerEvents="box-none"
      style={{
        bottom: bottomOffset,
        position: 'absolute',
        right: 20,
      }}
    >
      <TouchableOpacity
        accessibilityHint="Bascule entre la liste et la carte."
        accessibilityLabel={accessibilityLabel}
        activeOpacity={0.85}
        onPress={onPress}
        style={[
          ApplicationStyle.shadow200,
          {
            alignItems: 'center',
            backgroundColor: Colors.primary500,
            borderColor: 'rgba(255,255,255,0.18)',
            borderRadius: 32,
            borderWidth: 1,
            elevation: 8,
            height: 64,
            justifyContent: 'center',
            shadowColor: 'black',
            shadowOffset: {
              height: 6,
              width: 0,
            },
            shadowOpacity: 0.32,
            shadowRadius: 12,
            width: 64,
          },
        ]}
      >
        <Image
          resizeMode="contain"
          source={Images[mainIconKey]}
          style={{
            height: 24,
            tintColor: Colors.neutral00,
            width: 24,
          }}
        />

        <View
          style={{
            alignItems: 'center',
            backgroundColor: Colors.primary200,
            borderColor: 'rgba(255,255,255,0.36)',
            borderRadius: 999,
            borderWidth: 1,
            height: 20,
            justifyContent: 'center',
            position: 'absolute',
            right: 8,
            top: 8,
            width: 20,
          }}
        >
          <Image
            resizeMode="contain"
            source={Images[secondaryIconKey]}
            style={{
              height: 10,
              tintColor: Colors.primary900,
              width: 10,
            }}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default SearchMapFab;
