import { useHeaderHeight } from '@react-navigation/elements';
import { useMemo } from 'react';
import { ImageBackground, useWindowDimensions, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import { getFloatingTabBarScenePaddingBottom } from '@/navigation/commonOptions';

/**
 * The ScreenContainer component is a template for all screens in the application.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {'bg1' | 'bg2' | 'bg3'} [props.bgImage]
 * @param {Array<import('react-native').ViewStyle>} [props.style]
 * @param {Array<import('react-native').ViewStyle>} [props.contentContainerStyle]
 * @param {'none' | 'tab-scene'} [props.bottomInsetMode]
 * @param {number} [props.bottomInsetExtra]
 * @param {boolean} [props.responsiveHorizontalPadding]
 * @param {string[] | null} [props.gradient]
 * @param {boolean} [props.withHeaderPadding]
 * @returns {import('react').ReactElement}
 */
function ScreenContainer({
  bgImage = 'bg2', // Default to bg2 per user request
  bottomInsetExtra = 12,
  bottomInsetMode = 'none',
  children,
  contentContainerStyle = [],
  gradient = null, // Default to no gradient
  responsiveHorizontalPadding = false,
  responsivePadding,
  style = [],
  withHeaderPadding = true,
}) {
  // hooks
  const {
    Alignments, Images,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeightNative = useHeaderHeight();
  const { width } = useWindowDimensions();
  const isResponsivePaddingEnabled = responsivePadding ?? responsiveHorizontalPadding;
  const horizontalPadding = isResponsivePaddingEnabled && width <= 375 ? 16 : 24;
  const safeStyle = Array.isArray(style) ? style : [style];
  const safeContentContainerStyle = Array.isArray(contentContainerStyle)
    ? contentContainerStyle
    : [contentContainerStyle];

  // constants
  const containerSpaces = useMemo(() => {
    /** @type {{ paddingTop?: number, paddingBottom?: number }} */
    const nextSpaces = {};

    if (withHeaderPadding) {
      nextSpaces.paddingTop = headerHeightNative || insets.top;
    }

    if (bottomInsetMode === 'tab-scene') {
      nextSpaces.paddingBottom = getFloatingTabBarScenePaddingBottom(insets.bottom, bottomInsetExtra);
    }

    return nextSpaces;
  }, [bottomInsetExtra, bottomInsetMode, headerHeightNative, insets.bottom, insets.top, withHeaderPadding]);

  if (gradient) {
    return (
      <View style={[Alignments.fill, ...safeStyle]}>

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
          <View style={[Alignments.grow1, ...safeContentContainerStyle]}>
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
        ...safeStyle,
      ]}
    >
      <View style={[Alignments.grow1, ...safeContentContainerStyle]}>
        {children}
      </View>
    </ImageBackground>
  );
}

export default ScreenContainer;
