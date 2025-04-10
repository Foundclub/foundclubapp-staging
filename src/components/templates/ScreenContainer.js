import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useHeaderHeight } from '@react-navigation/elements';
import { useContext, useMemo } from 'react';
import { ImageBackground, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

/**
 * The ScreenContainer component is a template for all screens in the application.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {'bg1' | 'bg2' | 'bg3'} [props.bgImage]
 * @param {Array<import('react-native').ViewStyle>} [props.style]
 * @param {Array<import('react-native').ViewStyle>} [props.contentContainerStyle]
 * @returns {import('react').ReactElement}
 */
function ScreenContainer({
  bgImage = 'bg1',
  children,
  contentContainerStyle = [],
  style = [],
}) {
  // hooks
  const {
    Alignments, Images, Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeightNative = useHeaderHeight();
  const tabBarHeight = useContext(BottomTabBarHeightContext);

  // constants
  const containerSpaces = useMemo(() => ({
    marginBottom: tabBarHeight ? tabBarHeight - 12 : 0,
    paddingTop: headerHeightNative || insets.top,
  }), [tabBarHeight, headerHeightNative, insets.top]);

  return (
    <ImageBackground
      source={Images[bgImage]}
      style={[
        Alignments.fill,
        Spaces.padding[24],
        containerSpaces,
        ...style,
      ]}
    >
      <View style={[Alignments.grow1, ...contentContainerStyle]}>
        {children}
      </View>
    </ImageBackground>
  );
}

export default ScreenContainer;
