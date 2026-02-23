import { useHeaderHeight } from '@react-navigation/elements';
import { useMemo } from 'react';
import { ImageBackground, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

/**
 * The ScreenContainer component is a template for all screens in the application.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {'bg1' | 'bg2' | 'bg3'} [props.bgImage]
 * @param {Array<import('react-native').ViewStyle>} [props.style]
 * @param {Array<import('react-native').ViewStyle>} [props.contentContainerStyle]
 * @param {boolean} [props.responsiveHorizontalPadding]
 * @param props.gradient
 * @param props.withHeaderPadding
 * @returns {import('react').ReactElement}
 */
function ScreenContainer({
  bgImage = 'bg2', // Default to bg2 per user request
  children,
  contentContainerStyle = [],
  gradient = null, // Default to no gradient
  responsiveHorizontalPadding = false,
  style = [],
  withHeaderPadding = true,
  ...props
}) {
  // hooks
  const {
    Alignments, Images,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeightNative = useHeaderHeight();
  const { width } = useWindowDimensions();
  const horizontalPadding = responsiveHorizontalPadding && width <= 375 ? 16 : 24;

  // constants
  const containerSpaces = useMemo(() => {
    if (!withHeaderPadding) return {};
    return {
      paddingTop: headerHeightNative || insets.top,
    };
  }, [headerHeightNative, insets.top, withHeaderPadding]);

  if (gradient) {
    const LinearGradient = require('react-native-linear-gradient').default;
    return (
      <View style={[Alignments.fill, ...style]}>

        <LinearGradient
          colors={gradient}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={[
            Alignments.fill,
            { paddingHorizontal: horizontalPadding },
            containerSpaces,
          ]}
        >
          <View style={[Alignments.grow1, ...contentContainerStyle]}>
            {children}
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <ImageBackground
      resizeMode="cover"
      source={Images[bgImage]}
      style={[
        Alignments.fill,
        { paddingHorizontal: horizontalPadding },
        containerSpaces,
        ...style,
      ]}
      {...props}
    >
      <View style={[Alignments.grow1, ...contentContainerStyle]}>
        {children}
      </View>
    </ImageBackground>
  );
}

export default ScreenContainer;
