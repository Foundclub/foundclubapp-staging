import { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import AnimatedTabBarButton from '@/components/atoms/animatedTabBarButton/AnimatedTabBarButton';

const DEFAULT_ACTIVE_COLOR = '#01B3F4';
const DEFAULT_INACTIVE_COLOR = '#9AA8B5';
const INDICATOR_HORIZONTAL_INSET = 2;

/**
 * Apply alpha to a hex color.
 * @param {string} color
 * @param {number} alpha
 * @returns {string}
 */
const withAlpha = (color, alpha) => {
  if (typeof color !== 'string') return `rgba(1, 179, 244, ${alpha})`;

  const normalized = color.trim();
  const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(normalized);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('').map((char) => Number.parseInt(char + char, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const longMatch = /^#([0-9a-fA-F]{6})$/.exec(normalized);
  if (longMatch) {
    const hex = longMatch[1];
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return normalized;
};

/**
 * Resolve a fallback label string for a route.
 * @param {object} options
 * @param {string | undefined} options.tabBarLabel
 * @param {string | undefined} options.title
 * @param {import('@react-navigation/bottom-tabs').BottomTabNavigationRouteProp} route
 * @returns {string}
 */
const getFallbackLabel = (options, route) => {
  if (typeof options.tabBarLabel === 'string') return options.tabBarLabel;
  if (typeof options.title === 'string' && options.title.trim()) return options.title;
  return route.name;
};

/**
 * Render a label node from React Navigation options.
 * @param {object} props
 * @param {object} props.options
 * @param {string} props.color
 * @param {boolean} props.focused
 * @param {import('@react-navigation/bottom-tabs').BottomTabNavigationRouteProp} props.route
 * @returns {import('react').ReactNode}
 */
const renderTabLabel = ({
  color,
  focused,
  options,
  route,
}) => {
  if (options.tabBarShowLabel === false) return null;

  if (typeof options.tabBarLabel === 'function') {
    return options.tabBarLabel({
      children: getFallbackLabel(options, route),
      color,
      focused,
      position: 'below-icon',
    });
  }

  const flattenedLabelStyle = StyleSheet.flatten(options.tabBarLabelStyle) || {};
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[
        styles.fallbackLabel,
        flattenedLabelStyle,
        { color },
      ]}
    >
      {getFallbackLabel(options, route)}
    </Text>
  );
};

/**
 * Floating dock tab bar with a shared moving active indicator.
 * @param {import('@react-navigation/bottom-tabs').BottomTabBarProps} props
 * @returns {import('react').ReactElement | null}
 */
function FloatingAnimatedTabBar({
  descriptors,
  navigation,
  state,
}) {
  const [rowWidth, setRowWidth] = useState(0);
  const progress = useSharedValue(state.index);
  const focusedRoute = state.routes[state.index];
  const focusedOptions = descriptors[focusedRoute.key]?.options || {};
  const flattenedTabBarStyle = StyleSheet.flatten(focusedOptions.tabBarStyle) || {};
  const isHidden = flattenedTabBarStyle.display === 'none';

  useEffect(() => {
    progress.value = withTiming(state.index, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, state.index]);

  const colorRanges = useMemo(() => state.routes.map((route) => {
    const routeOptions = descriptors[route.key]?.options || {};
    const activeColor = routeOptions.tabBarActiveTintColor || DEFAULT_ACTIVE_COLOR;

    return {
      active: activeColor,
      background: withAlpha(activeColor, 0.18),
      border: withAlpha(activeColor, 0.3),
      glow: withAlpha(activeColor, 0.24),
      topAccent: withAlpha(activeColor, 0.92),
    };
  }), [descriptors, state.routes]);

  const inputRange = state.routes.map((_, index) => index);
  const itemWidth = rowWidth > 0 ? rowWidth / Math.max(state.routes.length, 1) : 0;
  const indicatorWidth = Math.max(itemWidth - (INDICATOR_HORIZONTAL_INSET * 2), 0);

  const glowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      inputRange,
      colorRanges.map((item) => item.glow),
    ),
    opacity: rowWidth > 0 ? 1 : 0,
    transform: [
      {
        translateX: interpolate(
          progress.value,
          inputRange,
          inputRange.map((index) => (index * itemWidth) + INDICATOR_HORIZONTAL_INSET),
        ),
      },
      {
        scale: interpolate(progress.value, inputRange, inputRange.map(() => 1)),
      },
    ],
    width: indicatorWidth,
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      inputRange,
      colorRanges.map((item) => item.background),
    ),
    borderColor: interpolateColor(
      progress.value,
      inputRange,
      colorRanges.map((item) => item.border),
    ),
    opacity: rowWidth > 0 ? 1 : 0,
    transform: [{
      translateX: interpolate(
        progress.value,
        inputRange,
        inputRange.map((index) => (index * itemWidth) + INDICATOR_HORIZONTAL_INSET),
      ),
    }],
    width: indicatorWidth,
  }));

  const topAccentStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      inputRange,
      colorRanges.map((item) => item.topAccent),
    ),
  }));

  if (isHidden) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={[styles.container, flattenedTabBarStyle]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {typeof focusedOptions.tabBarBackground === 'function'
          ? focusedOptions.tabBarBackground()
          : null}
      </View>
      <View
        onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
        style={styles.row}
      >
        {rowWidth > 0 ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.sharedGlow,
                glowStyle,
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.sharedIndicator,
                indicatorStyle,
              ]}
            >
              <Animated.View style={[styles.topAccent, topAccentStyle]} />
            </Animated.View>
          </>
        ) : null}

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];
          const activeColor = options.tabBarActiveTintColor || DEFAULT_ACTIVE_COLOR;
          const inactiveColor = options.tabBarInactiveTintColor || DEFAULT_INACTIVE_COLOR;
          const tintColor = isFocused ? activeColor : inactiveColor;
          const flattenedItemStyle = StyleSheet.flatten(options.tabBarItemStyle) || {};
          const flattenedIconStyle = StyleSheet.flatten(options.tabBarIconStyle) || {};
          const accessibilityLabel = options.tabBarAccessibilityLabel
            || getFallbackLabel(options, route);

          /**
           * Handle tab press.
           */
          const handlePress = () => {
            const event = navigation.emit({
              canPreventDefault: true,
              target: route.key,
              type: 'tabPress',
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          /**
           * Handle tab long press.
           */
          const handleLongPress = () => {
            navigation.emit({
              target: route.key,
              type: 'tabLongPress',
            });
          };

          return (
            <View key={route.key} style={styles.item}>
              <AnimatedTabBarButton
                accessibilityLabel={accessibilityLabel}
                accessibilityState={isFocused ? { selected: true } : {}}
                activeBackgroundColor="rgba(0,0,0,0)"
                activeBorderColor="rgba(0,0,0,0)"
                activeColor={activeColor}
                activeGlowColor="rgba(0,0,0,0)"
                contentScaleFocused={1.045}
                contentTranslateYFocused={-2}
                onLongPress={handleLongPress}
                onPress={handlePress}
                showActiveGlow={false}
                showActiveSurface={false}
                showSelectedShadow={false}
                style={[styles.button, flattenedItemStyle]}
                testID={options.tabBarButtonTestID}
              >
                <View style={styles.buttonContent}>
                  {typeof options.tabBarIcon === 'function' ? (
                    <View style={[styles.iconWrap, flattenedIconStyle]}>
                      {options.tabBarIcon({
                        color: tintColor,
                        focused: isFocused,
                        size: 20,
                      })}
                    </View>
                  ) : null}
                  {renderTabLabel({
                    color: tintColor,
                    focused: isFocused,
                    options,
                    route,
                  })}
                </View>
              </AnimatedTabBarButton>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
  },
  buttonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    justifyContent: 'center',
  },
  fallbackLabel: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: {
    flex: 1,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  sharedGlow: {
    borderRadius: 999,
    bottom: 2,
    position: 'absolute',
    top: 2,
  },
  sharedIndicator: {
    borderRadius: 999,
    borderWidth: 1,
    bottom: 2,
    overflow: 'hidden',
    position: 'absolute',
    top: 2,
  },
  topAccent: {
    borderRadius: 999,
    height: 2,
    left: 18,
    opacity: 0.95,
    position: 'absolute',
    right: 18,
    top: 0,
  },
});

export default FloatingAnimatedTabBar;
