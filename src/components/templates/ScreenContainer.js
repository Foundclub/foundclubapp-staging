import { StatusBar, View } from 'react-native';
// Hooks
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useContext, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import useTheme from '../../theme/themeContext';

/**
 * The ScreenContainer component is a template for all screens in the application.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {Array<import('react-native').ViewStyle>} [props.style]
 * @param {'light' | 'dark'} [props.scheme]
 * @returns {import('react').ReactElement}
 */
function ScreenContainer({
  children,
  style = [],
  scheme = 'dark',
}) {
  // hooks
  const {
    Alignments, Spaces, ApplicationStyle, Colors, changeTheme,
  } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  // constants
  const containerSpaces = {
    marginBottom: tabBarHeight - 12 || 0,
    paddingTop: headerHeight > 0 ? 0 : insets.top,
  };

  // lifecycle
  useEffect(() => {
    // As react-navigation doesn't re-render tab main screen,
    // we need to force refresh the statusbar color with
    // a listener on the focus state of the screen
    const unsubscribe = navigation.addListener('focus', () => {
      changeTheme(scheme);
      StatusBar.setBarStyle(scheme === 'light' ? 'dark-content' : 'light-content');
    });
    return unsubscribe;
  }, [navigation, changeTheme, scheme, Colors]);

  return (
    <View
      style={[
        Alignments.fill,
        Spaces.paddingHorizontal[24],
        ApplicationStyle.backgroundColor.neutral252,
        containerSpaces,
        ...style,
      ]}
    >
      {children}
    </View>
  );
}

export default ScreenContainer;
