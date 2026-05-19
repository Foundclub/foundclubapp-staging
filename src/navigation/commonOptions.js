import { CardStyleInterpolators } from '@react-navigation/stack';
import {
  Platform,
  Text,
} from 'react-native';

import getThemeColors from '@/theme/colors';
import { lineHeights, sizes } from '@/theme/fonts';

import AnimatedTabBarButton from '@/components/atoms/animatedTabBarButton/AnimatedTabBarButton';
import GlassSurface from '@/components/atoms/glassSurface/GlassSurface';
import Header from '@/components/atoms/header/Header';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';

export const commonOptions = {
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  headerBackImage: () => <HeaderBackButton />,
  headerBackTitle: '',
  headerShadowVisible: false,
  headerShown: true,
  headerTitle: () => <Header />,
  headerTitleAlign: /** @type {const} */ ('center'),
  headerTitleStyle: {
    fontFamily: 'Montserrat-Bold',
    fontSize: sizes.p1Size,
    lineHeight: lineHeights.p1Height,
    maxWidth: 211,
  },
  headerTransparent: true,
  title: '',
};

/**
 * Get label color.
 * @param {'light' | 'dark'} labelScheme - The label scheme.
 * @param {boolean} focused - The focused state.
 * @returns {string} The label color.
 */
const getLabelColor = (labelScheme, focused) => {
  const colors = getThemeColors();
  if (focused) {
    return colors.neutral00;
  }
  return labelScheme === 'light' ? colors.neutral00 : colors.neutral500;
};

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

const MOBILE_FLOATING_TAB_BAR_BASE_BOTTOM_OFFSET = 10;
const MOBILE_FLOATING_TAB_BAR_BOTTOM_GAP = 6;
const MOBILE_FLOATING_TAB_BAR_HORIZONTAL_INSET = 16;
const MOBILE_FLOATING_TAB_BAR_VERTICAL_PADDING = 10;
const MOBILE_FLOATING_TAB_BAR_HEIGHT = 82;
const WEB_FLOATING_DOCK_CLEARANCE = 112;
const WEB_FLOATING_ACTION_SIDE_OFFSET = 32;

/**
 * Resolve floating tab bar layout metrics.
 * @param {number} [bottomInset]
 * @returns {{
 *   bottomOffset: number,
 *   clearance: number,
 *   contentHeight: number,
 *   height: number,
 *   horizontalInset: number,
 *   safeBottom: number,
 *   topPadding: number,
 * }}
 */
export const getFloatingTabBarMetrics = (bottomInset = 0) => {
  const bottomOffset = Math.max(bottomInset, MOBILE_FLOATING_TAB_BAR_BASE_BOTTOM_OFFSET)
    + MOBILE_FLOATING_TAB_BAR_BOTTOM_GAP;

  return {
    bottomOffset,
    clearance: bottomOffset + MOBILE_FLOATING_TAB_BAR_HEIGHT,
    contentHeight: MOBILE_FLOATING_TAB_BAR_HEIGHT - (MOBILE_FLOATING_TAB_BAR_VERTICAL_PADDING * 2),
    height: MOBILE_FLOATING_TAB_BAR_HEIGHT,
    horizontalInset: MOBILE_FLOATING_TAB_BAR_HORIZONTAL_INSET,
    safeBottom: MOBILE_FLOATING_TAB_BAR_VERTICAL_PADDING,
    topPadding: MOBILE_FLOATING_TAB_BAR_VERTICAL_PADDING,
  };
};

/**
 * Resolve the bottom padding required to keep scroll content above the floating dock.
 * @param {number} [bottomInset]
 * @param {number} [extra]
 * @returns {number}
 */
export const getFloatingTabBarScenePaddingBottom = (bottomInset = 0, extra = 12) => (
  Platform.OS === 'web'
    ? WEB_FLOATING_DOCK_CLEARANCE + Math.max(bottomInset, 0) + extra
    : getFloatingTabBarMetrics(bottomInset).clearance + extra
);

