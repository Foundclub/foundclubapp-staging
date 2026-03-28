import { ImageBackground, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';
import { BREAKPOINTS } from '@/responsive';

const CONTENT_WIDTHS = {
  content: 960,
  form: 560,
  readable: 720,
  wide: 1180,
};

const resolveContentWidth = (contentWidth) => {
  if (typeof contentWidth === 'number') {
    return contentWidth;
  }

  if (contentWidth === 'full') {
    return null;
  }

  return CONTENT_WIDTHS[contentWidth] || CONTENT_WIDTHS.wide;
};

/**
 * Web-compatible screen container.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {'bg1' | 'bg2' | 'bg3' | 'bg4' | 'bg5'} [props.bgImage]
 * @param {Array<import('react-native').ViewStyle>} [props.style]
 * @param {Array<import('react-native').ViewStyle>} [props.contentContainerStyle]
 * @param {'form' | 'readable' | 'content' | 'wide' | 'full' | number} [props.contentWidth]
 * @param {'top' | 'center'} [props.desktopAlignment]
 * @param {boolean | number} [props.desktopMinHeight]
 * @param {boolean} [props.responsiveHorizontalPadding]
 * @param {boolean} [props.responsivePadding]
 * @param {string[]} [props.gradient]
 * @param {'none' | 'card'} [props.surface]
 * @param {boolean} [props.withHeaderPadding]
 * @returns {import('react').ReactElement}
 */
function ScreenContainer({
  bgImage = 'bg2',
  children,
  contentContainerStyle = [],
  contentWidth = 'wide',
  desktopAlignment = 'top',
  desktopMinHeight,
  gradient = null,
  responsiveHorizontalPadding = false,
  responsivePadding,
  surface = 'none',
  style = [],
  withHeaderPadding = true,
  ...props
}) {
  const {
    Alignments,
    Colors,
    Images,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const isResponsivePaddingEnabled = responsivePadding ?? responsiveHorizontalPadding;
  const isTabletOrDesktop = width >= BREAKPOINTS.tablet;
  const isDesktop = width >= BREAKPOINTS.desktop;
  const horizontalPadding = isResponsivePaddingEnabled
    ? width >= 1440 ? 56 : width >= 1280 ? 48 : width >= BREAKPOINTS.desktop ? 40 : width >= BREAKPOINTS.tablet ? 28 : 20
    : 24;
  const resolvedContentWidth = resolveContentWidth(contentWidth);
  const shouldCenterContent = isTabletOrDesktop && desktopAlignment === 'center';
  const useSurface = isTabletOrDesktop && surface === 'card';
  const contentFramePadding = useSurface ? (isDesktop ? 40 : 28) : 0;
  const centeredMinHeight = typeof desktopMinHeight === 'number'
    ? desktopMinHeight
    : desktopMinHeight === false
      ? undefined
      : (shouldCenterContent && useSurface ? Math.max(520, Math.min(height - 96, 700)) : undefined);

  const containerStyle = [
    Alignments.fill,
    Alignments.fullWidth,
    {
      minHeight: height,
      paddingHorizontal: horizontalPadding,
      paddingTop: withHeaderPadding ? Math.max(insets.top, 20) : 0,
    },
    style,
  ];

  const backgroundColor = gradient?.[0] || Colors.primary700;
  const backgroundImageSource = Images?.[bgImage];
  const contentFrameStyle = [
    {
      alignSelf: 'center',
      maxWidth: resolvedContentWidth || undefined,
      width: '100%',
    },
    useSurface
      ? {
        backgroundColor: 'rgba(9, 24, 35, 0.78)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 32,
        borderWidth: 1,
        boxShadow: '0 24px 72px rgba(6, 16, 26, 0.28)',
        overflow: 'hidden',
        padding: contentFramePadding,
      }
      : null,
    shouldCenterContent
      ? {
        minHeight: centeredMinHeight,
      }
      : null,
  ];
  const overlayStyle = [
    Alignments.fill,
    {
      justifyContent: shouldCenterContent ? 'center' : 'flex-start',
    },
  ];

  if (!backgroundImageSource) {
    return (
      <View style={[containerStyle, { backgroundColor }]} {...props}>
        <View style={overlayStyle}>
          <View style={contentFrameStyle}>
            <View style={[Alignments.grow1, contentContainerStyle]}>
              {children}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ImageBackground
      resizeMode="cover"
      source={backgroundImageSource}
      style={containerStyle}
      {...props}
    >
      <View style={overlayStyle}>
        <View style={contentFrameStyle}>
          <View style={[Alignments.grow1, contentContainerStyle]}>
            {children}
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

export default ScreenContainer;
