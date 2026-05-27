import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import { BREAKPOINTS } from '@/responsive';

const CONTENT_WIDTHS = {
  content: 960,
  form: 560,
  readable: 720,
  wide: 1180,
};

const resolveAssetUri = (source) => {
  if (!source) return null;
  if (typeof source === 'string') return source;
  if (typeof source === 'object' && typeof source.uri === 'string') return source.uri;
  return null;
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
  style = [],
  surface = 'none',
  withHeaderPadding = true,
}) {
  const {
    Alignments,
    Colors,
    Images,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const isResponsivePaddingEnabled = responsivePadding ?? responsiveHorizontalPadding;
  const safeStyle = Array.isArray(style) ? style : [style];
  const safeContentContainerStyle = Array.isArray(contentContainerStyle)
    ? contentContainerStyle
    : [contentContainerStyle];
  const isTabletOrDesktop = width >= BREAKPOINTS.tablet;
  const isDesktop = width >= BREAKPOINTS.desktop;
  let horizontalPadding = 24;
  if (isResponsivePaddingEnabled) {
    if (width >= 1440) {
      horizontalPadding = 56;
    } else if (width >= 1280) {
      horizontalPadding = 48;
    } else if (width >= BREAKPOINTS.desktop) {
      horizontalPadding = 40;
    } else if (width >= BREAKPOINTS.tablet) {
      horizontalPadding = 28;
    } else {
      horizontalPadding = 20;
    }
  }
  const resolvedContentWidth = resolveContentWidth(contentWidth);
  const shouldCenterContent = isTabletOrDesktop && desktopAlignment === 'center';
  const useSurface = isTabletOrDesktop && surface === 'card';
  let contentFramePadding = 0;
  if (useSurface) {
    contentFramePadding = isDesktop ? 40 : 28;
  }
  let centeredMinHeight;
  if (typeof desktopMinHeight === 'number') {
    centeredMinHeight = desktopMinHeight;
  } else if (desktopMinHeight !== false && shouldCenterContent) {
    centeredMinHeight = useSurface
      ? Math.max(520, Math.min(height - 96, 700))
      : Math.max(560, Math.min(height - Math.max(insets.top, 20) - 72, 760));
  }
  const backgroundColor = gradient?.[0] || Colors.primary700;
  const backgroundImageSource = Images?.[bgImage];
  const backgroundImageUri = resolveAssetUri(backgroundImageSource);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const rootStyle = document.documentElement?.style;
    if (!rootStyle) return;

    rootStyle.setProperty('--immersive-app-background-color', backgroundColor);
    rootStyle.setProperty(
      '--immersive-app-background-image',
      backgroundImageUri ? `url("${backgroundImageUri}")` : 'none',
    );
    rootStyle.setProperty('--immersive-app-background-position', 'center top');
    rootStyle.setProperty('--immersive-app-background-repeat', 'no-repeat');
    rootStyle.setProperty('--immersive-app-background-size', 'cover');
  }, [backgroundColor, backgroundImageUri]);

  const containerStyle = [
    Alignments.fill,
    Alignments.fullWidth,
    {
      backgroundColor: backgroundImageUri ? 'transparent' : backgroundColor,
      minHeight: height,
      paddingHorizontal: horizontalPadding,
      paddingTop: withHeaderPadding ? Math.max(insets.top, 20) : 0,
    },
    ...safeStyle,
  ];
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
    centeredMinHeight
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

  return (
    <View style={containerStyle}>
      <View style={overlayStyle}>
        <View style={contentFrameStyle}>
          <View style={[Alignments.grow1, ...safeContentContainerStyle]}>
            {children}
          </View>
        </View>
      </View>
    </View>
  );
}

export default ScreenContainer;