/**
 * Resolve the vertical offset for floating CTAs shown above the dock.
 * @param {number} [bottomInset]
 * @param {number} [extra]
 * @returns {number}
 */
export const getFloatingActionBottomOffset = (bottomInset = 0, extra = 14) => (
  Platform.OS === 'web'
    ? WEB_FLOATING_DOCK_CLEARANCE + Math.max(bottomInset, 0) + extra
    : getFloatingTabBarMetrics(bottomInset).clearance + extra
);

/**
 * Resolve a stable floating action container position across platforms.
 * On web, the CTA is fixed to the viewport so it keeps the same placement while scrolling.
 * @param {number} bottomOffset
 * @param {{ right?: number, webRight?: number, zIndex?: number }} [options]
 * @returns {import('react-native').ViewStyle}
 */
export const getFloatingActionContainerStyle = (
  bottomOffset,
  {
    right = 20,
    webRight = WEB_FLOATING_ACTION_SIDE_OFFSET,
    zIndex = 1000,
  } = {},
) => (
  Platform.OS === 'web'
    ? {
      bottom: bottomOffset,
      position: 'fixed',
      right: webRight,
      zIndex,
    }
    : {
      bottom: bottomOffset,
      position: 'absolute',
      right,
      zIndex,
    }
);

/**
 * Get tab screen common options.
 * @param {object} props - The props of the component.
 * @param {string} [props.accessibilityLabel] - The accessibility label of the tab.
 * @param {string} props.label - The label of the tab.
 * @param {string} [props.visualLabel] - The compact visual label shown in the dock.
 * @param {string} props.activeColor - The active color of the tab.
 * @param {import('react-native').ImageSourcePropType} [props.icon] - The icon of the tab.
 * @param {Function} [props.renderTabBarIcon] - The render tab bar icon function.
 * @param {number} [props.badge] - The badge of the tab.
 * @param {'light' | 'dark'} [props.labelScheme] - The color scheme of the label.
 * @param {number} [props.bottomInset] - The bottom inset to account for safe area.
 * @returns {import('@react-navigation/bottom-tabs').BottomTabNavigationOptions}
 */
