import { CardStyleInterpolators } from '@react-navigation/stack';

import getThemeColors from '@/theme/colors';
import { lineHeights, sizes } from '@/theme/fonts';

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
 * Get tab screen common options.
 * @param {object} props - The props of the component.
 * @param {string} props.label - The label of the tab.
 * @param {string} props.activeColor - The active color of the tab.
 * @param {import('react-native').ImageSourcePropType} [props.icon] - The icon of the tab.
 * @param {Function} [props.renderTabBarIcon] - The render tab bar icon function.
 * @param {number} [props.badge] - The badge of the tab.
 * @param {'light' | 'dark'} [props.labelScheme] - The color scheme of the label.
 * @returns {import('@react-navigation/bottom-tabs').BottomTabNavigationOptions}
 */
export const getTabScreenCommonOptions = ({
  activeColor,
  badge,
  icon = undefined,
  label,
  labelScheme = 'light',
  renderTabBarIcon = undefined,
}) => ({
  tabBarAccessibilityLabel: label,
  tabBarActiveTintColor: activeColor,
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
      label,
      source: icon,
    }) : undefined,
  tabBarIconStyle: {
    display: icon ? 'flex' : 'none',
  },
  tabBarInactiveTintColor: getLabelColor(labelScheme, false),
  tabBarItemStyle: {
    marginTop: 8,
  },
  tabBarLabel: label,
  tabBarLabelStyle: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 10,
    lineHeight: 16,
  },
  tabBarStyle: {
    backgroundColor: getThemeColors().primary700,
    borderTopColor: getThemeColors().primary900,
    borderTopWidth: 1,
    margin: 0,
    minHeight: 70,
  },
});
