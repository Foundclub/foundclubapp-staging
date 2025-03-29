import { ImageBackground } from 'react-native';
import { useContext } from 'react';
// Hooks
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import useTheme from '../../theme/themeContext';

/**
 * The ScreenContainer component is a template for all screens in the application.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {'bg1' | 'bg2'} [props.bgImage]
 * @param {Array<import('react-native').ViewStyle>} [props.style]
 * @returns {import('react').ReactElement}
 */
function ScreenContainer({
  children,
  style = [],
  bgImage = 'bg1',
}) {
  // hooks
  const {
    Alignments, Spaces, ApplicationStyle, Images,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  // constants
  const containerSpaces = {
    marginBottom: tabBarHeight - 12 || 0,
    paddingTop: headerHeight > 0 ? 0 : insets.top,
  };

  return (
    <ImageBackground
      source={Images[bgImage]}
      style={[
        Alignments.fill,
        Spaces.padding[24],
        ApplicationStyle.backgroundColor.neutral900,
        containerSpaces,
        ...style,
      ]}
    >
      {children}
    </ImageBackground>
  );
}

export default ScreenContainer;