export const getTabScreenCommonOptions = ({
  accessibilityLabel = undefined,
  activeColor,
  badge,
  bottomInset = 0,
  icon = undefined,
  label,
  labelScheme = 'light',
  renderTabBarIcon = undefined,
  visualLabel = undefined,
}) => {
  const isWeb = Platform.OS === 'web';
  const colors = getThemeColors();
  const resolvedActiveColor = activeColor || colors.primary500;
  const inactiveLabelColor = getLabelColor(labelScheme, false);
  const mobileMetrics = getFloatingTabBarMetrics(bottomInset);
  const tabBarPaddingTop = isWeb ? 10 : mobileMetrics.topPadding;
  const tabBarPaddingBottom = isWeb ? Math.max(bottomInset, 14) : mobileMetrics.safeBottom;
  const tabBarHeight = isWeb
    ? 80 + tabBarPaddingTop + tabBarPaddingBottom
    : mobileMetrics.height;

  return ({
    tabBarAccessibilityLabel: accessibilityLabel || label,
    tabBarActiveTintColor: resolvedActiveColor,
    tabBarBackground: isWeb
      ? undefined
      : () => (
        <GlassSurface
          blurAmount={18}
          borderColor={withAlpha(colors.primary500, 0.18)}
          borderRadius={999}
          fallbackColor="rgba(9, 24, 35, 0.92)"
          style={{ flex: 1 }}
          tintColor="rgba(9, 24, 35, 0.62)"
          topHighlightColor="rgba(255,255,255,0.05)"
          topHighlightHeight={1}
        />
      ),
    tabBarButton: isWeb
      ? undefined
      : ({
        accessibilityLabel: tabAccessibilityLabel,
        accessibilityState,
        children,
        onLongPress,
        onPress,
        style,
        testID,
      }) => (
        <AnimatedTabBarButton
          accessibilityLabel={tabAccessibilityLabel}
          accessibilityState={accessibilityState}
          activeBackgroundColor={withAlpha(resolvedActiveColor, 0.16)}
          activeBorderColor={withAlpha(resolvedActiveColor, 0.28)}
          activeColor={resolvedActiveColor}
          activeGlowColor={withAlpha(resolvedActiveColor, 0.22)}
          contentMinHeight={isWeb ? undefined : mobileMetrics.contentHeight}
          isWeb={isWeb}
          onLongPress={onLongPress}
          onPress={onPress}
          style={style}
          testID={testID}
        >
          {children}
        </AnimatedTabBarButton>
      ),
    tabBarHideOnKeyboard: !isWeb,
    tabBarIcon: icon && renderTabBarIcon
      /**
       * Render tab bar icon.
       * @param {object} props - Component props.
       * @param {string} props.color - Icon color.
       * @returns {React.ReactElement} TabBarIcon component.
       */
      ? ({ color }) => renderTabBarIcon({
        badge,
        badgeColor: activeColor,
        color,
        focused: color === resolvedActiveColor,
        label,
        source: icon,
      }) : undefined,
    tabBarIconStyle: {
      display: icon ? 'flex' : 'none',
      marginBottom: isWeb ? 2 : 4,
      marginTop: 0,
    },
    tabBarInactiveTintColor: inactiveLabelColor,
    tabBarItemStyle: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: isWeb ? 'visible' : 'hidden',
      paddingBottom: 0,
      paddingTop: 0,
    },
    tabBarLabel: ({ focused }) => (
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={{
          color: focused ? resolvedActiveColor : inactiveLabelColor,
          fontFamily: 'Montserrat-Bold',
          fontSize: isWeb ? sizes.captionSize : sizes.p4Size,
          includeFontPadding: false,
          letterSpacing: isWeb ? 0.15 : 0.1,
          lineHeight: isWeb ? lineHeights.captionHeight : lineHeights.p4Height,
          maxWidth: '100%',
          opacity: focused ? 1 : 0.88,
          paddingHorizontal: isWeb ? 2 : 4,
          textAlign: 'center',
        }}
      >
        {visualLabel || label}
      </Text>
    ),
    tabBarLabelStyle: {
      fontFamily: 'Montserrat-Bold',
      fontSize: isWeb ? sizes.captionSize : sizes.p4Size,
      lineHeight: isWeb ? lineHeights.captionHeight : lineHeights.p4Height,
    },
    tabBarStyle: {
      backgroundColor: isWeb ? colors.primary700 : 'transparent',
      borderColor: isWeb ? colors.primary900 : 'transparent',
      borderRadius: isWeb ? 0 : 999,
      borderTopColor: isWeb ? colors.primary900 : 'transparent',
      borderTopWidth: isWeb ? 1 : 0,
      borderWidth: isWeb ? 0 : 1,
      bottom: isWeb ? 0 : mobileMetrics.bottomOffset,
      elevation: isWeb ? 0 : 14,
      height: tabBarHeight,
      left: isWeb ? 0 : mobileMetrics.horizontalInset,
      marginBottom: 0,
      overflow: isWeb ? 'visible' : 'hidden',
      paddingBottom: tabBarPaddingBottom,
      paddingHorizontal: isWeb ? 0 : 8,
      paddingTop: tabBarPaddingTop,
      position: isWeb ? 'relative' : 'absolute',
      right: isWeb ? 0 : mobileMetrics.horizontalInset,
      ...(isWeb
        ? {}
        : {
          shadowColor: '#06101A',
          shadowOffset: { height: 12, width: 0 },
          shadowOpacity: 0.32,
          shadowRadius: 24,
        }),
    },
  });
};
