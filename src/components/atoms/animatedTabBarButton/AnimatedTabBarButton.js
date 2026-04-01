import { useEffect } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Animated floating tab bar button with a subtle glow and lift on selection.
 * @param {object} props
 * @param {string} [props.accessibilityLabel]
 * @param {import('react-native').AccessibilityState} [props.accessibilityState]
 * @param {string} props.activeBackgroundColor
 * @param {string} props.activeBorderColor
 * @param {string} props.activeGlowColor
 * @param {string} props.activeColor
 * @param {import('react').ReactNode} [props.children]
 * @param {number} [props.contentMinHeight]
 * @param {boolean} [props.isWeb]
 * @param {() => void} [props.onLongPress]
 * @param {() => void} [props.onPress]
 * @param {number} [props.contentScaleFocused]
 * @param {number} [props.contentTranslateYFocused]
 * @param {boolean} [props.showActiveGlow]
 * @param {boolean} [props.showActiveSurface]
 * @param {boolean} [props.showSelectedShadow]
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * @param {string} [props.testID]
 * @returns {import('react').ReactElement}
 */
function AnimatedTabBarButton({
  accessibilityLabel,
  accessibilityState,
  activeBackgroundColor,
  activeBorderColor,
  activeColor,
  activeGlowColor,
  children,
  contentMinHeight,
  contentScaleFocused = 1.03,
  contentTranslateYFocused = -1.5,
  isWeb = Platform.OS === 'web',
  onLongPress,
  onPress,
  showActiveGlow = true,
  showActiveSurface = true,
  showSelectedShadow = true,
  style,
  testID,
}) {
  const isSelected = Boolean(accessibilityState?.selected);
  const progress = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isSelected ? 1 : 0, {
      duration: isSelected ? 280 : 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [isSelected, progress]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: showActiveGlow
      ? interpolate(progress.value, [0, 1], [0, isWeb ? 0.16 : 0.22])
      : 0,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.9, 1.08]) }],
  }));

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(0,0,0,0)', showActiveSurface ? activeBackgroundColor : 'rgba(0,0,0,0)'],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(0,0,0,0)', showActiveSurface ? activeBorderColor : 'rgba(0,0,0,0)'],
    ),
    opacity: showActiveSurface ? interpolate(progress.value, [0, 1], [0, 1]) : 0,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.94, 1]) }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, contentScaleFocused]) },
      { translateY: interpolate(progress.value, [0, 1], [0, contentTranslateYFocused]) },
    ],
  }));

  let selectedShadowStyle = null;
  if (isSelected && showSelectedShadow) {
    selectedShadowStyle = isWeb
      ? { boxShadow: `0 8px 14px ${activeGlowColor}` }
      : {
        shadowColor: activeColor,
        shadowOffset: { height: 8, width: 0 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
      };
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        {
          alignItems: 'center',
          borderRadius: 999,
          flex: 1,
          justifyContent: 'center',
          marginHorizontal: isWeb ? 4 : 2,
          marginVertical: isWeb ? 4 : 4,
          minHeight: contentMinHeight,
          overflow: 'hidden',
          paddingBottom: 0,
          paddingTop: 0,
        },
        selectedShadowStyle,
        pressed ? { opacity: 0.94, transform: [{ scale: 0.985 }] } : null,
      ]}
      testID={testID}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          styles.glow,
          { backgroundColor: activeGlowColor },
          glowStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          styles.surface,
          surfaceStyle,
        ]}
      />
      <Animated.View style={[styles.content, contentStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    borderRadius: 999,
  },
  surface: {
    borderRadius: 999,
    borderWidth: 1,
  },
});

export default AnimatedTabBarButton;
